import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { onboard, onboardingStatus } from "../controllers/onboarding.controller";

const router = Router();
router.use(requireAuth);
router.post("/bvn", onboard);
router.post("/nin", onboard);
router.get("/status", onboardingStatus);
export default router;