"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-acid-lime text-void shadow-[var(--shadow-cta)] hover:bg-[#edf64a]",
        ghost:
          "bg-transparent text-mist border border-graphite hover:border-smoke hover:text-paper",
        pill: "rounded-full bg-paper text-void hover:bg-bone",
        nav: "bg-transparent text-mist hover:text-paper",
        subtle:
          "bg-white/[0.05] text-mist hover:bg-white/[0.08] hover:text-paper",
      },
      size: {
        sm: "h-8 px-3 text-[13px] font-normal rounded-[6px]",
        md: "h-9 px-4 text-[14px] font-[510] tracking-[-0.011em] rounded-[6px]",
        lg: "h-10 px-4 text-[14px] font-[510] rounded-[6px]",
        icon: "size-8 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "sm",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
