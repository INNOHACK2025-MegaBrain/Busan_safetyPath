"use client";

import { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

interface MenuItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

export default function MenuItem({
  label,
  icon: Icon,
  onClick,
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}
