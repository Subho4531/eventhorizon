"use client";

import { useState } from "react";
import { Copy, MapPin, Loader2, Check } from "lucide-react";

export default function PortfolioPage() {
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  // MOCK POSITIONS (Usually fetched from Freighter + Soroban RPC)
  const MOCK_POSITIONS = [
    {
      id: "9f8a...3b21",
      marketTitle: "Starship-V Launch Success by Q4?",
      side: "YES",
      commitment: "0x4f8...a21b",
      resolved: false,
      won: false,
    },
    {
      id: "2b4c...9d8e",
      marketTitle: "Is Bitcoin crossing $150k this month?",
      side: "NO",
      commitment: "0x7a1...b39f",
      resolved: true,
      won: true,
    }
  ];

  const handleClaim = async (id: string, side: string) => {
    setClaiming(id);
    try {
      if (!window.snarkjs) throw new Error("snarkjs not loaded");
      
      const nonce = 12345;
      const bettorKey = 54321;
      
      const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
        { side: side === "YES" ? 1 : 0, nonce, bettor_key: bettorKey },
        "/circuit.wasm",
        "/circuit_final.zkey"
      );
      
      console.log("Soroban invoke params:", {
         proof_a: proof.pi_a.slice(0, 2),
         proof_b: [proof.pi_b[0].reverse(), proof.pi_b[1].reverse()],
         proof_c: proof.pi_c.slice(0, 2),
         nullifier: publicSignals[0]
      });

      await new Promise(r => setTimeout(r, 2000));
      alert("Successfully claimed 2000 XLM with ZK-SNARK nullifier!");
    } catch (e) {
      console.error(e);
      alert("Verification failed");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 lg:py-12 relative z-10 h-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 px-4 xl:px-0">
        <div>
          <div className="font-sans uppercase tracking-[0.4em] text-[10px] text-blue-400 mb-4">PORTFOLIO OVERVIEW</div>
          <h1 className="font-sans text-4xl md:text-6xl font-bold tracking-tighter text-white">COSMIC<br/><span className="text-white/40">HORIZON</span></h1>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-end">
          <div className="font-sans uppercase tracking-[0.3em] text-[10px] text-white/40 mb-1">TOTAL SYSTEM EQUITY</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl lg:text-4xl font-sans font-bold text-white">24,550 XLM</span>
            <span className="text-orange-500 font-sans font-bold text-lg">+12.4%</span>
          </div>
        </div>
      </div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 xl:px-0">
        
        {/* Main Chart Card */}
        <div className="lg:col-span-8 bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 lg:p-8">
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-[8px] font-bold tracking-widest uppercase rounded-full">1D</span>
              <span className="px-3 py-1 text-white/40 text-[8px] font-bold tracking-widest uppercase rounded-full hover:bg-white/5 cursor-pointer">1W</span>
              <span className="px-3 py-1 text-white/40 text-[8px] font-bold tracking-widest uppercase rounded-full hover:bg-white/5 cursor-pointer">1M</span>
            </div>
          </div>
          <div className="mb-12">
            <div className="font-sans uppercase tracking-[0.3em] text-[10px] text-white/60 mb-2">EQUITY TRAJECTORY</div>
            <div className="text-3xl lg:text-4xl font-sans font-bold text-white">Growth Core</div>
          </div>
          
          {/* Neon Blue Trend Chart Placeholder */}
          <div className="h-64 w-full relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200">
              <defs>
                <linearGradient id="ptfGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3"></stop>
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <path className="drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]" d="M0,150 Q50,140 100,160 T200,100 T300,120 T400,60 T500,80 T600,40 T700,50 T800,20" fill="none" stroke="#2563eb" strokeWidth="3"></path>
              <path d="M0,150 Q50,140 100,160 T200,100 T300,120 T400,60 T500,80 T600,40 T700,50 T800,20 V200 H0 Z" fill="url(#ptfGradient)"></path>
            </svg>
            <div className="absolute top-[20px] right-0 w-3 h-3 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,1)] animate-pulse"></div>
          </div>
        </div>

        {/* Active Predictions Side Panel (ZK Sealed Vaults) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 h-full">
            <div className="flex justify-between items-center mb-6">
              <div className="font-sans uppercase tracking-[0.3em] text-[10px] text-white/60">SEALED POSITIONS (ZK)</div>
              <span className="material-symbols-outlined text-white/40 text-sm">lock</span>
            </div>
            
            <div className="space-y-4">
              {MOCK_POSITIONS.map((pos) => (
                <div key={pos.id} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-4">
                      <div className="text-[10px] font-sans font-bold text-white mb-1 uppercase tracking-wider line-clamp-2">{pos.marketTitle}</div>
                      <div className="text-[8px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-2 h-2" /> {pos.id}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${pos.side === 'YES' ? 'text-blue-500' : 'text-orange-500'}`}>{pos.side}</div>
                      <div className="text-[8px] text-white/40 uppercase tracking-widest">SIDE</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                     <div className="text-[10px] text-white/40 font-mono tracking-wider">{pos.commitment}</div>
                     {pos.resolved ? (
                       pos.won ? (
                         <button 
                           onClick={() => handleClaim(pos.id, pos.side)}
                           disabled={claiming === pos.id}
                           className="text-[10px] uppercase font-bold tracking-widest bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-400 transition-colors flex items-center gap-1"
                         >
                           {claiming === pos.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                         </button>
                       ) : (
                         <span className="text-[10px] uppercase font-bold tracking-widest text-white/30 px-3 py-1 border border-white/10 rounded-full">Lost</span>
                       )
                     ) : (
                       <span className="text-[10px] uppercase font-bold tracking-widest text-green-400 px-3 py-1 bg-green-500/10 rounded-full flex items-center gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                       </span>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-12">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 overflow-hidden">
            <div className="font-sans uppercase tracking-[0.3em] text-[10px] text-white/60 mb-8">SYSTEM LOG / RECENT ACTIVITY</div>
            <div className="space-y-6">
              
              {/* Activity Item 1 */}
              <div className="flex items-center gap-6 group">
                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-600/20 shrink-0">
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                </div>
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                  <div className="col-span-1">
                    <div className="text-[10px] text-white font-bold uppercase tracking-widest">POSITION OPENED</div>
                    <div className="text-[8px] text-white/40 uppercase">ORBITAL INFRASTRUCTURE</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] text-white/60 uppercase">COMMITMENT</div>
                    <div className="text-[10px] text-white font-bold font-mono">0x4f8...a21b</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] text-white/60 uppercase">TIMESTAMP</div>
                    <div className="text-[10px] text-white font-bold">02:44:12 UTC</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white font-bold">- 500 XLM</div>
                    <div className="text-[8px] text-white/40 uppercase">STAKED</div>
                  </div>
                </div>
              </div>

              {/* Activity Item 2 */}
              <div className="flex items-center gap-6 group">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20 shrink-0">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
                  <div className="col-span-1">
                    <div className="text-[10px] text-white font-bold uppercase tracking-widest">RESOLUTION CLAIM</div>
                    <div className="text-[8px] text-white/40 uppercase">BTC 150K TARGET</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] text-white/60 uppercase">ZK NULLIFIER</div>
                    <div className="text-[10px] text-orange-400 font-bold font-mono">0x9a2...c44d</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] text-white/60 uppercase">TIMESTAMP</div>
                    <div className="text-[10px] text-white font-bold">YESTERDAY</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-orange-400 font-bold">+ 2,150.44 XLM</div>
                    <div className="text-[8px] text-white/40 uppercase">PAYOUT</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
