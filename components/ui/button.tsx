import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        // Black pill: near-black solid background, white text
        blackPill:
          "bg-[#1E1E1E] text-white hover:bg-black active:scale-[0.98] shadow-sm rounded-full",
        // Outline pill: white/transparent background, 1px grey border, dark text
        outlinePill:
          "bg-white/80 hover:bg-white text-[#1E1E1E] border border-[#E4E4E7] active:scale-[0.98] rounded-full shadow-xs",
        // Standard outline
        outline:
          "bg-transparent border border-zinc-700 text-zinc-200 hover:bg-white/10 hover:text-white rounded-xl shadow-xs",
        // Circular icon button: round white button with subtle border
        circularIcon:
          "bg-white hover:bg-[#F4F4F6] text-[#1E1E1E] border border-[#E4E4E7] rounded-full p-2.5 shadow-xs aspect-square",
        // Dark circular icon
        circularIconDark:
          "bg-[#1E1E1E] hover:bg-black text-white rounded-full p-2.5 shadow-xs aspect-square",
        // Ghost / subtle
        ghost:
          "hover:bg-[#F4F4F6] text-[#1E1E1E] rounded-full",
      },
      size: {
        sm: "text-xs px-3.5 py-1.5 h-8 gap-1.5",
        md: "text-sm px-5 py-2.5 h-10 gap-2",
        lg: "text-base px-6 py-3 h-12 gap-2.5",
        icon: "h-10 w-10 p-0",
        iconSm: "h-8 w-8 p-0 text-xs",
      },
    },
    defaultVariants: {
      variant: "blackPill",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
