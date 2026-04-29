"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isConnected, setAllowed, getAddress } from '@stellar/freighter-api';

export type UserLink = { label: string; url: string };

export type UserProfile = {
  publicKey: string;
  name: string;
  bio: string;
  pfpUrl: string;
  links: UserLink[];
  balance: number;
  createdAt: string;
};

export const getDefaultPfp = (publicKey: string) => 
  `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(publicKey)}&backgroundColor=0a0a0a,1a1a1a`;
type WalletContextType = {
  publicKey: string | null;
  isConnecting: boolean;
  isFreighterInstalled: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  // User account
  user: UserProfile | null;
  needsOnboarding: boolean;
  isLoadingUser: boolean;
  refreshUser: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const fetchUser = useCallback(async (key: string) => {
    setIsLoadingUser(true);
    try {
      const res = await fetch(`/api/users?publicKey=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.user) {
        setUser(data.user as UserProfile);
        setNeedsOnboarding(false);
      } else {
        setUser(null);
        setNeedsOnboarding(true);
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
    } finally {
      setIsLoadingUser(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (publicKey) await fetchUser(publicKey);
  }, [publicKey, fetchUser]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await isConnected();
        setIsFreighterInstalled(connected.isConnected);
        if (connected.isConnected) {
          const savedKey = localStorage.getItem("freighter_pubkey");
          if (savedKey) {
            try {
              const pubKeyRes = await getAddress();
              let resolvedKey = "";
              if (pubKeyRes && pubKeyRes.address) resolvedKey = pubKeyRes.address;
              else if (typeof pubKeyRes === 'string') resolvedKey = pubKeyRes;
              if (resolvedKey) {
                setPublicKey(resolvedKey);
                await fetchUser(resolvedKey);
              }
            } catch (e) { console.error(e); }
          }
        }
      } catch (err) {
        console.error("Freighter check error:", err);
      }
    };
    checkConnection();
  }, [fetchUser]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      if (!isFreighterInstalled) {
        const connected = await isConnected();
        setIsFreighterInstalled(connected.isConnected);
        if (!connected.isConnected) {
          alert("Freighter Wallet is not installed. Please install it from https://freighter.app");
          setIsConnecting(false);
          return;
        }
      }

      await setAllowed();
      const addressRes = await getAddress();
      let addressStr = "";
      if (addressRes && addressRes.address) addressStr = addressRes.address;
      else if (typeof addressRes === 'string') addressStr = addressRes;

      if (addressStr) {
        setPublicKey(addressStr);
        localStorage.setItem("freighter_pubkey", addressStr);
        await fetchUser(addressStr);
      }
    } catch (error) {
      console.error("Error connecting to Freighter:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setUser(null);
    setNeedsOnboarding(false);
    localStorage.removeItem("freighter_pubkey");
  };

  return (
    <WalletContext.Provider value={{
      publicKey, isConnecting, isFreighterInstalled, connect, disconnect,
      user, needsOnboarding, isLoadingUser, refreshUser
    }}>
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
