"use client";

import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-start justify-between pointer-events-none"
    >
      <div className="flex flex-col items-start leading-tight pointer-events-auto">
        <span className="text-xl font-bold tracking-tight text-white mb-1 drop-shadow-lg">
          StellarSub
        </span>
        <span className="text-xs text-white/50">
          4D Polymorphic Edition
        </span>
      </div>

      {/* Tabs Menu */}
      <div className="hidden md:flex items-center gap-1 glass-pill px-2 py-1.5 rounded-full pointer-events-auto shadow-2xl">
        <button className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all">The Core</button>
        <button className="px-4 py-1.5 rounded-full text-sm font-medium text-dim hover:text-white transition-all">Orbits</button>
        <button className="px-4 py-1.5 rounded-full text-sm font-medium text-dim hover:text-white transition-all">Analytics</button>
      </div>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-6 py-2.5 rounded-[12px] font-medium text-sm transition-all text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-white/20 pointer-events-auto"
      >
        Launch DApp
      </motion.button>
    </motion.nav>
  );
}
