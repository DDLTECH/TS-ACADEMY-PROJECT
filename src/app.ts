import express from "express";
import authRoutes from "./routes/auth.routes";
import onboardingRoutes from "./routes/onboarding.routes";
import accountRoutes from "./routes/account.routes";
import transferRoutes from "./routes/transfer.routes";
import transactionRoutes from "./routes/transaction.routes";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Digital Banking API is running" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/onboarding", onboardingRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/transfers", transferRoutes);
app.use("/api/v1/transactions", transactionRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({
    success: false,
    message: err?.message ?? "Request failed"
  });
});