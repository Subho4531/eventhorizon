"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ConnectWalletButton from "./ui/connectWalletButton";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";


export default function Navbar() {
  const pathname = usePathname();
  const { publicKey, connect, isConnecting , disconnect} = useWallet();
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-start justify-between pointer-events-none"
    >
      <div className="flex flex-col items-start leading-tight pointer-events-auto">
        <span className="text-xl font-bold tracking-tight text-white mb-1 drop-shadow-lg">
          Event Horizon
        </span>
        <span className="text-xs text-white/50">
          ZK Prediction Market
        </span>
      </div>

      {/* Tabs Menu */} 
      <div className={`items-center gap-1 glass-pill px-2 py-1.5 rounded-full pointer-events-auto shadow-2xl ${publicKey ? 'md:flex':'hidden' }`}>
        <Link href="/dashboard" className={`px-4 py-1.5 rounded-full text-sm font-medium ${pathname === '/dashboard' ? 'text-white' : 'text-dim'} hover:bg-white/20 transition-all`}>Dashboard</Link>
        <Link href="/markets" className={`px-4 py-1.5 rounded-full text-sm font-medium ${pathname === '/markets' ? 'text-white' : 'text-dim'} hover:bg-white/20 transition-all`}>Markets</Link>
        <Link href="/portfolio" className={`px-4 py-1.5 rounded-full text-sm font-medium ${pathname === '/portfolio' ? 'text-white' : 'text-dim'} hover:bg-white/20 transition-all`}>Portfolio</Link>
        <Link href="/leaderboard" className={`px-4 py-1.5 rounded-full text-sm font-medium ${pathname === '/leaderboard' ? 'text-white' : 'text-dim'} hover:bg-white/20 transition-all`}>Leaderboard</Link>
      </div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="pointer-events-auto">
        <ConnectWalletButton />
      </motion.div>
    </motion.nav>
  );
}
