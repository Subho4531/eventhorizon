"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { Crown, Medal, Award, TrendingUp, Users, Loader2, Trophy, Star } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

interface User {
  publicKey: string;
  name: string;
  pfpUrl: string;
  balance: number;
  totalWinnings: number;
  totalSpent: number;
  netProfit: number;
  updatedAt: string;
}

export default function LeaderboardPage() {
  const { publicKey: myPublicKey } = useWallet();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const CACHE_KEY = "gravityflow_leaderboard_cache";

  useEffect(() => {
    // 1. Load from cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.users) {
          setUsers(parsed.users);
          setLoading(false);
        }
      } catch (e) {
        console.error("Leaderboard cache error:", e);
      }
    }

    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        const userList = data.users || [];
        setUsers(userList);
        
        // 2. Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          users: userList,
          updatedAt: Date.now()
        }));
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
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF8C00]/[0.06] border border-[#FF8C00]/15 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#FF8C00]/60 animate-spin" />
          </div>
          <span className="text-[10px] text-white/25 uppercase tracking-[0.2em] font-medium">Loading rankings...</span>
        </div>
      </div>
    );
  }

  /* Podium config for top 3 */
  const podiumConfig = [
    {
      // #2 — Silver (left)
      order: "order-2 md:order-1",
      size: "w-20 h-20",
      barHeight: "h-44",
      avatarBorder: "border-white/15 hover:border-[#C0C0C0]/60",
      glowColor: "rgba(192,192,192,0.1)",
      accentColor: "#C0C0C0",
      badgeColor: "bg-gradient-to-br from-[#C0C0C0] to-[#898989]",
      tierLabel: "Silver",
      tierClass: "text-[#C0C0C0]",
      Icon: Medal,
    },
    {
      // #1 — Gold (center)
      order: "order-1 md:order-2",
      size: "w-28 h-28",
      barHeight: "h-60",
      avatarBorder: "border-[#FFD700]/30 hover:border-[#FFD700]/80",
      glowColor: "rgba(255,215,0,0.15)",
      accentColor: "#FFD700",
      badgeColor: "bg-gradient-to-br from-[#FFD700] to-[#FF8C00]",
      tierLabel: "Champion",
      tierClass: "text-[#FFD700]",
      Icon: Crown,
    },
    {
      // #3 — Bronze (right)
      order: "order-3",
      size: "w-20 h-20",
      barHeight: "h-36",
      avatarBorder: "border-white/15 hover:border-[#CD7F32]/60",
      glowColor: "rgba(205,127,50,0.1)",
      accentColor: "#CD7F32",
      badgeColor: "bg-gradient-to-br from-[#CD7F32] to-[#8B5A2B]",
      tierLabel: "Bronze",
      tierClass: "text-[#CD7F32]",
      Icon: Award,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 lg:py-12 relative z-10 h-full">
      {/* ── Header Section ── */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16 text-center lg:text-left flex flex-col lg:flex-row lg:items-end justify-between gap-8"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="w-8 h-8 rounded-xl bg-[#FF8C00]/[0.06] border border-[#FF8C00]/15 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#FF8C00]/60" />
            </div>
            <span className="uppercase tracking-[0.2em] text-[9px] text-[#FF8C00]/70 font-semibold">
              Global Standings
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Leaderboard
          </h1>
          <p className="text-sm text-white/25 max-w-md font-medium">
            Top traders ranked by net profit (Total Payouts - Total Bets) across all prediction markets.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex gap-6 items-center p-5 rounded-2xl border border-white/[0.06] bg-[#0A0A0A] backdrop-blur-md">
          <div className="text-center">
            <p className="text-[8px] text-white/25 uppercase tracking-[0.15em] font-semibold mb-1.5">Traders</p>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-6 h-6 rounded-lg bg-[#FF8C00]/[0.06] flex items-center justify-center">
                <Users className="w-3 h-3 text-[#FF8C00]/50" />
              </div>
              <span className="text-xl font-black text-white tabular-nums">{users.length}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-[8px] text-white/25 uppercase tracking-[0.15em] font-semibold mb-1.5">Net Profits</p>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-6 h-6 rounded-lg bg-[#00C853]/[0.06] flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-[#00C853]/50" />
              </div>
              <span className="text-xl font-black text-white tabular-nums font-mono">
                {users.reduce((sum, u) => sum + (u.netProfit || 0), 0).toLocaleString()}
                <span className="text-[9px] text-white/15 ml-1 font-medium font-sans">XLM</span>
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Top 3 Podium ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 max-w-4xl mx-auto px-4">
        {[1, 0, 2].map((podiumIndex) => {
          const user = top3[podiumIndex];
          if (!user) return null;
          const config = podiumConfig[podiumIndex];
          const rank = podiumIndex === 1 ? 1 : podiumIndex === 0 ? 2 : 3;

          return (
            <motion.div
              key={user.publicKey}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + podiumIndex * 0.15, duration: 0.5, ease: "easeOut" }}
              className={`${config.order} flex flex-col items-center group`}
            >
              {/* Avatar */}
              <div className="relative mb-6">
                {rank === 1 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-float">
                    <Crown className="w-7 h-7 text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.4)]" />
                  </div>
                )}
                <div className={`${config.size} rounded-full border-2 ${config.avatarBorder} p-1 transition-all duration-500 overflow-hidden relative z-10`}
                  style={{ boxShadow: `0 0 40px ${config.glowColor}` }}
                >
                  <Image 
                    fill
                    className="rounded-full object-cover" 
                    alt="Avatar" 
                    src={user.pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.publicKey}`}
                  />
                </div>
                {/* Rank badge */}
                <div className={`absolute -bottom-2 -right-2 w-9 h-9 ${config.badgeColor} rounded-full flex items-center justify-center text-lg font-black text-black shadow-lg z-20 border-2 border-[#050505]`}>
                  {rank}
                </div>
              </div>

              {/* Pedestal */}
              <div className={`bg-[#0A0A0A] w-full ${config.barHeight} rounded-t-2xl flex flex-col items-center justify-center p-6 border-x border-t border-white/[0.06] relative overflow-hidden transition-all duration-300 group-hover:bg-white/[0.03]`}>
                {/* Top accent line */}
                <div className="absolute top-0 left-0 w-full h-[2px] rounded-full" 
                  style={{ background: `linear-gradient(90deg, transparent, ${config.accentColor}30, transparent)` }} 
                />

                <h3 className={`text-base font-bold mb-1 text-white truncate w-full text-center ${rank === 1 ? "text-lg" : ""}`}>
                  {user.name || maskAddress(user.publicKey)}
                </h3>
                <p className={`text-[9px] font-bold uppercase tracking-[0.2em] mb-4 ${config.tierClass} flex items-center gap-1.5`}>
                  <Star className="w-2.5 h-2.5" />
                  {config.tierLabel}
                </p>
                <div className="text-center">
                  <p className={`font-black tabular-nums text-white font-mono ${rank === 1 ? "text-3xl" : "text-xl"}`}>
                    {(user.netProfit || 0).toLocaleString()}
                  </p>
                  <p className="text-[8px] text-white/20 font-medium uppercase tracking-[0.15em] mt-1">XLM Won</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* ── Ranking Table ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl overflow-hidden mb-12 border border-white/[0.06] bg-[#0A0A0A]"
      >
        {/* Table Header */}
        <div className="px-8 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row justify-between items-center bg-white/[0.02] gap-4">
          <h2 className="text-xs font-bold tracking-wide text-white/35 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white/[0.04] flex items-center justify-center">
              <Users className="w-3 h-3 opacity-40" />
            </div>
            Full Rankings
          </h2>
          <div className="flex gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-[#FF8C00]/[0.06] text-[8px] font-bold tracking-[0.12em] uppercase border border-[#FF8C00]/15 text-[#FF8C00]/60">
              By Profit
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="text-left border-b border-white/[0.05]">
                <th className="px-8 py-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em]">Rank</th>
                <th className="px-8 py-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em]">Trader</th>
                <th className="px-8 py-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em]">Tier</th>
                <th className="px-8 py-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em]">Performance</th>
                <th className="px-8 py-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em] text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {remaining.map((user, idx) => {
                const rank = idx + 4;
                const isMe = user.publicKey === myPublicKey;
                const tierLabel = idx < 2 ? "Gold" : idx < 7 ? "Silver" : "Bronze";
                const tierColor = idx < 2 ? "text-[#FFD700] border-[#FFD700]/15 bg-[#FFD700]/[0.04]" : idx < 7 ? "text-[#C0C0C0] border-[#C0C0C0]/15 bg-[#C0C0C0]/[0.04]" : "text-[#CD7F32] border-[#CD7F32]/15 bg-[#CD7F32]/[0.04]";
                const perfScore = Math.min(99, 60 + (idx % 40));
                const perfColor = perfScore > 80 ? "from-[#00C853]/30 to-[#00C853]/70" : perfScore > 60 ? "from-[#FF8C00]/30 to-[#FF8C00]/60" : "from-white/10 to-white/30";
                
                return (
                  <motion.tr 
                    key={user.publicKey} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + idx * 0.03 }}
                    className={`group transition-all duration-300 border-b border-white/[0.03] ${
                      isMe 
                        ? "bg-[#FF8C00]/[0.03] border-l-2 border-l-[#FF8C00]" 
                        : "hover:bg-white/[0.015]"
                    }`}
                  >
                    <td className={`px-8 py-4 font-bold text-sm tabular-nums font-mono ${isMe ? "text-[#FF8C00]" : "text-white/20"}`}>
                      {rank.toString().padStart(2, '0')}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full border ${isMe ? "border-[#FF8C00]/30" : "border-white/[0.08]"} p-0.5 bg-black overflow-hidden relative shrink-0`}>
                          <Image 
                            fill
                            className="rounded-full object-cover" 
                            alt="Avatar" 
                            src={user.pfpUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.publicKey}`}
                          />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isMe ? "text-white" : "text-white/60 group-hover:text-white/80"} transition-colors duration-300`}>
                            {user.name || maskAddress(user.publicKey)}
                          </p>
                          {isMe && <p className="text-[8px] text-[#FF8C00]/50 font-bold uppercase tracking-[0.15em]">You</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-2.5 py-1 rounded-lg border text-[8px] font-bold tracking-[0.1em] uppercase ${tierColor}`}>
                        {tierLabel}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full bg-gradient-to-r ${perfColor} transition-all duration-700`}
                            style={{ width: `${perfScore}%` }} 
                          />
                        </div>
                        <span className="text-[10px] text-white/25 font-semibold tabular-nums font-mono">{perfScore}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="font-bold text-sm tabular-nums text-white font-mono">
                        {(user.netProfit || 0).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-white/15 ml-1.5 font-medium">XLM</span>
                    </td>
                  </motion.tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-xs text-white/12 font-medium">
                    No traders found yet. Be the first to trade!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}
