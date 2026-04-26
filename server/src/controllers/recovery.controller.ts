import { Request, Response } from 'express';
import * as recoveryService from '../services/recovery.service.js';

export const initiate = async (req: Request, res: Response) => {
    try {
        const { transactionId, complainantName, complainantEmail, complainantVpa, amountDisputed, notes } = req.body;
        if (!transactionId || !complainantName || !complainantEmail || !complainantVpa || amountDisputed == null) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const updatedCase = await recoveryService.initiateRecovery(transactionId, {
            complainantName, complainantEmail, complainantVpa, amountDisputed, notes
        });
        res.status(201).json({ data: updatedCase });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const advance = async (req: Request, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const updatedCase = await recoveryService.advanceRecoveryState(caseId);
        res.status(200).json({ data: updatedCase });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getByTransaction = async (req: Request, res: Response) => {
    try {
        const transactionId = req.params.transactionId as string;
        const caseData = await recoveryService.getRecoveryCaseByTransaction(transactionId);
        if (!caseData) {
            res.status(404).json({ error: "Case not found" });
            return;
        }
        res.status(200).json({ data: caseData });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAll = async (_req: Request, res: Response) => {
    try {
        const cases = await recoveryService.getAllRecoveryCases();
        res.status(200).json({ data: cases });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
