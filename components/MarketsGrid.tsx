"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Clock,
  ArrowRight,
  Flame,
  Timer,
  BarChart2,
  Users,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import { GlowCard } from "@/components/ui/glow-card";

interface Market {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  yesPool: number;
  noPool: number;
  totalVolume: number;
  closeDate: string;
  category: string;
  imageUrl?: string | null;
  contractMarketId?: number | null;
}

interface MarketIntelligence {
  probability?: number;
  qualityScore?: number;
  manipulationScore?: number;
  riskFlags?: string[];
  confidence?: number;
  sources?: string[];
}

const CATEGORY_COLORS: Record<string, { text: string; border: string; bg: string; glow: string; gradient: string }> = {
  Crypto: { text: "text-[#FF8C00]", border: "border-[#FF8C00]/25", bg: "bg-[#FF8C00]/5", glow: "rgba(255,140,0,0.08)", gradient: "from-[#FF8C00]/10 to-transparent" },
  Finance: { text: "text-[#00C853]", border: "border-[#00C853]/25", bg: "bg-[#00C853]/5", glow: "rgba(0,200,83,0.08)", gradient: "from-[#00C853]/10 to-transparent" },
  Technology: { text: "text-[#2979FF]", border: "border-[#2979FF]/25", bg: "bg-[#2979FF]/5", glow: "rgba(41,121,255,0.08)", gradient: "from-[#2979FF]/10 to-transparent" },
  Politics: { text: "text-[#FFD700]", border: "border-[#FFD700]/25", bg: "bg-[#FFD700]/5", glow: "rgba(255,215,0,0.08)", gradient: "from-[#FFD700]/10 to-transparent" },
  Sports: { text: "text-[#F50057]", border: "border-[#F50057]/25", bg: "bg-[#F50057]/5", glow: "rgba(245,0,87,0.08)", gradient: "from-[#F50057]/10 to-transparent" },
  Science: { text: "text-[#AA00FF]", border: "border-[#AA00FF]/25", bg: "bg-[#AA00FF]/5", glow: "rgba(170,0,255,0.08)", gradient: "from-[#AA00FF]/10 to-transparent" },
  Entertainment: { text: "text-[#FF4081]", border: "border-[#FF4081]/25", bg: "bg-[#FF4081]/5", glow: "rgba(255,64,129,0.08)", gradient: "from-[#FF4081]/10 to-transparent" },
};

const DEFAULT_CAT = { text: "text-white/40", border: "border-white/10", bg: "bg-white/5", glow: "rgba(255,255,255,0.05)", gradient: "from-white/5 to-transparent" };

/* Expose active-category setter so the sidebar can drive the filter */
let _setCategory: ((c: string) => void) | null = null;
export function setActiveMarketCategory(cat: string) {
  _setCategory?.(cat);
}

/* ── Countdown helper ── */
function useCountdown(closeDate: string) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function calc() {
      const diff = new Date(closeDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("CLOSED"); setIsUrgent(false); return; }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);

      setIsUrgent(diff < 3600000); // under 1 hour

      if (d > 0) setTimeLeft(`${d}d ${h}h`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else setTimeLeft(`${m}m`);
    }

    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [closeDate]);

  return { timeLeft, isUrgent };
}

