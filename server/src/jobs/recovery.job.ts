import cron from 'node-cron';
import { checkExpiredCases } from '../services/recovery.service.js';

export const startRecoveryJobs = () => {
    // Run at midnight every day
    cron.schedule('0 0 * * *', async () => {
        try {
            await checkExpiredCases();
        } catch (error) {
            console.error("[RecoveryJob] Failed to process expirations:", error);
        }
    });

    console.log("[FraudShield] Recovery jobs started");
};
