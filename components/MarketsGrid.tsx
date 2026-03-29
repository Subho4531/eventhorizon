"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, AlertCircle } from "lucide-react";
import BetModal from "./BetModal";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Example Mock Data matching the Soroban structure
const MOCK_MARKETS = [
  { id: 1, title: "Will artificial general intelligence (AGI) be achieved by 2026?", yesPool: 15400, noPool: 12000, volume: 27400, endDate: "Dec 31, 2026", status: "Open" },
  { id: 2, title: "Will Soroban reach $1B TVL by end of Q3?", yesPool: 45000, noPool: 8200, volume: 53200, endDate: "Sep 30, 2026", status: "Open" },
  { id: 3, title: "Is Bitcoin crossing $150k this month?", yesPool: 89000, noPool: 112000, volume: 201000, endDate: "Mar 31, 2026", status: "Open" },
];

export default function MarketsGrid() {
  const [selectedMarket, setSelectedMarket] = useState<typeof MOCK_MARKETS[0] | null>(null);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_MARKETS.map((market, i) => {
          const odds = calculateOdds(market.yesPool, market.noPool);
          return (
            <motion.div 
              key={market.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="h-full"
            >
              <Card onClick={() => setSelectedMarket(market)}>
                <CardHeader className="flex flex-row justify-between items-start pb-2 space-y-0">
                  <Badge>
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> {market.status}
                  </Badge>
                  <span className="text-xs text-dim flex items-center gap-1 mt-0">
                     <TrendingUp className="w-3 h-3"/> {market.volume.toLocaleString()} XLM
                  </span>
                </CardHeader>
                
                <CardContent className="flex flex-col flex-grow">
                  <CardTitle>{market.title}</CardTitle>
                  
                  <div className="space-y-3 mt-8">
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
                
                <CardFooter>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Closes {market.endDate}</span>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {selectedMarket && (
        <BetModal 
          isOpen={true} 
          onClose={() => setSelectedMarket(null)} 
          marketId={selectedMarket.id}
          marketTitle={selectedMarket.title}
        />
      )}
    </>
  );
}
