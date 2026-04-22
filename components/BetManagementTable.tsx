"use client";

import { useState } from "react";
import { Terminal, Activity } from "lucide-react";

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
}: BetManagementTableProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const d = new Date(dateString);
    return d.toISOString().replace("T", " ").slice(0, 19).toUpperCase();
  };

  if (loading) {
    return (
      <div className="py-20 text-center border border-white/5 bg-[#0D0D0D] font-mono">
        <div className="w-8 h-8 border-2 border-[#FF8C00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <span className="text-[10px] text-white/20 uppercase font-black tracking-[0.4em]">SYNCING TX LOGS...</span>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="py-24 text-center border border-dashed border-white/10 bg-[#0D0D0D] font-mono">
        <Terminal className="w-12 h-12 text-white/5 mx-auto mb-6" />
        <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.4em] italic">NO DATA RECORDS FOUND</p>
      </div>
    );
  }

  return (
    <div className="font-mono bg-[#0D0D0D] border border-white/10">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest">SOURCE MARKET</th>
              <th className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest">AUTHENTICATOR</th>
              <th className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest">INJECTION</th>
              <th className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest">COMMIT HASH</th>
              <th className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest text-center">STATE</th>
              <th className="px-6 py-4 text-right text-[9px] text-white/20 font-black uppercase tracking-widest">TIMESTAMP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bets.map((bet) => (
              <tr key={bet.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-6">
                  <div className="text-[12px] font-black text-white uppercase italic tracking-tighter max-w-[200px] truncate">{bet.market.title}</div>
                  <div className="text-[8px] text-white/20 font-bold tracking-[0.2em] mt-1">SYSTEM ID: {bet.market.id.slice(0, 8)}</div>
                </td>
                <td className="px-6 py-6">
                  <button 
                    onClick={() => copyToClipboard(bet.userPublicKey)}
                    className="flex flex-col items-start group/btn"
                  >
                    <span className="text-[11px] font-black text-blue-400 group-hover/btn:text-white transition-colors">{bet.userPublicKey.slice(0, 12)}...</span>
                    <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest flex items-center gap-1">
                      {copiedText === bet.userPublicKey ? "SYNCED TO CLIPBOARD" : "COPY AUTH KEY"}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-6 text-[12px] font-black text-white">{bet.amount.toFixed(2)} XLM</td>
                <td className="px-6 py-6">
                  <button 
                    onClick={() => copyToClipboard(bet.commitment)}
                    className="flex flex-col items-start group/btn"
                  >
                    <span className="text-[10px] font-black text-[#FF8C00] group-hover/btn:text-white transition-colors uppercase italic">{bet.commitment.slice(0, 16)}...</span>
                    <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest flex items-center gap-1">
                      {copiedText === bet.commitment ? "HASH COPIED" : "READ COMMIT HASH"}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-6 text-center">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 border ${
                    bet.revealed 
                      ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5" 
                      : "text-blue-400 border-blue-400/30 bg-blue-400/5"
                  }`}>
                    {bet.revealed ? "[REVEALED]" : "[SEALED]"}
                  </span>
                </td>
                <td className="px-6 py-6 text-right text-[10px] text-white/40 font-bold">{formatTimestamp(bet.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Card Stack */}
      <div className="lg:hidden divide-y divide-white/5">
        {bets.map((bet) => (
          <div key={bet.id} className="p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="text-[12px] font-black text-white uppercase italic tracking-tighter">{bet.market.title}</div>
                <div className="text-[8px] text-white/20 font-bold tracking-[0.2em] uppercase">SYSTEM_NODE_{bet.id.slice(0, 4)}</div>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border ${
                bet.revealed 
                  ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5" 
                  : "text-blue-400 border-blue-400/30 bg-blue-400/5"
              }`}>
                {bet.revealed ? "REVEALED" : "SEALED"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div>
                <div className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1">AUTH_KEY</div>
                <div className="text-[10px] font-black text-blue-400">{bet.userPublicKey.slice(0, 8)}...</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-1">INJECTION</div>
                <div className="text-[12px] font-black text-white">{bet.amount.toFixed(2)} XLM</div>
              </div>
            </div>

            <div className="bg-white/[0.02] p-4 border border-white/10">
              <div className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-2">COMMITMENT HASH</div>
              <div className="text-[9px] font-black text-[#FF8C00] break-all uppercase italic">{bet.commitment}</div>
            </div>

            <div className="flex justify-between items-center text-[9px] font-bold text-white/20 uppercase tracking-widest pt-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" /> VERIFIED
              </div>
              <div>{formatTimestamp(bet.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
