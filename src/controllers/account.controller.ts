import { Response } from "express";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { koboToNaira } from "../utils/account";
import { decryptIdentifier } from "../utils/privacy";
import { createProviderAccount, getProviderBalance } from "../services/nibss.service";

const PREFUND_KOBO = 1500000n;

export async function createAccount(req: AuthRequest, res: Response) {
  const customer = await prisma.customer.findUnique({
    where: { userId: req.userId! },
    include: { account: true, onboarding: { orderBy: { createdAt: "desc" } } }
  });

  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  if (customer.verificationStatus !== "VERIFIED") {
    return res.status(403).json({
      success: false,
      message: "BVN or NIN verification must be successful before account creation"
    });
  }
  if (customer.account) {
    return res.status(409).json({ success: false, message: "Customer already has an account" });
  }

  const latest = customer.onboarding.find(o => o.status === "VERIFIED");
  if (!latest) return res.status(403).json({ success: false, message: "Verified KYC record not found" });

  const encrypted = latest.type === "BVN" ? customer.bvnEncrypted : customer.ninEncrypted;
  if (!encrypted || !customer.dateOfBirth) {
    return res.status(400).json({ success: false, message: "Complete verified KYC data is required" });
  }

  try {
    const provider = await createProviderAccount({
      kycType: latest.type.toLowerCase() as "bvn" | "nin",
      kycID: decryptIdentifier(encrypted),
      dob: customer.dateOfBirth.toISOString().slice(0, 10)
    });

    const account = await prisma.$transaction(async tx => {
      const created = await tx.account.create({
        data: {
          customerId: customer.id,
          accountNumber: provider.accountNumber,
          accountName: `${customer.firstName} ${customer.lastName}`,
          balanceKobo: BigInt(Math.round(provider.balance * 100))
        }
      });

      await tx.transaction.create({
        data: {
          reference: `FUND-${provider.accountNumber}-${Date.now()}`,
          recipientAccountId: created.id,
          amountKobo: BigInt(Math.round(provider.balance * 100)),
          type: "FUNDING",
          status: "SUCCESSFUL",
          description: "NIBSS By Phoenix test-account pre-funding"
        }
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Account created through NIBSS By Phoenix",
      data: {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankCode: provider.bankCode,
        bankName: provider.bankName,
        balance: provider.balance,
        currency: account.currency
      }
    });
  } catch (error: any) {
    return res.status(error?.status && error.status < 500 ? error.status : 502).json({
      success: false,
      message: error instanceof Error ? error.message : "NIBSS account creation failed"
    });
  }
}

export async function getAccount(req: AuthRequest, res: Response) {
  const account = await prisma.account.findFirst({
    where: { customer: { userId: req.userId! } }
  });
  if (!account) return res.status(404).json({ success: false, message: "Account not found" });

  try {
    const provider = await getProviderBalance(account.accountNumber);
    const balanceKobo = BigInt(Math.round(provider.balance * 100));

    if (balanceKobo !== account.balanceKobo) {
      await prisma.account.update({
        where: { id: account.id },
        data: { balanceKobo }
      });
    }

    return res.json({
      success: true,
      data: {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        balance: provider.balance,
        currency: account.currency,
        status: account.status
      }
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not retrieve provider balance"
    });
  }
}