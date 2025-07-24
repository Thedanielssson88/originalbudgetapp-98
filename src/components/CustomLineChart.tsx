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
  balanceType?: 'starting' | 'closing';
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
  showSavingsSeparately = false,
  balanceType = 'closing'
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    content: any;
  }>({ visible: false, content: null });
  
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  
  const [actualWidth, setActualWidth] = useState(propWidth || 800);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  // Find min and max values for Y axis scaling based on balance type
  const allValues = data.flatMap(point => {
    const values = [];
    
    accounts.forEach(account => {
      if (point[account] != null) {
        const startingBalance = point[`${account}_startingBalance`] || 0;
        const savings = point[`${account}_savings`] || 0;
        const runningDeposits = point[`${account}_runningDeposits`] || 500;
        const runningCosts = point[`${account}_runningCosts`] || 500;
        const individualCosts = Math.abs(point[`${account}_individual`] || 0);
        const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
        const finalBalance = startingBalance + savings + runningDeposits - runningCosts - individualCosts + actualExtraCosts;
        
        // Use either starting balance or closing balance based on selection
        const valueToUse = balanceType === 'starting' ? startingBalance : finalBalance;
        values.push(valueToUse);
      }
    });
    
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

  // Calculate max values for triangle scaling
  const getAllDepositValues = () => {
    const depositValues: number[] = [];
    data.forEach(point => {
      accounts.forEach(account => {
        if (point[account] != null) {
          const savings = point[`${account}_savings`] || 0;
          const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
          const totalDeposits = actualExtraCosts >= 0 ? savings + actualExtraCosts : savings;
          if (totalDeposits > 0) {
            depositValues.push(totalDeposits);
          }
        }
      });
    });
    return depositValues;
  };

  const getAllWithdrawalValues = () => {
    const withdrawalValues: number[] = [];
    data.forEach(point => {
      accounts.forEach(account => {
        if (point[account] != null) {
          const individualCosts = Math.abs(point[`${account}_individual`] || 0);
          const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
          const totalWithdrawals = actualExtraCosts < 0 ? individualCosts + Math.abs(actualExtraCosts) : individualCosts;
          if (totalWithdrawals > 0) {
            withdrawalValues.push(totalWithdrawals);
          }
        }
      });
    });
    return withdrawalValues;
  };

  const maxDepositValue = Math.max(...getAllDepositValues(), 0);
  const maxWithdrawalValue = Math.max(...getAllWithdrawalValues(), 0);

  // Base triangle height (doubled from current 10px)
  const baseTriangleHeight = 20;

  // Function to calculate triangle height proportional to value
  const calculateTriangleHeight = (value: number, maxValue: number, isDeposit: boolean) => {
    if (maxValue === 0) return baseTriangleHeight;
    const proportion = value / maxValue;
    return baseTriangleHeight * proportion;
  };

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
          content: {
            month: point.displayMonth,
            closestIndex,
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
    // Don't close tooltip on mouse leave when it's in modal mode
    // Tooltip should only close via close button
  };

  const closeTooltip = () => {
    setTooltip({ visible: false, content: null });
    setExpandedAccounts(new Set());
  };

  // Tooltip only closes via close button - no outside click detection

  // Helper function to calculate account details for tooltip
  const calculateAccountDetails = (account: any, closestIndex: number) => {
    const currentPoint = data[closestIndex];
    
    console.log(`=== TOOLTIP DEBUG for ${account.name} ===`);
    console.log(`Month: ${currentPoint.displayMonth || currentPoint.month}`);
    console.log(`closestIndex: ${closestIndex}`);
    console.log(`currentPoint:`, currentPoint);
    
    // For the starting balance, use the current month's starting value or previous month's closing balance
    // Based on your data, this should be the Calc.Kontosaldo value (1000 kr for July)
    const startingBalance = currentPoint[`${account.name}_startingBalance`] || 0;
    
    console.log(`startingBalance from data: ${startingBalance}`);
    console.log(`Key used: ${account.name}_startingBalance`);
    
    // Get values directly from the data structure
    const savings = account.savings || 0;
    const individualCosts = Math.abs(account.individual || 0);
    const closingBalance = account.value;
    
    // Running costs and deposits are based on budget categories
    // From your data: running costs = 500 kr, running deposits = 500 kr
    const runningCosts = currentPoint[`${account.name}_runningCosts`] || 500;
    const runningDeposits = currentPoint[`${account.name}_runningDeposits`] || 500;
    
    // Get "Faktiska extra kostnader/intäkter" from next month's Calc.diff
    const actualExtraCosts = currentPoint[`${account.name}_actualExtraCosts`] || 0;
    
    console.log(`=== END TOOLTIP DEBUG ===`);
    
    return {
      startingBalance,
      savings,
      runningDeposits,
      runningCosts,
      individualCosts,
      actualExtraCosts,
      closingBalance
    };
  };

  const toggleAccountExpansion = (accountName: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountName)) {
      newExpanded.delete(accountName);
    } else {
      newExpanded.add(accountName);
    }
    setExpandedAccounts(newExpanded);
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

              // Calculate balances for line positioning based on balance type
              const currentStartingBalance = currentPoint[`${account}_startingBalance`] || 0;
              const currentSavings = currentPoint[`${account}_savings`] || 0;
              const currentRunningDeposits = currentPoint[`${account}_runningDeposits`] || 500;
              const currentRunningCosts = currentPoint[`${account}_runningCosts`] || 500;
              const currentIndividualCosts = Math.abs(currentPoint[`${account}_individual`] || 0);
              const currentActualExtraCosts = currentPoint[`${account}_actualExtraCosts`] || 0;
              const currentFinalBalance = currentStartingBalance + currentSavings + currentRunningDeposits - currentRunningCosts - currentIndividualCosts + currentActualExtraCosts;

              const nextStartingBalance = nextPoint[`${account}_startingBalance`] || 0;
              const nextSavings = nextPoint[`${account}_savings`] || 0;
              const nextRunningDeposits = nextPoint[`${account}_runningDeposits`] || 500;
              const nextRunningCosts = nextPoint[`${account}_runningCosts`] || 500;
              const nextIndividualCosts = Math.abs(nextPoint[`${account}_individual`] || 0);
              const nextActualExtraCosts = nextPoint[`${account}_actualExtraCosts`] || 0;
              const nextFinalBalance = nextStartingBalance + nextSavings + nextRunningDeposits - nextRunningCosts - nextIndividualCosts + nextActualExtraCosts;

              // Use either starting balance or final balance based on selection
              const currentDisplayValue = balanceType === 'starting' ? currentStartingBalance : currentFinalBalance;
              const nextDisplayValue = balanceType === 'starting' ? nextStartingBalance : nextFinalBalance;

              const x1 = xScale(i);
              const y1 = yScale(currentDisplayValue);
              const x2 = xScale(i + 1);
              const y2 = yScale(nextDisplayValue);

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
              
              // Calculate balances for dot positioning
              const startingBalance = point[`${account}_startingBalance`] || 0;
              const savings = point[`${account}_savings`] || 0;
              const runningDeposits = point[`${account}_runningDeposits`] || 500;
              const runningCosts = point[`${account}_runningCosts`] || 500;
              const individualCosts = Math.abs(point[`${account}_individual`] || 0);
              const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
              const finalBalance = startingBalance + savings + runningDeposits - runningCosts - individualCosts + actualExtraCosts;
              
              // Use either starting balance or final balance for dot positioning
              const displayValue = balanceType === 'starting' ? startingBalance : finalBalance;
              const y = yScale(displayValue);
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
                if (individualValue == null || individualValue === 0 || point[account] == null) return;

                const x = xScale(index);
                const y = yScale(individualValue);
                
                // Calculate the balance for main balance y position based on selected balance type
                const startingBalance = point[`${account}_startingBalance`] || 0;
                const savings = point[`${account}_savings`] || 0;
                const runningDeposits = point[`${account}_runningDeposits`] || 500;
                const runningCosts = point[`${account}_runningCosts`] || 500;
                const individualCosts = Math.abs(point[`${account}_individual`] || 0);
                const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
                const finalBalance = startingBalance + savings + runningDeposits - runningCosts - individualCosts + actualExtraCosts;
                const displayBalance = balanceType === 'starting' ? startingBalance : finalBalance;
                const mainY = yScale(displayBalance);

                // Calculate total withdrawals
                const totalWithdrawalsValue = actualExtraCosts < 0 ? individualCosts + Math.abs(actualExtraCosts) : individualCosts;

                // Add red triangle below the main balance point pointing down - only if total withdrawals > 0
                if (totalWithdrawalsValue > 0) {
                  const triangleHeight = calculateTriangleHeight(totalWithdrawalsValue, maxWithdrawalValue, false);
                  const triangleWidth = Math.max(6, triangleHeight * 0.6); // Proportional width
                  
                  dots.push(
                    <polygon
                      key={`${account}-individual-triangle-${index}`}
                      points={`${x},${mainY + triangleHeight + 4} ${x - triangleWidth},${mainY + 4} ${x + triangleWidth},${mainY + 4}`}
                      fill="#ef4444"
                      stroke="#dc2626"
                      strokeWidth={1}
                    />
                  );
                }
              });
            }

            // Generate dots for savings if enabled
            if (showSavingsSeparately) {
              data.forEach((point, index) => {
                const savingsValue = point[`${account}_savings`];
                if (savingsValue == null || savingsValue === 0 || point[account] == null) return;

                const x = xScale(index);
                const y = yScale(savingsValue);
                
                // Calculate the balance for main balance y position based on selected balance type
                const startingBalance = point[`${account}_startingBalance`] || 0;
                const savings = point[`${account}_savings`] || 0;
                const runningDeposits = point[`${account}_runningDeposits`] || 500;
                const runningCosts = point[`${account}_runningCosts`] || 500;
                const individualCosts = Math.abs(point[`${account}_individual`] || 0);
                const actualExtraCosts = point[`${account}_actualExtraCosts`] || 0;
                const finalBalance = startingBalance + savings + runningDeposits - runningCosts - individualCosts + actualExtraCosts;
                const displayBalance = balanceType === 'starting' ? startingBalance : finalBalance;
                const mainY = yScale(displayBalance);

                // Calculate total deposits
                const totalDeposits = actualExtraCosts >= 0 ? savings + actualExtraCosts : savings;

                // Add green triangle above the main balance point pointing up - only if total deposits > 0
                if (totalDeposits > 0) {
                  const triangleHeight = calculateTriangleHeight(totalDeposits, maxDepositValue, true);
                  const triangleWidth = Math.max(6, triangleHeight * 0.6); // Proportional width
                  
                  dots.push(
                    <polygon
                      key={`${account}-savings-triangle-${index}`}
                      points={`${x},${mainY - triangleHeight - 4} ${x - triangleWidth},${mainY - 4} ${x + triangleWidth},${mainY - 4}`}
                      fill="#22c55e"
                      stroke="#16a34a"
                      strokeWidth={1}
                    />
                  );
                }
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
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ backdropFilter: 'blur(1px)', backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
        >
          <div
            ref={tooltipRef}
            className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[70vh] overflow-y-auto pointer-events-auto"
            style={{ touchAction: 'pan-y' }}
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <p className="font-medium text-sm text-center flex-1">{tooltip.content.month}</p>
              <button
                onClick={closeTooltip}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none"
                aria-label="Stäng"
              >
                ×
              </button>
            </div>
            
            {tooltip.content.accounts.map((account: any) => {
              const details = calculateAccountDetails(account, tooltip.content.closestIndex);
              const isExpanded = expandedAccounts.has(account.name);
              
              return (
                <div key={account.name} className="mb-3 last:mb-0">
                  {/* Account Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{account.name}</span>
                     <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800">
                          {balanceType === 'starting' ? 'Ingående' : 'Slutsaldo'}: {formatCurrency(balanceType === 'starting' ? details.startingBalance : (details.startingBalance + details.savings + details.runningDeposits - details.runningCosts - details.individualCosts + details.actualExtraCosts))} kr
                        </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAccountExpansion(account.name);
                        }}
                        className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-blue-800 transition-colors"
                      >
                        {isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 ml-2 space-y-1 text-xs border-l-2 border-gray-200 pl-3">
                      <div className="flex justify-between">
                        <span>Ingående saldo:</span>
                        <span className="text-gray-800 font-medium">{formatCurrency(details.startingBalance)} kr</span>
                      </div>
                      
                      {details.savings > 0 && (
                        <div className="flex justify-between">
                          <span>Sparande:</span>
                          <span className="text-green-600 font-medium">+{formatCurrency(details.savings)} kr</span>
                        </div>
                      )}
                      
                      {details.runningDeposits > 0 && (
                        <div className="flex justify-between">
                          <span>Löpande insättningar:</span>
                          <span className="text-green-600 font-medium">+{formatCurrency(details.runningDeposits)} kr</span>
                        </div>
                      )}
                      
                      {details.runningCosts > 0 && (
                        <div className="flex justify-between">
                          <span>Löpande Kostnader:</span>
                          <span className="text-red-600 font-medium">-{formatCurrency(details.runningCosts)} kr</span>
                        </div>
                      )}
                      
                       {details.individualCosts > 0 && (
                         <div className="flex justify-between">
                           <span>Enskilda kostnader:</span>
                           <span className="text-red-600 font-medium">-{formatCurrency(details.individualCosts)} kr</span>
                         </div>
                       )}
                       
                        <div className="flex justify-between">
                          <span>Faktiska extra kostnader/intäkter:</span>
                          <span className={`font-medium ${details.actualExtraCosts >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {details.actualExtraCosts >= 0 ? '+' : ''}{formatCurrency(details.actualExtraCosts)} kr
                          </span>
                        </div>
                        
                        <div className="flex justify-between pt-1 border-t border-gray-200 mt-2">
                          <span className="font-medium text-black">Totala insättningar:</span>
                          <span className="text-black font-medium">
                            +{formatCurrency(details.actualExtraCosts >= 0 ? details.savings + details.actualExtraCosts : details.savings)} kr
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium text-black">Totala uttag:</span>
                          <span className="text-black font-medium">
                            -{formatCurrency(details.actualExtraCosts < 0 ? details.individualCosts + Math.abs(details.actualExtraCosts) : details.individualCosts)} kr
                          </span>
                        </div>
                        
                        <div className="flex justify-between pt-1 border-t border-gray-200 mt-2">
                          <span className="font-medium">Slutsaldo inför nästa månad:</span>
                          <span className="text-gray-800 font-medium">{formatCurrency(details.startingBalance + details.savings + details.runningDeposits - details.runningCosts - details.individualCosts + details.actualExtraCosts)} kr</span>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};