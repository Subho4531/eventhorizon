"use client";

import { motion } from "framer-motion";
import { Mic, CheckCircle2, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";


export default function HeroUI() {
  const router = useRouter();
  const [randomHeights] = useState(() => [...Array(20)].map(() => Math.max(15, Math.random() * 100)));
  return (
    <div className="relative z-10 w-full">
      {/* Spacer to push content down into the scroll zone */}

      {/* 1. Main Hero Panel (Centered) */}
      <section className="min-h-screen flex items-center justify-center pt-20 px-8">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="mb-8"
          >
            <Image src="/logo.png" alt="Event Horizon Logo" width={128} height={128} className="object-contain rounded-full shadow-[0_0_50px_rgba(255,255,255,0.1)]" priority />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <span className="glass-pill px-4 py-1.5 rounded-full flex items-center justify-center gap-2 text-xs text-dim mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
              ZK-SNARKs · Cryptographically Sealed · True Privacy
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-4 drop-shadow-2xl text-shadow-lg uppercase italic text-white"
          >
            EVENT<br></br> HORIZON
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            className="text-xl md:text-2xl font-mono tracking-[0.3em] mb-12 drop-shadow-2xl text-[#FF8C00] font-black uppercase italic"
          >
            Trade on the <span className="text-white">future</span> without <span className="text-white">exposure.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.6 }}
            className="text-white/40 text-[11px] max-w-xl mb-14 leading-relaxed font-black uppercase tracking-[0.1em]"
          >
            Trade on the outcome of real-world events. Using Zero-Knowledge proofs, your positions are cryptographically sealed until resolution, enabling true decentralized privacy.
          </motion.p>
          

          <motion.button
            onClick={() => {
              router.push("/markets");
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="glass-pill text-white px-6 py-3 rounded-full flex items-center gap-2 text-sm hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
            <span>Enter the <span className="text-dim ml-1">Markets</span></span>
          </motion.button>

        </div>
      </section>

      {/* 2. Floating Cards Layout - spaced out to trigger on scroll */}
      <section className="min-h-[150vh] relative w-full overflow-hidden pointer-events-none px-4 md:px-0">
        <div className="max-w-7xl mx-auto relative h-full">

          {/* Left Card 1 */}
          <motion.div
            initial={{ opacity: 0, x: -100, rotateY: 20 }}
            whileInView={{ opacity: 1, x: 0, rotateY: 15 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 1.2, type: "spring" }}
            className="absolute left-[5%] top-[10%] glass-card p-5 rounded-xl w-64 md:w-72 shadow-2xl"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="flex items-center gap-2 mb-4 text-xs text-dim uppercase tracking-wider">
              <Mic className="w-4 h-4 text-white" /> Market Resolution
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            </div>
            <div className="flex items-end gap-1 h-10 mb-5">
              {randomHeights.map((h, i) => (
                <div key={i} className="flex-1 bg-white/20 rounded-full" style={{ height: `${h}%` }}></div>
              ))}
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              &quot;Oracle has signed the outcome. Reveal your cryptographically sealed commitment to claim the payout.&quot;
            </p>
          </motion.div>

          {/* Right Card 1 */}
          <motion.div
            initial={{ opacity: 0, x: 100, rotateY: -20 }}
            whileInView={{ opacity: 1, x: 0, rotateY: -15 }}
            viewport={{ once: false, margin: "-200px" }}
            transition={{ duration: 1.2, type: "spring", delay: 0.2 }}
            className="absolute right-[5%] top-[30%] glass-card p-5 rounded-xl w-64 md:w-72 shadow-2xl"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="flex items-center justify-between mb-5 text-xs uppercase tracking-wider text-dim">
              <span className="flex items-center gap-2 text-white"><Calendar className="w-4 h-4" /> Active Markets</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 text-xs text-white/90">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /> AGI by 2026?</span>
                <span className="text-blue-400">82% YES</span>
              </div>
              <div className="flex justify-between items-center text-xs text-dim px-2">
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-white/20"></div> Soroban $1B TVL</span>
                <span className="text-red-400">45% NO</span>
              </div>
            </div>
            &quot;The cosmic event horizon of prediction markets.&quot; &mdash; Horizon Protocol Terminal v4.2
          </motion.div>

          {/* Left Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 100, rotateX: 20 }}
            whileInView={{ opacity: 1, y: 250, rotateX: 5 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 1.2, type: "spring" }}
            className="absolute left-[15%] top-[60%] glass-card p-5 rounded-xl w-64 md:w-72 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-4 text-xs text-dim uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-white" /> ZK Verification
            </div>
            <ul className="space-y-3 text-xs text-white/70 leading-relaxed">
              <li className="flex items-start gap-2"><span className="w-1 h-1 mt-1.5 bg-white/50 rounded-full shrink-0"></span> Generating local randomness...</li>
              <li className="flex items-start gap-2"><span className="w-1 h-1 mt-1.5 bg-white/50 rounded-full shrink-0"></span> Hashing side + nonce...</li>
              <li className="flex items-start gap-2"><span className="w-1 h-1 mt-1.5 bg-white/50 rounded-full shrink-0"></span> Submitting snarkjs proof</li>
            </ul>
          </motion.div>

          {/* Right Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 100, rotateX: 20 }}
            whileInView={{ opacity: 1, y: 200, rotateX: -5 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 1.2, type: "spring", delay: 0.2 }}
            className="absolute right-[15%] top-[80%] glass-card p-5 rounded-xl w-60 md:w-64 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-5 text-xs text-dim uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-white" /> Win Rate
            </div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-3xl text-white font-medium tracking-tight">87%</span>
              <span className="text-xs text-blue-400 font-medium">+47%</span>
            </div>
            <p className="text-xs text-dim mb-6">Markets resolved accurately</p>

            <div className="h-12 w-full relative">
              <svg viewBox="0 0 100 30" className="absolute inset-0 w-full h-full overflow-visible">
                <path d="M0,30 L10,25 L20,28 L30,15 L40,18 L50,10 L60,12 L70,5 L80,8 L90,0 L100,5" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="100" cy="5" r="3" fill="#60a5fa" />
                <circle cx="100" cy="5" r="6" fill="#60a5fa" opacity="0.3" />
              </svg>
              <div className="absolute inset-x-0 bottom-[-10px] flex justify-between text-[9px] text-dim/50 font-medium font-sans">
                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Footer spacer */}
      <section className="h-[20vh] flex items-center justify-center">
        <p className="text-dim text-xs tracking-widest uppercase">End of Transmission</p>
      </section>

    </div>
  );
}
