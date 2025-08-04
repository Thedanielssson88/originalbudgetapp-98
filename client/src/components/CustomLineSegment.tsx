import React from 'react';

interface CustomLineSegmentProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export const CustomLineSegment: React.FC<CustomLineSegmentProps> = ({
  x1,
  y1,
  x2,
  y2,
  stroke,
  strokeWidth,
  strokeDasharray
}) => {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      fill="none"
    />
  );
};