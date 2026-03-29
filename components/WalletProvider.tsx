"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { isConnected, setAllowed, getAddress } from '@stellar/freighter-api';

type WalletContextType = {
    publicKey: string | null;
    isConnecting: boolean;
    isFreighterInstalled: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const connected = await isConnected();
                setIsFreighterInstalled(connected);
                
                if (connected) {
                    const savedKey = localStorage.getItem("freighter_pubkey");
                    if (savedKey) {
                        try {
                           const pubKeyRes = await getAddress();
                           if (pubKeyRes && pubKeyRes.address) {
                               setPublicKey(pubKeyRes.address);
                           } else if (typeof pubKeyRes === 'string') {
                               setPublicKey(pubKeyRes);
                           }
                        } catch(e) { console.error(e) }
                    }
                }
            } catch (err) {
                console.error("Freighter check error:", err);
            }
        };
        
        checkConnection();
    }, []);

    const connect = async () => {
        setIsConnecting(true);
        try {
            if (!isFreighterInstalled) {
               const connected = await isConnected();
               setIsFreighterInstalled(connected);
               if (!connected) {
                   alert("Freighter Wallet is not installed. Please install it from https://freighter.app");
                   setIsConnecting(false);
                   return;
               }
            }
            
            // setAllowed requests access, getAddress returns it.
            await setAllowed();
            const addressRes = await getAddress();
            
            let addressStr = "";
            if (addressRes && addressRes.address) addressStr = addressRes.address;
            else if (typeof addressRes === 'string') addressStr = addressRes;
            
            if (addressStr) {
                setPublicKey(addressStr);
                localStorage.setItem("freighter_pubkey", addressStr);
            }
        } catch (error) {
            console.error("Error connecting to Freighter:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = () => {
        setPublicKey(null);
        localStorage.removeItem("freighter_pubkey");
    };

    return (
        <WalletContext.Provider value={{ publicKey, isConnecting, isFreighterInstalled, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
};
