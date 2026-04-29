"use client";

import React, { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence
} from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  Database,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BarChart2
} from "lucide-react";
import Image from "next/image";
import {
  AreaChart,
  Area,
  ResponsiveContainer
} from "recharts";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { GlowCard } from "@/components/ui/glow-card";

interface Market {
  id: string;
  title: string;
  totalVolume: number;
  category: string;
  yesPool: number;
  noPool: number;
  status: string;
  imageUrl?: string | null;
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
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.markets) setTrendingMarkets(parsed.markets);
        if (parsed.metrics) setMetrics(parsed.metrics);
        if (parsed.markets?.length > 0) setLoading(false);
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
        
        const totalVol = allMarkets.reduce((sum, m) => sum + m.totalVolume, 0);
        const active = allMarkets.filter(m => m.status === 'OPEN').length;
        const liquidity = allMarkets.reduce((sum, m) => sum + m.yesPool + m.noPool, 0);
        
        setMetrics({
          totalVolume: totalVol,
          activeMarkets: active,
          totalLiquidity: liquidity,
          change24h: 5.2 
        });

        const topMarkets = [...allMarkets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
        
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
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          markets: marketsWithHistory,
          metrics: { totalVolume: totalVol, activeMarkets: active, totalLiquidity: liquidity, change24h: 5.2 },
          updatedAt: Date.now()
        }));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % trendingMarkets.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + trendingMarkets.length) % trendingMarkets.length);

  if (loading && trendingMarkets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Skeleton className="h-[120px] w-full rounded-[2rem] bg-neutral-900/50" />
        <Skeleton className="h-[400px] w-full rounded-[2rem] bg-neutral-900/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Skeleton className="h-[200px] rounded-[2rem] bg-neutral-900/50" />
          <Skeleton className="h-[200px] rounded-[2rem] bg-neutral-900/50" />
          <Skeleton className="h-[200px] rounded-[2rem] bg-neutral-900/50" />
        </div>
      </div>
    );
  }

  const featured = trendingMarkets[currentIndex];

  const metricItems = [
    { label: "PROTOCOL VOLUME", value: metrics.totalVolume.toLocaleString() + " XLM", icon: Database, color: "text-white" },
    { label: "ACTIVE MARKETS", value: metrics.activeMarkets.toString(), icon: Layers, color: "text-white" },
    { label: "TOTAL LIQUIDITY", value: metrics.totalLiquidity.toLocaleString() + " XLM", icon: Activity, color: "text-white" },
    { label: "24H MOMENTUM", value: "+" + metrics.change24h + "%", icon: TrendingUp, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto font-sans pt-12">
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricItems.map((item, i) => (
          <GlowCard key={i} className="p-6 flex flex-col gap-2 bg-neutral-900/40 rounded-[1.5rem]">
            <div className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{item.label}</span>
            </div>
            <div className={`text-2xl font-bold tracking-tight font-mono ${item.color}`}>
              {item.value}
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Scrolling Ribbon for Trending Markets */}
      {trendingMarkets.length > 0 && (
        <div className="w-full overflow-hidden bg-indigo-500/10 border-y border-indigo-500/20 py-2 relative flex items-center">
          <div className="absolute left-0 w-20 h-full bg-gradient-to-r from-[#000000] to-transparent z-10" />
          <div className="absolute right-0 w-20 h-full bg-gradient-to-l from-[#000000] to-transparent z-10" />
          <motion.div 
            className="flex whitespace-nowrap items-center gap-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
          >
            {[...trendingMarkets, ...trendingMarkets, ...trendingMarkets].map((m, i) => (
              <span key={i} className="text-xs font-mono text-indigo-300 flex items-center gap-2 tracking-widest uppercase cursor-pointer hover:text-white transition-colors" onClick={() => router.push(`/markets/${m.id}`)}>
                <Activity className="w-3 h-3 text-indigo-500" />
                {m.title}
                <span className="text-white/50 ml-2">({m.totalVolume.toLocaleString()} XLM)</span>
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {featured ? (
        <GlowCard className="relative overflow-hidden bg-black/40 border-white/5">
          <AnimatePresence mode="wait">
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="relative aspect-[21/9] min-h-[420px] flex items-center p-8 lg:p-16"
            >
              <div className="absolute inset-0 z-0 opacity-30 pointer-events-none overflow-hidden rounded-[1.5rem]">
                 {featured.imageUrl && (
                   <Image src={featured.imageUrl} alt={featured.title} fill className="object-cover opacity-50" unoptimized />
                 )}
                 <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
                 <div className="absolute top-0 right-0 w-[60%] h-[120%] bg-gradient-to-bl from-indigo-500/30 via-purple-500/5 to-transparent blur-3xl rounded-full translate-x-1/4 -translate-y-1/4" />
                 <div className="absolute bottom-0 left-0 w-[50%] h-[100%] bg-gradient-to-tr from-indigo-400/20 to-transparent blur-2xl rounded-full -translate-x-1/4 translate-y-1/4" />
              </div>

              <div className="relative z-10 w-full max-w-2xl space-y-8">
                <div className="space-y-4">
                  <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300 backdrop-blur-md"
                  >
                      <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span>Featured Market</span>
                  </motion.div>
                  <h2 className="text-3xl lg:text-5xl font-light tracking-tight leading-tight text-white">
                    {featured.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Liquidity Pool</span>
                    <span className="text-xl font-bold font-mono text-white">{(featured.yesPool + featured.noPool).toLocaleString()} XLM</span>
                  </div>
                  <Separator orientation="vertical" className="h-10 hidden sm:block bg-white/10" />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Confidence</span>
                    <span className="text-xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                      {Math.round((featured.yesPool / (featured.yesPool + featured.noPool || 1)) * 100)}% YES
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button onClick={() => router.push(`/markets/${featured.id}`)} className="group flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-black transition-transform hover:scale-105">
                      Trade Now
                      <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                  </button>
                  <button onClick={() => router.push(`/markets/${featured.id}`)} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10">
                      View Analysis
                  </button>
                </div>
              </div>

              <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 w-1/3 h-[60%] z-10 opacity-70 hover:opacity-100 transition-opacity">
                 {featured.history && featured.history.length > 1 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={featured.history}>
                       <defs>
                         <linearGradient id="featuredGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                           <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                         </linearGradient>
                       </defs>
                       <Area 
                         type="stepAfter" 
                         dataKey="p" 
                         stroke="#818cf8" 
                         strokeWidth={3}
                         fill="url(#featuredGrad)" 
                       />
                     </AreaChart>
                   </ResponsiveContainer>
                 ) : (
                    <div className="h-full flex items-center justify-center text-sm text-neutral-500 font-mono">
                      Gathering initial data...
                    </div>
                 )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-4">
              {trendingMarkets.map((_, i) => (
                <div
                  key={i}
                  className={`transition-all duration-300 rounded-full ${
                    i === currentIndex 
                      ? "w-6 h-1.5 bg-blue-500" 
                      : "w-2 h-2 bg-white/20 hover:bg-white/40 cursor-pointer"
                  }`}
                  onClick={() => setCurrentIndex(i)}
                />
              ))}
            </div>
            <button onClick={prevSlide} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/10">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextSlide} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/10">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </GlowCard>
      ) : (
        <GlowCard className="relative overflow-hidden bg-black/40 border-white/5 min-h-[420px] flex items-center justify-center flex-col gap-4">
          <Activity className="w-8 h-8 text-indigo-500/50" />
          <p className="text-sm font-medium text-neutral-500 tracking-widest uppercase">No trending markets found</p>
        </GlowCard>
      )}

      <div className="space-y-6 pt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-2xl font-light tracking-tight text-white">Trending Markets</h3>
              <p className="text-sm font-medium text-neutral-400 mt-1">Highest volume activities in the last 24h</p>
            </div>
          </div>
          <button onClick={() => router.push('/markets')} className="text-sm font-medium text-neutral-400 hover:text-white transition-colors flex items-center gap-2">
            View All Markets <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingMarkets.slice(0, 6).map((market, i) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlowCard className="h-full flex flex-col bg-neutral-900 cursor-pointer overflow-hidden group border border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />
                
                {market.imageUrl && (
                  <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                    <Image src={market.imageUrl} alt={market.title} fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/80 to-transparent" />
                  </div>
                )}
                
                {/* Ribbon */}
                <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 z-20 pointer-events-none">
                  <div className="absolute bg-gradient-to-r from-indigo-500 to-purple-500 text-[9px] font-bold text-white shadow-lg text-center font-mono py-1 right-[-35px] top-[25px] w-[140px] rotate-45 transform tracking-widest uppercase">
                    Trending
                  </div>
                </div>

                <div 
                  className="p-6 flex-1 flex flex-col justify-between gap-6 relative z-10"
                  onClick={() => router.push(`/markets/${market.id}`)}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="inline-flex rounded-lg bg-white/5 px-3 py-1 text-sm text-neutral-300 border border-white/5 font-medium tracking-wide">
                        {market.category}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-50" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                        </span>
                        <span className="text-xs font-semibold uppercase text-neutral-400 tracking-widest">Live</span>
                      </div>
                    </div>
                    
                    <h4 className="text-lg font-light tracking-tight leading-tight text-white line-clamp-2">
                      {market.title}
                    </h4>
                  </div>

                  <div className="h-16 w-full relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent z-10" />
                    {market.history && market.history.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={market.history}>
                           <defs>
                             <linearGradient id={`grad-${market.id}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                               <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                             </linearGradient>
                           </defs>
                          <Area 
                            type="monotone" 
                            dataKey="p" 
                            stroke="#818cf8" 
                            strokeWidth={2}
                            fill={`url(#grad-${market.id})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full rounded flex items-center justify-center">
                        <Activity className="w-5 h-5 text-neutral-600" />
                      </div>
                    )}
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500">Volume</span>
                      <span className="text-sm font-bold font-mono text-white">{market.totalVolume.toLocaleString()} XLM</span>
                    </div>
                    <button className="flex items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20">
                      Analyze
                    </button>
                  </div>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
