"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

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
          <span className="font-sans uppercase tracking-[0.3em] text-[10px] text-blue-500 font-bold px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">GLOBAL STANDINGS</span>
          <h1 className="text-4xl md:text-5xl font-sans font-bold tracking-tighter text-white uppercase">The Horizon <br/><span className="text-blue-500">Elite</span></h1>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex gap-12 items-center border border-white/5 bg-white/3 backdrop-blur-md">
          <div className="text-center">
            <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1 font-bold">Live Nodes</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse border border-blue-400/40 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
              <span className="text-2xl font-sans font-bold text-white tracking-tighter">{users.length.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="text-center">
            <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1 font-bold">Total Winnings</p>
            <span className="text-2xl font-sans font-bold text-orange-500 tracking-tighter">
              {users.reduce((sum, u) => sum + u.totalWinnings, 0).toLocaleString()} <span className="text-[10px] opacity-60">XLM</span>
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
              <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 group-hover:border-blue-500/40 transition-all duration-500 overflow-hidden shadow-2xl">
                <img 
                  className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                  alt="Avatar" 
                  src={top3[1].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[1].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-sans font-bold text-white shadow-xl">2</div>
            </div>
            <div className="bg-white/5 shadow-[0_0_40px_rgba(37,99,235,0.15)] w-full h-48 rounded-t-3xl flex flex-col items-center justify-center p-6 border-b-0 border border-white/10 backdrop-blur-md">
              <h3 className="font-sans text-lg font-bold mb-1 text-white uppercase tracking-tight truncate w-full text-center">
                {top3[1].name || maskAddress(top3[1].publicKey)}
              </h3>
              <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-blue-500 mb-4 font-black">PLATINUM TIER</p>
              <div className="text-center">
                <p className="font-sans text-2xl font-bold tracking-tighter text-white">{top3[1].totalWinnings.toLocaleString()}</p>
                <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">XLM WON</p>
              </div>
            </div>
          </div>
        )}

        {/* Rank 1 (Central) */}
        {top3[0] && (
          <div className="order-1 md:order-2 flex flex-col items-center group">
            <div className="relative mb-8 transform -translate-y-4 scale-110">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-orange-500 animate-bounce">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              </div>
              <div className="w-32 h-32 rounded-full border-4 border-orange-500/50 p-1 shadow-[0_0_30px_rgba(249,115,22,0.3)] group-hover:border-orange-500 transition-all overflow-hidden bg-black">
                <img 
                  className="w-full h-full rounded-full object-cover" 
                  alt="Avatar" 
                  src={top3[0].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[0].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center border-4 border-black text-2xl font-sans font-bold text-black shadow-2xl">1</div>
            </div>
            <div className="bg-white/5 shadow-[0_0_60px_rgba(249,115,22,0.1)] w-full h-64 rounded-t-3xl flex flex-col items-center justify-center p-6 border-orange-500/20 border-x border-t backdrop-blur-md">
              <h3 className="font-sans text-2xl font-bold mb-1 text-white uppercase tracking-tighter truncate w-full text-center">
                {top3[0].name || maskAddress(top3[0].publicKey)}
              </h3>
              <p className="font-sans uppercase tracking-[0.3em] text-[10px] text-orange-500 font-black mb-6">CELESTIAL GRANDMASTER</p>
              <div className="text-center">
                <p className="font-sans text-4xl font-extrabold tracking-tighter text-white">{top3[0].totalWinnings.toLocaleString()}</p>
                <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-white/40 font-bold">TOTAL WINNINGS</p>
              </div>
            </div>
          </div>
        )}

        {/* Rank 3 */}
        {top3[2] && (
          <div className="order-3 md:order-3 flex flex-col items-center group">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 group-hover:border-purple-500/40 transition-all duration-500 overflow-hidden shadow-2xl">
                <img 
                  className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                  alt="Avatar" 
                  src={top3[2].pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${top3[2].publicKey}`}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-sans font-bold text-white shadow-xl">3</div>
            </div>
            <div className="bg-white/5 shadow-[0_0_40px_rgba(168,85,247,0.15)] w-full h-36 rounded-t-3xl flex flex-col items-center justify-center p-6 border-b-0 border border-white/10 backdrop-blur-md">
              <h3 className="font-sans text-lg font-bold mb-1 text-white uppercase tracking-tight truncate w-full text-center">
                {top3[2].name || maskAddress(top3[2].publicKey)}
              </h3>
              <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-purple-400 mb-2 font-black">GOLD TIER</p>
              <div className="text-center">
                <p className="font-sans text-xl font-bold tracking-tighter text-white">{top3[2].totalWinnings.toLocaleString()}</p>
                <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">XLW WON</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Ranking Table */}
      <section className="bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden mb-12 border border-white/5 shadow-2xl">
        <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center bg-white/3 gap-4">
          <h2 className="font-sans font-bold tracking-widest text-[10px] uppercase text-white/60">Global Ranking Directory</h2>
          <div className="flex gap-4">
            <button className="px-4 py-1.5 rounded-full bg-blue-500/10 text-[9px] font-sans font-bold tracking-widest uppercase border border-blue-500/30 text-blue-400">Total Winnings</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-white/5 bg-black/40">
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">Rank</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">User Identity</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">Status</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 font-bold">Trust Score</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 text-right font-bold">Total Winnings</th>
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
