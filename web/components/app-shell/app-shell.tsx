"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { WalletButton } from "./wallet-button";

function LogoMark() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 px-1 text-[16px] font-[510] text-paper"
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

// Compact top bar: four routes and a ghost Connect. No sidebar, no
// palette, no key jumps — one book does not need app chrome.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[6px] focus:bg-acid-lime focus:px-3 focus:py-2 focus:text-void"
      >
        Skip to content
      </a>

      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-graphite px-3 md:gap-5 md:px-6">
        <LogoMark />
        <nav
          aria-label="Primary"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 text-[13px] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  active
                    ? "bg-white/[0.04] text-paper"
                    : "text-mist hover:bg-white/[0.03] hover:text-paper",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </header>
      <main id="content" className="min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
