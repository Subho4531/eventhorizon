"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, Wallet, ArrowDownCircle,
  ArrowUpCircle, Edit3, Link as LinkIcon, Loader2,
  TrendingUp, RefreshCw, Activity,
  Lock, Trophy, Shield
} from "lucide-react";
import Image from "next/image";
import { useWallet, UserLink, getDefaultPfp } from "@/components/WalletProvider";
import EditProfileModal from "@/components/EditProfileModal";
import EscrowModal from "@/components/EscrowModal";
import SealedPositionCard from "@/components/SealedPositionCard";
import { getOnchainEscrowBalance, fetchSealedPositions, SealedPosition } from "@/lib/escrow";

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "BET" | "CLAIM";
  amount: number;
  hash: string;
  createdAt: string;
};

// ── Wallet Gate ────────────────────────────────────────────────────────────────
function WalletGate() {
  const { connect, isConnecting } = useWallet();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4 font-mono">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-3xl border border-white/10 flex items-center justify-center bg-[#0A0A0A] relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-[#FF8C00]/5 group-hover:bg-[#FF8C00]/10 transition-colors" />
          <Lock className="w-10 h-10 text-white/40 group-hover:text-[#FF8C00] transition-colors relative z-10" />
        </div>
      </motion.div>
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-black text-white tracking-tight">Terminal Locked</h2>
        <p className="text-white/40 text-[11px] leading-relaxed uppercase tracking-widest font-bold">
          Connect your authorized hardware module to access decentralized escrow and transaction logs.
        </p>
      </div>
      <button
        onClick={connect}
        disabled={isConnecting}
        className="group relative bg-gradient-to-r from-[#FF8C00] to-[#E67E22] text-black font-black px-12 py-4 rounded-xl uppercase tracking-[0.2em] text-[12px] shadow-[0_0_30px_rgba(255,140,0,0.2)] hover:shadow-[0_0_40px_rgba(255,140,0,0.4)] transition-all disabled:opacity-50 overflow-hidden transform hover:scale-[1.02] active:scale-95"
      >
        <span className="relative z-10 flex items-center gap-3">
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          Initialize Wallet
        </span>
      </button>
    </div>
  );
}

