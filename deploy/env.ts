// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

/** Sepolia chain id targeted by the public Sisu release. */
export const SEPOLIA_CHAIN_ID = 11155111;

/** Thrown for any invalid or missing Sisu deployment configuration. */
export class SisuConfigError extends Error {
  constructor(message: string) {
    super(`Sisu deployment configuration error: ${message}`);
    this.name = 'SisuConfigError';
  }
}

/** Hardhat in-process and localhost nodes are the only networks allowed to use mocks. */
export function isLocalNetwork(networkName: string): boolean {
  return networkName === 'hardhat' || networkName === 'localhost';
}

/** Requires an explicit opt-in before any non-local deployment can broadcast. */
export function requireLiveDeploymentConfirmation(networkName: string): void {
  if (isLocalNetwork(networkName)) return;
  if (optionalEnv('SISU_ALLOW_LIVE_DEPLOYMENT') !== 'true') {
    throw new SisuConfigError(
      `refusing to deploy on ${networkName} without SISU_ALLOW_LIVE_DEPLOYMENT=true. ` +
        'Set it explicitly for an intentional live deployment.',
    );
  }
}

/** Reads a required environment variable, failing with a clear, actionable message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new SisuConfigError(
      `missing required environment variable ${name}. Set it in sisu/.env (see sisu/.env.example).`,
    );
  }
  return value.trim();
}

/** Reads an optional environment variable, treating empty strings as unset. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/** Reads an optional integer environment variable, rejecting non-integers. */
export function optionalIntEnv(name: string): number | undefined {
  const raw = optionalEnv(name);
  if (raw === undefined) return undefined;
  if (!/^-?\d+$/.test(raw)) {
    throw new SisuConfigError(`${name} must be an integer, got "${raw}".`);
  }
  return Number(raw);
}
