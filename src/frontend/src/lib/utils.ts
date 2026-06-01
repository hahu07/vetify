import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanizeCycleError(error: unknown): string {
  const msg = String(error).toLowerCase();
  if (
    msg.includes("cycle") ||
    msg.includes("cycles") ||
    msg.includes("insufficient") ||
    msg.includes("balance")
  ) {
    return "The platform is temporarily paused. Please contact the administrator to top up the cycle balance.";
  }
  return String(error);
}
