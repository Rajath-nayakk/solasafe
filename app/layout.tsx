import type { Metadata } from "next";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolSafe | Plain-English Solana Pre-Signing Safety",
  description:
    "AI-powered Solana wallet assistant with transaction simulation, deterministic risk engine, and plain-English explanations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        <WalletProviderWrapper>{children}</WalletProviderWrapper>
      </body>
    </html>
  );
}
