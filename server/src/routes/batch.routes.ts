import { Router, Response } from "express";
import multer from "multer";
import { authGuard } from "../middleware/auth.middleware.js";
import prisma from "../services/prisma.service.js";
import { parseCsvFile, processBatchTransactions, generateBatchReport } from "../services/batch.service.js";
import { generateBatchReportPdf } from "../services/report.service.js";
import type { AuthenticatedRequest, ApiResponse } from "../types/index.js";
import fs from 'fs';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.use(authGuard);

router.post("/", upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: "CSV file is required" } as ApiResponse);
        return;
    }

    try {
        // Use req.userId directly (already set by authGuard)
        const userId = req.userId!;
        
        const { transactions, errorCount } = await parseCsvFile(req.file.buffer);

        if (transactions.length === 0) {
            res.status(400).json({ success: false, message: "No valid transactions found in CSV." } as ApiResponse);
            return;
        }

        if (transactions.length > 5000) {
            res.status(400).json({ success: false, message: "Max 5000 transactions allowed per batch." } as ApiResponse);
            return;
        }

        const batchJob = await prisma.batchJob.create({
            data: {
                userId: userId,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                totalCount: transactions.length,
                status: "PROCESSING"
            }
        });

        // Fire and forget processing
        processBatchTransactions(batchJob.id, transactions)
            .then(async (result) => {
                // Post-processing completion
                const reportData = generateBatchReport(
                    { totalCount: batchJob.totalCount, frozenCount: result.frozenCount, allowedCount: result.allowedCount }, 
                    result.results
                );
                
                await prisma.batchJob.update({
                    where: { id: batchJob.id },
                    data: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                        reportData: JSON.stringify(reportData),
                        processedCount: result.processedCount,
                        frozenCount: result.frozenCount,
                        allowedCount: result.allowedCount
                    }
                });
            })
            .catch(async (e) => {
                console.error("Batch Job Fatal Error", e);
                await prisma.batchJob.update({
                    where: { id: batchJob.id },
                    data: { status: "FAILED", errorMessage: e.message }
                });
            });

        res.status(202).json({
            success: true,
            message: "Batch processing started",
            data: { batchId: batchJob.id, errorCount }
        } as ApiResponse);

    } catch (e: any) {
        res.status(400).json({ success: false, message: e.message } as ApiResponse);
    }
});

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    const batches = await prisma.batchJob.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: batches } as ApiResponse);
});

router.get("/:batchId", async (req: AuthenticatedRequest, res: Response) => {
    const batch = await prisma.batchJob.findUnique({
        where: { id: req.params.batchId as string},
        include: { transactions: true }
    });

    if (!batch || batch.userId !== req.userId!) {
        res.status(404).json({ success: false, message: "Batch not found" } as ApiResponse);
        return;
    }

    res.status(200).json({ success: true, data: batch } as ApiResponse);
});

router.get("/:batchId/report/csv", async (req: AuthenticatedRequest, res: Response) => {
    const batch = await prisma.batchJob.findUnique({
        where: { id: req.params.batchId as string},
        include: { transactions: true }
    });

    if (!batch || batch.status !== "COMPLETED" || batch.userId !== req.userId!) {
        res.status(404).json({ success: false, message: "Report not available" } as ApiResponse);
        return;
    }

    const header = "RRN,Sender,Receiver,Amount,Location,Status,RiskScore\n";
    const rows = batch.transactions.map((t: any) => `${t.rrn},${t.senderVpa},${t.receiverVpa},${t.amount},${t.location},${t.status},${t.riskScore}`).join("\n");
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="batch_report_${batch.id}.csv"`);
    res.status(200).send(header + rows);
});

router.get("/:batchId/report/pdf", async (req: AuthenticatedRequest, res: Response) => {
    const batch = await prisma.batchJob.findUnique({
        where: { id: req.params.batchId as string},
        include: { transactions: true }
    });

    if (!batch || batch.status !== "COMPLETED" || batch.userId !== req.userId!) {
        res.status(404).json({ success: false, message: "Report not available" } as ApiResponse);
        return;
    }

    try {
        const filePath = await generateBatchReportPdf(batch, batch.transactions);
        res.download(filePath, `batch_report_${batch.id}.pdf`, (err) => {
            if (err) console.error("PDF download failed", err);
            // Optionally delete the file after sending
            fs.unlink(filePath, () => {});
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to generate PDF" } as ApiResponse);
    }
});

export default router;