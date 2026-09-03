import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 5000),
  jwtSecret: process.env.JWT_SECRET ?? "",
  nibssBaseUrl: process.env.NIBSS_BASE_URL ?? "https://nibssbyphoenix.onrender.com",
  nibssApiKey: process.env.NIBSS_API_KEY ?? "",
  nibssApiSecret: process.env.NIBSS_API_SECRET ?? "",
  bankName: process.env.BANK_NAME ?? "Phoenix Digital Bank",
  bankEmail: process.env.BANK_EMAIL ?? ""
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is required");
}