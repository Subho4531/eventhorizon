"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  Zap, 
  BarChart3, 
  ArrowUpRight, 
  Layers, 
  Clock, 
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Globe,
  Database,
  Cpu,
  BarChart2
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  title: string;
  totalVolume: number;
  category: string;
  yesPool: number;
  noPool: number;
  imageUrl?: string;
  status: string;
  history?: any[];
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

  useEffect(() => {
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
               return { ...m, history: hData.history.map((h: any) => ({ 
                 p: Math.round(h.probability * 100),
                 t: new Date(h.createdAt).toLocaleTimeString()
               })).reverse() };
             }
           } catch (e) {}
           return m;
        }));

        setTrendingMarkets(marketsWithHistory);
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
          <Cpu className="w-12 h-12 text-[#00F2FF] animate-spin" />
          <div className="absolute inset-0 bg-[#00F2FF]/20 blur-2xl animate-pulse" />
        </div>
        <span className="mt-8 text-[10px] font-medium uppercase tracking-[1em] text-[#00F2FF]/50">Initializing Quantum Protocol</span>
      </div>
    );
  }

  const featured = trendingMarkets[currentIndex];

  return (
    <div className="space-y-8 pb-20 max-w-[1400px] mx-auto">
      {/* ── METRICS BAR ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 backdrop-blur-xl overflow-hidden">
        {[
          { label: "PROTOCOL VOLUME", value: metrics.totalVolume.toLocaleString() + " XLM", icon: Database },
          { label: "ACTIVE MARKETS", value: metrics.activeMarkets, icon: Layers },
          { label: "SYSTEM LIQUIDITY", value: metrics.totalLiquidity.toLocaleString() + " XLM", icon: Activity },
          { label: "24H MOMENTUM", value: "+" + metrics.change24h + "%", icon: TrendingUp, color: "text-emerald-400" },
        ].map((item, i) => (
          <div key={i} className="p-6 bg-[#050505]/80 hover:bg-white/[0.02] transition-colors relative group">
            <div className="flex items-center gap-3 mb-2">
              <item.icon className="w-3 h-3 text-[#00F2FF]/40 group-hover:text-[#00F2FF] transition-colors" />
              <span className="text-[10px] font-jetbrains font-medium text-white/30 uppercase tracking-[0.2em]">{item.label}</span>
            </div>
            <div className={`text-xl font-jetbrains font-medium tracking-tight ${item.color || "text-white"}`}>
              {item.value}
            </div>
            <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#00F2FF]/40 group-hover:w-full transition-all duration-500" />
          </div>
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
              className="relative aspect-[21/9] min-h-[400px] bg-[#050505] border border-white/5 overflow-hidden"
            >
              {/* Poster Background */}
              <div className="absolute inset-0">
                <img 
                  src={featured.imageUrl || `https://source.unsplash.com/featured/?${featured.category},future`} 
                  alt="" 
                  className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
              </div>

              {/* Content Overlay */}
              <div className="relative h-full flex items-center p-12 lg:p-20">
                <div className="max-w-2xl space-y-8">
                  <div className="space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-3 px-3 py-1 bg-[#00F2FF]/10 border border-[#00F2FF]/20 text-[#00F2FF] text-[10px] font-jetbrains font-medium uppercase tracking-[0.2em]"
                    >
                      <Zap className="w-3 h-3 animate-pulse" />
                      Featured Prediction
                    </motion.div>
                    <motion.h2 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-5xl lg:text-6xl font-michroma font-normal text-white tracking-tight leading-[1.1] uppercase"
                    >
                      {featured.title}
                    </motion.h2>
                  </div>

                  <div className="flex items-center gap-12">
                    <div>
                      <div className="text-[10px] font-jetbrains text-white/30 font-medium uppercase tracking-[0.2em] mb-1">Market Pool</div>
                      <div className="text-2xl font-jetbrains font-medium text-white">{(featured.yesPool + featured.noPool).toLocaleString()} <span className="text-xs text-white/40">XLM</span></div>
                    </div>
                    <div>
                      <div className="text-[10px] font-jetbrains text-white/30 font-medium uppercase tracking-[0.2em] mb-1">Confidence Index</div>
                      <div className="text-2xl font-jetbrains font-medium text-[#00F2FF]">
                        {Math.round((featured.yesPool / (featured.yesPool + featured.noPool || 1)) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => router.push(`/markets/${featured.id}`)}
                      className="px-10 py-4 bg-[#00F2FF] text-black font-jetbrains font-medium text-xs uppercase tracking-[0.2em] hover:bg-white transition-all duration-300"
                    >
                      EXECUTE ORDER
                    </button>
                    <button 
                      onClick={() => router.push(`/markets/${featured.id}`)}
                      className="px-10 py-4 border border-white/10 text-white font-jetbrains font-medium text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all duration-300"
                    >
                      ANALYSIS
                    </button>
                  </div>
                </div>

                {/* Right Side: High-Tech Graph Overlay */}
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-2/3 pr-20 opacity-60">
                   <div className="h-full w-full relative">
                      <div className="absolute inset-0 bg-[#00F2FF]/5 blur-3xl rounded-full" />
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={featured.history}>
                          <defs>
                            <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00F2FF" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#00F2FF" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area 
                            type="stepAfter" 
                            dataKey="p" 
                            stroke="#00F2FF" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#techGrad)" 
                            animationDuration={2000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      <div className="absolute top-0 right-0 text-[10px] text-[#00F2FF] font-jetbrains font-medium uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Probability Horizon
                      </div>
                   </div>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="absolute bottom-10 right-10 flex gap-2">
                <button onClick={prevSlide} className="p-4 border border-white/10 bg-[#050505]/40 backdrop-blur-md text-white hover:bg-[#00F2FF] hover:text-black transition-all">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextSlide} className="p-4 border border-white/10 bg-[#050505]/40 backdrop-blur-md text-white hover:bg-[#00F2FF] hover:text-black transition-all">
                  <ChevronRight className="w-5 h-5" />
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
            <BarChart2 className="w-4 h-4 text-[#00F2FF]" />
            <h3 className="text-xs font-jetbrains font-medium text-white uppercase tracking-[0.4em]">Signal Stream</h3>
          </div>
          <button 
            onClick={() => router.push('/markets')}
            className="text-[10px] font-jetbrains font-medium text-white/30 hover:text-[#00F2FF] transition-colors uppercase tracking-[0.2em]"
          >
            Access Terminal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingMarkets.slice(0, 6).map((market, i) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => router.push(`/markets/${market.id}`)}
              className="group cursor-pointer bg-white/[0.02] border border-white/5 p-6 hover:bg-white/[0.04] hover:border-[#00F2FF]/30 transition-all relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00F2FF]/5 blur-3xl group-hover:bg-[#00F2FF]/10 transition-all" />
              
              <div className="relative space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-jetbrains font-medium text-[#00F2FF] bg-[#00F2FF]/10 px-2 py-0.5 border border-[#00F2FF]/20 uppercase tracking-widest">
                    {market.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-white/20 font-jetbrains font-medium uppercase tracking-widest">Live</span>
                  </div>
                </div>

                <h4 className="text-lg font-medium text-white/90 group-hover:text-white transition-colors leading-tight">
                  {market.title}
                </h4>

                {/* Yes/No Probability Graph */}
                <div className="h-16 w-full opacity-40 group-hover:opacity-100 transition-opacity">
                  {market.history && market.history.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={market.history}>
                        <Area 
                          type="stepAfter" 
                          dataKey="p" 
                          stroke="#00F2FF" 
                          strokeWidth={2}
                          fill="transparent" 
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[9px] text-white/10 uppercase tracking-widest">
                      Gathering Intel...
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[10px] font-jetbrains text-white/30 font-medium uppercase tracking-widest">
                    Vol: {market.totalVolume.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-jetbrains font-medium text-[#00F2FF]">
                    Analyze <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Background Subtle Elements */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00F2FF]/5 blur-[120px] rounded-full animate-pulse" />
         <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#FF8C00]/5 blur-[150px] rounded-full animate-pulse" />
      </div>
    </div>
  );
}
