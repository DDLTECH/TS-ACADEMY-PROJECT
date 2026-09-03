import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { nameEnquiryController, transfer } from "../controllers/transfer.controller";

const router = Router();
router.use(requireAuth);
router.get("/name-enquiry/:accountNumber", nameEnquiryController);
router.post("/", transfer);
export default router;