// ── Transaction Row ────────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const date = new Date(tx.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const config = {
    DEPOSIT: { label: "Liquidity In", icon: ArrowDownCircle, color: "text-[#FF8C00]", bg: "border-[#FF8C00]/20 bg-[#FF8C00]/10", sign: "+" },
    WITHDRAWAL: { label: "Liquidity Out", icon: ArrowUpCircle, color: "text-white/40", bg: "border-white/10 bg-white/5", sign: "-" },
    BET: { label: "Position Seal", icon: TrendingUp, color: "text-white/40", bg: "border-white/10 bg-white/5", sign: "-" },
    CLAIM: { label: "Winnings Recovery", icon: Trophy, color: "text-[#00C853]", bg: "border-[#00C853]/20 bg-[#00C853]/10", sign: "+" },
  };

  const { label, icon: Icon, color, bg, sign } = config[tx.type] || config.DEPOSIT;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/[0.05] hover:bg-white/[0.02] px-4 transition-colors group font-mono rounded-lg">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-black text-white uppercase tracking-[0.1em]">{label}</div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">TX ID: </span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-white/50 hover:text-[#FF8C00] transition-colors truncate max-w-[120px] font-medium"
          >
            {tx.hash.slice(0, 16).toUpperCase()}...
          </a>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[13px] font-black ${color} tracking-tight`}>
          {sign}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
        </div>
        <div className="text-[9px] text-white/30 font-bold mt-1.5 uppercase tracking-widest">{formatted} | {time}</div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, delay }: {
  label: string; value: string; sub: string; icon: React.ReactNode; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#0A0A0A] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-[#FF8C00]/30 transition-all font-mono shadow-lg hover:shadow-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF8C00]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</div>
          <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center text-white/40 group-hover:text-[#FF8C00] group-hover:border-[#FF8C00]/30 group-hover:bg-[#FF8C00]/10 transition-all shadow-inner">
            {icon}
          </div>
        </div>
        <div className="text-3xl font-black text-white tracking-tight">{value}</div>
        <div className="text-[10px] text-white/30 font-bold mt-3 uppercase tracking-widest">{sub}</div>
      </div>
    </motion.div>
  );
}

// ── Main Portfolio Page ────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { publicKey, user, refreshUser } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sealedPositions, setSealedPositions] = useState<SealedPosition[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [onchainBalance, setOnchainBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchOnchainBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    try {
      const bal = await getOnchainEscrowBalance(publicKey);
      setOnchainBalance(bal);
    } catch (err) {
      console.error("Failed to fetch on-chain balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  const loadSealedPositions = useCallback(async () => {
    if (!publicKey) return;
    const sorted = await fetchSealedPositions(publicKey);
    setSealedPositions(sorted);
  }, [publicKey]);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/transactions?publicKey=${encodeURIComponent(publicKey)}`, { cache: 'no-store' });
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // Handle error silently
    } finally {
      setTxLoading(false);
    }
  }, [publicKey]);

  const CACHE_KEY = "gravityflow_portfolio_cache";

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.sealedPositions) setSealedPositions(parsed.sealedPositions);
        if (parsed.onchainBalance !== undefined) setOnchainBalance(parsed.onchainBalance);
      } catch (e) {
        console.error("Portfolio cache error:", e);
      }
    }

    if (!publicKey) return;
    loadTransactions();
    loadSealedPositions();
    fetchOnchainBalance();
    const interval = setInterval(fetchOnchainBalance, 30_000);
    return () => clearInterval(interval);
  }, [loadTransactions, loadSealedPositions, fetchOnchainBalance, publicKey]);

  useEffect(() => {
    if (publicKey && (transactions.length > 0 || sealedPositions.length > 0)) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        transactions,
        sealedPositions,
        onchainBalance,
        updatedAt: Date.now()
      }));
    }
  }, [transactions, sealedPositions, onchainBalance, publicKey]);

  const copyKey = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publicKey) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File too large (max 5MB)");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, avatarUrl: url })
      });
      await refreshUser();
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!publicKey) return <WalletGate />;

  const displayName = user?.name || `Agent ${publicKey.slice(0, 4)}`;
  const avatarUrl = user?.pfpUrl || getDefaultPfp(publicKey);
  const links: UserLink[] = (user?.links as UserLink[]) || [];
  const bio = user?.bio || "Decentralized Oracle Participant.";

  const liveBalance = onchainBalance ?? 0;
  const openPositionsValue = sealedPositions
    .filter(p => p.status === "SEALED")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const claimedPositions = sealedPositions.filter(p => p.status === "CLAIMED");
  const winRate = sealedPositions.length > 0 
    ? Math.round((claimedPositions.length / sealedPositions.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#000000] text-white pt-24 pb-20 selection:bg-[#FF8C00]/30 selection:text-white">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#FF8C00]/[0.02] rounded-full blur-[120px]" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white/[0.01] rounded-full blur-[100px]" />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/gif, image/webp"
        className="hidden"
      />

      {editOpen && (
        <EditProfileModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      {depositOpen && (
        <EscrowModal
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          onComplete={fetchOnchainBalance}
          mode="DEPOSIT"
        />
      )}

      {withdrawOpen && (
        <EscrowModal
          isOpen={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          onComplete={fetchOnchainBalance}
          mode="WITHDRAW"
          currentBalance={liveBalance}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 relative z-10 space-y-12">
        
        {/* ── Profile Header ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A0A0A] border border-white/[0.08] rounded-[2rem] p-8 md:p-12 relative overflow-hidden shadow-2xl"
        >
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF8C00]/40 to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              
              {/* Avatar */}
              <div className="relative group/avatar">
                <div className="absolute inset-[-4px] bg-gradient-to-br from-[#FF8C00]/30 to-transparent rounded-[2rem] blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                  className="w-32 h-32 rounded-[2rem] overflow-hidden border-2 border-white/10 relative bg-[#111] shrink-0 shadow-inner group-hover/avatar:border-[#FF8C00]/50 transition-colors"
                >
                  <Image src={avatarUrl} alt="Avatar" fill className="object-cover transition-transform duration-500 group-hover/avatar:scale-105" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Edit3 className="w-6 h-6 text-white" />}
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="text-center md:text-left space-y-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#FF8C00]/20 bg-[#FF8C00]/5 text-[#FF8C00] text-[10px] font-black uppercase tracking-[0.2em] mb-2 shadow-inner">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF8C00] animate-pulse" />
                    Live Profile
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{displayName}</h1>
                </div>
                
                <p className="text-white/40 text-[13px] font-mono leading-relaxed max-w-lg">{bio}</p>

                <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
                  <button
                    onClick={copyKey}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.2] transition-all group/key"
                  >
                    <Wallet className="w-4 h-4 text-white/30 group-hover/key:text-[#FF8C00] transition-colors" />
                    <span className="text-[11px] font-bold text-white/40 group-hover/key:text-white/80 font-mono tracking-wider">
                      {publicKey.slice(0, 8)}...{publicKey.slice(-6)}
                    </span>
                    {copied ? <Check className="w-4 h-4 text-[#00C853]" /> : <Copy className="w-4 h-4 text-white/30" />}
                  </button>

                  {links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {links.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[11px] font-mono font-bold text-white/40 hover:text-[#FF8C00] transition-colors border border-white/[0.08] bg-white/[0.02] px-4 py-2 rounded-xl"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {link.label?.toUpperCase() || "LINK"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setEditOpen(true)}
              className="px-8 py-4 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-white hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.08] transition-all rounded-xl shadow-sm"
            >
              Config Profile
            </button>
          </div>
        </motion.div>

        {/* ── Liquidity & Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          
          <div className="space-y-8">
            {/* Main Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard 
                label="Escrow Liquidity" 
                value={`${liveBalance.toLocaleString()} XLM`} 
                sub={balanceLoading ? "Syncing Chain..." : "On-chain Available"} 
                icon={<Shield className="w-5 h-5" />}
                delay={0.1}
              />
              <StatCard 
                label="Capital At Stake" 
                value={`${openPositionsValue.toLocaleString()} XLM`} 
                sub={`${sealedPositions.filter(p => p.status === "SEALED").length} Active Positions`} 
                icon={<Activity className="w-5 h-5" />}
                delay={0.2}
              />
              <StatCard 
                label="Accuracy Index" 
                value={`${winRate}%`} 
                sub={`${claimedPositions.length} Successful Recoveries`} 
                icon={<Trophy className="w-5 h-5" />}
                delay={0.3}
              />
            </div>

            {/* Positions */}
            <div className="border border-white/[0.08] bg-[#0A0A0A] rounded-[2rem] p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white/40" />
                  </div>
                  Position Inventory
                </h2>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/30 bg-black/40 px-4 py-2 rounded-xl border border-white/[0.05]">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 bg-[#FF8C00] rounded-full shadow-[0_0_8px_rgba(255,140,0,0.8)]" /> YES</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" /> NO</span>
                </div>
              </div>

              {sealedPositions.length === 0 ? (
                <div className="text-center py-24 border border-white/5 rounded-2xl bg-white/[0.01]">
                  <p className="text-[11px] text-white/30 uppercase font-black tracking-[0.4em]">No Active Positions Detected</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {sealedPositions.map((pos) => (
                    <SealedPositionCard 
                      key={pos.commitment} 
                      position={pos} 
                      onClaimed={loadSealedPositions} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Liquidity Controls & History */}
          <div className="space-y-8">
            {/* Liquidity Module */}
            <div className="border border-[#FF8C00]/30 bg-[#0A0A0A] rounded-[2rem] p-8 relative overflow-hidden shadow-[0_0_40px_rgba(255,140,0,0.05)]">
              <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF8C00]/40 to-transparent animate-pulse" />
              
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-[#FF8C00] mb-8 flex items-center justify-between">
                Liquidity Module
                <button onClick={fetchOnchainBalance} className={`p-2 rounded-lg hover:bg-[#FF8C00]/10 transition-colors ${balanceLoading ? "opacity-50" : ""}`}>
                  <RefreshCw className={`w-4 h-4 ${balanceLoading ? "animate-spin" : ""}`} />
                </button>
              </h2>

              <div className="space-y-6">
                <div className="p-8 rounded-2xl border border-white/[0.05] bg-black/60 text-center shadow-inner relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-b from-[#FF8C00]/[0.02] to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em] mb-3">Escrow Capacity</div>
                    <div className="text-5xl font-black text-white tracking-tight">
                      {liveBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </div>
                    <div className="text-[12px] text-white/40 font-bold mt-2 uppercase tracking-widest">XLM Token</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDepositOpen(true)}
                    className="py-4 rounded-xl border border-[#FF8C00]/40 text-[#FF8C00] font-black uppercase text-[11px] tracking-[0.2em] bg-[#FF8C00]/5 hover:bg-[#FF8C00] hover:text-black transition-all flex items-center justify-center gap-2 shadow-inner"
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    Deposit
                  </button>
                  <button
                    onClick={() => setWithdrawOpen(true)}
                    className="py-4 rounded-xl border border-white/20 text-white font-black uppercase text-[11px] tracking-[0.2em] bg-white/[0.02] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 shadow-inner"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Withdraw
                  </button>
                </div>
                
                <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.2em] text-center leading-relaxed max-w-[80%] mx-auto">
                  Funds are secured in decentralized escrow smart contract
                </p>
              </div>
            </div>

            {/* History feed */}
            <div className="border border-white/[0.08] bg-[#0A0A0A] rounded-[2rem] p-8 shadow-xl">
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/50 mb-8 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white/40" />
                 </div>
                System Logs
              </h2>

              <div className="space-y-2">
                {txLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 border border-white/[0.05] rounded-xl bg-white/[0.01]">
                    <div className="text-[11px] text-white/30 uppercase font-black tracking-widest">Log Empty</div>
                  </div>
                ) : (
                  transactions.slice(0, 10).map((tx) => <TxRow key={tx.id} tx={tx} />)
                )}
              </div>

              {transactions.length > 10 && (
                <button className="w-full py-4 mt-6 rounded-xl border border-white/[0.05] bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all">
                  Load More Logs
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
