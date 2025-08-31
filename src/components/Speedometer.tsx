import React from 'react';

interface SpeedometerProps {
  score: number; // 0-100
  size?: number;
}

export default function Speedometer({ score, size = 200 }: SpeedometerProps) {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));
  
  // Calculate angle for the needle (0 degrees = left, 180 degrees = right)
  const angle = (clampedScore / 100) * 180;
  
  // Color based on score
  const getColor = (score: number) => {
    if (score < 30) return '#ef4444'; // red
    if (score < 60) return '#f59e0b'; // amber
    return '#10b981'; // green
  };
  
  const color = getColor(clampedScore);
  const radius = size / 2 - 20;
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Create arc path for the speedometer background
  const createArc = (startAngle: number, endAngle: number, radius: number) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };
  
  function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
  
  // Needle coordinates
  const needleEnd = polarToCartesian(centerX, centerY, radius - 10, angle);
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.6} className="overflow-visible">
        {/* Background arc */}
        <path
          d={createArc(0, 180, radius)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Colored sections */}
        <path
          d={createArc(0, 54, radius)} // 0-30% red
          fill="none"
          stroke="#fecaca"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={createArc(54, 108, radius)} // 30-60% amber
          fill="none"
          stroke="#fed7aa"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={createArc(108, 180, radius)} // 60-100% green
          fill="none"
          stroke="#bbf7d0"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Score arc */}
        <path
          d={createArc(0, angle, radius)}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r="6"
          fill="#374151"
        />
        
        {/* Score labels */}
        <text x={centerX - radius + 10} y={centerY + 5} textAnchor="middle" className="text-sm font-medium fill-gray-600">0</text>
        <text x={centerX} y={centerY - radius + 20} textAnchor="middle" className="text-sm font-medium fill-gray-600">50</text>
        <text x={centerX + radius - 10} y={centerY + 5} textAnchor="middle" className="text-sm font-medium fill-gray-600">100</text>
      </svg>
      
      <div className="text-center mt-2">
        <div className="text-3xl font-bold" style={{ color }}>
          {Math.round(clampedScore)}
        </div>
        <div className="text-sm text-gray-600">Authenticity Score</div>
      </div>
    </div>
  );
}