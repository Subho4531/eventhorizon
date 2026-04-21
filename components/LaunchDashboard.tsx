"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  Zap, 
  BarChart3, 
  ArrowUpRight, 
  Users, 
  Clock, 
  LayoutGrid, 
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Lock,
  Globe
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
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
  const [categories, setCategories] = useState<{ name: string; volume: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [marketsRes, logsRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/transactions?limit=10")
      ]);

      if (marketsRes.ok) {
        const data = await marketsRes.json();
        const allMarkets: Market[] = data.markets || [];
        
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

        // Category showdown
        const catMap: Record<string, number> = {};
        allMarkets.forEach(m => {
          catMap[m.category] = (catMap[m.category] || 0) + m.totalVolume;
        });
        setCategories(Object.entries(catMap).map(([name, volume]) => ({ name, volume })));
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setRecentLogs(data.transactions || []);
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
          <Zap className="w-12 h-12 text-[#FF8C00] animate-pulse" />
          <div className="absolute inset-0 bg-[#FF8C00]/20 blur-xl animate-pulse" />
        </div>
        <span className="mt-8 text-[10px] font-black uppercase tracking-[1em] text-white/30">Horizon Protocol Online</span>
      </div>
    );
  }

  const featured = trendingMarkets[currentIndex];

  return (
    <div className="space-y-12 pb-20">
      {/* ── HERO HEADING ── */}
      <section className="text-center py-10 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 border border-[#FF8C00]/30 bg-[#FF8C00]/5 rounded-full"
        >
          <Lock className="w-3 h-3 text-[#FF8C00]" />
          <span className="text-[9px] font-black text-[#FF8C00] uppercase tracking-widest">Zero Knowledge Shielded</span>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="text-7xl font-black text-white tracking-[-0.05em] uppercase italic leading-none"
        >
          EVENT <span className="text-[#FF8C00] text-shadow-glow">HORIZON</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/40 text-sm font-bold uppercase tracking-[0.4em]"
        >
          Privacy Prediction Markets on Stellar
        </motion.p>
      </section>

      {/* ── FEATURED SWIPER ── */}
      <section className="relative">
        <div className="absolute top-1/2 -left-12 -translate-y-1/2 z-20">
          <button onClick={prevSlide} className="p-3 border border-white/5 hover:border-[#FF8C00]/40 text-white/20 hover:text-[#FF8C00] transition-all bg-[#0D0D0D]">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="absolute top-1/2 -right-12 -translate-y-1/2 z-20">
          <button onClick={nextSlide} className="p-3 border border-white/5 hover:border-[#FF8C00]/40 text-white/20 hover:text-[#FF8C00] transition-all bg-[#0D0D0D]">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {featured && (
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="grid grid-cols-1 lg:grid-cols-2 bg-[#0D0D0D] border border-white/5 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
              {/* Left: Info */}
              <div className="p-12 space-y-8 flex flex-col justify-center border-r border-white/5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 border border-[#FF8C00]/30 text-[#FF8C00] text-[9px] font-black uppercase tracking-widest">{featured.category}</span>
                    <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">Market ID: {featured.id.slice(0,8)}</span>
                  </div>
                  <h2 className="text-4xl font-black text-white uppercase italic leading-[0.95] tracking-tighter">
                    {featured.title}
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <div className="text-[24px] font-black text-white tracking-tighter">{featured.totalVolume.toLocaleString()}</div>
                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">Protocol Vol</div>
                  </div>
                  <div>
                    <div className="text-[24px] font-black text-[#00C853] tracking-tighter">
                      {Math.round((featured.yesPool / (featured.yesPool + featured.noPool || 1)) * 100)}%
                    </div>
                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">YES Momentum</div>
                  </div>
                  <div>
                    <div className="text-[24px] font-black text-blue-400 tracking-tighter">
                       {(featured.yesPool + featured.noPool).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">Liquidity</div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => router.push(`/markets/${featured.id}`)}
                    className="group flex items-center gap-3 px-8 py-4 bg-[#FF8C00] text-black font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all"
                  >
                    Enter Position <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Right: Graph */}
              <div className="bg-[#0A0A0A] p-8 flex flex-col min-h-[400px] relative">
                 <div className="flex items-center justify-between mb-8 relative z-10">
                   <div className="flex items-center gap-2">
                     <Activity className="w-4 h-4 text-[#FF8C00] animate-pulse" />
                     <span className="text-[10px] text-white font-black uppercase tracking-widest">Probability Horizon</span>
                   </div>
                   <div className="text-[9px] text-white/20 font-black uppercase tracking-widest">Live Signal Feed</div>
                 </div>

                 <div className="flex-1 w-full h-full min-h-[250px]">
                    {featured.history && featured.history.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={featured.history}>
                          <defs>
                            <linearGradient id="featuredGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FF8C00" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#FF8C00" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: 900 }}
                            itemStyle={{ color: '#FF8C00' }}
                          />
                          <Area 
                            type="stepAfter" 
                            dataKey="p" 
                            stroke="#FF8C00" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#featuredGrad)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-20">
                        <BarChart3 className="w-12 h-12 mb-4 animate-bounce" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Historical Data...</span>
                      </div>
                    )}
                 </div>

                 {/* Corner Decoration */}
                 <div className="absolute bottom-0 right-0 p-4 opacity-5">
                   <Globe className="w-32 h-32" />
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {trendingMarkets.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setCurrentIndex(i)}
              className={`w-12 h-1 transition-all ${i === currentIndex ? "bg-[#FF8C00]" : "bg-white/10 hover:bg-white/20"}`}
            />
          ))}
        </div>
      </section>

      {/* ── SHOWDOWN & LOGS ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Category Showdown */}
        <div className="bg-[#0D0D0D] border border-white/5 p-10 group">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] italic">Market Sectors</h3>
            </div>
            <div className="text-[9px] text-white/20 font-black uppercase tracking-widest">Comparative Volume</div>
          </div>

          <div className="space-y-6">
            {categories.sort((a,b) => b.volume - a.volume).map((cat, i) => {
               const maxVol = Math.max(...categories.map(c => c.volume));
               const width = (cat.volume / (maxVol || 1)) * 100;
               return (
                 <div key={cat.name} className="space-y-2">
                   <div className="flex justify-between items-end">
                     <span className="text-[11px] font-black text-white/60 uppercase tracking-widest">{cat.name}</span>
                     <span className="text-[11px] font-black text-white uppercase tracking-tighter">{cat.volume.toLocaleString()} <span className="text-white/20 ml-1">XLM</span></span>
                   </div>
                   <div className="h-1.5 bg-white/5 w-full relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="absolute h-full bg-blue-500" 
                      />
                   </div>
                 </div>
               );
            })}
          </div>
        </div>

        {/* Live Logs */}
        <div className="bg-[#0D0D0D] border border-white/5 p-10 flex flex-col h-[480px]">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#00C853]" />
              <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] italic">Protocol Feed</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
              <span className="text-[9px] text-[#00C853] font-black uppercase tracking-widest">Realtime Active</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-2">
            {recentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-10">
                <Clock className="w-10 h-10 mb-4" />
                <span className="text-[11px] font-black uppercase tracking-widest">Syncing with Ledger...</span>
              </div>
            ) : (
              <AnimatePresence>
                {recentLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-5 border border-white/5 hover:bg-white/[0.02] transition-all group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="text-[10px] font-black text-white/20 group-hover:text-[#FF8C00] transition-colors uppercase">
                        {log.type.slice(0,3)}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white uppercase tracking-tight">
                          {log.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[9px] text-white/20 font-bold uppercase truncate max-w-[140px]">
                          {log.userPublicKey}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-black text-[#FF8C00] tracking-tighter">+{log.amount} <span className="text-[10px] ml-0.5">XLM</span></div>
                      <div className="text-[8px] text-white/20 font-black uppercase tracking-widest">Verified</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
