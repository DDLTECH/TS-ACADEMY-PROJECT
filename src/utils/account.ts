import { randomInt } from "crypto";

export function generateReference(prefix = "TXN") {
  return `${prefix}-${Date.now()}-${randomInt(100000, 999999)}`;
}

export async function generateAccountNumber(exists: (n: string) => Promise<boolean>) {
  for (let i = 0; i < 20; i++) {
    const number = String(randomInt(100000000, 999999999)).padStart(10, "0");
    if (!(await exists(number))) return number;
  }
  throw new Error("Could not generate unique account number");
}

export function nairaToKobo(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
  return BigInt(Math.round(amount * 100));
}

export function koboToNaira(kobo: bigint) {
  return Number(kobo) / 100;
}