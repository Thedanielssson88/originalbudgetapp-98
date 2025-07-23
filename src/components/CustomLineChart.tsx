import React, { useState, useRef, useEffect } from 'react';
import { CustomLineSegment } from './CustomLineSegment';

interface ChartDataPoint {
  [key: string]: any;
  displayMonth?: string;
}

interface CustomLineChartProps {
  data: ChartDataPoint[];
  accounts: string[];
  accountColors: string[];
  showEstimatedBudgetAmounts: boolean;
  width: number; // Can be 0 for auto-sizing
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  formatCurrency: (value: number) => string;
  showIndividualCostsOutsideBudget?: boolean;
  showSavingsSeparately?: boolean;
}

export const CustomLineChart: React.FC<CustomLineChartProps> = ({
  data,
  accounts,
  accountColors,
  showEstimatedBudgetAmounts,
  width: propWidth,
  height,
  margin,
  formatCurrency,
  showIndividualCostsOutsideBudget = false,
  showSavingsSeparately = false
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: any;
  }>({ visible: false, x: 0, y: 0, content: null });
  
  const [actualWidth, setActualWidth] = useState(propWidth || 800);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use ResizeObserver to detect container width changes
  useEffect(() => {
    if (!containerRef.current || propWidth > 0) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setActualWidth(Math.max(width, 300)); // Minimum width of 300px
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [propWidth]);

  const width = propWidth || actualWidth;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Find min and max values for Y axis scaling (include individual costs and savings if enabled)
  const allValues = data.flatMap(point => {
    const values = [];
    const mainValues = accounts.map(account => point[account]).filter(val => val != null);
    values.push(...mainValues);
    
    if (showIndividualCostsOutsideBudget) {
      const individualValues = accounts.map(account => point[`${account}_individual`]).filter(val => val != null);
      values.push(...individualValues);
    }
    if (showSavingsSeparately) {
      const savingsValues = accounts.map(account => point[`${account}_savings`]).filter(val => val != null);
      values.push(...savingsValues);
    }
    return values;
  });
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue;
  const padding = valueRange * 0.1; // 10% padding
  const yMin = minValue - padding;
  const yMax = maxValue + padding;

  // Scale functions
  const xScale = (index: number) => (index / (data.length - 1)) * chartWidth;
  const yScale = (value: number) => chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

  // Generate Y axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = yMin + (yMax - yMin) * (i / tickCount);
    yTicks.push({
      value,
      y: yScale(value)
    });
  }

  // Generate grid lines
  const gridLines = yTicks.map(tick => (
    <line
      key={tick.value}
      x1={0}
      y1={tick.y}
      x2={chartWidth}
      y2={tick.y}
      stroke="#e0e0e0"
      strokeDasharray="3 3"
      strokeWidth={1}
    />
  ));

  // Generate X axis labels
  const xAxisLabels = data.map((point, index) => (
    <text
      key={index}
      x={xScale(index)}
      y={chartHeight + 20}
      textAnchor="middle"
      fontSize="12"
      fill="#666"
      transform={`rotate(-45 ${xScale(index)} ${chartHeight + 20})`}
    >
      {point.displayMonth}
    </text>
  ));

  // Generate Y axis labels
  const yAxisLabels = yTicks.map(tick => (
    <text
      key={tick.value}
      x={-10}
      y={tick.y + 4}
      textAnchor="end"
      fontSize="12"
      fill="#666"
    >
      {formatCurrency(tick.value)}
    </text>
  ));

  // Handle mouse events for tooltip
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - margin.left;
    const mouseY = event.clientY - rect.top - margin.top;
    
    // Find closest data point
    const closestIndex = Math.round((mouseX / chartWidth) * (data.length - 1));
    if (closestIndex >= 0 && closestIndex < data.length) {
      const point = data[closestIndex];
      const accountsWithData = accounts.filter(account => point[account] != null);
      
      if (accountsWithData.length > 0) {
        setTooltip({
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          content: {
            month: point.displayMonth,
              accounts: accountsWithData.map(account => ({
                name: account,
                value: point[account],
                isEstimated: point[`${account}_isEstimated`],
                individual: point[`${account}_individual`],
                savings: point[`${account}_savings`]
              }))
          }
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width} 
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair' }}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          {gridLines}
          
          {/* Chart lines and segments */}
          {accounts.map((account, accountIndex) => {
            const accountColor = accountColors[accountIndex % accountColors.length];
            const segments = [];
            const dots = [];

            // Generate main account line segments
            for (let i = 0; i < data.length - 1; i++) {
              const currentPoint = data[i];
              const nextPoint = data[i + 1];

              // Skip if either point doesn't have data for this account
              if (currentPoint[account] == null || nextPoint[account] == null) continue;

              const x1 = xScale(i);
              const y1 = yScale(currentPoint[account]);
              const x2 = xScale(i + 1);
              const y2 = yScale(nextPoint[account]);

              let strokeDasharray = undefined; // solid by default

              if (showEstimatedBudgetAmounts) {
                const currentIsEstimated = currentPoint[`${account}_isEstimated`];
                const nextIsEstimated = nextPoint[`${account}_isEstimated`];

                // Line from non-estimated to estimated should be dashed
                // Line from estimated to non-estimated should also be dashed
                // Line from estimated to estimated should also be dashed
                if ((!currentIsEstimated && nextIsEstimated) || 
                    (currentIsEstimated && !nextIsEstimated) ||
                    (currentIsEstimated && nextIsEstimated)) {
                  strokeDasharray = "5 5";
                }
                // Only lines between two non-estimated values are solid
              }

              segments.push(
                <CustomLineSegment
                  key={`${account}-segment-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={accountColor}
                  strokeWidth={2}
                  strokeDasharray={strokeDasharray}
                />
              );
            }

            // Individual costs don't have line segments - only markers

            // Generate dots for main account values
            data.forEach((point, index) => {
              if (point[account] == null) return;

              const x = xScale(index);
              const y = yScale(point[account]);
              const isEstimated = point[`${account}_isEstimated`];

              if (showEstimatedBudgetAmounts && isEstimated) {
                // Special dot for estimated values
                dots.push(
                  <circle
                    key={`${account}-dot-${index}`}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={accountColor}
                    stroke={accountColor}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                );
              } else {
                // Regular dot for non-estimated values
                dots.push(
                  <circle
                    key={`${account}-dot-${index}`}
                    cx={x}
                    cy={y}
                    r={3}
                    fill={accountColor}
                  />
                );
              }
            });

            // Generate dots for individual costs if enabled
            if (showIndividualCostsOutsideBudget) {
              data.forEach((point, index) => {
                const individualValue = point[`${account}_individual`];
                if (individualValue == null || individualValue === 0) return;

                const x = xScale(index);
                const y = yScale(individualValue);

                dots.push(
                  <circle
                    key={`${account}-individual-dot-${index}`}
                    cx={x}
                    cy={y}
                    r={6}
                    fill="#ef4444"
                    stroke="#dc2626"
                    strokeWidth={2}
                  />
                );

                // Add red triangle below the circle pointing down
                dots.push(
                  <polygon
                    key={`${account}-individual-triangle-${index}`}
                    points={`${x},${y + 12} ${x - 6},${y + 22} ${x + 6},${y + 22}`}
                    fill="#ef4444"
                    stroke="#dc2626"
                    strokeWidth={1}
                  />
                );
              });
            }

            // Generate dots for savings if enabled
            if (showSavingsSeparately) {
              data.forEach((point, index) => {
                const savingsValue = point[`${account}_savings`];
                if (savingsValue == null || savingsValue === 0) return;

                const x = xScale(index);
                const y = yScale(savingsValue);

                dots.push(
                  <circle
                    key={`${account}-savings-dot-${index}`}
                    cx={x}
                    cy={y}
                    r={8}
                    fill="#22c55e"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                );

                // Add green triangle above the circle pointing up
                dots.push(
                  <polygon
                    key={`${account}-savings-triangle-${index}`}
                    points={`${x},${y - 14} ${x - 6},${y - 24} ${x + 6},${y - 24}`}
                    fill="#22c55e"
                    stroke="#16a34a"
                    strokeWidth={1}
                  />
                );
              });
            }

            return [segments, dots];
          })}

          {/* X axis */}
          <line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#666"
            strokeWidth={1}
          />

          {/* Y axis */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke="#666"
            strokeWidth={1}
          />

          {/* Y axis labels */}
          {yAxisLabels}
        </g>

        {/* X axis labels */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {xAxisLabels}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip.visible && tooltip.content && (
        <div
          className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-2 max-w-xs z-10 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: tooltip.x > width / 2 ? 'translateX(-100%)' : 'none'
          }}
        >
          <p className="font-medium text-sm mb-1">{tooltip.content.month}</p>
          {tooltip.content.accounts.map((account: any) => (
            <div key={account.name}>
              <div className="text-sm">
                <span>
                  {showEstimatedBudgetAmounts && account.isEstimated ? 
                    `${account.name} (Estimerat)` : account.name}: {formatCurrency(account.value)} kr
                </span>
              </div>
              {showIndividualCostsOutsideBudget && account.individual != null && (
                <div className="text-sm text-red-600">
                  <span>
                    {account.name} (Enskilda Kostnader): {formatCurrency(account.individual)} kr
                  </span>
                </div>
              )}
              {showSavingsSeparately && account.savings != null && (
                <div className="text-sm text-green-600">
                  <span>
                    {account.name} (Sparande): {formatCurrency(account.savings)} kr
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};