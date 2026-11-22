import { twMerge } from "tailwind-merge";

/** Join class names, dropping falsy values, and let later Tailwind utilities win. */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}
