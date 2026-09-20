/**
 * mock-data.service.ts
 * FraudShield Phase 12 — Smart Mock Data Engine
 *
 * Generates statistically realistic UPI transactions following real-world patterns:
 *  - Authentic Indian VPA domains and names
 *  - Amount distributions (80% normal, 15% medium, 5% high-risk)
 *  - Time-of-day patterns (80% daytime, 20% night)
 *  - Per-VPA behavioral profiles (deterministic via xorshift32 PRNG)
 *  - 70/20/10 fraud distribution for bulk generation
 *  - Anomaly flag detection (8 pattern types)
 *
 * No external API calls. No new npm packages. All profiles are in-memory Maps
 * seeded deterministically so the same VPA always produces the same profile.
 */

import { getRandomCity, isImpossibleTravel, getAllCityNames } from './geolocation.service.js';
import { validateVPA, checkBlacklist } from './vpa-validation.service.js';
import { FraudPatternType, FRAUD_PATTERNS, computePatternRiskContribution } from '../data/fraud-patterns.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockSenderBehavior {
    avgTransactionAmount: number;
    txnFrequencyPerDay: number;
    usualLocations: string[];
    accountAgeInDays: number;
    riskProfile: 'low' | 'medium' | 'high';
}

export interface MockReceiverBehavior {
    totalReceived: number;
    uniqueSendersLast7Days: number;
    averageAmountReceived: number;
    /** 0–1; higher = more likely fraud mule */
    muleScore: number;
}

export interface MockTransaction {
    rrn: string;
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    location: string;
    timestamp: Date;
    senderBehavior: MockSenderBehavior;
    receiverBehavior: MockReceiverBehavior;
    anomalyFlags: string[];
    /** Composite risk score (0–1) derived from patterns + profiles */
    mockRiskScore: number;
    /** Human-readable reason string for this transaction */
    mockReason: string;
}

// Internal enriched context passed to the controller
export interface EnrichedTransactionContext {
    senderBehavior: MockSenderBehavior;
    receiverBehavior: MockReceiverBehavior;
    anomalyFlags: string[];
    senderValidation: ReturnType<typeof validateVPA>;
    receiverValidation: ReturnType<typeof validateVPA>;
    mockRiskScore: number;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG — xorshift32 seeded from djb2 string hash
// ---------------------------------------------------------------------------

function djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        hash = hash >>> 0;
    }
    return hash === 0 ? 1 : hash;
}

function xorshift32(seed: number): () => number {
    let state = seed === 0 ? 1 : seed;
    return function (): number {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        state = state >>> 0;
        return state / 0xffffffff;
    };
}

/** Returns a seeded RNG for a given string key. */
function seededRandom(key: string): () => number {
    return xorshift32(djb2Hash(key));
}

/** Pick a random element from an array using the provided RNG. */
function pickRandom<T>(arr: T[], rng: () => number): T {
    return arr[Math.floor(rng() * arr.length)];
}

