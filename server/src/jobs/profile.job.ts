import { initializeOrUpdateProfile } from "../services/userProfile.service.js";

export function syncUserProfile(userId: string) {
    // Process completely detached
    setImmediate(() => {
        initializeOrUpdateProfile(userId).catch(err => {
            console.error(`[FraudShield Jobs] Failed to sync profile for ${userId}:`, err);
        });
    });
}
