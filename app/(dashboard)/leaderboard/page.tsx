"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { Zap } from "lucide-react";

interface User {
  publicKey: string;
  name: string;
  pfpUrl: string;
  balance: number;
  totalWinnings: number;
  updatedAt: string;
}

export default function LeaderboardPage() {
  const { publicKey: myPublicKey } = useWallet();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  const top3 = users.slice(0, 3);
  const remaining = users.slice(3);

  // Helper to mask addresses
  const maskAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Unknown";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 lg:py-12 relative z-10 h-full">
      {/* Header Section */}
      <header className="mb-16 text-center lg:text-left flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <span className="uppercase tracking-[0.3em] text-[10px] text-[#2979FF] font-black px-4 py-1.5 bg-[#2979FF]/5 rounded-full border border-[#2979FF]/20 shadow-[0_0_15px_rgba(41,121,255,0.1)]">Global Standings</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase italic leading-[0.9]">The Horizon <br/><span className="text-[#2979FF]">Elite</span></h1>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex gap-12 items-center border border-white/5 bg-white/[0.02] backdrop-blur-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2979FF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-center relative z-10">
            <p className="uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1 font-black">Live Nodes</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2979FF] animate-pulse shadow-[0_0_10px_rgba(41,121,255,0.8)]"></span>
              <span className="text-2xl font-black text-white tracking-tighter">{users.length.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-white/10 relative z-10"></div>
          <div className="text-center relative z-10">
            <p className="uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1 font-black">Total Winnings</p>
            <span className="text-2xl font-black text-[#FF8C00] tracking-tighter">
              {users.reduce((sum, u) => sum + u.totalWinnings, 0).toLocaleString()} <span className="text-[10px] opacity-40">XLM</span>
            </span>
          </div>
        </div>
      </header>

      {/* Top 3 Pedestals */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-24 max-w-5xl mx-auto px-4">
        {/* Rank 2 */}
        {top3[1] && (
          <div className="order-2 md:order-1 flex flex-col items-center group">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-2 border-white/10 p-1 group-hover:border-[#2979FF]/40 transition-all duration-500 overflow-hidden shadow-2xl relative z-10">
                <img 
                  className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                  alt="Avatar" 
                  src={top3[1].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[1].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-black text-white shadow-xl z-20">2</div>
              <div className="absolute inset-0 bg-[#2979FF]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
            </div>
            <div className="bg-white/[0.02] shadow-[0_0_40px_rgba(41,121,255,0.05)] w-full h-48 rounded-t-[2.5rem] flex flex-col items-center justify-center p-6 border-x border-t border-white/5 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#2979FF]/30 to-transparent" />
              <h3 className="text-lg font-black mb-1 text-white uppercase tracking-tight truncate w-full text-center">
                {top3[1].name || maskAddress(top3[1].publicKey)}
              </h3>
              <p className="uppercase tracking-[0.2em] text-[10px] text-[#2979FF] mb-4 font-black">Platinum Tier</p>
              <div className="text-center">
                <p className="text-2xl font-black tracking-tighter text-white tabular-nums">{top3[1].totalWinnings.toLocaleString()}</p>
                <p className="uppercase tracking-[0.2em] text-[8px] text-white/40 font-black">XLM Won</p>
              </div>
            </div>
          </div>
        )}

        {/* Rank 1 (Central) */}
        {top3[0] && (
          <div className="order-1 md:order-2 flex flex-col items-center group">
            <div className="relative mb-8 transform -translate-y-4 scale-110 relative z-30">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[#FF8C00] animate-bounce">
                <Zap className="w-8 h-8 fill-[#FF8C00]" />
              </div>
              <div className="w-32 h-32 rounded-full border-4 border-[#FF8C00]/30 p-1 shadow-[0_0_50px_rgba(255,140,0,0.2)] group-hover:border-[#FF8C00] transition-all overflow-hidden bg-black relative">
                <img 
                  className="w-full h-full rounded-full object-cover" 
                  alt="Avatar" 
                  src={top3[0].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[0].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-[#FF8C00] rounded-full flex items-center justify-center border-4 border-[#0D0D0D] text-2xl font-black text-black shadow-2xl">1</div>
              <div className="absolute inset-0 bg-[#FF8C00]/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full -z-10" />
            </div>
            <div className="bg-white/[0.03] shadow-[0_0_80px_rgba(255,140,0,0.08)] w-full h-64 rounded-t-[3rem] flex flex-col items-center justify-center p-6 border-x border-t border-[#FF8C00]/20 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[#FF8C00]/40 to-transparent" />
              <h3 className="text-2xl font-black mb-1 text-white uppercase tracking-tighter truncate w-full text-center italic">
                {top3[0].name || maskAddress(top3[0].publicKey)}
              </h3>
              <p className="uppercase tracking-[0.3em] text-[10px] text-[#FF8C00] font-black mb-6">Celestial Grandmaster</p>
              <div className="text-center">
                <p className="text-4xl font-black tracking-tighter text-white tabular-nums">{top3[0].totalWinnings.toLocaleString()}</p>
                <p className="uppercase tracking-[0.2em] text-[10px] text-white/40 font-black">Total Winnings</p>
              </div>
            </div>
          </div>
        )}

        {/* Rank 3 */}
        {top3[2] && (
          <div className="order-3 md:order-3 flex flex-col items-center group">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-2 border-white/10 p-1 group-hover:border-purple-500/40 transition-all duration-500 overflow-hidden shadow-2xl relative z-10">
                <img 
                  className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                  alt="Avatar" 
                  src={top3[2].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[2].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-black text-white shadow-xl z-20">3</div>
              <div className="absolute inset-0 bg-purple-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
            </div>
            <div className="bg-white/[0.02] shadow-[0_0_40px_rgba(168,85,247,0.05)] w-full h-36 rounded-t-[2rem] flex flex-col items-center justify-center p-6 border-x border-t border-white/5 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
              <h3 className="text-lg font-black mb-1 text-white uppercase tracking-tight truncate w-full text-center">
                {top3[2].name || maskAddress(top3[2].publicKey)}
              </h3>
              <p className="uppercase tracking-[0.2em] text-[10px] text-purple-400 mb-2 font-black">Gold Tier</p>
              <div className="text-center">
                <p className="text-xl font-black tracking-tighter text-white tabular-nums">{top3[2].totalWinnings.toLocaleString()}</p>
                <p className="uppercase tracking-[0.2em] text-[8px] text-white/40 font-black">XLM Won</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Ranking Table */}
      <section className="bg-white/[0.02] backdrop-blur-md rounded-[2.5rem] overflow-hidden mb-12 border border-white/5 shadow-2xl">
        <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center bg-white/[0.02] gap-4">
          <h2 className="font-black tracking-widest text-[10px] uppercase text-white/40 italic">Global Ranking Directory</h2>
          <div className="flex gap-4">
            <button className="px-4 py-1.5 rounded-full bg-blue-500/10 text-[9px] font-sans font-bold tracking-widest uppercase border border-blue-500/30 text-blue-400">Total Winnings</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-white/5 bg-black/40">
                <th className="px-8 py-5 uppercase tracking-[0.3em] text-[9px] text-white/20 font-black italic">Rank</th>
                <th className="px-8 py-5 uppercase tracking-[0.3em] text-[9px] text-white/20 font-black italic">Explorer Identity</th>
                <th className="px-8 py-5 uppercase tracking-[0.3em] text-[9px] text-white/20 font-black italic">Status</th>
                <th className="px-8 py-5 uppercase tracking-[0.3em] text-[9px] text-white/20 font-black italic">Trust Score</th>
                <th className="px-8 py-5 uppercase tracking-[0.3em] text-[9px] text-white/20 text-right font-black italic">Total Winnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {remaining.map((user, idx) => {
                const rank = idx + 4;
                const isMe = user.publicKey === myPublicKey;
                
                return (
                  <tr key={user.publicKey} className={`hover:bg-white/5 transition-all group ${isMe ? "bg-blue-500/10 border-l-4 border-blue-500" : ""}`}>
                    <td className={`px-8 py-5 font-sans font-bold ${isMe ? "text-blue-400" : "text-white/40"}`}>
                      {rank.toString().padStart(2, '0')}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full border ${isMe ? "border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-white/10"} p-0.5 bg-black overflow-hidden`}>
                          <img 
                            className="w-full h-full rounded-full object-cover" 
                            alt="Avatar" 
                            src={user.pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.publicKey}`}
                          />
                        </div>
                        <div>
                          <p className={`font-sans font-bold text-sm ${isMe ? "text-white font-extrabold" : "text-white/80"}`}>
                            {user.name || maskAddress(user.publicKey)}
                          </p>
                          <p className="font-sans text-[8px] text-white/30 uppercase tracking-widest">
                            {isMe ? "Your Account" : "Active Explorer"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full border ${idx < 5 ? "border-blue-500/30 text-blue-400" : "border-white/10 text-white/40"} text-[8px] font-sans font-bold tracking-widest uppercase`}>
                        {idx < 2 ? "Gold" : idx < 7 ? "Silver" : "Bronze"}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(99, 60 + (idx % 40))}%` }}></div>
                        </div>
                        <span className="font-sans text-[10px] text-white/60">{Math.min(99, 60 + (idx % 40))}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-sans font-bold text-lg tabular-nums text-white tracking-tighter">
                      {user.totalWinnings.toLocaleString()} <span className="text-[10px] opacity-40">XLM</span>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center uppercase tracking-[0.3em] font-sans text-xs text-white/20">
                    No explorers found in the current quadrant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
