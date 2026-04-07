"use client";
import { useWallet } from "../WalletProvider";
import { Loader2, Wallet } from "lucide-react";

export default function ConnectWalletButton() {
  const { publicKey, connect, isConnecting, disconnect } = useWallet();

  const formatKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

  return (
    <button
      onClick={publicKey ? disconnect : connect}
      disabled={isConnecting}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
        publicKey
          ? "bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white"
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]"
      }`}
    >
      {isConnecting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Wallet className="w-3.5 h-3.5" />
      )}
      {isConnecting ? "Connecting…" : publicKey ? formatKey(publicKey) : "Connect Wallet"}
    </button>
  );
}