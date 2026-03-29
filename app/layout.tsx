import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/LenisProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "Event Horizon | Cosmic Market",
  description: "Trade on the outcome of future events with Zero-Knowledge privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
    >
      <head>
        <script src="https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/build/snarkjs.min.js" async></script>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-black">
        <WalletProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </WalletProvider>
      </body>
    </html>
  );
}
