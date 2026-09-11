import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0 text-[12px] font-normal leading-[1.4] whitespace-nowrap",
  {
    variants: {
      tone: {
        mute: "bg-white/5 text-fog",
        lime: "bg-acid-lime/12 text-acid-lime",
        green: "text-pulse-green bg-pulse-green/10",
        red: "text-coral-red bg-coral-red/10",
        violet: "text-iris-violet bg-iris-violet/12",
        lavender: "text-lavender bg-lavender/12",
      },
    },
    defaultVariants: {
      tone: "mute",
    },
  },
);

function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
