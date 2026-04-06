"use client";

import { useState } from "react";

interface Bet {
  id: string;
  marketId: string;
  userPublicKey: string;
  amount: number;
  commitment: string;
  revealed: boolean;
  createdAt: string;
  market: {
    id: string;
    title: string;
    status: string;
  };
  user: {
    publicKey: string;
    name: string | null;
  };
}

interface BetManagementTableProps {
  bets: Bet[];
  loading: boolean;
  onSort?: (sortBy: "amount" | "createdAt", sortOrder: "asc" | "desc") => void;
  onFilter?: (marketId: string) => void;
}

export default function BetManagementTable({
  bets,
  loading,
  onSort,
  onFilter,
}: BetManagementTableProps) {
  const [copiedCommitment, setCopiedCommitment] = useState<string | null>(null);
  const [copiedPublicKey, setCopiedPublicKey] = useState<string | null>(null);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const copyToClipboard = async (text: string, type: "commitment" | "publicKey") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "commitment") {
        setCopiedCommitment(text);
        setTimeout(() => setCopiedCommitment(null), 2000);
      } else {
        setCopiedPublicKey(text);
        setTimeout(() => setCopiedPublicKey(null), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-4">Loading bets...</p>
        </div>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-20 text-center">
          <span className="material-symbols-outlined text-white/10 text-5xl mb-6">receipt_long</span>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest italic">No bets found for selected filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="text-left px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">Market</th>
              <th className="text-left px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">User</th>
              <th className="text-right px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">Amount</th>
              <th className="text-left px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">Commitment</th>
              <th className="text-center px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">Status</th>
              <th className="text-right px-6 py-4 text-[9px] text-white/50 uppercase font-black tracking-widest">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm text-white font-medium max-w-xs truncate">{bet.market.title}</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-wider">{bet.market.status}</div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => copyToClipboard(bet.user.publicKey, "publicKey")}
                    className="group relative text-left"
                    title={bet.user.publicKey}
                  >
                    <div className="text-sm text-white font-mono hover:text-purple-400 transition-colors">
                      {bet.user.publicKey.slice(0, 8)}...
                    </div>
                    {bet.user.name && (
                      <div className="text-[9px] text-white/40">{bet.user.name}</div>
                    )}
                    {copiedPublicKey === bet.user.publicKey && (
                      <span className="absolute -top-8 left-0 bg-green-500 text-white text-[9px] px-2 py-1 rounded">
                        Copied!
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-sm text-white font-bold">{bet.amount.toFixed(2)} XLM</div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => copyToClipboard(bet.commitment, "commitment")}
                    className="group relative"
                    title={bet.commitment}
                  >
                    <div className="text-xs text-purple-400 font-mono hover:text-purple-300 transition-colors">
                      {bet.commitment.slice(0, 12)}...
                    </div>
                    {copiedCommitment === bet.commitment && (
                      <span className="absolute -top-8 left-0 bg-green-500 text-white text-[9px] px-2 py-1 rounded">
                        Copied!
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    bet.revealed 
                      ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}>
                    {bet.revealed ? "Revealed" : "Sealed"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-xs text-white/60">{formatRelativeTime(bet.createdAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 p-4">
        {bets.map((bet) => (
          <div key={bet.id} className="bg-white/5 rounded-2xl p-4 space-y-3 border border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-white font-medium mb-1">{bet.market.title}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">{bet.market.status}</div>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                bet.revealed 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}>
                {bet.revealed ? "Revealed" : "Sealed"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">User</div>
                <button
                  onClick={() => copyToClipboard(bet.user.publicKey, "publicKey")}
                  className="relative text-xs text-white font-mono hover:text-purple-400 transition-colors"
                  title={bet.user.publicKey}
                >
                  {bet.user.publicKey.slice(0, 8)}...
                  {copiedPublicKey === bet.user.publicKey && (
                    <span className="absolute -top-8 left-0 bg-green-500 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
              </div>

              <div className="text-right">
                <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Amount</div>
                <div className="text-sm text-white font-bold">{bet.amount.toFixed(2)} XLM</div>
              </div>
            </div>

            <div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Commitment</div>
              <button
                onClick={() => copyToClipboard(bet.commitment, "commitment")}
                className="relative text-xs text-purple-400 font-mono hover:text-purple-300 transition-colors break-all"
                title={bet.commitment}
              >
                {bet.commitment.slice(0, 20)}...
                {copiedCommitment === bet.commitment && (
                  <span className="absolute -top-8 left-0 bg-green-500 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap">
                    Copied!
                  </span>
                )}
              </button>
            </div>

            <div className="text-right">
              <div className="text-xs text-white/60">{formatRelativeTime(bet.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
