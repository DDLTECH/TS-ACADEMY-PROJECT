import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { encryptIdentifier } from "../utils/privacy";
import { verifyBvn, verifyNin } from "../services/nibss.service";

const schema = z.object({
  identifier: z.string().regex(/^\d{11}$/, "Identifier must be exactly 11 digits")
});

export async function onboard(req: AuthRequest, res: Response) {
  const type = req.path.toLowerCase().includes("bvn") ? "BVN" : "NIN";
  const { identifier } = schema.parse(req.body);

  const customer = await prisma.customer.findUnique({
    where: { userId: req.userId! }
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

  try {
    const result = type === "BVN"
      ? await verifyBvn(identifier)
      : await verifyNin(identifier);

    if (!result.valid) {
      await prisma.onboarding.create({
        data: { customerId: customer.id, type, status: "FAILED" }
      });
      return res.status(400).json({ success: false, message: `${type} validation failed` });
    }

    await prisma.$transaction(async tx => {
      await tx.onboarding.create({
        data: { customerId: customer.id, type, status: "VERIFIED" }
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          firstName: result.firstName,
          lastName: result.lastName,
          dateOfBirth: new Date(`${result.dob}T00:00:00.000Z`),
          verificationStatus: "VERIFIED",
          ...(type === "BVN"
            ? { bvnEncrypted: encryptIdentifier(identifier) }
            : { ninEncrypted: encryptIdentifier(identifier) })
        }
      });
    });

    return res.json({
      success: true,
      message: `${type} verification successful`,
      data: {
        verificationStatus: "VERIFIED",
        firstName: result.firstName,
        lastName: result.lastName,
        dateOfBirth: result.dob
      }
    });
  } catch (error: any) {
    return res.status(error?.status && error.status < 500 ? error.status : 502).json({
      success: false,
      message: error instanceof Error ? error.message : "NIBSS onboarding error"
    });
  }
}

export async function onboardingStatus(req: AuthRequest, res: Response) {
  const customer = await prisma.customer.findUnique({
    where: { userId: req.userId! },
    select: {
      verificationStatus: true,
      onboarding: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });

  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  return res.json({ success: true, data: customer });
}