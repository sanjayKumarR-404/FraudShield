import { RecoveryStatus, Prisma } from '@prisma/client';
import prisma from './prisma.service.js';
import { generateDisputePDF } from './pdf.service.js';

export const initiateRecovery = async (
    transactionId: string,
    complainantDetails: { complainantName: string, complainantEmail: string, complainantVpa: string, amountDisputed: number, notes?: string }
) => {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new Error("Transaction not found");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const caseData = await prisma.recoveryCase.create({
        data: {
            transactionId,
            status: RecoveryStatus.INITIATED,
            expiresAt,
            complainantName: complainantDetails.complainantName,
            complainantEmail: complainantDetails.complainantEmail,
            complainantVpa: complainantDetails.complainantVpa,
            amountDisputed: complainantDetails.amountDisputed,
            notes: complainantDetails.notes
        }
    });

    const pdfPath = await generateDisputePDF(caseData, transaction);

    return await prisma.recoveryCase.update({
        where: { id: caseData.id },
        data: { pdfPath }
    });
};

export const advanceRecoveryState = async (caseId: string) => {
    const caseData = await prisma.recoveryCase.findUnique({ where: { id: caseId } });
    if (!caseData) throw new Error("Recovery Case not found");

    const now = new Date();
    let updateData: Prisma.RecoveryCaseUpdateInput = {};

    if (caseData.status === RecoveryStatus.INITIATED) {
        updateData = { status: RecoveryStatus.BANK_NOTIFIED, bankNotifiedAt: now };
    } else if (caseData.status === RecoveryStatus.BANK_NOTIFIED) {
        if (!caseData.bankNotifiedAt) throw new Error("Missing bank notification date");
        const diffDays = (now.getTime() - new Date(caseData.bankNotifiedAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays < 7) {
            throw new Error("Cannot escalate to RBI before 7 days have passed since bank notification");
        }
        updateData = { status: RecoveryStatus.RBI_ESCALATED, rbiEscalatedAt: now };
    } else if (caseData.status === RecoveryStatus.RBI_ESCALATED) {
        updateData = { status: RecoveryStatus.RESOLVED, resolvedAt: now };
    } else {
        throw new Error(`Cannot advance manually from state: ${caseData.status}`);
    }

    return await prisma.recoveryCase.update({
        where: { id: caseId },
        data: updateData
    });
};

export const checkExpiredCases = async () => {
    const now = new Date();
    const expiredCases = await prisma.recoveryCase.updateMany({
        where: {
            expiresAt: { lt: now },
            status: { notIn: [RecoveryStatus.RESOLVED, RecoveryStatus.FAILED, RecoveryStatus.EXPIRED] }
        },
        data: {
            status: RecoveryStatus.EXPIRED
        }
    });

    console.log(`[RecoveryJob] Expired ${expiredCases.count} cases today.`);
    return expiredCases.count;
};

export const getRecoveryCaseByTransaction = async (transactionId: string) => {
    return await prisma.recoveryCase.findUnique({
        where: { transactionId },
        include: { transaction: true }
    });
};

export const getAllRecoveryCases = async () => {
    return await prisma.recoveryCase.findMany({
        orderBy: { initiatedAt: 'desc' },
        include: { transaction: true }
    });
};
