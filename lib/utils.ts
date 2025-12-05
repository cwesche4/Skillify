import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility to merge Tailwind classes correctly.
 * Example: cn("p-2 p-4") => "p-4"
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}
