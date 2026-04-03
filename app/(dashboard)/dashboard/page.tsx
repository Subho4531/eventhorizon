"use client";

import { useEffect, useState } from "react";
import BetModal from "@/components/BetModal";
import CreateMarketModal from "@/components/CreateMarketModal";
import { useWallet } from "@/components/WalletProvider";

interface Market {
  id: string;
  title: string;
  description: string;
  outcome: string | null;
  yesPool: number;
  noPool: number;
  totalVolume: number;
  closeDate: string;
  contractMarketId: number;
  status: string;
}

export default function Home() {
  const { publicKey } = useWallet();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        console.error("Failed to fetch markets", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  const heroMarket = markets[0];
  const trendingMarkets = markets.slice(1, 3);
  
  const totalVolume = markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0);
  const totalStakes = markets.reduce((sum, m) => sum + (m.yesPool + m.noPool), 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full content-start animate-pulse">
        <section className="col-span-1 xl:col-span-8 space-y-8">
          <div className="h-[500px] rounded-[2.5rem] bg-white/3 border border-white/5 p-10">
            <div className="w-48 h-6 bg-white/5 rounded-full mb-6" />
            <div className="w-full max-w-md h-12 bg-white/5 rounded-2xl mb-4" />
            <div className="w-1/2 h-4 bg-white/5 rounded-full mb-10" />
            <div className="w-full h-40 bg-white/5 rounded-2xl mb-10" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-20 bg-white/5 rounded-2xl" />
              <div className="h-20 bg-white/5 rounded-2xl" />
              <div className="h-20 bg-white/5 rounded-2xl" />
              <div className="h-20 bg-white/5 rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="h-64 rounded-3xl bg-white/3 border border-white/5" />
            <div className="h-64 rounded-3xl bg-white/3 border border-white/5" />
          </div>
        </section>
        <section className="col-span-1 xl:col-span-4 space-y-8">
          <div className="h-80 rounded-3xl bg-white/3 border border-white/5" />
          <div className="h-32 rounded-3xl bg-white/3 border border-white/5" />
        </section>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40">
        <span className="material-symbols-outlined text-6xl mb-4 opacity-20">cloud_off</span>
        <h2 className="text-xl font-bold tracking-widest uppercase">No Horizons Found</h2>
        <p className="text-xs mt-2 uppercase tracking-[0.2em]">The cosmic ledger is currently silent.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full content-start">
      {/* Hero Section */}
      <section className="col-span-1 xl:col-span-8 space-y-8">
        <div className="glass-panel rounded-3xl p-6 md:p-10 overflow-hidden relative border border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative z-10">
            <div className="max-w-md">
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] uppercase tracking-[0.3em] font-black border border-blue-500/20">
                  Active Horizon Event
                </span>
                {publicKey && (
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-white/60 text-[9px] uppercase tracking-widest font-bold border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">add</span>
                    Propose Horizon
                  </button>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-sans text-white font-bold leading-tight tracking-tight">
                {heroMarket.title}
              </h1>
              <p className="text-white/40 text-[10px] mt-4 leading-relaxed uppercase tracking-widest max-w-sm">
                {heroMarket.description || "Real-time prediction market for high-impact cosmic events."}
              </p>
            </div>
            <div className="text-left md:text-right">
              <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] mb-2 font-bold">Consensus</div>
              <div className="text-4xl md:text-5xl font-bold text-white font-sans tracking-tighter drop-shadow-sm">
                {heroMarket.yesPool + heroMarket.noPool > 0 
                  ? Math.round((heroMarket.yesPool / (heroMarket.yesPool + heroMarket.noPool)) * 100) 
                  : 50}%
              </div>
            </div>
          </div>
          
          {/* Mini Chart - Minimalist Graphic */}
          <div className="w-full h-40 bg-white/2 rounded-2xl mb-10 relative border border-white/5 overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
              <path className="drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" d="M0,150 Q150,140 300,160 T600,120 T900,140" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"></path>
              <path className="drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" d="M0,150 Q200,160 400,130 T700,90 T1000,40" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2"></path>
              <path d="M0,150 Q200,160 400,130 T700,90 T1000,40 V200 H0 Z" fill="url(#chartGradient)"></path>
              <defs>
                <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1"></stop>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            <button 
              onClick={() => setSelectedMarket(heroMarket)}
              className="bg-blue-600 border border-blue-400/30 text-white rounded-2xl py-4 flex flex-col items-center justify-center shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="text-xl font-bold font-sans tracking-tight">YES</span>
              <span className="text-[8px] text-white/60 uppercase font-black tracking-widest mt-1">Bet Logic</span>
            </button>
            <button 
              onClick={() => setSelectedMarket(heroMarket)}
              className="bg-white/5 border border-white/10 text-white rounded-2xl py-4 flex flex-col items-center justify-center hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="text-xl font-bold font-sans tracking-tight">NO</span>
              <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">Bet Logic</span>
            </button>
            <div className="bg-white/3 rounded-2xl py-4 px-6 border border-white/5 flex flex-col justify-center">
              <span className="block text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Pool</span>
              <span className="block text-xl font-bold font-sans text-white">{(heroMarket.yesPool + heroMarket.noPool).toLocaleString()} XLM</span>
            </div>
            <div className="bg-white/3 rounded-2xl py-4 px-6 border border-white/5 flex flex-col justify-center">
              <span className="block text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Status</span>
              <span className="block text-sm font-bold font-sans text-blue-400 uppercase tracking-widest">{heroMarket.status}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {markets.slice(1).map((m, idx) => (
            <div 
              key={m.id}
              onClick={() => setSelectedMarket(m)}
              className="glass-panel p-8 rounded-3xl group cursor-pointer hover:bg-white/4 transition-all border border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-blue-500/40 transition-all">
                  <span className="material-symbols-outlined text-white/60 text-sm">
                    {idx === 0 ? "rocket_launch" : "satellite_alt"}
                  </span>
                </div>
                <span className={`${idx === 0 ? "text-blue-400" : "text-purple-400"} text-[9px] font-black tracking-widest uppercase`}>
                  {idx === 0 ? "Live Event" : "Cosmic Pulse"}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-6 font-sans text-white leading-tight line-clamp-2 min-h-14">
                {m.title}
              </h3>
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pt-4 border-t border-white/5">
                <div>
                  <div className="text-[8px] text-white/30 uppercase font-bold mb-1 tracking-widest whitespace-nowrap">Market Sentiment</div>
                  <div className="text-3xl font-bold text-white font-sans tracking-tighter">
                    {m.yesPool + m.noPool > 0 
                      ? Math.round((m.yesPool / (m.yesPool + m.noPool)) * 100) 
                      : 50}%
                  </div>
                </div>
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest group-hover:text-white group-hover:translate-x-1 transition-all">
                  Trade Now →
                </span>
              </div>
            </div>
          ))}
          
          {/* Mock card if only one real market exists */}
          {markets.length === 1 && (
            <div className="glass-panel p-8 rounded-3xl opacity-40 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-3xl mb-4 text-white/20">explore</span>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 italic">Awaiting Next Cosmic Pulse...</p>
            </div>
          )}
        </div>
      </section>

      {/* Sidebar Grid */}
      <section className="col-span-1 xl:col-span-4 space-y-8">
        <div className="glass-panel rounded-3xl p-8 border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[10px] font-bold font-sans uppercase tracking-[0.2em] flex items-center text-white/80">
              <span className="material-symbols-outlined mr-3 text-white/30 text-sm">sensors</span>
              Cosmic Alerts
            </h2>
            <span className="text-[7px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-black tracking-widest animate-pulse border border-blue-500/10 uppercase">
              Live Edge
            </span>
          </div>
          <div className="space-y-6">
            <div className="border-l border-white/10 pl-5 py-0.5 group cursor-default">
              <div className="text-[8px] text-white/20 uppercase font-bold mb-1 tracking-widest">02:14 UTC</div>
              <p className="text-xs leading-relaxed text-white/70 group-hover:text-white transition-colors">
                {heroMarket.title} market volume crossed {Math.round(totalVolume * 0.1)} XLM.
              </p>
            </div>
            <div className="border-l border-white/10 pl-5 py-0.5 group cursor-default">
              <div className="text-[8px] text-white/20 uppercase font-bold mb-1 tracking-widest">01:45 UTC</div>
              <p className="text-xs leading-relaxed text-white/50 group-hover:text-white transition-colors">Multiple new oracles joined the consensus layer.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-8 border border-white/5 bg-linear-to-br from-white/3 to-transparent">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[8px] text-white/30 uppercase font-bold mb-2 tracking-widest">Global Flow</div>
              <div className="text-2xl font-bold font-sans text-white tracking-tighter">
                {totalVolume.toLocaleString()} XLM
              </div>
            </div>
            <div className="border-l border-white/10 pl-6">
              <div className="text-[8px] text-white/30 uppercase font-bold mb-2 tracking-widest">Active Stake</div>
              <div className="text-2xl font-bold font-sans text-white tracking-tighter">
                {totalStakes.toLocaleString()} XLM
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      {selectedMarket && (
        <BetModal 
          isOpen={!!selectedMarket}
          onClose={() => setSelectedMarket(null)}
          marketTitle={selectedMarket.title}
          marketId={selectedMarket.id}
          contractMarketId={selectedMarket.contractMarketId}
        />
      )}

      {isCreateModalOpen && publicKey && (
        <CreateMarketModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          userPublicKey={publicKey}
        />
      )}
    </div>
  );
}
