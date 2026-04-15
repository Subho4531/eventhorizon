"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Clock,
  AlertCircle,
  Brain,
  ArrowRight,
} from "lucide-react";
import QualityIndicator from "./QualityIndicator";
import RiskAlert from "./RiskAlert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  Crypto: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Finance: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Technology: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  Politics: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Sports: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

/* Expose active-category setter so the sidebar can drive the filter */
let _setCategory: ((c: string) => void) | null = null;
export function setActiveMarketCategory(cat: string) {
  _setCategory?.(cat);
}

export default function MarketsGrid() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [intelligence, setIntelligence] = useState<Record<string, MarketIntelligence>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  // Expose the setter for the sidebar
  useEffect(() => {
    _setCategory = setActiveCategory;
    return () => { _setCategory = null; };
  }, []);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        const marketList: Market[] = data.markets || [];
        setMarkets(marketList);
        fetchIntelligenceData(marketList);
      } catch (err) {
        console.error(err);
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
          console.error(`Failed to fetch intelligence for market ${market.id}:`, err);
        }
      })
    );

    setIntelligence(intelligenceData);
  };

  const calculateOdds = (yes: number, no: number) => {
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    return {
      yes: Math.round((yes / total) * 100),
      no: Math.round((no / total) * 100),
    };
  };

  const filteredMarkets =
    activeCategory === "All"
      ? markets
      : markets.filter((m) => m.category === activeCategory);

  /* ── Helper: render AI badge only when there's a meaningful signal ── */
  const renderAIBadge = (market: Market, intel: MarketIntelligence) => {
    const prob = intel.probability;
    const confidence = intel.confidence ?? 0;
    const sources = intel.sources ?? [];

    // Only show when we have a real signal — not just the pool fallback
    const hasRealSignal = sources.includes("historical") || sources.includes("external");
    if (prob === undefined || prob === null) return null;

    // If only "fallback" source (= pool ratio), show a different label
    const isPoolOnly = !hasRealSignal && sources.includes("fallback");

    const pct = Math.round(prob * 100);
    // Don't show if it exactly equals the YES pool ratio AND is pool-only (duplicates the bar)
    const odds = calculateOdds(market.yesPool, market.noPool);
    if (isPoolOnly && pct === odds.yes) return null;

    return (
      <div className="flex items-center gap-2 text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/25 rounded-lg px-3 py-1.5 relative z-10 w-fit">
        <Brain className="w-3.5 h-3.5 shrink-0" />
        <span className="font-bold uppercase tracking-widest">
          {isPoolOnly ? "Pool" : "AI"}:
        </span>
        <span className="font-bold">{pct}%</span>
        {confidence > 0 && !isPoolOnly && (
          <span className="text-purple-400/50 font-medium">
            · {Math.round(confidence * 100)}% conf
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[280px] rounded-3xl bg-white/3 border border-white/5 animate-pulse overflow-hidden relative"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="w-16 h-5 bg-white/5 rounded-full" />
                  <div className="w-20 h-4 bg-white/5 rounded-full" />
                </div>
                <div className="w-3/4 h-8 bg-white/5 rounded-xl" />
                <div className="space-y-3 pt-4">
                  <div className="w-full h-4 bg-white/5 rounded-lg" />
                  <div className="w-full h-4 bg-white/5 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-white/40 bg-white/5 rounded-3xl border border-white/5">
          <AlertCircle className="w-10 h-10 mb-4 opacity-20" />
          <p className="text-sm uppercase tracking-widest">
            No markets in this category yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market, i) => {
            const odds = calculateOdds(market.yesPool, market.noPool);
            const intel = intelligence[market.id] || {};
            const showRiskAlert =
              intel.manipulationScore && intel.manipulationScore >= 70;
            const categoryColor =
              CATEGORY_COLORS[market.category] ||
              "text-white/60 bg-white/5 border-white/10";

            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="h-full"
              >
                <div
                  onClick={() => router.push(`/markets/${market.id}`)}
                  className="cursor-pointer group h-full flex flex-col rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-all duration-300 p-5 gap-4 relative overflow-hidden"
                >
                  {/* Subtle glow on hover */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${categoryColor}`}
                      >
                        {market.category}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                          market.status === "OPEN"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                            : "text-white/30 bg-white/5 border-white/10"
                        }`}
                      >
                        {market.status === "OPEN" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        {market.status}
                      </span>
                      {/* {intel.qualityScore !== undefined && (
                        <QualityIndicator
                          score={intel.qualityScore}
                          size="sm"
                          showLabel={false}
                        />
                      )} */}
                    </div>

                    <span className="flex items-center gap-1 text-xs text-white/40 shrink-0">
                      <TrendingUp className="w-3 h-3" />
                      {(market.totalVolume || 0).toLocaleString()} XLM
                    </span>
                  </div>

                  {/* Title — full text, no clamp */}
                  <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-white transition-colors relative z-10">
                    {market.title}
                  </h3>

                  {showRiskAlert && (
                    <div className="relative z-10">
                      <RiskAlert
                        score={intel.manipulationScore!}
                        flags={intel.riskFlags}
                      />
                    </div>
                  )}

                  {/* AI probability badge — only shown when meaningful */}
                  {renderAIBadge(market, intel)}

                  {/* Probability bars */}
                  <div className="space-y-2 mt-auto relative z-10">
                    <Progress
                      value={odds.yes}
                      label="YES"
                      textClass="text-blue-400"
                      indicatorClass="bg-blue-500/25"
                    />
                    <Progress
                      value={odds.no}
                      label="NO"
                      textClass="text-rose-400"
                      indicatorClass="bg-rose-500/25"
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10">
                    <span className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      Closes {new Date(market.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/30 group-hover:text-blue-400 transition-colors uppercase tracking-wider font-semibold">
                      Trade <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}
