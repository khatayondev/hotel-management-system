"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DialogProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({
  isOpen,
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  const visible = isOpen !== undefined ? isOpen : !!open;
  if (!visible) return null;

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-[#E4E4E7] z-10 transition-all duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#F4F4F6]">
          <div>
            <h2 className="text-lg font-bold text-[#1E1E1E]">{title}</h2>
            {description && (
              <p className="text-xs text-[#71717A] mt-0.5">{description}</p>
            )}
          </div>
          <Button
            variant="circularIcon"
            size="iconSm"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F4F4F6]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "bottom" | "left" | "right";
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  side = "bottom",
  className,
}: DrawerProps) {
  if (!isOpen) return null;

  const sideStyles = {
    bottom: "bottom-0 inset-x-0 rounded-t-3xl max-h-[85vh]",
    left: "top-0 bottom-0 left-0 w-80 rounded-r-3xl h-full",
    right: "top-0 bottom-0 right-0 w-80 rounded-l-3xl h-full",
  };

  const isDark = className?.includes("bg-black") || className?.includes("bg-zinc-950");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed bg-white shadow-2xl border border-[#E4E4E7] p-6 z-10 overflow-y-auto flex flex-col",
          sideStyles[side],
          className
        )}
      >
        <div className={cn("flex items-center justify-between pb-4 border-b border-[#F4F4F6]", isDark && "border-white/10")}>
          <h2 className={cn("text-base font-bold text-[#1E1E1E]", isDark && "text-white")}>{title}</h2>
          <Button
            variant="circularIcon"
            size="iconSm"
            onClick={onClose}
            aria-label="Close drawer"
            className={isDark ? "bg-zinc-900 hover:bg-zinc-800 text-white border-white/10" : undefined}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface ContextMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  className?: string;
}

export function ContextMenuPopover({
  isOpen,
  onClose,
  items,
  className,
}: ContextMenuPopoverProps) {
  if (!isOpen) return null;

  return (
    <div className="relative">
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute right-0 mt-1 w-44 bg-[#1E1E1E] text-white rounded-2xl p-1.5 shadow-xl border border-white/10 z-40 animate-in fade-in zoom-in-95",
          className
        )}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left cursor-pointer",
              item.danger
                ? "text-rose-400 hover:bg-rose-500/20"
                : "text-white/90 hover:bg-white/10"
            )}
          >
            {item.icon && <span className="w-3.5 h-3.5 shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
