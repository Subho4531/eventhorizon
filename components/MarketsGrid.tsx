"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, AlertCircle, Loader2 } from "lucide-react";
import BetModal from "./BetModal";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function MarketsGrid() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<any | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

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
                    <Badge variant="outline" className={`${market.status === 'OPEN' ? 'border-blue-500/50 text-blue-400' : 'border-dim/50 text-dim'}`}>
                       <span className={`w-1.5 h-1.5 rounded-full mr-2 ${market.status === 'OPEN' ? 'bg-blue-500 animate-pulse' : 'bg-dim'}`}></span> {market.status}
                    </Badge>
                    <span className="text-xs text-dim flex items-center gap-1 mt-0">
                       <TrendingUp className="w-3 h-3"/> {market.totalVolume?.toLocaleString() || 0} XLM
                    </span>
                  </CardHeader>
                  
                  <CardContent className="flex flex-col flex-grow">
                    <CardTitle className="leading-tight mb-4">{market.title}</CardTitle>
                    
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
