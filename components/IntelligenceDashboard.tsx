"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  Shield,
  Clock,
  DollarSign,
  Activity,
  Users,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface DashboardMetrics {
  activeMarkets: number;
  totalLiquidity: number;
  volume24h: number;
  highRiskMarkets: number;
  pendingDisputes: number;
  avgOracleReliability: number;
  avgResolutionTime: number;
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
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch("/api/analytics/dashboard"),
        fetch("/api/alerts"),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-20 text-white/40">
        Failed to load dashboard metrics
      </div>
    );
  }

  const severityColors = {
    INFO: "border-blue-500/50 bg-blue-500/10 text-blue-400",
    WARNING: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
    CRITICAL: "border-red-500/50 bg-red-500/10 text-red-400",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Intelligence Dashboard</h2>
        <p className="text-[10px] text-white/40 uppercase tracking-widest">
          Real-time platform analytics and monitoring
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.activeMarkets}
                </span>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
                Active Markets
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.totalLiquidity.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
                Total Liquidity (XLM)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.volume24h.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
                24h Volume (XLM)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="w-5 h-5 text-yellow-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.totalUsers}
                </span>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
                Total Users
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Risk & Disputes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-3xl font-bold text-red-400">
                {metrics.highRiskMarkets}
              </span>
            </div>
            <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
              High Risk Markets
            </p>
            <p className="text-[9px] text-white/40 mt-2">Risk score &gt; 60</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="w-5 h-5 text-yellow-400" />
              <span className="text-3xl font-bold text-yellow-400">
                {metrics.pendingDisputes}
              </span>
            </div>
            <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
              Pending Disputes
            </p>
            <p className="text-[9px] text-white/40 mt-2">Active voting periods</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-3xl font-bold text-blue-400">
                {metrics.avgResolutionTime.toFixed(1)}h
              </span>
            </div>
            <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
              Avg Resolution Time
            </p>
            <p className="text-[9px] text-white/40 mt-2">
              Oracle reliability: {(metrics.avgOracleReliability * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-xs">
              No active alerts
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 10).map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border rounded-xl p-4 ${severityColors[alert.severity]}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] uppercase tracking-widest font-black">
                          {alert.severity}
                        </span>
                        <span className="text-[9px] opacity-60">
                          {alert.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs">{alert.message}</p>
                    </div>
                    <span className="text-[9px] opacity-60 whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
