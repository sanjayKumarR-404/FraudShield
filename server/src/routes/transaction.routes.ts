import { Router } from "express";
import { authGuard } from "../middleware/auth.middleware.js";
import { process, getAll, getById, getAttribution, getTrends, getVpaStats } from "../controllers/transaction.controller.js";

const router = Router();

// All transaction routes require authentication
router.use(authGuard);

router.post("/process", process);
router.get("/", getAll);
// Phase 12: analytics endpoints — must be registered BEFORE /:id to avoid shadowing
router.get("/trends", getTrends);
router.get("/vpa-stats/:vpa", getVpaStats);
router.get("/:id", getById);
router.get("/:id/attribution", getAttribution);

export default router;
