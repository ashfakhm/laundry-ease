import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Mask bank account numbers, IFSC and UPI IDs for safe API responses.
 * - accountNumber: show only last 4 digits (prefix with ****)
 * - ifsc: show first 2 and last 2 chars, mask the middle
 * - upi: show prefix up to @ and mask local part partially
 */
export function maskAccountNumber(account?: string | null) {
  if (!account) return account;
  const clean = account.replace(/\s+/g, "");
  if (clean.length <= 4) return "****" + clean;
  return "****" + clean.slice(-4);
}

export function maskIfsc(ifsc?: string | null) {
  if (!ifsc) return ifsc;
  if (ifsc.length <= 4) return "****";
  const first = ifsc.slice(0, 2);
  const last = ifsc.slice(-2);
  return `${first}****${last}`;
}

export function maskUpi(upi?: string | null) {
  if (!upi) return upi;
  const parts = upi.split("@");
  if (parts.length !== 2) return "****@" + (parts[1] || "*");
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return "**@" + domain;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}****@${domain}`;
}

export function maskBankDetails(
  bank:
    | {
        accountNumber?: string;
        ifsc?: string;
        upiId?: string;
        accountHolderName?: string;
      }
    | null
    | undefined
) {
  if (!bank) return bank;
  return {
    ...bank,
    accountNumber: bank.accountNumber
      ? maskAccountNumber(bank.accountNumber)
      : undefined,
    ifsc: bank.ifsc ? maskIfsc(bank.ifsc) : undefined,
    upiId: bank.upiId ? maskUpi(bank.upiId) : undefined,
    // keep accountHolderName as-is (business need), but you may choose to partially mask it
  };
}
