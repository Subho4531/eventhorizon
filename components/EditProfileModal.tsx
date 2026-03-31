"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, ImageIcon, FileText, Link as LinkIcon, Plus, Trash2, Loader2, Check } from "lucide-react";
import { useWallet, UserLink } from "./WalletProvider";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { publicKey, user, refreshUser } = useWallet();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");
  const [links, setLinks] = useState<UserLink[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio(user.bio ?? "");
      setPfpUrl(user.pfpUrl ?? "");
      setLinks(Array.isArray(user.links) ? user.links : []);
    }
  }, [user, isOpen]);

  const addLink = () => setLinks((l) => [...l, { label: "", url: "" }]);
  const removeLink = (i: number) => setLinks((l) => l.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof UserLink, val: string) =>
    setLinks((l) => l.map((link, idx) => idx === i ? { ...link, [field]: val } : link));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(publicKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, pfpUrl, links }),
      });
      if (!res.ok) throw new Error("Update failed");
      await refreshUser();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = (name || user?.name || "?").slice(0, 2).toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg bg-[#0a0a0f]/98 border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(37,99,235,0.12)] max-h-[90vh] overflow-hidden flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Edit Profile</h2>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Orbital Identity</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 p-6">
                <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* Avatar Preview */}
                  <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-white/10 flex items-center justify-center shrink-0">
                      {pfpUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pfpUrl} alt="" className="w-full h-full object-cover" onError={() => setPfpUrl("")} />
                      ) : (
                        <span className="text-xl font-bold text-white/50">{initials}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white mb-1">{name || "Your Name"}</p>
                      <p className="text-[10px] text-white/30 truncate">{publicKey?.slice(0, 20)}...</p>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                      Display Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required maxLength={40}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                      Bio
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3 w-3.5 h-3.5 text-white/30" />
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={200}
                        rows={3}
                        placeholder="Tell the galaxy about yourself..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                      />
                    </div>
                    <p className="text-right text-[10px] text-white/20 mt-1">{bio.length}/200</p>
                  </div>

                  {/* PFP URL */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                      Avatar URL
                    </label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="url"
                        value={pfpUrl}
                        onChange={(e) => setPfpUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Social Links */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Links
                      </label>
                      <button
                        type="button"
                        onClick={addLink}
                        className="text-[10px] flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Link
                      </button>
                    </div>
                    <div className="space-y-2">
                      {links.map((link, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateLink(i, "label", e.target.value)}
                            placeholder="Label"
                            className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                          />
                          <div className="relative flex-1">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => updateLink(i, "url", e.target.value)}
                              placeholder="https://..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLink(i)}
                            className="w-8 h-8 mt-0.5 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {links.length === 0 && (
                        <p className="text-[10px] text-white/20 text-center py-2">No links added yet</p>
                      )}
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 border-t border-white/5">
                <motion.button
                  type="submit"
                  form="edit-profile-form"
                  disabled={isSubmitting || !name.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <><Check className="w-4 h-4" /> Saved!</>
                  ) : (
                    "Save Changes"
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
