import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-carbon p-6 shadow-[var(--shadow-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[6px] bg-white/[0.02] p-2 shadow-[0_2px_4px_rgba(0,0,0,0.4)]",
        className,
      )}
      {...props}
    />
  );
}

export { Card, Panel };
