"use client";

import { AlertTriangle, Shield, Info } from "lucide-react";
import { motion } from "framer-motion";

interface RiskAlertProps {
  score: number;
  flags?: string[];
  onDismiss?: () => void;
}

export default function RiskAlert({ score, flags = [], onDismiss }: RiskAlertProps) {
  if (score < 70) return null;

  const getSeverity = (score: number) => {
    if (score >= 85) return { level: "critical", color: "border-red-500/50 bg-red-500/10 text-red-400", icon: AlertTriangle };
    if (score >= 70) return { level: "warning", color: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400", icon: Shield };
    return { level: "info", color: "border-blue-500/50 bg-blue-500/10 text-blue-400", icon: Info };
  };

  const severity = getSeverity(score);
  const Icon = severity.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-2xl p-4 ${severity.color} relative`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest">
              {severity.level === "critical" ? "High Risk Detected" : "Manipulation Warning"}
            </h4>
            <span className="text-[10px] opacity-70">Risk Score: {score}</span>
          </div>
          <p className="text-[10px] opacity-80 leading-relaxed">
            This market has been flagged for suspicious activity. Exercise caution before placing bets.
          </p>
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {flags.map((flag, i) => (
                <span
                  key={i}
                  className="text-[8px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 uppercase tracking-wider"
                >
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[10px] opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}
