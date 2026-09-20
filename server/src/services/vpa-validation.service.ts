/**
 * vpa-validation.service.ts
 * FraudShield Phase 12 — VPA format validation and risk scoring.
 *
 * Validates UPI VPA format (handle@domain) and assigns bank-domain risk scores,
 * account-age risk factors, and blacklist checks — all using mock data only.
 * No external API calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VPAValidationResult {
    isValid: boolean;
    vpa: string;
    /** e.g. "okicici", "ybl", or the full custom domain */
    bankDomain: string;
    /** 0–1; established regulated banks score low (0.1–0.2) */
    bankRiskScore: number;
    /** Days since VPA was first seen (deterministic mock based on VPA hash) */
    accountAgeDays: number;
    /** 0–1; new accounts (< 7 days) score high (0.8) */
    accountAgeRiskFactor: number;
    isBlacklisted: boolean;
    recommendedAction: 'allow' | 'review' | 'block';
}

// ---------------------------------------------------------------------------
// Bank domain risk map
// ---------------------------------------------------------------------------

interface BankDomainInfo {
    riskScore: number;
    tier: 'safe' | 'medium' | 'risky';
    bankName: string;
}

const BANK_RISK_MAP: Record<string, BankDomainInfo> = {
    // ── SAFE (established, RBI-regulated) ──────────────────────────────────
    okicici:     { riskScore: 0.10, tier: 'safe',   bankName: 'ICICI Bank (Google Pay)' },
    okhdfcbank:  { riskScore: 0.10, tier: 'safe',   bankName: 'HDFC Bank (Google Pay)' },
    oksbi:       { riskScore: 0.10, tier: 'safe',   bankName: 'State Bank of India (Google Pay)' },
    okaxis:      { riskScore: 0.12, tier: 'safe',   bankName: 'Axis Bank (Google Pay)' },
    hdfc:        { riskScore: 0.12, tier: 'safe',   bankName: 'HDFC Bank' },
    upi:         { riskScore: 0.12, tier: 'safe',   bankName: 'NPCI UPI' },
    axl:         { riskScore: 0.13, tier: 'safe',   bankName: 'Axis Bank' },
    sbi:         { riskScore: 0.13, tier: 'safe',   bankName: 'State Bank of India' },
    icici:       { riskScore: 0.14, tier: 'safe',   bankName: 'ICICI Bank' },
    kotak:       { riskScore: 0.15, tier: 'safe',   bankName: 'Kotak Mahindra Bank' },
    pnb:         { riskScore: 0.15, tier: 'safe',   bankName: 'Punjab National Bank' },
    federal:     { riskScore: 0.16, tier: 'safe',   bankName: 'Federal Bank' },
    idfcfirst:   { riskScore: 0.17, tier: 'safe',   bankName: 'IDFC First Bank' },
    indus:       { riskScore: 0.18, tier: 'safe',   bankName: 'IndusInd Bank' },
    // ── MEDIUM (smaller / payment banks) ───────────────────────────────────
    ybl:         { riskScore: 0.30, tier: 'medium', bankName: 'Yes Bank (PhonePe)' },
    airtel:      { riskScore: 0.32, tier: 'medium', bankName: 'Airtel Payments Bank' },
    allbank:     { riskScore: 0.35, tier: 'medium', bankName: 'Allahabad Bank' },
    paytm:       { riskScore: 0.33, tier: 'medium', bankName: 'Paytm Payments Bank' },
    ibl:         { riskScore: 0.34, tier: 'medium', bankName: 'IndusInd Bank (Slice)' },
    fbl:         { riskScore: 0.36, tier: 'medium', bankName: 'Fino Payments Bank' },
    barodampay:  { riskScore: 0.38, tier: 'medium', bankName: 'Bank of Baroda' },
    jio:         { riskScore: 0.38, tier: 'medium', bankName: 'Jio Payments Bank' },
    // ── RISKY (unknown / custom / suspicious) ──────────────────────────────
    unknown:     { riskScore: 0.75, tier: 'risky',  bankName: 'Unknown domain' },
    test:        { riskScore: 0.80, tier: 'risky',  bankName: 'Test/Dev domain' },
    temp:        { riskScore: 0.85, tier: 'risky',  bankName: 'Temporary account' },
    fraud:       { riskScore: 0.95, tier: 'risky',  bankName: 'Flagged domain' },
};

// ---------------------------------------------------------------------------
// Mock blacklist (pre-seeded from fictional prior fraud cases)
// ---------------------------------------------------------------------------

const MOCK_BLACKLIST = new Set<string>([
    'mule123@unknown',
    'scammer1@unknown',
    'fraud.account@test',
    'hawala.dest@unknown',
    'drain.acc@fraud',
    'layering@temp',
    'smurfing@unknown',
    'cashout@fraud',
    'mule.acct2@unknown',
    'hijack.vpa@test',
    'round.trip@unknown',
    'shell.corp@fraud',
    'ghost.acct@unknown',
    'structurer99@unknown',
    'nightowl@fraud',
    'velocity@test',
    'impersonator@unknown',
    'phishing.mule@fraud',
    'otpscam@unknown',
    'social.eng@temp',
]);

