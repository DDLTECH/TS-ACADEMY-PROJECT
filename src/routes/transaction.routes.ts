import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { history, status } from "../controllers/transaction.controller";

const router = Router();
router.use(requireAuth);
router.get("/", history);
router.get("/:reference", status);
export default router;