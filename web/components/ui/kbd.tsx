import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-graphite bg-obsidian px-1 font-mono text-[11px] font-normal text-fog",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
