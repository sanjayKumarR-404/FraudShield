import { Request, Response } from "express";
import { getUserProfile, isTransactionAnomalous, initializeOrUpdateProfile } from "../services/userProfile.service.js";

export async function getProfile(req: Request, res: Response) {
    try {
        const profile = await getUserProfile(req.params.userId as string);
        res.json({ success: true, data: profile });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function checkAnomaly(req: Request, res: Response) {
    try {
        const { transaction } = req.body;
        const result = await isTransactionAnomalous(req.params.userId as string, transaction);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function rebuildProfile(req: Request, res: Response) {
    try {
        await initializeOrUpdateProfile(req.params.userId as string);
        res.json({ success: true, message: "Profile rebuilt successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}
