"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { NAV } from "@/lib/nav";
import { useWallet } from "@/components/providers";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { address, connect, disconnect } = useWallet();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sisu:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sisu:palette", onOpen);
    };
  }, []);

  const items = useMemo(
    () => [
      ...NAV.map((item) => ({
        id: item.href,
        label: `Go to ${item.label}`,
        hint: item.shortcut,
        run: () => router.push(item.href),
      })),
      {
        id: "wallet",
        label: address ? "Disconnect wallet" : "Connect wallet",
        hint: "",
        run: () => (address ? disconnect() : connect()),
      },
    ],
    [address, connect, disconnect, router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-void/70"
        onClick={() => setOpen(false)}
      />
      <div className="absolute left-1/2 top-[18vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
        <Command
          label="Command palette"
          className="overflow-hidden rounded-[12px] bg-carbon shadow-[var(--shadow-subtle)]"
        >
          <Command.Input
            autoFocus
            placeholder="Go to, connect, search…"
            className="h-11 w-full border-b border-graphite bg-transparent px-4 text-[14px] text-paper placeholder:text-fog focus:outline-none"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-[13px] text-fog">
              No matching commands.
            </Command.Empty>
            <Command.Group
              heading="Navigate"
              className="px-2 py-1 text-[11px] text-fog [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {items.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    item.run();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[6px] px-2 py-2 text-[13px] text-mist data-[selected=true]:bg-white/[0.05] data-[selected=true]:text-paper",
                  )}
                >
                  <span>{item.label}</span>
                  {item.hint ? (
                    <span className="font-mono text-[11px] text-fog">
                      {item.hint}
                    </span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
