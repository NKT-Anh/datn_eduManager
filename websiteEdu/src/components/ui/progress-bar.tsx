import React from "react";

export interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  color?: string;
  height?: number | string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, className = "", color = "#2563eb", height = 8 }) => {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={`relative w-full rounded-full bg-gray-200 overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="absolute left-0 top-0 rounded-full transition-all duration-300"
        style={{
          width: `${percent}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color} 60%, #60a5fa 100%)`,
        }}
      />
      <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium select-none">
        {percent}%
      </div>
    </div>
  );
};
