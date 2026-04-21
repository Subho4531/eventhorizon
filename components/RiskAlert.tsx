"use client";

import { AlertTriangle, Shield, Info, Cpu, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface RiskAlertProps {
  score: number;
  flags?: string[];
  onDismiss?: () => void;
}

export default function RiskAlert({ score, flags = [], onDismiss }: RiskAlertProps) {
  if (score < 40) return null; // Show for more markets now

  const isCritical = score >= 85;
  const isWarning = score >= 70;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative overflow-hidden border ${
        isCritical ? "border-red-500 bg-red-500/5" : "border-[#FF8C00]/40 bg-[#0D0D0D]"
      } p-5 font-mono shadow-2xl shadow-black/50`}
    >
      {/* Scanning effect */}
      <div className={`absolute top-0 left-0 w-full h-[1px] ${isCritical ? "bg-red-500/40" : "bg-[#FF8C00]/40"} animate-scan pointer-events-none`} />
      
      <div className="relative z-10 flex flex-col gap-4">
        {/* Header with AI Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`px-2 py-0.5 border ${isCritical ? "border-red-500 bg-red-500/10 text-red-500" : "border-[#FF8C00]/30 bg-[#FF8C00]/5 text-[#FF8C00]"} text-[8px] font-black tracking-widest flex items-center gap-2`}>
              <Cpu className="w-2.5 h-2.5" />
              AI INFERENCE ENGINE
            </div>
            <div className="text-[7px] text-white/20 font-black tracking-widest uppercase">MODEL: GPT-OSS:120B-CLOUD</div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-white/20 hover:text-white transition-colors">
              <span className="text-[9px] font-black tracking-tighter">[ACK]</span>
            </button>
          )}
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            <div className={`w-3 h-3 rounded-sm ${isCritical ? "bg-red-500 animate-pulse" : "bg-[#FF8C00]"} border border-white/20 shadow-[0_0_10px_rgba(255,140,0,0.3)]`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-[11px] font-black tracking-[0.1em] uppercase italic ${
                isCritical ? "text-red-500" : "text-[#FF8C00]"
              }`}>
                {isCritical ? "CRITICAL ANOMALY DETECTED" : "HEURISTIC RISK WARNING"}
              </h4>
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-white/20" />
                <span className={`text-[12px] font-black ${isCritical ? "text-red-500" : "text-white"}`}>
                  {score.toFixed(0)}<span className="text-[8px] opacity-40 ml-0.5">%</span>
                </span>
              </div>
            </div>

            <p className="text-[10px] text-white/60 leading-relaxed mb-4 font-bold uppercase tracking-tight">
              {isCritical 
                ? "PROTOCOL SIGMA: HIGH PROBABILITY OF MARKET MANIPULATION. SOURCE VOTING PATTERNS IRREGULAR."
                : "SIGNAL DETECTED: UNUSUAL LIQUIDITY SHIFT. PROCEED WITH CALIBRATED CAUTION."}
            </p>

            {flags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                {flags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-[7px] px-2 py-1 border border-white/10 bg-white/5 text-white/40 uppercase font-black tracking-widest"
                  >
                    TAG ID:{flag.replace(/_/g, "::")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative hardware aesthetics */}
      <div className={`absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 ${isCritical ? "border-red-500/40" : "border-[#FF8C00]/20"}`} />
      <div className="absolute top-0 right-0 w-2 h-2 bg-white/5" />
    </motion.div>
  );
}
