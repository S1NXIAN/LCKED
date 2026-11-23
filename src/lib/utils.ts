import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** First value that isn't empty or whitespace. */
export function firstNonBlank(values: string[]): string | undefined {
  return values.find((v) => v.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string | undefined | null): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}