// ---------------------------------------------------------------------------
// Deterministic PRNG (xorshift32) — seeded from VPA string
// Used so that account age appears consistent for the same VPA across calls.
// ---------------------------------------------------------------------------

function djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        hash = hash >>> 0; // keep 32-bit unsigned
    }
    return hash;
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

/**
 * Derives a deterministic account age (in days, 1–730) for a given VPA.
 * VPAs that start with common suspicious prefixes are biased toward < 7 days.
 */
function deriveAccountAgeDays(vpa: string): number {
    const rng = xorshift32(djb2Hash(vpa));
    const rand = rng();

    const suspiciousPrefixes = ['mule', 'fraud', 'scam', 'test', 'temp', 'new', 'shell', 'ghost'];
    const lowerVpa = vpa.toLowerCase();
    const isSuspicious = suspiciousPrefixes.some((p) => lowerVpa.startsWith(p));

    if (isSuspicious) {
        // 70% chance the account is < 7 days old
        return rand < 0.70 ? Math.max(1, Math.floor(rand * 7)) : Math.floor(rand * 60) + 7;
    }

    // Normal accounts: exponentially distributed, mean ~180 days, capped at 730
    const u = rng();
    const age = Math.floor(-180 * Math.log(1 - u * 0.9));
    return Math.min(Math.max(age, 8), 730);
}

// ---------------------------------------------------------------------------
// VPA format validation (NPCI spec)
// ---------------------------------------------------------------------------

/** Validates UPI VPA format per NPCI specification: handle@domain */
function isValidVPAFormat(vpa: string): boolean {
    // Must contain exactly one '@'
    const parts = vpa.split('@');
    if (parts.length !== 2) return false;
    const [handle, domain] = parts;
    // Handle: 3–32 chars, alphanumeric + '.', '_', '-'
    if (!/^[a-z0-9._-]{3,32}$/i.test(handle)) return false;
    // Domain: 2–20 chars, alphanumeric only
    if (!/^[a-z0-9]{2,20}$/i.test(domain)) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the risk score for a bank domain string.
 * Unknown domains are scored 0.75 by default.
 */
export function getBankRiskScore(domain: string): number {
    return BANK_RISK_MAP[domain.toLowerCase()]?.riskScore ?? 0.75;
}

/**
 * Returns true if the VPA's derived account age is under 7 days.
 */
export function isNewAccount(vpa: string): boolean {
    return deriveAccountAgeDays(vpa) < 7;
}

/**
 * Returns true if the VPA is in the mock fraud watchlist.
 */
export function checkBlacklist(vpa: string): boolean {
    return MOCK_BLACKLIST.has(vpa.toLowerCase());
}

/**
 * Returns the risk tier for a VPA.
 */
export function assignRiskTier(vpa: string): 'safe' | 'medium' | 'high_risk' {
    if (!isValidVPAFormat(vpa)) return 'high_risk';
    const domain = vpa.split('@')[1].toLowerCase();
    const info = BANK_RISK_MAP[domain];
    if (!info) return 'high_risk'; // custom unknown domain
    return info.tier === 'risky' ? 'high_risk' : info.tier;
}

/**
 * Full VPA validation — format check, risk scoring, age, blacklist check,
 * and recommended action.
 */
export function validateVPA(vpa: string): VPAValidationResult {
    const isValid = isValidVPAFormat(vpa);

    if (!isValid) {
        return {
            isValid: false,
            vpa,
            bankDomain: '',
            bankRiskScore: 1.0,
            accountAgeDays: 0,
            accountAgeRiskFactor: 1.0,
            isBlacklisted: false,
            recommendedAction: 'block',
        };
    }

    const domain = vpa.split('@')[1].toLowerCase();
    const bankInfo = BANK_RISK_MAP[domain];
    const bankRiskScore = bankInfo?.riskScore ?? 0.75;

    const accountAgeDays = deriveAccountAgeDays(vpa);
    // Age risk: < 7 days → 0.8, 7–30 days → 0.4, 30–90 days → 0.2, 90+ days → 0.05
    let accountAgeRiskFactor: number;
    if (accountAgeDays < 7) accountAgeRiskFactor = 0.80;
    else if (accountAgeDays < 30) accountAgeRiskFactor = 0.40;
    else if (accountAgeDays < 90) accountAgeRiskFactor = 0.20;
    else accountAgeRiskFactor = 0.05;

    const isBlacklisted = checkBlacklist(vpa);

    // Composite score for action recommendation
    const compositeScore = bankRiskScore * 0.4 + accountAgeRiskFactor * 0.3 + (isBlacklisted ? 1.0 : 0) * 0.3;

    let recommendedAction: 'allow' | 'review' | 'block';
    if (isBlacklisted || compositeScore >= 0.7) {
        recommendedAction = 'block';
    } else if (compositeScore >= 0.35) {
        recommendedAction = 'review';
    } else {
        recommendedAction = 'allow';
    }

    return {
        isValid: true,
        vpa,
        bankDomain: domain,
        bankRiskScore,
        accountAgeDays,
        accountAgeRiskFactor,
        isBlacklisted,
        recommendedAction,
    };
}

/**
 * Returns all currently blacklisted VPAs (for admin/debug use).
 */
export function getBlacklistedVPAs(): string[] {
    return Array.from(MOCK_BLACKLIST);
}
