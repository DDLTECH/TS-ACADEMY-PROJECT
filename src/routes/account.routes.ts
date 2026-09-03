import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createAccount, getAccount } from "../controllers/account.controller";

const router = Router();
router.use(requireAuth);
router.post("/", createAccount);
router.get("/", getAccount);
router.get("/balance", getAccount);
export default router;