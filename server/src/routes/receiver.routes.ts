import { Router } from "express";
import prisma from "../services/prisma.service.js";
import { getReceiverRiskScore } from "../services/receiverProfile.service.js";

const router = Router();

/**
 * GET /api/receivers/top-risk
 * Returns top 10 receivers by risk score (descending).
 */
router.get("/top-risk", async (_req, res, next) => {
    try {
        const topRisk = await prisma.receiverProfile.findMany({
            orderBy: { riskScore: "desc" },
            take: 10,
        });
        res.json({ success: true, data: topRisk });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/receivers/fraud-mules
 * Returns all receivers classified as FRAUD_MULE.
 */
router.get("/fraud-mules", async (_req, res, next) => {
    try {
        const mules = await prisma.receiverProfile.findMany({
            where: { riskCategory: "FRAUD_MULE" },
            orderBy: { riskScore: "desc" },
        });
        res.json({ success: true, data: mules });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/receivers/all
 * Returns all receiver profiles ordered by risk score.
 */
router.get("/all", async (_req, res, next) => {
    try {
        const all = await prisma.receiverProfile.findMany({
            orderBy: { riskScore: "desc" },
        });
        res.json({ success: true, data: all });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/receivers/:vpa/profile
 * Returns the ReceiverProfile for a specific VPA including computed risk signals.
 */
router.get("/:vpa/profile", async (req, res, next) => {
    try {
        const vpa = decodeURIComponent(req.params.vpa);
        const profile = await prisma.receiverProfile.findUnique({
            where: { receiverVpa: vpa },
        });

        if (!profile) {
            // Return a default empty profile for unknown receivers
            const riskResult = await getReceiverRiskScore(vpa);
            return res.json({
                success: true,
                data: {
                    receiverVpa: vpa,
                    riskScore: riskResult.score,
                    riskCategory: riskResult.category,
                    signals: riskResult.signals,
                    totalReceived: 0,
                    totalFraudFlagged: 0,
                    fraudRate: 0,
                    uniqueSendersLast24h: 0,
                    totalAmountLast24h: 0,
                    avgAmountReceived: 0,
                    isNewAccount: true,
                    firstSeenAt: new Date().toISOString(),
                },
            });
        }

        const riskResult = await getReceiverRiskScore(vpa);
        return res.json({
            success: true,
            data: { ...profile, signals: riskResult.signals },
        });
    } catch (err) {
        next(err);
        return;
    }
});

/**
 * GET /api/receivers/:vpa/transactions
 * Returns the last 50 transactions for a specific receiver VPA.
 */
router.get("/:vpa/transactions", async (req, res, next) => {
    try {
        const vpa = decodeURIComponent(req.params.vpa);
        const transactions = await prisma.transaction.findMany({
            where: { receiverVpa: vpa },
            orderBy: { timestamp: 'desc' },
            take: 50,
            select: {
                id: true,
                rrn: true,
                amount: true,
                status: true,
                senderVpa: true,
                receiverVpa: true,
                timestamp: true,
                riskScore: true,
                location: true,
            }
        });
        return res.json({ success: true, data: transactions });
    } catch (err) {
        next(err);
        return;
    }
});

export default router;
