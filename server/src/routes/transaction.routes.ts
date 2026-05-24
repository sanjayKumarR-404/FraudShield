import { Router } from "express";
import { authGuard } from "../middleware/auth.middleware.js";
import { process, getAll, getById, getAttribution } from "../controllers/transaction.controller.js";

const router = Router();

// All transaction routes require authentication
router.use(authGuard);

router.post("/process", process);
router.get("/", getAll);
router.get("/:id", getById);
router.get("/:id/attribution", getAttribution);

export default router;
