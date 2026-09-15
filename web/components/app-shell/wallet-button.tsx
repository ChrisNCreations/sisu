"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  LoaderCircle,
} from "lucide-react";
import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletAvatar } from "@/components/wallet-avatar";
import { useWallet } from "@/components/providers";
import { formatAddress, formatToken } from "@/lib/format";
import { BrandGlyph, brandFor, useWalletBrands } from "@/lib/wallets";
import { explorerAddressUrl } from "@/lib/chain";

function ConnectButton() {
  const { connect, connecting } = useWallet();
  const brands = useWalletBrands();
  const brand = brands[0] ?? brandFor(undefined);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={connect}
      disabled={connecting}
      aria-haspopup="dialog"
      className="h-8 gap-2 px-4 text-[13px] font-[510]"
    >
      {connecting ? (
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <BrandGlyph brand={brand} size={14} />
      )}
      {connecting ? "Connecting" : `Connect ${brand.shortName}`}
    </Button>
  );
}

function WalletPill({ address }: { address: string }) {
  const { walletName, chainId, disconnect } = useWallet();
  const brand = brandFor(walletName);
  const explorer = explorerAddressUrl(address);

  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  });

  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copyAddress = React.useCallback(() => {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }, [address]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-haspopup="menu"
          className="group h-8 gap-2 rounded-[6px] border border-graphite px-2.5 hover:border-smoke data-[state=open]:border-smoke data-[state=open]:bg-white/[0.04] data-[state=open]:text-paper"
        >
          <WalletAvatar address={address} size={18} />
          <span className="font-mono text-[12px] tracking-[-0.013em] text-paper">
            {formatAddress(address)}
          </span>
          {balance ? (
            <span className="hidden text-[12px] text-ash lg:inline">
              {formatToken(Number(formatUnits(balance.value, balance.decimals)), balance.symbol, 3)}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className="size-3 text-ash transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[state=open]:rotate-180"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <BrandGlyph brand={brand} size={16} />
          {brand.name}
        </DropdownMenuLabel>

        <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-0.5">
          <WalletAvatar address={address} size={32} />
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] tracking-[-0.013em] text-paper">
              {formatAddress(address)}
            </p>
            <p className="text-[11px] text-ash">
              {balance
                ? formatToken(Number(formatUnits(balance.value, balance.decimals)), balance.symbol, 4)
                : chainId
                  ? `Chain ${chainId}`
                  : "Connected"}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={copyAddress}>
          {copied ? (
            <Check className="text-pulse-green" />
          ) : (
            <Copy aria-hidden />
          )}
          {copied ? "Copied" : "Copy address"}
        </DropdownMenuItem>

        {explorer ? (
          <DropdownMenuItem asChild>
            <a href={explorer} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              View on explorer
            </a>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={() => disconnect()}>
          <LogOut aria-hidden />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WalletButton() {
  const { address, reconnecting } = useWallet();

  if (!address) {
    return reconnecting ? (
      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-label="Reconnecting wallet"
        className="h-8 gap-2 px-4 text-[13px] font-[510]"
      >
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
        Reconnecting
      </Button>
    ) : (
      <ConnectButton />
    );
  }

  return <WalletPill address={address} />;
}
