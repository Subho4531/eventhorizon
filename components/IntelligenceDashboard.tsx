"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  Shield,
  Clock,
  DollarSign,
  Activity,
  Users,
  Loader2,
  Terminal,
  Cpu,
  Zap
} from "lucide-react";

interface DashboardMetrics {
  activeMarkets: number;
  totalLiquidity: number;
  volume24h: number;
  highRiskMarkets: number;
  pendingDisputes: number;
  oracleMetrics: {
    avgResolutionTime: number;
    avgReliability: number;
  };
  totalUsers: number;
}

interface Alert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
}

export default function IntelligenceDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch("/api/analytics/dashboard"),
        fetch("/api/alerts"),
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center bg-[#0D0D0D] border border-white/5 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF8C00] mx-auto mb-4" />
        <span className="text-[10px] text-white/20 uppercase font-black tracking-[0.5em]">BOOTING INTEL MODULE...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="py-20 text-center bg-[#0D0D0D] border border-red-500/20 font-mono text-red-500 text-[10px] font-black uppercase tracking-widest">
        CRITICAL ERROR: DATA STREAM OFFLINE
      </div>
    );
  }

  const severityStyles = {
    INFO: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    WARNING: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    CRITICAL: "border-red-500/30 bg-red-500/5 text-red-500",
  };

  return (
    <div className="space-y-10 font-mono">
      <div className="flex items-center justify-between bg-[#0D0D0D] border border-white/10 p-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-[#FF8C00]" />
            <h2 className="text-xl font-black text-white uppercase tracking-[0.1em] italic">INTELLIGENCE CORE</h2>
          </div>
          <p className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-bold pl-8">CONTINUOUS THREAT ASSESSMENT ACTIVE</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[8px] text-white/20 uppercase font-black tracking-widest">SYSTEM STATUS</div>
            <div className="text-[10px] text-[#00C853] font-black uppercase tracking-widest">[NOMINAL]</div>
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "ACTIVE HORIZONS", value: metrics.activeMarkets, icon: Activity, color: "text-blue-400" },
          { label: "LIQUIDITY POOL", value: `${metrics.totalLiquidity.toLocaleString()} XLM`, icon: DollarSign, color: "text-[#00C853]" },
          { label: "24H TX VOLUME", value: `${metrics.volume24h.toLocaleString()} XLM`, icon: TrendingUp, color: "text-purple-400" },
          { label: "TOTAL NODES", value: metrics.totalUsers, icon: Users, color: "text-yellow-400" }
        ].map((m, i) => (
          <motion.div 
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0D0D0D] border border-white/10 p-8 hover:border-white/20 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <m.icon className={`w-5 h-5 ${m.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
              <div className="text-[8px] text-white/20 font-black tracking-[0.2em] uppercase italic">METRIC_00{i+1}</div>
            </div>
            <div className="text-2xl font-black text-white tracking-tighter mb-2">{m.value}</div>
            <div className="text-[9px] text-white/40 font-black uppercase tracking-widest italic">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Risk Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0D0D0D] border border-red-500/20 p-8">
          <div className="flex justify-between items-start mb-6">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span className="text-[8px] text-red-500 font-black tracking-widest border border-red-500/30 px-2 py-0.5">HIGH ALERT</span>
          </div>
          <div className="text-4xl font-black text-red-500 tracking-tighter mb-2">{metrics.highRiskMarkets}</div>
          <div className="text-[10px] text-red-500/40 font-black uppercase tracking-widest">ANOMALOUS MARKETS</div>
        </div>

        <div className="bg-[#0D0D0D] border border-yellow-500/20 p-8">
          <div className="flex justify-between items-start mb-6">
            <Shield className="w-6 h-6 text-yellow-500" />
            <span className="text-[8px] text-yellow-500 font-black tracking-widest border border-yellow-500/30 px-2 py-0.5">DISPUTE LOG</span>
          </div>
          <div className="text-4xl font-black text-yellow-500 tracking-tighter mb-2">{metrics.pendingDisputes}</div>
          <div className="text-[10px] text-yellow-500/40 font-black uppercase tracking-widest">PENDING RESOLUTIONS</div>
        </div>

        <div className="bg-[#0D0D0D] border border-blue-500/20 p-8">
          <div className="flex justify-between items-start mb-6">
            <Clock className="w-6 h-6 text-blue-400" />
            <span className="text-[8px] text-blue-400 font-black tracking-widest border border-blue-400/30 px-2 py-0.5">SYNC FREQUENCY</span>
          </div>
          <div className="text-4xl font-black text-blue-400 tracking-tighter mb-2">{metrics.oracleMetrics.avgResolutionTime.toFixed(1)}H</div>
          <div className="text-[10px] text-blue-400/40 font-black uppercase tracking-widest">AVG RESPONSE TIME</div>
          <div className="mt-4 text-[8px] text-white/20 font-black uppercase tracking-[0.2em]">ORACLE RELIABILITY: {(metrics.oracleMetrics.avgReliability * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Alert Stream */}
      <div className="bg-[#0D0D0D] border border-white/10 overflow-hidden">
        <div className="p-8 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#FF8C00]" />
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">REALTIME SIGNAL STREAM</h3>
          </div>
          <div className="text-[9px] text-white/20 font-black uppercase tracking-widest">SHOWING LATEST{alerts.length}_EVENTS</div>
        </div>
        <div className="p-8">
          {alerts.length === 0 ? (
            <div className="py-12 text-center">
              <Terminal className="w-8 h-8 text-white/5 mx-auto mb-4" />
              <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">NO ACTIVE SIGNALS DETECTED</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {alerts.slice(0, 10).map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`border-l-4 p-5 ${severityStyles[alert.severity]} transition-all hover:bg-white/[0.02]`}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest">[{alert.severity}]</span>
                          <span className="text-[8px] opacity-40 font-bold uppercase tracking-[0.2em]">{alert.type.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-[11px] font-black leading-relaxed italic">{alert.message}</p>
                      </div>
                      <span className="text-[9px] opacity-30 font-black whitespace-nowrap">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
