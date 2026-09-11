import { mockSdk, DEFAULT_STRATEGY_HASH } from "./mock";
import { realSdk } from "./real";
import { isSeeded } from "@/lib/chain";

// Seeded local node -> real onchain SDK (eth_call quote, router swap).
// No deployment.json -> mock SDK so `npm run build` and browsing work.
export const sdk = isSeeded() ? realSdk : mockSdk;
export const isRealSdk = isSeeded();
export { DEFAULT_STRATEGY_HASH };
export type * from "./types";
export { appendHistory, decodeSwapRevert } from "./real";
