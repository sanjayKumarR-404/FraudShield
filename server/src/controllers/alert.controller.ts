import { Request, Response } from 'express';
import prisma from '../services/prisma.service.js';
import { sendWhatsAppAlert, sendVoiceAlert } from '../services/alert.service.js';

export const testAlert = async (req: Request, res: Response) => {
    try {
        const { transactionId } = req.body;
        if (!transactionId) {
            res.status(400).json({ error: "transactionId is required" });
            return;
        }

        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction) {
            res.status(404).json({ error: "Transaction not found" });
            return;
        }

        const [waResult, voiceResult] = await Promise.allSettled([
            sendWhatsAppAlert(transaction),
            sendVoiceAlert(transaction)
        ]);

        const whatsapp = waResult.status === 'fulfilled' && waResult.value;
        const voice = voiceResult.status === 'fulfilled' && voiceResult.value;

        res.status(200).json({ data: { whatsapp, voice } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAlertStatus = async (req: Request, res: Response) => {
    try {
        const transactionId = req.params.transactionId as string;
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            select: { whatsappAlertSent: true, voiceAlertSent: true, alertSentAt: true }
        });

        if (!transaction) {
            res.status(404).json({ error: "Transaction not found" });
            return;
        }

        res.status(200).json({ data: transaction });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
