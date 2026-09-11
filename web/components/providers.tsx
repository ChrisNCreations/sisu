"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const hardhatChain = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

const wagmiConfig = createConfig({
  chains: [hardhatChain],
  connectors: [injected()],
  transports: {
    [hardhatChain.id]: http(),
  },
});

const queryClient = new QueryClient();

interface WalletState {
  address: string | null;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

function WalletBridge({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { connect, isPending, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const value = useMemo<WalletState>(
    () => ({
      address: address ?? null,
      connecting: isPending,
      connect: () => {
        const connector =
          connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (connector) connect({ connector });
      },
      disconnect: () => disconnect(),
    }),
    [address, isPending, connectors, connect, disconnect],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => queryClient);
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={client}>
        <WalletBridge>{children}</WalletBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within Providers");
  return ctx;
}

export { wagmiConfig };
