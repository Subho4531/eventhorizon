"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";

interface DataPoint {
  time: string;
  yes: number;
  no: number;
}

interface MarketChartProps {
  marketId: string;
  yesPool: number;
  noPool: number;
}

// Generate a plausible synthetic history when no real ProbabilityHistory exists
function generateSyntheticHistory(yesPool: number, noPool: number): DataPoint[] {
  const total = yesPool + noPool;
  const finalYes = total === 0 ? 50 : Math.round((yesPool / total) * 100);
  const points: DataPoint[] = [];
  const steps = 20;

  // Start at 50/50, drift toward the real ratio
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease-in drift with small noise
    const drift = t * t;
    const noise = (Math.random() - 0.5) * 8 * (1 - t);
    const yes = Math.max(5, Math.min(95, 50 + drift * (finalYes - 50) + noise));
    const no = 100 - yes;

    const daysAgo = steps - i;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    points.push({
      time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      yes: Math.round(yes),
      no: Math.round(no),
    });
  }

  return points;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; color: string; value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs">
        <p className="text-white/50 mb-2 font-medium">{label}</p>
        {payload.map((p: { dataKey: string; color: string; value: number }) => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
            {p.dataKey.toUpperCase()}: {p.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MarketChart({ marketId, yesPool, noPool }: MarketChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/markets/${marketId}/history`);
        if (res.ok) {
          const json = await res.json();
          if (json.history?.length > 2) {
            setData(
              json.history.map((h: { probability: number; createdAt: string }) => ({
                time: new Date(h.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
                yes: Math.round(h.probability * 100),
                no: Math.round((1 - h.probability) * 100),
              }))
            );
            return;
          }
        }
      } catch {}
      // Fallback to synthetic
      setData(generateSyntheticHistory(yesPool, noPool));
    }
    load().finally(() => setLoading(false));
  }, [marketId, yesPool, noPool]);

  if (loading) {
    return (
      <div className="h-64 bg-white/3 rounded-2xl animate-pulse" />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="noGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#yesGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6" }}
          />
          <Area
            type="monotone"
            dataKey="no"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#noGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#f43f5e" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
