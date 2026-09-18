import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Pick black or white text for a background colour using the WCAG relative
 * luminance formula, so category colours stay readable whatever the user picks.
 */
export function readableTextColor(hexColor: string): "#0f172a" | "#ffffff" {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#0f172a";

  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

  return luminance > 0.45 ? "#0f172a" : "#ffffff";
}
