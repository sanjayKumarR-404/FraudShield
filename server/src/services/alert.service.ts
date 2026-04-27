import twilio from 'twilio';
import { config } from '../config/index.js';
import prisma from './prisma.service.js';

const {
    twilioAccountSid,
    twilioAuthToken,
    twilioWhatsappFrom,
    alertPhoneNumber
} = config;

let twilioClient: twilio.Twilio | null = null;
if (twilioAccountSid && twilioAuthToken) {
    console.log('[AlertService] Twilio credentials found. Initializing client...');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
} else {
    console.warn('[AlertService] Warning: Twilio credentials missing. Alerts will be skipped.');
}

const formatAmount = (amount: any) => {
    return Number(amount).toLocaleString('en-IN');
};

export const sendWhatsAppAlert = async (transaction: any): Promise<boolean> => {
    if (!twilioClient) return false;
    try {
        const msgBody = `🚨 *FraudShield Alert*
A transaction has been FROZEN by our AI Engine.

*Transaction Details:*
- RRN: ${transaction.rrn}
- Amount: ₹${formatAmount(transaction.amount)}
- Sender: ${transaction.senderVpa}
- Receiver: ${transaction.receiverVpa}
- Risk Score: ${transaction.riskScore || 'N/A'}
- Reason: ${transaction.reason || 'N/A'}

If this was you, reply SAFE to unfreeze.
If this was NOT you, reply FRAUD to escalate.`;

        await twilioClient.messages.create({
            from: twilioWhatsappFrom,
            to: alertPhoneNumber.startsWith('whatsapp:') ? alertPhoneNumber : `whatsapp:${alertPhoneNumber}`,
            body: msgBody
        });
        console.log(`[AlertService] WhatsApp alert sent successfully for RRN: ${transaction.rrn}`);
        return true;
    } catch (err) {
        console.error(`[AlertService] WhatsApp alert failed for RRN: ${transaction.rrn}`, err);
        return false;
    }
};

export const sendVoiceAlert = async (transaction: any): Promise<boolean> => {
    console.log(`[AlertService] Voice alerts disabled — requires verified Twilio number. RRN: ${transaction.rrn}`);
    return false;
};

export const sendFraudAlerts = async (transaction: any): Promise<void> => {
    if (!twilioClient) return;

    try {
        const results = await Promise.allSettled([
            sendWhatsAppAlert(transaction),
            sendVoiceAlert(transaction)
        ]);

        const waSent: boolean = results[0].status === 'fulfilled' ? (results[0].value ?? false) : false;
        const voiceSent: boolean = results[1].status === 'fulfilled' ? (results[1].value ?? false) : false;

        if (waSent || voiceSent) {
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    whatsappAlertSent: waSent,
                    voiceAlertSent: voiceSent,
                    alertSentAt: new Date()
                }
            });
        }
    } catch (err) {
        console.error('[AlertService] Unexpected error in sendFraudAlerts:', err);
    }
};
