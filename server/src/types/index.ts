import { Request } from "express";

// --- Auth Types ---

export interface RegisterBody {
    email: string;
    password: string;
    upiVpa: string;
}

export interface LoginBody {
    email: string;
    password: string;
}

export interface JwtPayload {
    userId: string;
    email: string;
}

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

// --- Transaction Types ---

export interface TransactionBody {
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    location: string;
}

export interface AIEngineRequest {
    amount: number;
    senderVpa: string;
    receiverVpa: string;
    location: string;
    timestamp: string;
    userId?: string | null;
    receiverRiskScore?: number;
}

export interface AttributionComponent {
    weight: number;
    value: number;
    contribution: number;
    reason: string;
}

export interface FeatureAttribution {
    gnn: AttributionComponent;
    location: AttributionComponent;
    amount: AttributionComponent;
    velocity: AttributionComponent;
    behavioral: AttributionComponent;
    receiver?: AttributionComponent;
}

export interface AIEngineResponse {
    status: string;
    action: string;
    reason: string;
    riskScore: number;
    attribution?: FeatureAttribution;
}

// --- Receiver Profile Types ---

export interface ReceiverRiskResult {
    score: number;
    category: string;
    signals: string[];
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
}

// --- Recovery / FIR Types (Phase 19) ---

export interface RecoveryCaseDetail {
    id: string;
    transactionId: string;
    status: string;
    firStatus: string;
    firNumber?: string;
    policeStationName?: string;
    complainantName: string;
    complainantEmail: string;
    complainantPhone?: string;
    bankName?: string;
    accountNumber?: string;
    amountDisputed: number;
    evidenceUploads: string[];
    screenshotsCount: number;
    bankStatementsCount: number;
    chatHistoriesCount: number;
    initiatedAt: Date;
    registeredAt?: Date;
    estimatedResolutionAt?: Date;
    expiresAt: Date;
    resolvedAt?: Date;
    recoveryAmount?: number;
    recoveryDate?: Date;
    pdfPath?: string;
    firPdfPath?: string;
    day30Reminded: boolean;
    day60Reminded: boolean;
    day85Reminded: boolean;
}

export interface FIRDocument {
    firNumber: string;
    reportDate: Date;
    transactionId: string;
    rrn: string;
    amount: number;
    senderVpa: string;
    receiverVpa: string;
    txTimestamp: Date;
    riskScore?: number;
    complainantName: string;
    complainantEmail: string;
    complainantPhone?: string;
    bankName?: string;
    accountNumber?: string;
    screenshotsCount: number;
    bankStatementsCount: number;
    chatHistoriesCount: number;
}
