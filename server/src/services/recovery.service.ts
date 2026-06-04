import { RecoveryStatus, Prisma } from '@prisma/client';
import prisma from './prisma.service.js';
import { generateDisputePDF } from './pdf.service.js';

export const initiateRecovery = async (
    transactionId: string,
    complainantDetails: { complainantName: string, complainantEmail: string, notes?: string }
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
            description: complainantDetails.notes
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
        updateData = { status: RecoveryStatus.BANK_NOTIFIED };
    } else if (caseData.status === RecoveryStatus.BANK_NOTIFIED) {
        updateData = { status: RecoveryStatus.RBI_ESCALATED };
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
    const caseData = await prisma.recoveryCase.findUnique({
        where: { transactionId }
    });
    if (!caseData) return null;
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    return { ...caseData, transaction };
};

export const getAllRecoveryCases = async () => {
    const cases = await prisma.recoveryCase.findMany({
        orderBy: { initiatedAt: 'desc' }
    });
    const txIds = cases.map(c => c.transactionId);
    const txs = await prisma.transaction.findMany({ where: { id: { in: txIds } } });
    const txMap = new Map(txs.map(t => [t.id, t]));
    return cases.map(c => ({ ...c, transaction: txMap.get(c.transactionId) }));
};

// ── Phase 19: Evidence Upload ──────────────────────────────────

export const uploadEvidence = async (
    caseId: string,
    fileUrl: string,
    fileType: 'SCREENSHOT' | 'BANK_STATEMENT' | 'CHAT_HISTORY'
): Promise<void> => {
    const caseData = await prisma.recoveryCase.findUnique({ where: { id: caseId } });
    if (!caseData) throw new Error('Recovery case not found');

    const updatedUploads = [...caseData.evidenceUploads, fileUrl];
    const updateData: Record<string, unknown> = { evidenceUploads: updatedUploads };

    if (fileType === 'SCREENSHOT') updateData.screenshotsCount = (caseData.screenshotsCount || 0) + 1;
    if (fileType === 'BANK_STATEMENT') updateData.bankStatementsCount = (caseData.bankStatementsCount || 0) + 1;
    if (fileType === 'CHAT_HISTORY') updateData.chatHistoriesCount = (caseData.chatHistoriesCount || 0) + 1;

    await prisma.recoveryCase.update({ where: { id: caseId }, data: updateData });
};

// ── Phase 19: Generate FIR PDF ────────────────────────────────

export const generateFIR = async (caseId: string): Promise<string> => {
    const caseData = await prisma.recoveryCase.findUnique({
        where: { id: caseId }
    });
    if (!caseData) throw new Error('Recovery case not found');
    const transaction = await prisma.transaction.findUnique({ where: { id: caseData.transactionId } });
    if (!transaction) throw new Error('Transaction not found');

    const { generateFIRDocument } = await import('./pdf.service.js');
    const firPath = await generateFIRDocument(caseData, transaction);

    await prisma.recoveryCase.update({
        where: { id: caseId },
        data: { firPdfPath: firPath }
    });

    return firPath;
};

// ── Phase 19: Generate Complaint Letters ──────────────────────

export const generateComplaintLetters = async (caseId: string): Promise<{ firPath: string; bankPath: string }> => {
    const caseData = await prisma.recoveryCase.findUnique({
        where: { id: caseId }
    });
    if (!caseData) throw new Error('Recovery case not found');
    const transaction = await prisma.transaction.findUnique({ where: { id: caseData.transactionId } });
    if (!transaction) throw new Error('Transaction not found');

    const { generateFIRDocument } = await import('./pdf.service.js');
    // Re-use the FIR generator for both documents (differentiate via filename)
    const firPath = await generateFIRDocument(caseData, transaction);
    const bankPath = await generateFIRDocument(
        { ...caseData, description: 'BANK COMPLAINT COPY — For bank fraud investigation desk' },
        transaction
    );

    await prisma.recoveryCase.update({
        where: { id: caseId },
        data: { firPdfPath: firPath }
    });

    return { firPath, bankPath };
};

// ── Phase 19: Update FIR Status ───────────────────────────────

export const updateFIRStatus = async (
    caseId: string,
    status: 'REGISTERED' | 'INVESTIGATION' | 'CLOSED',
    firNumber?: string,
    policeStation?: string
): Promise<unknown> => {
    const updateData: Record<string, unknown> = { firStatus: status };

    if (status === 'REGISTERED') updateData.registeredAt = new Date();
    if (firNumber) updateData.firNumber = firNumber;
    if (policeStation) updateData.policeStationName = policeStation;

    return await prisma.recoveryCase.update({
        where: { id: caseId },
        data: updateData
    });
};

// ── Phase 19: Mark Resolved ───────────────────────────────────

export const markResolved = async (
    caseId: string,
    recoveryAmount: number,
    recoveryDate: Date
): Promise<unknown> => {
    return await prisma.recoveryCase.update({
        where: { id: caseId },
        data: {
            status: RecoveryStatus.RESOLVED,
            resolvedAt: new Date(),
            recoveryAmount,
            recoveryDate,
            firStatus: 'CLOSED'
        }
    });
};

// ── Phase 19: Reminders ───────────────────────────────────────

export const checkAndSendReminders = async (): Promise<void> => {
    const now = new Date();
    const cases = await prisma.recoveryCase.findMany({
        where: {
            status: { notIn: [RecoveryStatus.RESOLVED, RecoveryStatus.EXPIRED, RecoveryStatus.FAILED] }
        }
    });

    for (const c of cases) {
        const daysSince = Math.floor((now.getTime() - new Date(c.initiatedAt).getTime()) / (1000 * 60 * 60 * 24));
        const updates: Record<string, boolean> = {};

        if (daysSince >= 30 && !c.day30Reminded) updates.day30Reminded = true;
        if (daysSince >= 60 && !c.day60Reminded) updates.day60Reminded = true;
        if (daysSince >= 85 && !c.day85Reminded) updates.day85Reminded = true;

        if (Object.keys(updates).length > 0) {
            await prisma.recoveryCase.update({ where: { id: c.id }, data: updates });
            console.log(`[RecoveryReminder] Case ${c.id} — Day ${daysSince} reminder flags set.`);
        }
    }
};

// ── Phase 19: Get Single Case ─────────────────────────────────

export const getRecoveryCaseById = async (caseId: string) => {
    const caseData = await prisma.recoveryCase.findUnique({
        where: { id: caseId }
    });
    if (!caseData) return null;
    const transaction = await prisma.transaction.findUnique({ where: { id: caseData.transactionId } });
    return { ...caseData, transaction };
};
