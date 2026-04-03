"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, AlertCircle, Loader2, Brain, Sparkles } from "lucide-react";
import BetModal from "./BetModal";
import QualityIndicator from "./QualityIndicator";
import RiskAlert from "./RiskAlert";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface MarketIntelligence {
  probability?: number;
  qualityScore?: number;
  manipulationScore?: number;
  riskFlags?: string[];
}

export default function MarketsGrid() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [intelligence, setIntelligence] = useState<Record<string, MarketIntelligence>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<any | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        const marketList = data.markets || [];
        setMarkets(marketList);
        
        // Fetch intelligence data for each market
        fetchIntelligenceData(marketList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  const fetchIntelligenceData = async (marketList: any[]) => {
    const intelligenceData: Record<string, MarketIntelligence> = {};
    
    await Promise.all(
      marketList.map(async (market) => {
        try {
          const [probRes, qualityRes, riskRes] = await Promise.all([
            fetch(`/api/markets/${market.id}/probability`).catch(() => null),
            fetch(`/api/markets/${market.id}/quality`).catch(() => null),
            fetch(`/api/markets/${market.id}/risk`).catch(() => null),
          ]);

          intelligenceData[market.id] = {
            probability: probRes?.ok ? (await probRes.json()).probability : undefined,
            qualityScore: qualityRes?.ok ? (await qualityRes.json()).score : undefined,
            manipulationScore: riskRes?.ok ? (await riskRes.json()).score : undefined,
            riskFlags: riskRes?.ok ? (await riskRes.json()).flags?.map((f: any) => f.type) : [],
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
      no: Math.round((no / total) * 100)
    };
  };

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[280px] rounded-3xl bg-white/3 border border-white/5 animate-pulse overflow-hidden relative">
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
              <div className="absolute bottom-0 inset-x-0 h-14 bg-white/2 border-t border-white/5 p-4 flex items-center justify-between">
                <div className="w-24 h-3 bg-white/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-dim bg-white/5 rounded-3xl border border-white/5">
           <AlertCircle className="w-10 h-10 mb-4 opacity-20" />
           <p className="text-sm uppercase tracking-widest">No active markets found in this sector.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market, i) => {
            const odds = calculateOdds(market.yesPool, market.noPool);
            const intel = intelligence[market.id] || {};
            const showRiskAlert = intel.manipulationScore && intel.manipulationScore >= 70;
            
            return (
              <motion.div 
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="h-full"
              >
                <Card onClick={() => setSelectedMarket(market)} className="cursor-pointer hover:bg-white/5 transition-all">
                  <CardHeader className="flex flex-row justify-between items-start pb-2 space-y-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${market.status === 'OPEN' ? 'border-blue-500/50 text-blue-400' : 'border-dim/50 text-dim'}`}>
                         <span className={`w-1.5 h-1.5 rounded-full mr-2 ${market.status === 'OPEN' ? 'bg-blue-500 animate-pulse' : 'bg-dim'}`}></span> {market.status}
                      </Badge>
                      {intel.qualityScore !== undefined && (
                        <QualityIndicator score={intel.qualityScore} size="sm" showLabel={false} />
                      )}
                    </div>
                    <span className="text-xs text-dim flex items-center gap-1 mt-0">
                       <TrendingUp className="w-3 h-3"/> {market.totalVolume?.toLocaleString() || 0} XLM
                    </span>
                  </CardHeader>
                  
                  <CardContent className="flex flex-col flex-grow">
                    <CardTitle className="leading-tight mb-4">{market.title}</CardTitle>
                    
                    {showRiskAlert && (
                      <div className="mb-4">
                        <RiskAlert 
                          score={intel.manipulationScore!} 
                          flags={intel.riskFlags}
                        />
                      </div>
                    )}
                    
                    {intel.probability !== undefined && (
                      <div className="mb-3 flex items-center gap-2 text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
                        <Brain className="w-3.5 h-3.5" />
                        <span className="font-bold uppercase tracking-widest">AI Estimate:</span>
                        <span className="font-bold">{(intel.probability * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    
                    <div className="space-y-3 mt-auto pt-4">
                       <Progress 
                         value={odds.yes} 
                         label="YES" 
                         textClass="text-blue-400"
                         indicatorClass="bg-blue-500/20"
                       />
                       <Progress 
                         value={odds.no} 
                         label="NO" 
                         textClass="text-red-400"
                         indicatorClass="bg-red-500/20"
                       />
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-4 border-t border-white/5 mt-4">
                    <span className="flex items-center gap-1.5 text-[10px] text-dim uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5"/> Closes {new Date(market.closeDate).toLocaleDateString()}
                    </span>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedMarket && (
        <BetModal 
          isOpen={true} 
          onClose={() => setSelectedMarket(null)} 
          marketId={selectedMarket.id}
          contractMarketId={selectedMarket.contractMarketId}
          marketTitle={selectedMarket.title}
        />
      )}
    </>
  );
}
