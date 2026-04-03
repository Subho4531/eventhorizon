"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface QualityIndicatorProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function QualityIndicator({
  score,
  size = "md",
  showLabel = true,
}: QualityIndicatorProps) {
  const getQualityLevel = (score: number) => {
    if (score >= 70) return { label: "High", color: "text-green-400", icon: CheckCircle };
    if (score >= 40) return { label: "Medium", color: "text-yellow-400", icon: AlertTriangle };
    return { label: "Low", color: "text-red-400", icon: XCircle };
  };

  const quality = getQualityLevel(score);
  const Icon = quality.icon;

  const sizeClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <div className={`flex items-center gap-1.5 ${quality.color} ${sizeClasses[size]} font-bold uppercase tracking-widest`}>
      <Icon className={iconSizes[size]} />
      {showLabel && (
        <>
          <span>{quality.label}</span>
          <span className="opacity-60">({score})</span>
        </>
      )}
    </div>
  );
}
