import { useWallet } from "../WalletProvider";
import { Loader2 } from "lucide-react";

export default function ConnectWalletButton() {
    const { publicKey, connect, isConnecting , disconnect } = useWallet();
    const formatKey = (key: string) => {
        return `${key.slice(0, 4)}...${key.slice(-4)}`;
    };
    return <button
        onClick={publicKey ? disconnect : connect}
        disabled={isConnecting}
        className={`backdrop-blur-md border border-blue-400/30 text-white px-5 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs hover:brightness-110 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center min-w-[140px] ${publicKey ? 'bg-white/10' : 'bg-blue-600/80'}`}
    >
        {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin text-white/70" />
        ) : publicKey ? (
            formatKey(publicKey)
        ) : (   
            "Connect Wallet"
        )}
    </button>
}