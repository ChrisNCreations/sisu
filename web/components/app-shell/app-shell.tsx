"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { WalletButton } from "./wallet-button";
import { CommandPalette } from "./command-palette";

function LogoMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 px-1 text-[16px] font-[510] text-paper"
    >
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-[2px] border border-paper/80"
      >
        <span className="size-1.5 bg-paper" />
      </span>
      Sisu
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between rounded-[6px] px-3 py-1.5 text-[13px] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              active
                ? "bg-white/[0.04] text-paper"
                : "text-mist hover:bg-white/[0.03] hover:text-paper",
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-px bg-acid-lime"
              />
            ) : null}
            <span>{item.label}</span>
            <span className="font-mono text-[10px] text-fog">
              {item.shortcut}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const title = NAV.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  )?.label;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let pending = "";
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (pending === "g") {
        const map: Record<string, string> = {
          d: "/",
          s: "/strategy",
          w: "/swap",
          h: "/history",
        };
        if (map[key]) {
          event.preventDefault();
          router.push(map[key]);
        }
        pending = "";
        return;
      }
      if (key === "g") {
        pending = "g";
        window.setTimeout(() => {
          pending = "";
        }, 700);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="flex min-h-dvh bg-void">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[6px] focus:bg-acid-lime focus:px-3 focus:py-2 focus:text-void"
      >
        Skip to content
      </a>

      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-graphite bg-carbon md:flex">
        <div className="flex h-12 items-center px-4">
          <LogoMark />
        </div>
        <div className="flex-1 px-2 py-2">
          <NavList />
        </div>
        <p className="px-4 py-3 font-mono text-[11px] text-fog">
          Offchain estimates. Onchain enforces.
        </p>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-void/70"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[240px] flex-col bg-carbon shadow-[1px_0_0_#23252a]">
            <div className="flex h-12 items-center justify-between px-4">
              <LogoMark />
              <Button
                variant="nav"
                size="icon"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="px-2 py-2">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-3 border-b border-graphite px-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="nav"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden />
            </Button>
            <h1 className="truncate text-[13px] font-[510] text-paper">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("sisu:palette"))}
              className="hidden h-8 items-center gap-2 rounded-[6px] border border-graphite px-2 text-[12px] text-fog md:flex"
            >
              Search
              <span className="flex items-center gap-0.5">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <WalletButton />
          </div>
        </header>
        <main id="content" className="min-w-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
