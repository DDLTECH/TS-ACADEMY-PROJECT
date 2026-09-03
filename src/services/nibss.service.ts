import { env } from "../config/env";

type TokenResponse = {
  token: string;
  fintech: {
    name: string;
    email: string;
    bankCode: string;
    bankName: string;
  };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function baseUrl() {
  if (!env.nibssBaseUrl) throw new Error("NIBSS_BASE_URL is not configured");
  return env.nibssBaseUrl.replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });

  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!response.ok) {
    const message = data?.message ?? `NIBSS request failed with HTTP ${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    throw error;
  }
  return data as T;
}

export async function fintechOnboard() {
  return request<{
    apiKey: string;
    apiSecret: string;
    bankCode: string;
    bankName: string;
  }>("/api/fintech/onboard", {
    method: "POST",
    body: { name: env.bankName, email: env.bankEmail }
  });
}

export async function login(): Promise<TokenResponse> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return {
      token: cachedToken.value,
      fintech: { name: env.bankName, email: env.bankEmail, bankCode: "", bankName: "" }
    };
  }

  if (!env.nibssApiKey || !env.nibssApiSecret) {
    throw new Error("NIBSS_API_KEY and NIBSS_API_SECRET are required");
  }

  const result = await request<TokenResponse>("/api/auth/token", {
    method: "POST",
    body: { apiKey: env.nibssApiKey, apiSecret: env.nibssApiSecret }
  });

  // Documentation specifies a 1-hour JWT lifetime. Refresh slightly early.
  cachedToken = { value: result.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return result;
}

async function protectedRequest<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const auth = await login();
  return request<T>(path, { ...options, token: auth.token });
}

export async function verifyBvn(bvn: string) {
  return request<{
    valid: boolean;
    bvn: string;
    firstName: string;
    lastName: string;
    dob: string;
  }>("/api/validateBvn", { method: "POST", body: { bvn } });
}

export async function verifyNin(nin: string) {
  return request<{
    valid: boolean;
    nin: string;
    firstName: string;
    lastName: string;
    dob: string;
  }>("/api/validateNin", { method: "POST", body: { nin } });
}

export async function createProviderAccount(input: {
  kycType: "bvn" | "nin";
  kycID: string;
  dob: string;
}) {
  return protectedRequest<{
    message: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    balance: number;
  }>("/api/account/create", { method: "POST", body: input });
}

export async function nameEnquiry(accountNumber: string) {
  return protectedRequest<{
    accountNumber: string;
    accountName: string;
    bankName: string;
  }>(`/api/account/name-enquiry/${encodeURIComponent(accountNumber)}`);
}

export async function getProviderBalance(accountNumber: string) {
  return protectedRequest<{
    accountNumber: string;
    balance: number;
  }>(`/api/account/balance/${encodeURIComponent(accountNumber)}`);
}

export async function getAllProviderAccounts() {
  return protectedRequest<{
    accounts: Array<{ accountNumber: string; accountName: string; balance: number }>;
  }>("/api/accounts");
}

export async function transfer(input: {
  from: string;
  to: string;
  amount: string;
}) {
  return protectedRequest<{
    message: string;
    transactionId: string;
    amount: number;
    from: string;
    to: string;
    status: string;
  }>("/api/transfer", { method: "POST", body: input });
}

export async function transactionStatus(transactionId: string) {
  return protectedRequest<{
    transactionId: string;
    status: string;
    amount: number;
    from: string;
    to: string;
    timestamp: string;
  }>(`/api/transaction/${encodeURIComponent(transactionId)}`);
}