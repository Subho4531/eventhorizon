"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { resolveMarket, submitSignedXdr } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";
import IntelligenceDashboard from "@/components/IntelligenceDashboard";
import ReputationBadge from "@/components/ReputationBadge";
import BetManagementTable from "@/components/BetManagementTable";

interface Market {
  id: string;
  title: string;
  description: string;
  contractMarketId: number;
  status: string;
  yesPool: number;
  noPool: number;
  qualityScore?: number;
  manipulationScore?: number;
}

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

interface BetStats {
  totalVolume: number;
  betCount: number;
  avgBetSize: number;
  sealedCount: number;
  revealedCount: number;
}

export default function AdminPage() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [payoutBps, setPayoutBps] = useState("20000"); // 2x default
  const [showDashboard, setShowDashboard] = useState(true);
  const [oracleReputation, setOracleReputation] = useState<any>(null);

  // Bet management state
  const [bets, setBets] = useState<Bet[]>([]);
  const [betStats, setBetStats] = useState<BetStats | null>(null);
  const [selectedMarketFilter, setSelectedMarketFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"amount" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [betsLoading, setBetsLoading] = useState(false);

  // Manual bet creation state
  const [showBetForm, setShowBetForm] = useState(false);
  const [betFormData, setBetFormData] = useState({
    marketId: "",
    userPublicKey: "",
    amount: "",
    commitment: "",
  });
  const [creatingBet, setCreatingBet] = useState(false);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        // Show only OPEN markets for resolution
        const openMarkets = data.markets.filter((m: any) => m.status === "OPEN");
        
        // Fetch intelligence data for each market
        const marketsWithIntel = await Promise.all(
          openMarkets.map(async (market: Market) => {
            try {
              const [qualityRes, riskRes] = await Promise.all([
                fetch(`/api/markets/${market.id}/quality`).catch(() => null),
                fetch(`/api/markets/${market.id}/risk`).catch(() => null),
              ]);
              
              return {
                ...market,
                qualityScore: qualityRes?.ok ? (await qualityRes.json()).score : undefined,
                manipulationScore: riskRes?.ok ? (await riskRes.json()).score : undefined,
              };
            } catch {
              return market;
            }
          })
        );
        
        setMarkets(marketsWithIntel);
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  useEffect(() => {
    if (publicKey) {
      fetchOracleReputation();
    }
  }, [publicKey]);

  // Fetch bets and stats when filters change
  useEffect(() => {
    fetchBets();
    fetchBetStats();
  }, [selectedMarketFilter, sortBy, sortOrder]);

  const fetchOracleReputation = async () => {
    if (!publicKey) return;
    
    try {
      const res = await fetch(`/api/users/${publicKey}/reputation`);
      if (res.ok) {
        const data = await res.json();
        setOracleReputation(data);
      }
    } catch (err) {
      console.error("Failed to fetch oracle reputation:", err);
    }
  };

  const fetchBets = async () => {
    setBetsLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        limit: "50"
      });

      if (selectedMarketFilter !== "all") {
        params.append("marketId", selectedMarketFilter);
      }

      const res = await fetch(`/api/bets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBets(data.bets || []);
      }
    } catch (err) {
      console.error("Failed to fetch bets:", err);
    } finally {
      setBetsLoading(false);
    }
  };

  const fetchBetStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMarketFilter !== "all") {
        params.append("marketId", selectedMarketFilter);
      }

      const res = await fetch(`/api/bets/stats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBetStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch bet stats:", err);
    }
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBet(true);

    try {
      // Generate a random commitment if not provided
      const commitment = betFormData.commitment || 
        `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: betFormData.marketId,
          userPublicKey: betFormData.userPublicKey,
          amount: parseFloat(betFormData.amount),
          commitment,
          txHash: `manual_${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create bet");
      }

      alert("Bet created successfully!");
      setShowBetForm(false);
      setBetFormData({ marketId: "", userPublicKey: "", amount: "", commitment: "" });
      fetchBets();
      fetchBetStats();
    } catch (err: any) {
      alert(err.message || "Failed to create bet");
    } finally {
      setCreatingBet(false);
    }
  };

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

  return (
    <div className="max-w-7xl mx-auto py-12 space-y-12">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-[10px] text-blue-400 font-black tracking-[0.3em] uppercase mb-4 block">Oracle Authority</span>
          <h1 className="text-4xl font-bold text-white tracking-tight">Consensus Resolution</h1>
          <p className="text-white/40 text-[10px] mt-4 uppercase tracking-widest">Authorized oracles must define the final cosmic state.</p>
          {oracleReputation && (
            <div className="mt-4">
              <ReputationBadge 
                score={oracleReputation.score} 
                tier={oracleReputation.tier}
                size="lg"
              />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowDashboard(!showDashboard)}
          className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
        >
          {showDashboard ? "Hide Dashboard" : "Show Dashboard"}
        </button>
      </header>

      {showDashboard && (
        <div className="mb-12">
          <IntelligenceDashboard />
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Markets Pending Resolution</h2>
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
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Contract ID: {m.contractMarketId}</span>
                      {m.qualityScore !== undefined && (
                        <div className="flex items-center gap-2 text-[9px] text-white/60">
                          <span>Quality:</span>
                          <span className={m.qualityScore >= 70 ? "text-green-400" : m.qualityScore >= 40 ? "text-yellow-400" : "text-red-400"}>
                            {m.qualityScore.toFixed(0)}
                          </span>
                        </div>
                      )}
                      {m.manipulationScore !== undefined && m.manipulationScore >= 70 && (
                        <div className="flex items-center gap-2 text-[9px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
                          <span>⚠️ Risk: {m.manipulationScore.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
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

      {/* Bet Management Section */}
      <div className="space-y-6 mt-16">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-purple-400 font-black tracking-[0.3em] uppercase mb-4 block">Betting Activity</span>
            <h2 className="text-3xl font-bold text-white tracking-tight">Bet Management</h2>
            <p className="text-white/40 text-[10px] mt-2 uppercase tracking-widest">Monitor all sealed positions across markets</p>
          </div>
          <button
            onClick={() => setShowBetForm(!showBetForm)}
            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white border border-purple-400 hover:bg-purple-700 transition-all"
          >
            {showBetForm ? "Cancel" : "+ Create Test Bet"}
          </button>
        </div>

        {/* Manual Bet Creation Form */}
        {showBetForm && (
          <div className="glass-panel p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
            <h3 className="text-xl font-bold text-white mb-6">Create Test Bet</h3>
            <form onSubmit={handleCreateBet} className="space-y-4">
              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  Market
                </label>
                <select
                  value={betFormData.marketId}
                  onChange={(e) => setBetFormData({ ...betFormData, marketId: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">Select a market</option>
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} (ID: {m.contractMarketId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  User Public Key
                </label>
                <input
                  type="text"
                  value={betFormData.userPublicKey}
                  onChange={(e) => setBetFormData({ ...betFormData, userPublicKey: e.target.value })}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                />
                <p className="text-[9px] text-white/40 mt-1 pl-1">
                  Stellar public key (starts with G)
                </p>
              </div>

              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  Amount (XLM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={betFormData.amount}
                  onChange={(e) => setBetFormData({ ...betFormData, amount: e.target.value })}
                  placeholder="10.00"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  Commitment Hash (Optional)
                </label>
                <input
                  type="text"
                  value={betFormData.commitment}
                  onChange={(e) => setBetFormData({ ...betFormData, commitment: e.target.value })}
                  placeholder="0x... (auto-generated if empty)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                />
                <p className="text-[9px] text-white/40 mt-1 pl-1">
                  Leave empty to auto-generate a random commitment
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creatingBet}
                  className="flex-1 bg-purple-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-xl hover:bg-purple-700 transition-all transform active:scale-95 disabled:opacity-30 shadow-lg"
                >
                  {creatingBet ? "Creating..." : "Create Bet"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBetForm(false)}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats Cards */}
        {betStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-transparent">
              <div className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-2">Total Volume</div>
              <div className="text-3xl font-bold text-white">{betStats.totalVolume.toFixed(2)} XLM</div>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent">
              <div className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-2">Bet Count</div>
              <div className="text-3xl font-bold text-white">{betStats.betCount}</div>
              <div className="text-[9px] text-white/40 mt-1">
                {betStats.sealedCount} sealed · {betStats.revealedCount} revealed
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-green-500/10 to-transparent">
              <div className="text-[9px] text-green-400 font-bold uppercase tracking-widest mb-2">Avg Bet Size</div>
              <div className="text-3xl font-bold text-white">{betStats.avgBetSize.toFixed(2)} XLM</div>
            </div>
          </div>
        )}

        {/* Filters and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">Filter by Market</label>
            <select
              value={selectedMarketFilter}
              onChange={(e) => setSelectedMarketFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Markets</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div>
              <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "amount" | "createdAt")}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="createdAt">Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bet Table */}
        <BetManagementTable
          bets={bets}
          loading={betsLoading}
          onSort={(sortBy, sortOrder) => {
            setSortBy(sortBy);
            setSortOrder(sortOrder);
          }}
          onFilter={(marketId) => {
            setSelectedMarketFilter(marketId);
          }}
        />
      </div>
    </div>
  );
}
