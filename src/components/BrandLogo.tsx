import React from "react";

interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-14 h-14",
};

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-label="Platform SPC"
      className={`${SIZE_CLASSES[size]} shrink-0 ${className}`.trim()}
    >
      <defs>
        <linearGradient id="spcLogoBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="spcLogoRing" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C7D2FE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#spcLogoBg)" />
      <g stroke="url(#spcLogoRing)" strokeWidth="2.6" strokeLinecap="round">
        <ellipse cx="32" cy="32" rx="20" ry="8.2" transform="rotate(-30 32 32)" />
        <ellipse cx="32" cy="32" rx="20" ry="8.2" transform="rotate(30 32 32)" />
        <ellipse cx="32" cy="32" rx="20" ry="8.2" transform="rotate(90 32 32)" />
      </g>
      <circle cx="32" cy="32" r="5" fill="#FFFFFF" />
      <circle cx="49" cy="22" r="2.6" fill="#38BDF8" />
      <circle cx="15" cy="42" r="2.6" fill="#34D399" />
      <circle cx="32" cy="12" r="2.4" fill="#FDE047" />
    </svg>
  );
}