/* ── Countdown Badge ── */
function CountdownBadge({ closeDate }: { closeDate: string }) {
  const { timeLeft, isUrgent } = useCountdown(closeDate);
  
  if (timeLeft === "CLOSED") {
    return (
      <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-tight text-white/15">
        <Clock className="w-2.5 h-2.5" />
        Closed
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-tight ${
      isUrgent ? "text-red-400" : "text-white/25"
    }`}>
      {isUrgent ? <Timer className="w-2.5 h-2.5 animate-pulse" /> : <Clock className="w-2.5 h-2.5" />}
      {timeLeft}
    </span>
  );
}

export default function MarketsGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [intelligence, setIntelligence] = useState<Record<string, MarketIntelligence>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  const query = searchParams.get("q") || "";

  // Expose the setter for the sidebar
  useEffect(() => {
    _setCategory = setActiveCategory;
    return () => { _setCategory = null; };
  }, []);

  const CACHE_KEY = "gravityflow_markets_cache";

  useEffect(() => {
    // 1. Load from cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.markets) setMarkets(parsed.markets);
        if (parsed.intelligence) setIntelligence(parsed.intelligence);
        setLoading(false);
      } catch (e) {
        console.error("Markets cache error:", e);
      }
    }

    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        const marketList: Market[] = data.markets || [];
        setMarkets(marketList);
        
        // Cache basic market data early
        const existingIntel = localStorage.getItem(CACHE_KEY) 
          ? JSON.parse(localStorage.getItem(CACHE_KEY)!).intelligence 
          : {};
          
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          markets: marketList,
          intelligence: existingIntel,
          updatedAt: Date.now()
        }));

        fetchIntelligenceData(marketList);
      } catch (err) {
        console.error(err instanceof Error ? err.message : "Internal Error");
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  const fetchIntelligenceData = async (marketList: Market[]) => {
    const intelligenceData: Record<string, MarketIntelligence> = {};

    await Promise.all(
      marketList.map(async (market) => {
        try {
          const [probRes, qualityRes, riskRes] = await Promise.all([
            fetch(`/api/markets/${market.id}/probability`).catch(() => null),
            fetch(`/api/markets/${market.id}/quality`).catch(() => null),
            fetch(`/api/markets/${market.id}/risk`).catch(() => null),
          ]);

          const probData = probRes?.ok ? await probRes.json() : null;
          const qualityData = qualityRes?.ok ? await qualityRes.json() : null;
          const riskData = riskRes?.ok ? await riskRes.json() : null;

          intelligenceData[market.id] = {
            probability: probData?.probability,
            confidence: probData?.confidence,
            sources: probData?.sources,
            qualityScore: qualityData?.score,
            manipulationScore: riskData?.score,
            riskFlags: riskData?.flags?.map((f: { type: string }) => f.type) ?? [],
          };
        } catch (err) {
          console.error(`Failed to fetch intelligence for market ${market.id}:`, err instanceof Error ? err.message : "Internal Error");
        }
      })
    );

    setIntelligence(intelligenceData);

    // 2. Save full intel to cache
    const currentMarkets = JSON.parse(localStorage.getItem(CACHE_KEY) || '{"markets":[]}');
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      markets: currentMarkets.markets,
      intelligence: intelligenceData,
      updatedAt: Date.now()
    }));
  };

  const calculateOdds = (yes: number, no: number) => {
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    return {
      yes: Math.round((yes / total) * 100),
      no: Math.round((no / total) * 100),
    };
  };

  const filteredMarkets = markets
    .filter((m) => {
      const matchesCategory = activeCategory === "All" || m.category === activeCategory;
      const matchesQuery = !query || 
        m.title.toLowerCase().includes(query.toLowerCase()) || 
        m.description?.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    })
    .sort((a, b) => {
      if (a.status === "RESOLVED" && b.status !== "RESOLVED") return 1;
      if (a.status !== "RESOLVED" && b.status === "RESOLVED") return -1;
      return 0;
    });

  /* ── Helper: render AI badge ── */
  const renderAIBadge = (market: Market, intel: MarketIntelligence) => {
    const prob = intel.probability;
    const confidence = intel.confidence ?? 0;
    const sources = intel.sources ?? [];

    const hasRealSignal = sources.includes("historical") || sources.includes("external");
    if (prob === undefined || prob === null) return null;

    const isPoolOnly = !hasRealSignal && sources.includes("fallback");
    const pct = Math.round(prob * 100);
    const odds = calculateOdds(market.yesPool, market.noPool);
    if (isPoolOnly && pct === odds.yes) return null;

    return (
      <div className="flex items-center gap-2.5 mt-auto pt-2">
        <div className={`px-2.5 py-1 rounded-lg border ${isPoolOnly ? "border-white/8 bg-white/[0.03] text-white/25" : "border-blue-500/25 bg-blue-500/[0.06] text-blue-400"} text-[7px] font-bold tracking-[0.15em] flex items-center gap-1.5`}>
          <div className={`w-1 h-1 rounded-full ${isPoolOnly ? "bg-white/15" : "bg-blue-400 animate-pulse"}`} />
          {isPoolOnly ? "POOL" : "AI SIGNAL"}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-black text-white tabular-nums font-mono">{pct}%</span>
          {confidence > 0 && !isPoolOnly && (
            <span className="text-[7px] text-white/15 font-bold uppercase tracking-tight">
              C:{Math.round(confidence * 100)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Results count */}
      {!loading && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[9px] text-white/20 font-semibold uppercase tracking-[0.15em]">
              <BarChart2 className="w-3 h-3 opacity-40" />
              {filteredMarkets.length} {filteredMarkets.length === 1 ? "Market" : "Markets"}
              {activeCategory !== "All" && <span className="text-white/30">in {activeCategory}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[8px] text-white/15 font-medium">
            <Users className="w-3 h-3 opacity-30" />
            Sorted by activity
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[360px] rounded-2xl border border-white/[0.04] bg-[#0A0A0A] overflow-hidden relative"
            >
              <div className="absolute inset-0 animate-shimmer" />
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center opacity-20">
                  <div className="w-16 h-5 bg-white/10 rounded-lg" />
                  <div className="w-20 h-4 bg-white/10 rounded-lg" />
                </div>
                <div className="w-full h-32 bg-white/[0.03] rounded-xl" />
                <div className="w-3/4 h-5 bg-white/[0.03] rounded-lg" />
                <div className="space-y-3 pt-4">
                  <div className="w-full h-8 bg-white/[0.03] rounded-lg" />
                  <div className="w-full h-8 bg-white/[0.03] rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-white/15 bg-[#0A0A0A] border border-white/[0.04] rounded-2xl">
          <BarChart2 className="w-8 h-8 mb-4 opacity-20" />
          <span className="text-xs uppercase tracking-[0.2em] font-medium">
            No markets found
          </span>
          <span className="text-[10px] mt-2 text-white/10">
            Try adjusting your filters or search query
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center mx-auto w-full">
          {filteredMarkets.map((market, i) => {
            const odds = calculateOdds(market.yesPool, market.noPool);
            const intel = intelligence[market.id] || {};
            const catColors = CATEGORY_COLORS[market.category] || DEFAULT_CAT;
            const isResolved = market.status === "RESOLVED";

            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: "easeOut" }}
                className="h-full w-full max-w-[320px]"
              >
                <GlowCard className="h-full group hover:shadow-[0_0_30px_rgba(255,140,0,0.15)] transition-shadow duration-500">
                <div
                  onClick={() => router.push(`/markets/${market.id}`)}
                  className={`cursor-pointer h-full flex flex-col rounded-[2rem] bg-transparent transition-all duration-500 relative overflow-hidden ${
                    isResolved 
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  {/* Image Section */}
                  {market.imageUrl && (
                    <div className="relative w-full h-36 overflow-hidden bg-[#080808]">
                      <Image 
                        src={market.imageUrl} 
                        alt={market.title}
                        fill
                        unoptimized={true}
                        className="object-cover object-center group-hover:scale-[1.08] transition-all duration-[800ms] ease-out"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {/* Gradient overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/30 to-transparent" />
                      <div className={`absolute inset-0 bg-gradient-to-br ${catColors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      
                      {/* Category badge on image */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className={`text-[8px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-lg border backdrop-blur-xl ${catColors.text} ${catColors.border} ${catColors.bg}`}>
                          {market.category}
                        </span>
                      </div>

                      {/* Trending badge */}
                      {market.totalVolume > 500 && (
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#FF8C00] to-[#FF6B00] rounded-lg shadow-[0_2px_12px_rgba(255,140,0,0.3)]">
                          <Flame className="w-2.5 h-2.5 text-black" />
                          <span className="text-[7px] font-black tracking-[0.1em] text-black uppercase">HOT</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-5 gap-3">
                    {/* Top row: status + volume */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border ${
                          market.status === "OPEN"
                            ? "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/[0.04]"
                            : market.status === "RESOLVED"
                            ? "text-white/15 bg-white/[0.02] border-white/[0.06]"
                            : "text-[#FF8C00] border-[#FF8C00]/20 bg-[#FF8C00]/[0.04]"
                        }`}
                      >
                        {market.status === "OPEN" && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C853] opacity-50" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00C853]" />
                          </span>
                        )}
                        {market.status}
                      </span>

                      <div className="flex items-center gap-1.5 text-[8px] text-white/20 tracking-tight font-medium font-mono">
                        <TrendingUp className="w-2.5 h-2.5 opacity-50" />
                        {market.totalVolume?.toLocaleString()} XLM
                      </div>
                    </div>

                    {/* No image fallback: show category badge here */}
                    {!market.imageUrl && (
                      <span className={`self-start text-[8px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-lg border ${catColors.text} ${catColors.border} ${catColors.bg}`}>
                        {market.category}
                      </span>
                    )}

                    {/* Title */}
                    <h3 className="text-[14px] font-medium text-white/90 leading-snug tracking-tight group-hover:text-white transition-colors duration-300 line-clamp-2">
                      {market.title}
                    </h3>

                    {/* AI Badge */}
                    {renderAIBadge(market, intel)}

                    {/* Probability bars */}
                    <div className="space-y-1.5 mt-auto">
                      <Progress
                        value={odds.yes}
                        label="YES"
                        textClass="text-[#FF8C00]"
                        indicatorClass="bg-gradient-to-r from-[#FF8C00]/15 to-[#FF8C00]/25"
                      />
                      <Progress
                        value={odds.no}
                        label="NO"
                        textClass="text-white/35"
                        indicatorClass="bg-white/[0.04]"
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                      <CountdownBadge closeDate={market.closeDate} />
                      <div className="flex items-center gap-2 group/trade">
                        <span className="text-[8px] text-white/15 uppercase font-bold tracking-[0.1em] group-hover:text-[#FF8C00] transition-colors duration-300">
                          Trade
                        </span>
                        <div className="w-5 h-5 rounded-md bg-white/[0.03] flex items-center justify-center group-hover:bg-[#FF8C00]/10 transition-all duration-300">
                          <ArrowRight className="w-3 h-3 text-white/10 group-hover:text-[#FF8C00] group-hover:translate-x-0.5 transition-all duration-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
