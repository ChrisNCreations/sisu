"use client";

// Tiny deterministic identicon: 5x5 mirrored grid hashed from the address.
// Derives the two palette tones from the same hash — brand-neutral by design.
import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; 3 * i < str.length; i++) {
    h = ((Math.imul(31, h) + str.charCodeAt(3 * i)) | 0) >>> 0;
  }
  return h;
}

function toHexColor(int: number, delta: number): string {
  const bgRed = (int >> 16) & 0xff;
  const bgGreen = (int >> 8) & 0xff;
  const bgBlue = int & 0xff;
  const spotRed = (bgRed + delta) & 0xff;
  const spotGreen = (bgGreen + delta) & 0xff;
  const spotBlue = (bgBlue + delta) & 0xff;
  return `rgb(${spotRed},${spotGreen},${spotBlue})`;
}

export function WalletAvatar({
  address,
  size = 20,
  className,
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const seedId = useId();
  const { bg, spot, cells } = useMemo(() => {
    const seed = hashCode(address.toLowerCase());
    return {
      bg: toHexColor(seed, 200),
      spot: toHexColor(seed, 55),
      cells: Array.from({ length: 15 }, (_, i) => ((seed >> i) & 1) === 1),
    };
  }, [address]);

  const squares: React.ReactNode[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const shift = row * 3 + col;
      if (!cells[shift]) continue;
      const x = col * 20 + 1;
      const mirroredX = (4 - col) * 20 + 1;
      squares.push(
        <rect
          key={`${seedId}-${shift}`}
          x={x}
          y={row * 20 + 1}
          width={18}
          height={18}
          fill={spot}
        />,
      );
      if (mirroredX !== x) {
        squares.push(
          <rect
            key={`${seedId}-mirror-${shift}`}
            x={mirroredX}
            y={row * 20 + 1}
            width={18}
            height={18}
            fill={spot}
          />,
        );
      }
    }
  }

  return (
    <svg
      role="img"
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0 rounded-[4px]", className)}
    >
      <rect width="100" height="100" fill={bg} />
      {squares}
    </svg>
  );
}
