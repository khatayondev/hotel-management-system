"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /**
   * "full" = Full logo with typography (emblem + "Becca's Crown Beauty Vault")
   * "mark" = Emblem icon only (crown with flowing hair & star)
   */
  variant?: "full" | "mark";

  /**
   * "dark" = White logo (for black / dark backgrounds)
   * "light" = Black logo (for white / light backgrounds)
   * "gold" = Gold luxury emblem/logo
   */
  theme?: "dark" | "light" | "gold";

  /**
   * Preset sizes:
   * "xs" = 24px height
   * "sm" = 32px height
   * "md" = 40px height
   * "lg" = 52px height
   * "xl" = 72px height
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  className?: string;
  priority?: boolean;
}

export function BrandLogo({
  variant = "full",
  theme = "dark",
  size = "md",
  className,
  priority = false,
}: BrandLogoProps) {
  // Dimensions map based on variant and size
  const dimensions = React.useMemo(() => {
    if (variant === "mark") {
      switch (size) {
        case "xs":
          return { width: 24, height: 24 };
        case "sm":
          return { width: 32, height: 32 };
        case "lg":
          return { width: 56, height: 56 };
        case "xl":
          return { width: 72, height: 72 };
        case "md":
        default:
          return { width: 40, height: 40 };
      }
    }

    // Full logo aspect ratio ~ 1.41 : 1 (width to height)
    switch (size) {
      case "xs":
        return { width: 90, height: 26 };
      case "sm":
        return { width: 120, height: 34 };
      case "lg":
        return { width: 200, height: 58 };
      case "xl":
        return { width: 260, height: 75 };
      case "md":
      default:
        return { width: 155, height: 45 };
    }
  }, [variant, size]);

  // Asset path based on variant and theme
  const src = React.useMemo(() => {
    if (variant === "mark") {
      if (theme === "light") return "/images/logo/logo-mark-black.svg";
      if (theme === "gold") return "/images/logo/logo-mark-gold.svg";
      return "/images/logo/logo-mark-white.svg";
    }

    if (theme === "light") return "/images/logo/logo-black.svg";
    if (theme === "gold") return "/images/logo/logo-gold.svg";
    return "/images/logo/logo-white.svg";
  }, [variant, theme]);

  return (
    <div className={cn("inline-flex items-center justify-center shrink-0 select-none", className)}>
      <Image
        src={src}
        alt="Becca's Crown Beauty Vault"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className="object-contain w-auto h-full"
      />
    </div>
  );
}
