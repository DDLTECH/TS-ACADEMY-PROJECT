import "dotenv/config";

const base = (process.env.NIBSS_BASE_URL || "https://nibssbyphoenix.onrender.com").replace(/\/+$/, "");
const name = process.env.BANK_NAME;
const email = process.env.BANK_EMAIL;

if (!name || !email) throw new Error("Set BANK_NAME and BANK_EMAIL in .env");

const response = await fetch(`${base}/api/fintech/onboard`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email })
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
console.log("\nCopy apiKey and apiSecret into .env. Never commit them.");
