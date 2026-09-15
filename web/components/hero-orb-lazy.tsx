"use client";

import dynamic from "next/dynamic";

const HeroOrb = dynamic(
  () => import("@/components/hero-orb").then((m) => m.HeroOrb),
  { ssr: false },
);

// Client shell so the server landing page can mount the WebGL hero
// without pulling three.js into the static prerender.
export function HeroOrbLazy() {
  return <HeroOrb />;
}
