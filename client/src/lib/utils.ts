import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind's merging strategy
 * This is used in shadcn/ui components to manage class name combinations
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date with standard formatting
 */
export function formatDate(date: Date | string) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Get a string from local storage
 */
export function getStorageString(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

/**
 * Set a string in local storage
 */
export function setStorageString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

/**
 * Get an object from local storage
 */
export function getStorageItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error parsing item ${key} from localStorage`, error);
    return null;
  }
}

/**
 * Set an object in local storage
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}