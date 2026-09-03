import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { koboToNaira } from "../utils/account";
import { transactionStatus } from "../services/nibss.service";

export async function history(req: AuthRequest, res: Response) {
  const account = await prisma.account.findFirst({
    where: { customer: { userId: req.userId! } },
    select: { id: true }
  });
  if (!account) return res.status(404).json({ success: false, message: "Account not found" });

  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ senderAccountId: account.id }, { recipientAccountId: account.id }] },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return res.json({
    success: true,
    data: transactions.map(t => ({
      reference: t.reference,
      amount: koboToNaira(t.amountKobo),
      type: t.type,
      status: t.status,
      description: t.description,
      createdAt: t.createdAt
    }))
  });
}

export async function status(req: AuthRequest, res: Response) {
  const reference = z.string().min(5).parse(req.params.reference);

  const account = await prisma.account.findFirst({
    where: { customer: { userId: req.userId! } },
    select: { id: true }
  });
  if (!account) return res.status(404).json({ success: false, message: "Account not found" });

  const tx = await prisma.transaction.findFirst({
    where: {
      reference,
      OR: [{ senderAccountId: account.id }, { recipientAccountId: account.id }]
    }
  });
  if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });

  if (tx.providerReference) {
    try {
      const provider = await transactionStatus(tx.providerReference);
      const mapped = provider.status === "SUCCESS" ? "SUCCESSFUL" : provider.status === "FAILED" ? "FAILED" : "PENDING";

      if (mapped !== tx.status) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: mapped }
        });
      }

      return res.json({
        success: true,
        data: {
          reference: tx.reference,
          amount: provider.amount,
          type: tx.type,
          status: mapped,
          providerStatus: provider.status,
          from: provider.from,
          to: provider.to,
          timestamp: provider.timestamp
        }
      });
    } catch {
      // Fall back to the locally recorded status if provider TSQ is temporarily unavailable.
    }
  }

  return res.json({
    success: true,
    data: {
      reference: tx.reference,
      amount: koboToNaira(tx.amountKobo),
      type: tx.type,
      status: tx.status,
      createdAt: tx.createdAt
    }
  });
}