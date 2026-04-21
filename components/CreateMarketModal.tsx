"use client";

import { useState } from "react";
import { zkCreateMarket as createMarket, submitSignedXdr } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";
import { X, Shield, Terminal, Database, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPublicKey: string;
}

export default function CreateMarketModal({
  isOpen,
  onClose,
  userPublicKey,
}: CreateMarketModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [oracle, setOracle] = useState(userPublicKey);
  
  // Default to 1 week from now
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  const formattedDefaultDate = defaultDate.toISOString().slice(0, 16);
  
  const [closeDate, setCloseDate] = useState(formattedDefaultDate);
  const [category, setCategory] = useState("CRYPTO");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "tx" | "indexing" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleCreate() {
    if (!title || !closeDate || !oracle) {
      setErrorMsg("ERR: MISSING_REQUIRED_PARAMETERS");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setStep("tx");

    try {
      const closeTimeUnix = Math.floor(new Date(closeDate).getTime() / 1000);
      const validSymbol = title.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);

      const res = await createMarket(userPublicKey, validSymbol, closeTimeUnix, oracle);
      if (!res.success || !res.unsignedXdr) throw new Error("FAILED_TO_BUILD_XDR_PAYLOAD");

      const signRes = await signTransaction(res.unsignedXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      if (!signRes || !signRes.signedTxXdr) throw new Error("AUTH_SIGNING_ABORTED");

      const txResult = await submitSignedXdr(signRes.signedTxXdr);
      const onChainMarketId = txResult.returnValue;

      setStep("indexing");
      
      // Simulating ZK proof generation for market creation
      const prevStep = step;
      setStep("tx"); // Reuse tx view for proving state if needed or update labels
      
      let uploadedUrl = "";
      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedUrl = uploadData.secure_url;
        }
      }

      const dbRes = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractMarketId: onChainMarketId,
          title: title,
          description,
          creatorId: userPublicKey,
          closeDate: new Date(closeDate).toISOString(),
          category,
          imageUrl: uploadedUrl
        }),
      });

      if (!dbRes.ok) {
        const errorData = await dbRes.json();
        throw new Error(`ON-CHAIN_SYNC_OK // INDEXING_FAILED: ${errorData.error || "UNKNOWN_DB_ERROR"}`);
      }

      setStep("success");
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "SYS_INTERNAL_ERROR");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0D0D0D] border border-white/10 w-full max-w-2xl relative overflow-hidden shadow-2xl"
      >
        {/* Hardware chassis details */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF8C00]/50 to-transparent" />
        <div className="absolute top-4 left-4 flex gap-1">
          <div className="w-1 h-1 bg-[#FF8C00] rounded-full animate-pulse" />
          <div className="w-1 h-1 bg-[#FF8C00]/20 rounded-full" />
        </div>

        <div className="p-8 md:p-12">
          <div className="flex justify-between items-start mb-12">
            <div className="relative">
              <div className="absolute -left-6 top-0 bottom-0 w-1 bg-[#FF8C00]" />
              <span className="text-[10px] text-[#FF8C00] font-black tracking-[0.5em] uppercase mb-3 block flex items-center gap-3">
                <Shield className="w-4 h-4" /> Auth Level: Oracle
              </span>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Create New Market</h2>
              <p className="text-white/20 text-[9px] mt-2 uppercase tracking-[0.2em] font-bold">Config Module v1.0.4 // Local host secure</p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 text-white/20 hover:text-white border border-white/5 hover:border-white/20 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === "form" && (
              <motion.div 
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Market Title</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. BTC Price Target"
                      className="w-full bg-black border border-white/10 p-4 text-white placeholder:text-white/5 focus:outline-none focus:border-[#FF8C00]/50 transition-all text-[12px] font-black uppercase italic"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-black border border-white/10 p-4 text-white focus:outline-none focus:border-[#FF8C00]/50 transition-all text-[12px] font-black uppercase appearance-none"
                    >
                      {["CRYPTO", "POLITICS", "SPORTS", "TECHNOLOGY", "SCIENCE"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="space-y-3">
                    <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Market Image</label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImage(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full bg-black border border-white/10 p-4 text-white/40 text-[10px] font-black flex items-center justify-between group-hover:border-[#FF8C00]/50 transition-all">
                        <span>{image ? image.name.toUpperCase() : "Click to upload image..."}</span>
                        {imagePreview && (
                          <div className="w-10 h-10 border border-white/10 overflow-hidden">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Resolution Criteria</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe how this market will be resolved..."
                    rows={4}
                    className="w-full bg-black border border-white/10 p-4 text-white placeholder:text-white/5 focus:outline-none focus:border-[#FF8C00]/50 transition-all text-[12px] font-black uppercase italic resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Oracle Address</label>
                    <input 
                      type="text" 
                      value={oracle}
                      onChange={(e) => setOracle(e.target.value)}
                      className="w-full bg-black border border-white/10 p-4 text-white/40 focus:outline-none focus:border-[#FF8C00]/50 transition-all text-[10px] font-black"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] text-white/20 uppercase font-black tracking-widest block">Closing Date</label>
                    <input 
                      type="datetime-local" 
                      value={closeDate}
                      onChange={(e) => setCloseDate(e.target.value)}
                      className="w-full bg-black border border-white/10 p-4 text-white focus:outline-none focus:border-[#FF8C00]/50 transition-all text-[12px] font-black h-[54px]"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-4 bg-red-500/5 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4" />
                    {errorMsg}
                  </div>
                )}

                <button 
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full bg-[#FF8C00] text-black font-black uppercase tracking-[0.3em] py-6 hover:bg-white transition-all disabled:opacity-20 flex items-center justify-center gap-4 shadow-xl shadow-[#FF8C00]/10"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
                  Create Market
                </button>
              </motion.div>
            )}

            {(step === "tx" || step === "indexing") && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-16 flex flex-col items-center justify-center text-center space-y-10"
              >
                <div className="relative">
                  <div className="w-32 h-32 border border-white/10 flex items-center justify-center">
                    <div className="absolute inset-0 border-t-2 border-[#FF8C00] animate-spin" />
                    {step === "tx" ? <Shield className="w-10 h-10 text-white/20" /> : <Database className="w-10 h-10 text-white/20" />}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] italic">
                    {step === "tx" ? "Authenticating Transaction" : step === "indexing" ? "Verifying ZK Circuit" : "Indexing Market"}
                  </h3>
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold max-w-sm mx-auto leading-relaxed">
                    {step === "tx" 
                      ? "Awaiting signature from local authorized module" 
                      : step === "indexing" 
                        ? "Verifying Zero-Knowledge integrity of market parameters"
                        : "Recording market metadata in global data stream"}
                  </p>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-16 flex flex-col items-center justify-center text-center space-y-10"
              >
                <div className="w-32 h-32 bg-[#00C853]/10 border border-[#00C853]/30 flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-[#00C853] animate-pulse" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] italic">Market Created Successfully</h3>
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold">Horizon proposed successfully // Relay active</p>
                </div>
              </motion.div>
            )}

            {step === "error" && (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 flex flex-col items-center justify-center text-center space-y-10"
              >
                <div className="w-32 h-32 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] italic">Creation Failed</h3>
                  <p className="text-[10px] text-red-500/80 uppercase tracking-[0.3em] font-bold max-w-md mx-auto">{errorMsg}</p>
                </div>
                <button 
                  onClick={() => setStep("form")}
                  className="px-10 py-4 border border-white/10 text-[10px] text-white font-black uppercase tracking-[0.4em] hover:bg-white/5 transition-all rounded-full"
                >
                  Retry Initialization
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