/** Returns a random integer in [min, max] inclusive using the provided RNG. */
function randInt(min: number, max: number, rng: () => number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// VPA generation pools
// ---------------------------------------------------------------------------

const INDIAN_FIRST_NAMES = [
    'aarav', 'aditya', 'akash', 'amit', 'ananya', 'anjali', 'ankit', 'anuj',
    'arjun', 'aryan', 'ayaan', 'deepak', 'dev', 'divya', 'gaurav', 'harsh',
    'ishaan', 'ishita', 'isha', 'jatin', 'karan', 'kavya', 'kunal', 'manish',
    'meera', 'mohit', 'monika', 'nisha', 'nikhil', 'nikita', 'pankaj', 'payal',
    'pooja', 'priya', 'priyanka', 'rahul', 'raj', 'rajan', 'rakesh', 'ravi',
    'ritesh', 'rohit', 'sachin', 'sahil', 'sanjay', 'sanket', 'sara', 'shreya',
    'shubham', 'sneha', 'sonam', 'suresh', 'swati', 'tanvi', 'tarun', 'tushar',
    'uday', 'varun', 'vijay', 'vikas', 'vipul', 'vishal', 'yash', 'yogesh',
    'zara', 'ritika', 'lavanya', 'akanksha', 'bhavna', 'chetan', 'dinesh',
    'ekta', 'fatima', 'girish', 'hemant', 'indra', 'jayesh', 'kiran', 'lalit',
    'madhuri', 'nalini', 'omkar', 'preeti', 'qadir', 'rashmi', 'sunita', 'tina',
    'urmila', 'vivek', 'wasim', 'xavier', 'yamini', 'zaid', 'aniket', 'bindu',
];

const SAFE_DOMAINS = ['okicici', 'okhdfcbank', 'oksbi', 'hdfc', 'upi', 'axl', 'kotak', 'icici', 'sbi'];
const MEDIUM_DOMAINS = ['ybl', 'airtel', 'allbank', 'paytm', 'ibl'];
const RISKY_DOMAINS = ['unknown', 'test', 'temp'];

const MERCHANT_HANDLES = [
    'zomato.food', 'amazon.pay', 'flipkart.merchant', 'grofers.store',
    'bigbasket.order', 'swiggy.delivery', 'ola.cab', 'rapido.ride',
    'phonepe.merchant', 'gpay.merchant', 'paytm.store', 'nykaa.shop',
    'meesho.seller', 'myntra.fashion', 'ajio.order', 'blinkit.delivery',
    'dunzo.task', 'urbancompany.service', 'practo.payment', 'byju.classes',
];

// ---------------------------------------------------------------------------
// In-memory profile caches (persist for server lifetime)
// ---------------------------------------------------------------------------

const senderProfileCache = new Map<string, MockSenderBehavior>();
const receiverProfileCache = new Map<string, MockReceiverBehavior>();

// RRN uniqueness tracker (session-level)
const generatedRRNs = new Set<string>();

// ---------------------------------------------------------------------------
// RRN generation
// ---------------------------------------------------------------------------

/** Generates a unique 12-digit Reference Retrieval Number. */
function generateUniqueRRN(): string {
    let rrn: string;
    do {
        rrn = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    } while (generatedRRNs.has(rrn));
    generatedRRNs.add(rrn);
    return rrn;
}

// ---------------------------------------------------------------------------
// VPA generation
// ---------------------------------------------------------------------------

/**
 * Generates a realistic sender VPA using a seeded RNG.
 * The same seed always produces the same VPA.
 */
function generateSenderVPA(seed: string): string {
    const rng = seededRandom(`sender-${seed}`);
    const name = pickRandom(INDIAN_FIRST_NAMES, rng);
    const suffix = Math.floor(rng() * 900) + 100; // 3-digit number

    // Domain distribution: 70% safe, 20% medium, 10% risky
    const domainRoll = rng();
    let domain: string;
    if (domainRoll < 0.70) domain = pickRandom(SAFE_DOMAINS, rng);
    else if (domainRoll < 0.90) domain = pickRandom(MEDIUM_DOMAINS, rng);
    else domain = pickRandom(RISKY_DOMAINS, rng);

    return `${name}${suffix}@${domain}`;
}

/**
 * Generates a realistic receiver VPA — mix of merchants and personal VPAs.
 */
function generateReceiverVPA(seed: string, fraudTier: 'normal' | 'suspicious' | 'fraud'): string {
    const rng = seededRandom(`receiver-${seed}`);

    if (fraudTier === 'fraud' && rng() < 0.60) {
        // High-fraud receivers use risky domains or blacklisted VPAs
        const blacklisted = [
            'mule123@unknown', 'scammer1@unknown', 'cashout@fraud',
            'layering@temp', 'smurfing@unknown',
        ];
        if (rng() < 0.30) return pickRandom(blacklisted, rng);
        const name = pickRandom(INDIAN_FIRST_NAMES, rng) + Math.floor(rng() * 9000 + 1000);
        return `${name}@${pickRandom(RISKY_DOMAINS, rng)}`;
    }

    if (fraudTier === 'suspicious' && rng() < 0.50) {
        const name = pickRandom(INDIAN_FIRST_NAMES, rng) + Math.floor(rng() * 9000 + 1000);
        return `${name}@${pickRandom(MEDIUM_DOMAINS, rng)}`;
    }

    // Normal: 40% merchant, 60% personal
    if (rng() < 0.40) {
        return `${pickRandom(MERCHANT_HANDLES, rng)}@${pickRandom(SAFE_DOMAINS, rng)}`;
    }
    const name = pickRandom(INDIAN_FIRST_NAMES, rng) + Math.floor(rng() * 9000 + 1000);
    return `${name}@${pickRandom(SAFE_DOMAINS, rng)}`;
}

// ---------------------------------------------------------------------------
// Profile builders
// ---------------------------------------------------------------------------

/**
 * Returns (and caches) a deterministic sender behavior profile for a VPA.
 * Calling with the same VPA always returns identical values.
 */
export function getSenderProfile(vpa: string): MockSenderBehavior {
    const cached = senderProfileCache.get(vpa);
    if (cached) return cached;

    const rng = seededRandom(`profile-${vpa}`);
    const allCities = getAllCityNames();

    // Determine risk profile based on VPA domain
    const domain = vpa.includes('@') ? vpa.split('@')[1] : 'unknown';
    const riskyDomains = new Set(['unknown', 'test', 'temp', 'fraud']);
    const mediumDomains = new Set(['ybl', 'airtel', 'allbank', 'paytm', 'ibl']);

    let riskProfile: 'low' | 'medium' | 'high';
    if (riskyDomains.has(domain)) {
        riskProfile = rng() < 0.80 ? 'high' : 'medium';
    } else if (mediumDomains.has(domain)) {
        riskProfile = rng() < 0.60 ? 'medium' : 'low';
    } else {
        riskProfile = rng() < 0.85 ? 'low' : 'medium';
    }

    // Amount profile depends on risk
    let avgAmount: number;
    if (riskProfile === 'low') {
        avgAmount = 500 + rng() * 9500; // ₹500 – ₹10,000
    } else if (riskProfile === 'medium') {
        avgAmount = 5000 + rng() * 45000; // ₹5,000 – ₹50,000
    } else {
        avgAmount = 20000 + rng() * 180000; // ₹20,000 – ₹2,00,000
    }

    const txnFrequency = riskProfile === 'high'
        ? 5 + rng() * 45     // high: 5–50 per day (mule / scripted bot)
        : 1 + rng() * 9;     // normal: 1–10 per day

    // Pick 2–4 usual cities
    const locationCount = 2 + Math.floor(rng() * 3);
    const usualLocations: string[] = [];
    const shuffled = [...allCities].sort(() => rng() - 0.5);
    for (let i = 0; i < locationCount && i < shuffled.length; i++) {
        usualLocations.push(shuffled[i]);
    }

    // Account age (in days): risky domains are newer
    const accountAgeInDays = riskProfile === 'high'
        ? randInt(1, 30, rng)
        : randInt(30, 730, rng);

    const profile: MockSenderBehavior = {
        avgTransactionAmount: Math.round(avgAmount),
        txnFrequencyPerDay: Math.round(txnFrequency * 10) / 10,
        usualLocations,
        accountAgeInDays,
        riskProfile,
    };

    senderProfileCache.set(vpa, profile);
    return profile;
}

/**
 * Returns (and caches) a deterministic receiver behavior profile for a VPA.
 */
export function getReceiverProfile(vpa: string): MockReceiverBehavior {
    const cached = receiverProfileCache.get(vpa);
    if (cached) return cached;

    const rng = seededRandom(`recv-profile-${vpa}`);
    const domain = vpa.includes('@') ? vpa.split('@')[1] : 'unknown';
    const riskyDomains = new Set(['unknown', 'test', 'temp', 'fraud']);
    const isRisky = riskyDomains.has(domain) || checkBlacklist(vpa);

    let muleScore: number;
    let totalReceived: number;
    let uniqueSenders: number;
    let avgAmount: number;

    if (isRisky) {
        // Simulate mule: high incoming volume, many unique senders
        muleScore = 0.6 + rng() * 0.4;
        totalReceived = randInt(50, 500, rng);
        uniqueSenders = randInt(20, 80, rng);
        avgAmount = 5000 + rng() * 95000;
    } else {
        muleScore = rng() * 0.25; // normal merchants / friends are low-mule
        totalReceived = randInt(1, 50, rng);
        uniqueSenders = randInt(1, 10, rng);
        avgAmount = 200 + rng() * 9800;
    }

    const profile: MockReceiverBehavior = {
        totalReceived,
        uniqueSendersLast7Days: uniqueSenders,
        averageAmountReceived: Math.round(avgAmount),
        muleScore: Math.round(muleScore * 1000) / 1000,
    };

    receiverProfileCache.set(vpa, profile);
    return profile;
}

// ---------------------------------------------------------------------------
// Amount generation
// ---------------------------------------------------------------------------

/**
 * Returns a realistic transaction amount following the sender's profile.
 * Distribution: 80% normal, 15% medium, 5% high-risk amounts.
 *
 * @param senderAvg   Sender's historical average amount
 * @param fraudTier   'normal' | 'suspicious' | 'fraud'
 * @param rng         Seeded RNG
 */
function generateAmount(
    senderAvg: number,
    fraudTier: 'normal' | 'suspicious' | 'fraud',
    rng: () => number
): number {
    let amount: number;

    if (fraudTier === 'fraud') {
        // Fraud: 50% chance of massive spike (10–50× avg), 50% structuring (₹9,000–₹9,999)
        if (rng() < 0.50) {
            amount = senderAvg * (10 + rng() * 40);
        } else {
            amount = 9000 + rng() * 999; // structuring just below ₹10K
        }
    } else if (fraudTier === 'suspicious') {
        // Suspicious: 3–10× normal or a high-value transfer
        const roll = rng();
        if (roll < 0.50) {
            amount = senderAvg * (3 + rng() * 7);
        } else if (roll < 0.80) {
            amount = 10000 + rng() * 90000; // ₹10K–₹1L
        } else {
            amount = 100000 + rng() * 400000; // ₹1L–₹5L
        }
    } else {
        // Normal: ± 50% of average, within overall 80/15/5 distribution
        const tier = rng();
        if (tier < 0.80) {
            amount = 500 + rng() * 9500;   // ₹500–₹10K
        } else if (tier < 0.95) {
            amount = 10000 + rng() * 90000; // ₹10K–₹1L
        } else {
            amount = 100000 + rng() * 400000; // ₹1L–₹5L
        }
        // Bias toward sender's average (±40%)
        const biasedAmount = senderAvg * (0.60 + rng() * 0.80);
        amount = (amount + biasedAmount) / 2;
    }

    return Math.round(Math.max(1, amount));
}

// ---------------------------------------------------------------------------
// Timestamp generation
// ---------------------------------------------------------------------------

/**
 * Generates a realistic timestamp within the last 90 days.
 * Night transactions (11 PM – 7 AM) are more likely for risky/fraud tiers.
 */
function generateTimestamp(
    fraudTier: 'normal' | 'suspicious' | 'fraud',
    rng: () => number
): Date {
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const baseDate = new Date(now - rng() * ninetyDaysMs);

    let hour: number;
    const nightRoll = rng();

    if (fraudTier === 'fraud') {
        // 50% night (11 PM – 7 AM)
        if (nightRoll < 0.50) {
            hour = nightRoll < 0.25 ? randInt(23, 23, rng) : randInt(0, 6, rng);
        } else {
            hour = randInt(7, 22, rng);
        }
    } else if (fraudTier === 'suspicious') {
        // 30% night
        hour = nightRoll < 0.30 ? (nightRoll < 0.15 ? 23 : randInt(0, 6, rng)) : randInt(7, 22, rng);
    } else {
        // Normal: 10% night (realistic UPI patterns)
        hour = nightRoll < 0.10 ? (nightRoll < 0.05 ? 23 : randInt(0, 6, rng)) : randInt(7, 22, rng);
    }

    baseDate.setHours(hour, randInt(0, 59, rng), randInt(0, 59, rng), 0);
    return baseDate;
}

// ---------------------------------------------------------------------------
// Anomaly flag generation
// ---------------------------------------------------------------------------

const mockReceiverHistoryMap = new Set<string>();

/** Check if sender has previously sent to this receiver. */
function checkReceiverHistory(senderVpa: string, receiverVpa: string): boolean {
    const key = `${senderVpa}→${receiverVpa}`;
    const hasHistory = mockReceiverHistoryMap.has(key);
    if (!hasHistory) mockReceiverHistoryMap.add(key);
    return hasHistory;
}

/**
 * Inspects a transaction and returns applicable anomaly flags.
 * Conservative: normal transactions should produce 0–1 flags at most.
 */
export function generateAnomalyFlags(tx: MockTransaction): string[] {
    const flags: string[] = [];
    const senderBeh = tx.senderBehavior;
    const receiverBeh = tx.receiverBehavior;

    // 1. Blacklisted VPA (highest confidence signal)
    if (checkBlacklist(tx.senderVpa) || checkBlacklist(tx.receiverVpa)) {
        flags.push(FRAUD_PATTERNS[FraudPatternType.BLACKLISTED].flag);
    }

    // 2. Unusual amount (only if > 3× sender's average)
    if (tx.amount > senderBeh.avgTransactionAmount * 3) {
        flags.push(FRAUD_PATTERNS[FraudPatternType.UNUSUAL_AMOUNT].flag);
    }

    // 3. New receiver (only 15% of first-time transfers)
    const hasReceiverHistory = checkReceiverHistory(tx.senderVpa, tx.receiverVpa);
    if (!hasReceiverHistory && Math.random() < 0.15) {
        flags.push(FRAUD_PATTERNS[FraudPatternType.NEW_RECEIVER].flag);
    }

    // 4. Night transaction (11 PM – 7 AM)
    const hour = new Date(tx.timestamp).getHours();
    if (hour < 7 || hour >= 23) {
        flags.push(FRAUD_PATTERNS[FraudPatternType.NIGHT_TRANSACTION].flag);
    }

    // 5. Mule receiver (stricter threshold: muleScore > 0.80)
    if (receiverBeh.muleScore > 0.80) {
        flags.push(FRAUD_PATTERNS[FraudPatternType.MULE_ACCOUNT].flag);
    }

    return [...new Set(flags)]; // deduplicate
}

// ---------------------------------------------------------------------------
// Risk score computation
// ---------------------------------------------------------------------------

function computeMockRiskScore(
    flags: string[],
    senderBehavior: MockSenderBehavior,
    receiverBehavior: MockReceiverBehavior,
    senderVpaRisk: number,
    receiverVpaRisk: number
): number {
    const patternRisk = computePatternRiskContribution(flags);
    const profileRisk =
        senderBehavior.riskProfile === 'high' ? 0.30 :
            senderBehavior.riskProfile === 'medium' ? 0.15 : 0.05;
    const muleRisk = receiverBehavior.muleScore * 0.25;
    const vpaRisk = (senderVpaRisk + receiverVpaRisk) / 2 * 0.20;

    return Math.min(patternRisk * 0.55 + profileRisk + muleRisk + vpaRisk, 1.0);
}

function buildReason(flags: string[], riskScore: number): string {
    if (flags.length === 0) {
        return riskScore < 0.2
            ? 'Transaction matches expected behavioral patterns.'
            : 'Marginal deviation from user baseline.';
    }
    const flagDescriptions: Record<string, string> = {
        unusual_amount: 'Amount significantly exceeds sender historical average',
        night_transaction: 'Transaction initiated during high-risk night window (11 PM–7 AM)',
        new_receiver: 'First-ever transaction to this receiver VPA',
        mule_receiver: 'Receiver exhibits money mule behavioral pattern',
        blacklisted_vpa: 'VPA found in fraud watchlist',
        high_velocity: 'Sender velocity exceeds 20 transactions per day',
        structuring_pattern: 'Amount pattern consistent with structuring (₹9K–₹10K range)',
        unusual_location: 'Transaction location outside sender\'s normal operating zone',
        new_sender_account: 'Sender account is less than 7 days old',
        impossible_travel: 'Consecutive transactions imply physically impossible travel',
        rapid_drain: 'Multiple large transfers in short succession',
        round_trip_pattern: 'Funds appear to cycle back to originating account',
    };
    return flags
        .slice(0, 3)
        .map((f) => flagDescriptions[f] ?? f)
        .join('; ') + (flags.length > 3 ? ` (+${flags.length - 3} more signals)` : '');
}

// ---------------------------------------------------------------------------
// Core generators
// ---------------------------------------------------------------------------

/**
 * Generates a single realistic UPI transaction.
 *
 * @param userVpa         Optional: fix the sender VPA (e.g. the logged-in user's VPA)
 * @param fraudTier       Optional: force a specific fraud tier
 */
export function generateRealisticTransaction(
    userVpa?: string,
    fraudTier?: 'normal' | 'suspicious' | 'fraud'
): MockTransaction {
    // Determine fraud tier if not provided
    const roll = Math.random();
    const tier: 'normal' | 'suspicious' | 'fraud' =
        fraudTier ?? (roll < 0.70 ? 'normal' : roll < 0.90 ? 'suspicious' : 'fraud');

    // Generate VPAs
    const seed = `${Date.now()}-${Math.random()}`;
    const senderVpa = userVpa ?? generateSenderVPA(seed);
    const receiverVpa = generateReceiverVPA(seed, tier);

    // Profiles
    const senderBehavior = getSenderProfile(senderVpa);
    const receiverBehavior = getReceiverProfile(receiverVpa);

    // Amount
    const txRng = seededRandom(seed);
    const amount = generateAmount(senderBehavior.avgTransactionAmount, tier, txRng);

    // Location — 85% chance it's from sender's usual locations
    let location: string;
    if (senderBehavior.usualLocations.length > 0 && txRng() < 0.85) {
        location = pickRandom(senderBehavior.usualLocations, txRng);
    } else {
        const city = getRandomCity(txRng);
        location = city.name;
    }

    // Timestamp
    const timestamp = generateTimestamp(tier, txRng);

    // Build partial transaction for flag generation
    const partial: MockTransaction = {
        rrn: generateUniqueRRN(),
        senderVpa,
        receiverVpa,
        amount,
        location,
        timestamp,
        senderBehavior,
        receiverBehavior,
        anomalyFlags: [],
        mockRiskScore: 0,
        mockReason: '',
    };

    // Generate anomaly flags
    const anomalyFlags = generateAnomalyFlags(partial);

    // Risk score
    const senderValidation = validateVPA(senderVpa);
    const receiverValidation = validateVPA(receiverVpa);
    const mockRiskScore = computeMockRiskScore(
        anomalyFlags,
        senderBehavior,
        receiverBehavior,
        senderValidation.bankRiskScore,
        receiverValidation.bankRiskScore
    );

    return {
        ...partial,
        anomalyFlags,
        mockRiskScore: Math.round(mockRiskScore * 10000) / 10000,
        mockReason: buildReason(anomalyFlags, mockRiskScore),
    };
}

/**
 * Generates N realistic transactions with enforced 70/20/10 distribution.
 */
export function generateBulkTransactions(count: number): MockTransaction[] {
    const normalCount = Math.round(count * 0.70);
    const suspiciousCount = Math.round(count * 0.20);
    const fraudCount = count - normalCount - suspiciousCount;

    const results: MockTransaction[] = [];

    for (let i = 0; i < normalCount; i++) {
        results.push(generateRealisticTransaction(undefined, 'normal'));
    }
    for (let i = 0; i < suspiciousCount; i++) {
        results.push(generateRealisticTransaction(undefined, 'suspicious'));
    }
    for (let i = 0; i < fraudCount; i++) {
        results.push(generateRealisticTransaction(undefined, 'fraud'));
    }

    // Shuffle to mix tiers
    for (let i = results.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [results[i], results[j]] = [results[j], results[i]];
    }

    return results;
}

/**
 * Builds a full EnrichedTransactionContext for a real incoming transaction.
 * Used by the controller to enrich user-submitted transactions.
 */
export function buildEnrichedContext(
    senderVpa: string,
    receiverVpa: string,
    amount: number,
    location: string,
    timestamp: Date
): EnrichedTransactionContext {
    const senderBehavior = getSenderProfile(senderVpa);
    const receiverBehavior = getReceiverProfile(receiverVpa);
    const senderValidation = validateVPA(senderVpa);
    const receiverValidation = validateVPA(receiverVpa);

    // Build a partial MockTransaction for flag generation
    const partial: MockTransaction = {
        rrn: '',
        senderVpa,
        receiverVpa,
        amount,
        location,
        timestamp,
        senderBehavior,
        receiverBehavior,
        anomalyFlags: [],
        mockRiskScore: 0,
        mockReason: '',
    };

    const anomalyFlags = generateAnomalyFlags(partial);

    // Check impossible travel against most recent transaction (heuristic: use primary usual location)
    if (senderBehavior.usualLocations.length > 0) {
        const primaryCity = senderBehavior.usualLocations[0];
        // 15-minute window heuristic for impossible travel detection
        if (primaryCity.toLowerCase() !== location.toLowerCase()) {
            if (isImpossibleTravel(primaryCity, location, 15)) {
                if (!anomalyFlags.includes(FRAUD_PATTERNS[FraudPatternType.IMPOSSIBLE_TRAVEL].flag)) {
                    anomalyFlags.push(FRAUD_PATTERNS[FraudPatternType.IMPOSSIBLE_TRAVEL].flag);
                }
            }
        }
    }

    const mockRiskScore = computeMockRiskScore(
        anomalyFlags,
        senderBehavior,
        receiverBehavior,
        senderValidation.bankRiskScore,
        receiverValidation.bankRiskScore
    );

    return {
        senderBehavior,
        receiverBehavior,
        anomalyFlags,
        senderValidation,
        receiverValidation,
        mockRiskScore: Math.round(mockRiskScore * 10000) / 10000,
    };
}

/**
 * Clears in-memory profile caches (useful for testing reproducibility).
 */
export function clearProfileCaches(): void {
    senderProfileCache.clear();
    receiverProfileCache.clear();
    generatedRRNs.clear();
}
