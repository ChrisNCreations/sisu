import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

export interface WalletBrand {
  name: string;
  shortName: string;
  color: string;
  icon?: string;
  iconNode?: ReactNode;
}
function toBrand(detail: EIP6963ProviderInfoLike): WalletBrand {
  return {
    name: detail.name,
    shortName: detail.name.split(" ")[0] ?? detail.name,
    color:
      detail.rdns === "io.metamask"
        ? "#f6851b"
        : detail.rdns === "io.rabby"
          ? "#7084ff"
          : detail.rdns === "com.coinbase.wallet"
            ? "#0052ff"
            : detail.rdns === "app.backpackapp.io" || detail.rdns === "app.backpack"
              ? "#e33e3f"
              : detail.rdns === "tech.okex"
                ? "#8b5cf6"
                : detail.rdns === "com.bitget.web3"
                  ? "#00f0ff"
                  : detail.rdns === "com.trustwallet.app"
                    ? "#0500ff"
                    : detail.rdns === "io.zerion.wallet"
                      ? "#2962ef"
                      : detail.rdns === "xyz.brave.app"
                        ? "#fb542b"
                        : "#8a8f98",
    icon: detail.icon,
  };
}

interface EIP6963ProviderDetailLike {
  info: EIP6963ProviderInfoLike;
  provider: unknown;
}

interface EIP6963ProviderInfoLike {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

const FALLBACK: WalletBrand = {
  name: "Browser Wallet",
  shortName: "Wallet",
  color: "#8a8f98",
};

const DUDS = ["_6963_", "Rabby Wallet"];

class WalletBrands {
  #brands: WalletBrand[] = [];
  #listeners = new Set<() => void>();
  #started = false;

  get snapshot(): WalletBrand[] {
    return this.#brands;
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    this.#start();
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #start() {
    if (this.#started || typeof window === "undefined") return;
    this.#started = true;
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetailLike>).detail;
      if (!detail?.info || DUDS.includes(detail.info.name)) return;
      if (this.#brands.some((b) => b.name === detail.info.name)) return;
      this.#brands = [...this.#brands, toBrand(detail.info)];
      this.#listeners.forEach((l) => l());
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
}

export const walletBrands = new WalletBrands();

export function useWalletBrands(): WalletBrand[] {
  return useSyncExternalStore(walletBrands.subscribe, () => walletBrands.snapshot, () => []);
}

export function brandFor(name: string | undefined): WalletBrand {
  if (!name) return FALLBACK;
  const lc = name.toLowerCase();
  return (
    walletBrands.snapshot.find((b) => b.name.toLowerCase() === lc) ??
    (lc.includes("metamask")
      ? { name: "MetaMask", shortName: "MetaMask", color: "#f6851b" }
      : lc.includes("rabby")
        ? { name: "Rabby", shortName: "Rabby", color: "#7084ff" }
        : lc.includes("coinbase")
          ? { name: "Coinbase Wallet", shortName: "Coinbase", color: "#0052ff" }
          : lc.includes("brave")
            ? { name: "Brave", shortName: "Brave", color: "#fb542b" }
            : lc.includes("okx")
              ? { name: "OKX Wallet", shortName: "OKX", color: "#8b5cf6" }
              : lc.includes("trust")
                ? { name: "Trust Wallet", shortName: "Trust", color: "#0500ff" }
                : lc.includes("phantom")
                  ? { name: "Phantom", shortName: "Phantom", color: "#ab9ff2" }
                  : FALLBACK)
  );
}

export function BrandGlyph({
  brand,
  size = 16,
}: {
  brand: WalletBrand;
  size?: number;
}) {
  if (brand.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.icon}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[4px] text-[8px] font-[590] text-void"
      style={{
        width: size,
        height: size,
        background: brand.color,
      }}
    >
      {brand.iconNode ?? brand.shortName.slice(0, 1).toUpperCase()}
    </span>
  );
}
