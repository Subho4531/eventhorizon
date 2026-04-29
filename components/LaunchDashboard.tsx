"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  Zap, 
  Cpu,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  BarChart2,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer
} from "recharts";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Market {
  id: string;
  title: string;
  totalVolume: number;
  category: string;
  yesPool: number;
  noPool: number;
  imageUrl?: string;
  status: string;
  history?: { p: number; t: string }[];
}

export default function LaunchDashboard() {
  const router = useRouter();
  const [trendingMarkets, setTrendingMarkets] = useState<Market[]>([]);
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    activeMarkets: 0,
    totalLiquidity: 0,
    change24h: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const CACHE_KEY = "gravityflow_dashboard_cache";

  useEffect(() => {
    // 1. Try to load from cache first
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.markets) setTrendingMarkets(parsed.markets);
        if (parsed.metrics) setMetrics(parsed.metrics);
        setLoading(false); // We have something to show, so stop the full-page loader
      } catch (e) {
        console.error("Cache parse error:", e);
      }
    }

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const marketsRes = await fetch("/api/markets");

      if (marketsRes.ok) {
        const data = await marketsRes.json();
        const allMarkets: Market[] = data.markets || [];
        
        // Metrics calculation
        const totalVol = allMarkets.reduce((sum, m) => sum + m.totalVolume, 0);
        const active = allMarkets.filter(m => m.status === 'active').length;
        const liquidity = allMarkets.reduce((sum, m) => sum + m.yesPool + m.noPool, 0);
        
        setMetrics({
          totalVolume: totalVol,
          activeMarkets: active,
          totalLiquidity: liquidity,
          change24h: 5.2 // Mocked for now
        });

        // Top 5 by volume
        const topMarkets = [...allMarkets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
        
        // Fetch history for each top market
        const marketsWithHistory = await Promise.all(topMarkets.map(async (m) => {
           try {
             const hRes = await fetch(`/api/markets/${m.id}/probability?history=true&limit=20`);
             if (hRes.ok) {
               const hData = await hRes.json();
               return { ...m, history: hData.history.map((h: { probability: number; createdAt: string }) => ({ 
                 p: Math.round(h.probability * 100),
                 t: new Date(h.createdAt).toLocaleTimeString()
               })).reverse() };
             }
             return m;
           } catch {
             return m;
           }
        }));

        setTrendingMarkets(marketsWithHistory);

        // 2. Save to cache for next time
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          markets: marketsWithHistory,
          metrics: {
            totalVolume: totalVol,
            activeMarkets: active,
            totalLiquidity: liquidity,
            change24h: 5.2
          },
          updatedAt: Date.now()
        }));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % trendingMarkets.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + trendingMarkets.length) % trendingMarkets.length);
  };

  if (loading && trendingMarkets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl border border-[#00F2FF]/20 bg-[#00F2FF]/[0.03] flex items-center justify-center">
            <Cpu className="w-8 h-8 text-[#00F2FF]/60 animate-spin" />
          </div>
          <div className="absolute inset-0 bg-[#00F2FF]/10 blur-3xl animate-pulse rounded-full" />
        </div>
        <span className="mt-8 text-[10px] font-semibold uppercase tracking-[0.5em] text-[#00F2FF]/40">Initializing Protocol</span>
      </div>
    );
  }

  const featured = trendingMarkets[currentIndex];

  const metricItems = [
    { label: "PROTOCOL VOLUME", value: metrics.totalVolume.toLocaleString() + " XLM", icon: Database, color: "text-white" },
    { label: "ACTIVE MARKETS", value: metrics.activeMarkets.toString(), icon: Layers, color: "text-white" },
    { label: "TOTAL LIQUIDITY", value: metrics.totalLiquidity.toLocaleString() + " XLM", icon: Activity, color: "text-white" },
    { label: "24H MOMENTUM", value: "+" + metrics.change24h + "%", icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-8 pb-20 max-w-[1400px] mx-auto">
      {/* ── METRICS BAR ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden">
        {metricItems.map((item, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="p-6 bg-[#050505] hover:bg-white/[0.02] transition-all duration-300 relative group cursor-default"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center group-hover:bg-[#00F2FF]/[0.06] transition-all duration-300">
                <item.icon className="w-3.5 h-3.5 text-[#00F2FF]/40 group-hover:text-[#00F2FF]/80 transition-colors duration-300" />
              </div>
              <span className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.15em] group-hover:text-white/35 transition-colors duration-300">{item.label}</span>
            </div>
            <div className={`text-xl font-bold tracking-tight font-mono ${item.color}`}>
              {item.value}
            </div>
            <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-[#00F2FF]/40 to-transparent group-hover:w-full transition-all duration-700 ease-out" />
          </motion.div>
        ))}
      </section>

      {/* ── FEATURED TERMINAL ── */}
      <section className="relative group">
        <AnimatePresence mode="wait">
          {featured && (
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-[21/9] min-h-[420px] bg-[#050505] border border-white/[0.06] rounded-2xl overflow-hidden"
            >
              {/* Poster Background */}
              <div className="absolute inset-0">
                <Image 
                  fill
                  src={featured.imageUrl || `https://source.unsplash.com/featured/?${featured.category},future`} 
                  alt="" 
                  className="w-full h-full object-cover opacity-35 grayscale group-hover:grayscale-0 transition-all duration-[1200ms] scale-105 group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/70 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/30" />
              </div>

              {/* Content Overlay */}
              <div className="relative h-full flex items-center p-10 lg:p-16">
                <div className="max-w-2xl space-y-7">
                  <div className="space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#00F2FF]/[0.06] border border-[#00F2FF]/15 rounded-lg text-[#00F2FF] text-[9px] font-semibold uppercase tracking-[0.2em]"
                    >
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      Featured Prediction
                    </motion.div>
                    <motion.h2 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.1]"
                    >
                      {featured.title}
                    </motion.h2>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-8"
                  >
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[9px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-1">Market Pool</div>
                      <div className="text-xl font-bold text-white font-mono">{(featured.yesPool + featured.noPool).toLocaleString()} <span className="text-xs text-white/30">XLM</span></div>
                    </div>
                    <div className="p-4 rounded-xl bg-[#00F2FF]/[0.03] border border-[#00F2FF]/10">
                      <div className="text-[9px] font-semibold text-[#00F2FF]/40 uppercase tracking-[0.15em] mb-1">Confidence</div>
                      <div className="text-xl font-bold text-[#00F2FF] font-mono">
                        {Math.round((featured.yesPool / (featured.yesPool + featured.noPool || 1)) * 100)}%
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <button 
                      onClick={() => router.push(`/markets/${featured.id}`)}
                      className="px-8 py-3.5 bg-gradient-to-r from-[#00F2FF] to-[#00C4CC] text-black font-bold text-xs uppercase tracking-[0.15em] hover:brightness-110 transition-all duration-300 rounded-xl shadow-[0_4px_20px_rgba(0,242,255,0.2)]"
                    >
                      Trade Now
                    </button>
                    <button 
                      onClick={() => router.push(`/markets/${featured.id}`)}
                      className="px-8 py-3.5 border border-white/10 text-white/70 font-bold text-xs uppercase tracking-[0.15em] hover:bg-white/[0.05] hover:border-white/20 hover:text-white transition-all duration-300 rounded-xl"
                    >
                      Analysis
                    </button>
                  </motion.div>
                </div>

                {/* Right Side: Graph Overlay */}
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-2/3 pr-16 opacity-50 group-hover:opacity-80 transition-opacity duration-500">
                   <div className="h-full w-full relative">
                      <div className="absolute inset-0 bg-[#00F2FF]/[0.03] blur-[60px] rounded-full" />
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={featured.history}>
                          <defs>
                            <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00F2FF" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#00F2FF" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="p" 
                            stroke="#00F2FF" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#techGrad)" 
                            animationDuration={2000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      <div className="absolute top-0 right-0 text-[9px] text-[#00F2FF]/50 font-semibold uppercase tracking-[0.15em] flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Probability
                      </div>
                   </div>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="absolute bottom-8 right-8 flex gap-2">
                {/* Slide indicators */}
                <div className="flex items-center gap-1.5 mr-3">
                  {trendingMarkets.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`transition-all duration-300 rounded-full ${
                        i === currentIndex 
                          ? "w-6 h-1.5 bg-[#00F2FF]" 
                          : "w-1.5 h-1.5 bg-white/15 hover:bg-white/30"
                      }`}
                    />
                  ))}
                </div>
                <button onClick={prevSlide} className="w-10 h-10 rounded-xl border border-white/10 bg-[#050505]/60 backdrop-blur-md text-white/50 hover:bg-[#00F2FF]/10 hover:text-[#00F2FF] hover:border-[#00F2FF]/20 transition-all duration-300 flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={nextSlide} className="w-10 h-10 rounded-xl border border-white/10 bg-[#050505]/60 backdrop-blur-md text-white/50 hover:bg-[#00F2FF]/10 hover:text-[#00F2FF] hover:border-[#00F2FF]/20 transition-all duration-300 flex items-center justify-center">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── LIVE SIGNAL STREAM ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#00F2FF]/[0.06] border border-[#00F2FF]/10 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-[#00F2FF]/60" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Signal Stream</h3>
              <p className="text-[9px] text-white/20 font-medium">Live market activity</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/markets')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[10px] font-semibold text-white/30 hover:text-white/60 hover:border-white/[0.1] transition-all duration-300 group/all"
          >
            View All
            <ArrowUpRight className="w-3 h-3 group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5 transition-transform duration-300" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trendingMarkets.slice(0, 6).map((market, i) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => router.push(`/markets/${market.id}`)}
              className="group cursor-pointer bg-[#0A0A0A] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.02] hover:border-white/[0.12] transition-all duration-500 relative overflow-hidden hover-lift"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F2FF]/[0.02] blur-[40px] group-hover:bg-[#00F2FF]/[0.05] transition-all duration-500 rounded-full" />
              
              <div className="relative space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-[8px] font-bold text-[#00F2FF]/70 bg-[#00F2FF]/[0.06] px-2.5 py-1 border border-[#00F2FF]/15 uppercase tracking-[0.12em] rounded-lg">
                    {market.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span className="text-[8px] text-white/15 font-semibold uppercase tracking-[0.1em]">Live</span>
                  </div>
                </div>

                <h4 className="text-[14px] font-bold text-white/85 group-hover:text-white transition-colors duration-300 leading-tight line-clamp-2">
                  {market.title}
                </h4>

                {/* Yes/No Probability Graph */}
                <div className="h-16 w-full opacity-30 group-hover:opacity-80 transition-opacity duration-500">
                  {market.history && market.history.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={market.history}>
                        <defs>
                          <linearGradient id={`signalGrad-${market.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00F2FF" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#00F2FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area 
                          type="monotone" 
                          dataKey="p" 
                          stroke="#00F2FF" 
                          strokeWidth={1.5}
                          fill={`url(#signalGrad-${market.id})`}
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[9px] text-white/8 uppercase tracking-[0.2em] font-medium">
                      Gathering signal...
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <div className="text-[9px] font-semibold text-white/20 font-mono">
                    Vol: {market.totalVolume.toLocaleString()} XLM
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[#00F2FF]/50 group-hover:text-[#00F2FF] transition-colors duration-300">
                    Analyze <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Background Subtle Elements */}
      <div className="fixed inset-0 pointer-events-none opacity-15">
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00F2FF]/[0.03] blur-[150px] rounded-full" />
         <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#FF8C00]/[0.03] blur-[180px] rounded-full" />
      </div>
    </div>
  );
}
