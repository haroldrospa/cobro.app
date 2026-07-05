import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDaysRemaining(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  const days = differenceInDays(new Date(dateString), new Date());
  return days > 0 ? days : 0;
}
