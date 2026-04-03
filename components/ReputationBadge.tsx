"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Award, Star } from "lucide-react";

interface ReputationBadgeProps {
  score: number;
  tier: "Novice" | "Intermediate" | "Expert" | "Master";
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

const tierConfig = {
  Novice: {
    color: "text-gray-400 border-gray-500/50",
    bg: "bg-gray-500/10",
    icon: Shield,
  },
  Intermediate: {
    color: "text-blue-400 border-blue-500/50",
    bg: "bg-blue-500/10",
    icon: TrendingUp,
  },
  Expert: {
    color: "text-purple-400 border-purple-500/50",
    bg: "bg-purple-500/10",
    icon: Award,
  },
  Master: {
    color: "text-yellow-400 border-yellow-500/50",
    bg: "bg-yellow-500/10",
    icon: Star,
  },
};

export default function ReputationBadge({
  score,
  tier,
  size = "md",
  showScore = true,
}: ReputationBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-[9px] px-2 py-0.5",
    md: "text-[10px] px-3 py-1",
    lg: "text-xs px-4 py-1.5",
  };

  const iconSizes = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
  };

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${config.bg} ${sizeClasses[size]} font-black uppercase tracking-widest flex items-center gap-1.5`}
    >
      <Icon className={iconSizes[size]} />
      {tier}
      {showScore && <span className="ml-1 opacity-70">({score})</span>}
    </Badge>
  );
}
