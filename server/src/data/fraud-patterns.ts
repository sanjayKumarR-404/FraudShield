/**
 * fraud-patterns.ts
 * FraudShield Phase 12 — Static library of real-world UPI fraud patterns.
 * These patterns are used by the mock data engine to inject realistic fraud
 * scenarios into generated transactions. Each pattern carries a risk contribution
 * weight that is additive toward the final risk score.
 */

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

export enum FraudPatternType {
    MULE_ACCOUNT       = 'mule_account',
    STRUCTURING        = 'structuring',
    UNUSUAL_AMOUNT     = 'unusual_amount',
    NEW_RECEIVER       = 'new_receiver',
    NIGHT_TRANSACTION  = 'night_transaction',
    IMPOSSIBLE_TRAVEL  = 'impossible_travel',
    HIGH_VELOCITY      = 'high_velocity',
    BLACKLISTED        = 'blacklisted',
    RAPID_DRAIN        = 'rapid_drain',
    ROUND_TRIP         = 'round_trip',
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FraudPattern {
    /** Canonical pattern identifier */
    type: FraudPatternType;
    /**
     * How much this pattern adds to the total risk score (0–1).
     * Multiple patterns are additive, capped at 1.0 by the engine.
     */
    riskContribution: number;
    /** Human-readable description shown in the dashboard */
    description: string;
    /** Concrete real-world example for analyst reference */
    realWorldExample: string;
    /** Anomaly flag string injected into MockTransaction.anomalyFlags */
    flag: string;
}

// ---------------------------------------------------------------------------
// Pattern Definitions
// ---------------------------------------------------------------------------

export const FRAUD_PATTERNS: Record<FraudPatternType, FraudPattern> = {

    [FraudPatternType.MULE_ACCOUNT]: {
        type: FraudPatternType.MULE_ACCOUNT,
        riskContribution: 0.40,
        description:
            'Receiver account collects funds from 50+ unique senders and funnels them to a single destination. ' +
            'Classic money mule behaviour — high volume in, low volume out.',
        realWorldExample:
            'mule123@unknown receives ₹5,00,000 from 60 different VPAs over 24 h, ' +
            'then sends a single ₹4,80,000 transfer to hawala_dest@unknown.',
        flag: 'mule_receiver',
    },

    [FraudPatternType.STRUCTURING]: {
        type: FraudPatternType.STRUCTURING,
        riskContribution: 0.35,
        description:
            'Sender splits a large transfer into dozens of transactions each just below ₹10,000 ' +
            'to evade the NPCI/RBI mandatory reporting threshold of ₹10,000.',
        realWorldExample:
            'Same VPA makes 100 transactions of ₹9,999 each to the same receiver within one hour, ' +
            'totalling ₹9,99,900 — all individually below detection threshold.',
        flag: 'structuring_pattern',
    },

    [FraudPatternType.UNUSUAL_AMOUNT]: {
        type: FraudPatternType.UNUSUAL_AMOUNT,
        riskContribution: 0.30,
        description:
            'Transaction amount is 10× or more above the sender\'s historical average. ' +
            'Indicates possible account compromise or social engineering.',
        realWorldExample:
            'User whose 90-day average is ₹1,200 suddenly initiates a ₹1,50,000 transfer to a new VPA at midnight.',
        flag: 'unusual_amount',
    },

    [FraudPatternType.NEW_RECEIVER]: {
        type: FraudPatternType.NEW_RECEIVER,
        riskContribution: 0.20,
        description:
            'This is the very first transaction between this sender and receiver pair. ' +
            'First-time large transfers are a significant fraud signal.',
        realWorldExample:
            'Victim of a customer-care scam sends ₹50,000 to a fraudster VPA they have never previously transacted with.',
        flag: 'new_receiver',
    },

    [FraudPatternType.NIGHT_TRANSACTION]: {
        type: FraudPatternType.NIGHT_TRANSACTION,
        riskContribution: 0.15,
        description:
            'Transaction initiated between 11 PM and 7 AM IST — a window with elevated fraud rates ' +
            'because compromised accounts are exploited when owners are asleep.',
        realWorldExample:
            'Account drained at 3:47 AM via a series of UPI transfers. Owner notices only at 9 AM.',
        flag: 'night_transaction',
    },

    [FraudPatternType.IMPOSSIBLE_TRAVEL]: {
        type: FraudPatternType.IMPOSSIBLE_TRAVEL,
        riskContribution: 0.50,
        description:
            'Two consecutive transactions for the same VPA originate from cities that are too far apart ' +
            'to have been reached in the elapsed time — proving simultaneous device usage.',
        realWorldExample:
            'Sender pings from Mumbai (2:00 PM) and then Delhi (2:15 PM). Distance: 1,400 km. ' +
            'That requires travelling at 5,600 km/h — physically impossible.',
        flag: 'impossible_travel',
    },

    [FraudPatternType.HIGH_VELOCITY]: {
        type: FraudPatternType.HIGH_VELOCITY,
        riskContribution: 0.35,
        description:
            'More than 20 outgoing transactions from the same VPA within a 60-minute window. ' +
            'Typical of automated bot attacks or credential-stuffing.',
        realWorldExample:
            'Compromised VPA fires 47 ₹500 transactions to 47 different mule accounts in 38 minutes.',
        flag: 'high_velocity',
    },

    [FraudPatternType.BLACKLISTED]: {
        type: FraudPatternType.BLACKLISTED,
        riskContribution: 0.70,
        description:
            'Sender or receiver VPA appears in the FraudShield internal watchlist, ' +
            'populated from previous confirmed fraud cases and NPCI alerts.',
        realWorldExample:
            'scammer123@unknown was flagged in a previous fraud case. Any new transaction involving this VPA is auto-blocked.',
        flag: 'blacklisted_vpa',
    },

    [FraudPatternType.RAPID_DRAIN]: {
        type: FraudPatternType.RAPID_DRAIN,
        riskContribution: 0.45,
        description:
            'Account balance is drained by ≥80% in under 10 minutes via multiple transfers, ' +
            'consistent with unauthorised remote access.',
        realWorldExample:
            'Victim\'s account shows ₹2,40,000 balance. 5 transfers totalling ₹2,00,000 execute in 7 minutes to unknown VPAs.',
        flag: 'rapid_drain',
    },

    [FraudPatternType.ROUND_TRIP]: {
        type: FraudPatternType.ROUND_TRIP,
        riskContribution: 0.40,
        description:
            'Funds are sent from Account A → Account B → Account C and returned to Account A ' +
            'within 24 h. Classic layering stage in money laundering.',
        realWorldExample:
            'Company sends ₹10L to vendor@hdfc, which immediately forwards to shell@unknown, ' +
            'which sends ₹9.8L back to a related company account — net loss ₹20,000, the laundering fee.',
        flag: 'round_trip_pattern',
    },
};

// ---------------------------------------------------------------------------
// Helper: flag → pattern lookup
// ---------------------------------------------------------------------------

/** Returns the FraudPattern for a given anomaly flag string, or undefined. */
export function getPatternByFlag(flag: string): FraudPattern | undefined {
    return Object.values(FRAUD_PATTERNS).find((p) => p.flag === flag);
}

/** Returns the cumulative risk contribution for a set of anomaly flags (capped at 1.0). */
export function computePatternRiskContribution(flags: string[]): number {
    const total = flags.reduce((sum, flag) => {
        const pattern = getPatternByFlag(flag);
        return sum + (pattern?.riskContribution ?? 0);
    }, 0);
    return Math.min(total, 1.0);
}
