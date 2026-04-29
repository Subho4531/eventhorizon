"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";

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

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5",
  Finance: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5",
  Technology: "text-[#2979FF] border-[#2979FF]/30 bg-[#2979FF]/5",
  Politics: "text-[#FFD700] border-[#FFD700]/30 bg-[#FFD700]/5",
  Sports: "text-[#F50057] border-[#F50057]/30 bg-[#F50057]/5",
};

/* Expose active-category setter so the sidebar can drive the filter */
let _setCategory: ((c: string) => void) | null = null;
export function setActiveMarketCategory(cat: string) {
  _setCategory?.(cat);
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

  /* ── Helper: render AI badge as technical tag ── */
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
      <div className="flex items-center gap-2 mt-auto pt-2">
        <div className={`px-2 py-0.5 border ${isPoolOnly ? "border-white/10 bg-white/5 text-white/30" : "border-blue-500/30 bg-blue-500/5 text-blue-400"} text-[8px] font-black tracking-widest flex items-center gap-1.5`}>
          <div className={`w-1 h-1 rounded-full ${isPoolOnly ? "bg-white/20" : "bg-blue-400"}`} />
          {isPoolOnly ? "Pool Signal" : "AI Signal"}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] font-black text-white">{pct}%</span>
          {confidence > 0 && !isPoolOnly && (
            <span className="text-[7px] text-white/20 font-bold uppercase tracking-tighter">
              [C {Math.round(confidence * 100)}]
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="">
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[300px] border border-white/5 bg-[#0D0D0D] overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#FF8C00]/20 animate-pulse" />
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center opacity-20">
                  <div className="w-16 h-4 bg-white/20" />
                  <div className="w-20 h-3 bg-white/20" />
                </div>
                <div className="w-full h-10 bg-white/5" />
                <div className="space-y-3 pt-4">
                  <div className="w-full h-8 bg-white/5" />
                  <div className="w-full h-8 bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-white/20 bg-[#0D0D0D] border border-white/5">
          <span className="text-xs uppercase tracking-[0.2em] animate-pulse">
            404: No markets detected
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market, i) => {
            const odds = calculateOdds(market.yesPool, market.noPool);
            const intel = intelligence[market.id] || {};
            // const showRiskAlert =
            //   intel.manipulationScore && intel.manipulationScore >= 70;
            const categoryColor =
              CATEGORY_COLORS[market.category] ||
              "text-white/40 bg-white/5 border-white/10";

            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="h-full"
              >
                <div
                  onClick={() => router.push(`/markets/${market.id}`)}
                  className="cursor-pointer group h-full flex flex-col border border-white/10 bg-[#0D0D0D] hover:border-[#FF8C00]/40 transition-all duration-300 p-4 gap-4 relative overflow-hidden"
                >
                  {/* Grid background pattern */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:16px_16px]" />

                  {/* Top utility row */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 border ${categoryColor}`}
                      >
                        {market.category}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 border ${
                          market.status === "OPEN"
                            ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5"
                            : "text-white/20 bg-white/5 border-white/10"
                        }`}
                      >
                        {market.status === "OPEN" && (
                          <span className="w-1 h-1 bg-[#00C853]" />
                        )}
                        {market.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[9px] text-white/30 tracking-tighter">
                      <TrendingUp className="w-2.5 h-2.5" />
                      Vol: {market.totalVolume?.toLocaleString()}
                    </div>
                  </div>

                  {/* Image Section */}
                  {market.imageUrl && (
                    <div className="relative w-full h-32 mb-2 border border-white/5 overflow-hidden bg-[#1A1A1A]">
                      {/* Fallback pattern if image is missing/broken */}
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                      
                      <Image 
                        src={market.imageUrl} 
                        alt={market.title}
                        fill
                        unoptimized={true}
                        className="object-cover group-hover:scale-105 transition-all duration-700 opacity-80 group-hover:opacity-100"
                        onError={(e) => {
                          // Hide broken image icon, show fallback
                          (e.target as any).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-transparent" />
                      

                      {market.totalVolume > 500 && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#FF8C00] text-black text-[7px] font-black tracking-[0.2em] uppercase italic">
                          TRENDING
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-xs font-bold text-white uppercase tracking-tight leading-tight group-hover:text-[#FF8C00] transition-colors relative z-10">
                    {market.title}
                  </h3>


                  
                  {renderAIBadge(market, intel)}

                  {/* Probability bars */}
                  <div className="space-y-1.5 mt-auto relative z-10">
                    <Progress
                      value={odds.yes}
                      label="YES"
                      textClass="text-[#FF8C00]"
                      indicatorClass="bg-[#FF8C00]/20"
                    />
                    <Progress
                      value={odds.no}
                      label="NO"
                      textClass="text-white/40"
                      indicatorClass="bg-white/5"
                    />
                  </div>

                  {/* Sync Status / Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10">
                    <span className="flex items-center gap-1.5 text-[8px] text-white/20 uppercase">
                      <Clock className="w-2.5 h-2.5" />
                      Closes: {new Date(market.closeDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-[#FF8C00] uppercase font-black">
                        Live Sync
                      </span>
                      <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-[#FF8C00] transition-colors" />
                    </div>
                  </div>

                  {/* Corner Accent */}
                  <div className="absolute top-0 right-0 w-1 h-8 bg-white/5" />
                  <div className="absolute top-0 left-0 w-8 h-[1px] bg-white/10 group-hover:bg-[#FF8C00]/50 transition-colors" />
                  
                  {/* Bottom Glow */}
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FF8C00]/0 group-hover:bg-[#FF8C00]/5 rounded-full blur-3xl transition-all duration-500" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
