import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes (host token utilities + plugin overrides). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
