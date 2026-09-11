"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[6px] border border-white/8 bg-white/[0.02] px-3.5 py-3 text-[14px] text-mist placeholder:text-fog transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:border-mist focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 tabular",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
