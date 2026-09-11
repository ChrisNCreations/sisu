const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatUsd(value: number, precise = false): string {
  return (precise ? usdPrecise : usd).format(value);
}

export function formatBps(bps: number): string {
  return `${bps.toFixed(1)} bps`;
}

export function formatPct(bps: number): string {
  return `${(bps / 100).toFixed(0)}%`;
}

// Onchain risk scale: 1e9 = 100%. Never pass 1e9 values to formatPct.
export function formatRisk(ratio1e9: number): string {
  return `${((ratio1e9 / 1_000_000_000) * 100).toFixed(0)}%`;
}

export function formatRiskPrecise(ratio1e9: number): string {
  return `${((ratio1e9 / 1_000_000_000) * 100).toFixed(1)}%`;
}

export function formatPctPrecise(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function formatToken(amount: number, symbol: string, digits = 4): string {
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })} ${symbol}`;
}

export function formatHash(hash: string): string {
  if (hash.length < 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function formatAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
