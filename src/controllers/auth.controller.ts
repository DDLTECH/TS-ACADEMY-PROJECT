import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/database";
import { signToken } from "../utils/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(7)
});

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      customer: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone
        }
      }
    },
    include: { customer: true }
  });

  return res.status(201).json({
    success: true,
    message: "Customer registered",
    data: { userId: user.id, customerId: user.customer?.id }
  });
}

export async function login(req: Request, res: Response) {
  const data = z.object({
    email: z.string().email(),
    password: z.string()
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  return res.json({ success: true, token: signToken(user.id) });
}