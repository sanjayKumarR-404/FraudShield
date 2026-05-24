import { Router } from "express";
import { getProfile, checkAnomaly, rebuildProfile } from "../controllers/user.controller.js";

const router = Router();
router.get("/:userId/profile", getProfile);
router.post("/:userId/profile-check", checkAnomaly);
router.post("/:userId/profile-rebuild", rebuildProfile);

export default router;
