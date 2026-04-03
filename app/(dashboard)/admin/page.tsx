"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { resolveMarket, submitSignedXdr } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  title: string;
  description: string;
  contractMarketId: number;
  status: string;
  yesPool: number;
  noPool: number;
}

export default function AdminPage() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [payoutBps, setPayoutBps] = useState("20000"); // 2x default

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        // Show only OPEN markets for resolution
        setMarkets(data.markets.filter((m: any) => m.status === "OPEN"));
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  async function handleResolve(market: Market) {
    if (!publicKey) return alert("Please connect wallet");
    
    setResolvingId(market.id);
    try {
      // 1. Build XDR
      const res = await resolveMarket(
        publicKey,
        market.contractMarketId,
        outcome,
        parseInt(payoutBps)
      );

      if (!res.success || !res.unsignedXdr) throw new Error("Failed to build XDR");

      // 2. Sign
      const signRes = await signTransaction(res.unsignedXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      if (!signRes.signedTxXdr) throw new Error("Signing failed");

      // 3. Submit
      await submitSignedXdr(signRes.signedTxXdr);

      // 4. Sync DB
      const dbRes = await fetch(`/api/markets/${market.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          payoutBps: parseInt(payoutBps),
          oraclePubKey: publicKey
        }),
      });

      if (!dbRes.ok) throw new Error("DB sync failed");

      alert("Market resolved successfully!");
      router.refresh();
      setMarkets(markets.filter(m => m.id !== market.id));
    } catch (err: any) {
      alert(err.message || "Resolution failed");
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <div className="p-10 text-white/50 text-xs uppercase animate-pulse">Loading Consensus Layer...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-12">
      <header>
        <span className="text-[10px] text-blue-400 font-black tracking-[0.3em] uppercase mb-4 block">Oracle Authority</span>
        <h1 className="text-4xl font-bold text-white tracking-tight">Consensus Resolution</h1>
        <p className="text-white/40 text-[10px] mt-4 uppercase tracking-widest">Authorized oracles must define the final cosmic state.</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {markets.length === 0 ? (
          <div className="glass-panel p-20 text-center rounded-4xl border border-dashed border-white/10">
            <span className="material-symbols-outlined text-white/10 text-5xl mb-6">verified_user</span>
            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest italic">All horizons reached consensus. No pending resolutions.</p>
          </div>
        ) : (
          markets.map((m) => (
            <div key={m.id} className="glass-panel p-8 rounded-3xl border border-white/5 bg-linear-to-br from-white/2 to-transparent group">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="space-y-2">
                  <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-1 block">Contract ID: {m.contractMarketId}</span>
                  <h3 className="text-xl font-bold text-white">{m.title}</h3>
                  <p className="text-xs text-white/40 max-w-md italic">{m.description || "No description provided."}</p>
                  <div className="flex gap-4 mt-4">
                    <div className="text-[10px] text-white/30 uppercase font-black tracking-widest">Yes Pool: <span className="text-white ml-1">{m.yesPool} XLM</span></div>
                    <div className="text-[10px] text-white/30 uppercase font-black tracking-widest border-l border-white/10 pl-4">No Pool: <span className="text-white ml-1">{m.noPool} XLM</span></div>
                  </div>
                </div>

                <div className="w-full md:w-auto space-y-4 pt-6 md:pt-0 border-t md:border-t-0 border-white/5">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setOutcome("YES")}
                      className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${outcome === "YES" ? "bg-blue-600 text-white border-blue-400" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"}`}
                    >
                      YES
                    </button>
                    <button 
                      onClick={() => setOutcome("NO")}
                      className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${outcome === "NO" ? "bg-red-600 text-white border-red-400" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"}`}
                    >
                      NO
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1">Payout BPS (10000 = 1x)</label>
                    <input 
                      type="number" 
                      value={payoutBps}
                      onChange={(e) => setPayoutBps(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs w-full focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <button 
                    onClick={() => handleResolve(m)}
                    disabled={resolvingId === m.id}
                    className="w-full bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-xl hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 disabled:opacity-30 shadow-lg"
                  >
                    {resolvingId === m.id ? "Resolving..." : "Resolve On-Chain"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
