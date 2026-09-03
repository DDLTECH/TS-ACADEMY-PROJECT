import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { nameEnquiry, transfer as providerTransfer, getProviderBalance } from "../services/nibss.service";
import { nairaToKobo, koboToNaira } from "../utils/account";

const transferSchema = z.object({
  recipientAccountNumber: z.string().regex(/^\d{10}$/, "Recipient account number must be 10 digits"),
  amount: z.number().positive(),
  description: z.string().max(100).optional()
});

export async function nameEnquiryController(req: AuthRequest, res: Response) {
  const accountNumber = z.string().regex(/^\d{10}$/).parse(req.params.accountNumber);
  try {
    const result = await nameEnquiry(accountNumber);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(error?.status && error.status < 500 ? error.status : 502).json({
      success: false,
      message: error instanceof Error ? error.message : "Name enquiry failed"
    });
  }
}

export async function transfer(req: AuthRequest, res: Response) {
  const data = transferSchema.parse(req.body);
  const amountKobo = nairaToKobo(data.amount);

  const sender = await prisma.account.findFirst({
    where: { customer: { userId: req.userId! } }
  });
  if (!sender) return res.status(404).json({ success: false, message: "Sender account not found" });
  if (sender.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Account is not active" });

  // Name enquiry is mandatory before transfer according to the supplied API docs.
  let recipient;
  try {
    recipient = await nameEnquiry(data.recipientAccountNumber);
  } catch (error: any) {
    return res.status(error?.status && error.status < 500 ? error.status : 502).json({
      success: false,
      message: error instanceof Error ? error.message : "Recipient name enquiry failed"
    });
  }

  // The customer's own BVN/NIN was verified during onboarding before transfer.
  const customer = await prisma.customer.findUnique({
    where: { userId: req.userId! },
    select: { verificationStatus: true }
  });
  if (customer?.verificationStatus !== "VERIFIED") {
    return res.status(403).json({ success: false, message: "Customer identity must be verified before transfer" });
  }

  // The provider is the ledger of record. It enforces available balance.
  try {
    const result = await providerTransfer({
      from: sender.accountNumber,
      to: data.recipientAccountNumber,
      amount: String(data.amount)
    });

    const status = result.status === "SUCCESS" ? "SUCCESSFUL" : "PENDING";
    const localRecipient = await prisma.account.findUnique({
      where: { accountNumber: data.recipientAccountNumber }
    });

    const created = await prisma.$transaction(async tx => {
      const row = await tx.transaction.create({
        data: {
          reference: result.transactionId,
          senderAccountId: sender.id,
          recipientAccountId: localRecipient?.id,
          recipientAccountNumber: data.recipientAccountNumber,
          amountKobo,
          type: localRecipient ? "INTRA_BANK" : "INTER_BANK",
          status,
          description: data.description,
          providerReference: result.transactionId
        }
      });

      // Synchronize local balances from the provider after successful submission.
      if (status === "SUCCESSFUL") {
        const senderBalance = await getProviderBalance(sender.accountNumber);
        await tx.account.update({
          where: { id: sender.id },
          data: { balanceKobo: BigInt(Math.round(senderBalance.balance * 100)) }
        });

        if (localRecipient) {
          const recipientBalance = await getProviderBalance(localRecipient.accountNumber);
          await tx.account.update({
            where: { id: localRecipient.id },
            data: { balanceKobo: BigInt(Math.round(recipientBalance.balance * 100)) }
          });
        }
      }

      return row;
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      data: {
        reference: created.reference,
        recipient: recipient.accountName,
        amount: koboToNaira(amountKobo),
        type: created.type,
        status: created.status
      }
    });
  } catch (error: any) {
    const status = error?.status === 400 ? 400 : 502;
    return res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : "Transfer failed"
    });
  }
}