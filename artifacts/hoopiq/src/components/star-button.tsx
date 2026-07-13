import React from "react";

interface StarButtonProps {
  active: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
  className?: string;
}

/**
 * Reusable star toggle used on every player row/column across Box Score,
 * Fantasy Optimizer, and Player Comparison. Stops click propagation so it
 * can sit inside rows that have their own click handlers (e.g. the
 * Fantasy Optimizer's select-on-row-click behavior).
 */
export function StarButton({ active, onToggle, label, size = 18, className = "" }: StarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`shrink-0 p-0.5 transition-colors ${active ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"} ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
