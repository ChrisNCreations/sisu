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
  useConnection,
  useConnect,
  useDisconnect,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { hardhatChain } from "@/lib/chain";

export { hardhatChain };

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
  /** True while wagmi restores the previous session on page load. */
  reconnecting: boolean;
  /** Human wallet name, e.g. "MetaMask" ("Browser Wallet" when undetected). */
  walletName: string | undefined;
  chainId: number | undefined;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

function WalletBridge({ children }: { children: ReactNode }) {
  const { address, chainId, connector } = useAccount();
  const { connect, isPending, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isReconnecting } = useConnection();

  const value = useMemo<WalletState>(
    () => ({
      address: address ?? null,
      connecting: isPending,
      reconnecting: isReconnecting,
      walletName: connector?.name,
      chainId,
      connect: () => {
        const connector =
          connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (connector) connect({ connector });
      },
      disconnect: () => disconnect(),
    }),
    [
      address,
      isPending,
      isReconnecting,
      connector?.name,
      chainId,
      connectors,
      connect,
      disconnect,
    ],
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
