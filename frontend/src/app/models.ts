export type DecisionValue = 'ALLOW' | 'MFA' | 'DENY';
export type Role = 'User' | 'Fleet' | 'Admin';

/** Decision Zero Trust (reponse de POST /api/stations/{id}/charge et /api/access/{resource}). */
export interface Decision {
  decision: DecisionValue;
  reason: string;
  policyDecision: string | null;
  finalRisk: number;
  aiRisk: number;
  contextRisk: number;
  contextReasons: string[];
  components: Record<string, number>;
  predictedClass: string | null;
  trustedDevice: boolean;
  role: string | null;
  mfaPassed: boolean | null;
  requestId: string;
  evidenceHash: string;
  fastApiSessionId: string | null;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  city: string;
  powerKw: number;
  available: boolean;
  /** Charge en cours sur cette borne (null si libre). */
  activeSessionId: number | null;
  /** Utilisateur qui charge (fourni uniquement à un Admin). */
  activeUser: string | null;
  /** L'utilisateur connecté peut arrêter cette charge (la sienne, ou toutes pour un Admin). */
  canStop: boolean;
}

export type ChargeStatus = 'PENDING_MFA' | 'ACTIVE' | 'DENIED' | 'STOPPED';

export interface ChargeSession {
  id: number;
  username: string;
  stationId: number;
  stationName: string;
  city: string;
  status: ChargeStatus;
  decision: DecisionValue | null;
  reason: string | null;
  aiRisk: number | null;
  finalRisk: number | null;
  requestId: string | null;
  evidenceHash: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ChargeResult {
  session: ChargeSession;
  decision: Decision | null;
}

export interface ChargeRequest {
  device?: string;
  otp?: string;
  location?: string;
  nonce?: string;
  timestamp?: number;
}

export interface Identity {
  registered: boolean;
  active: boolean;
  role: string;
  registered_at: number;
  revoked_at: number;
  home_location: string | null;
  past_denies: number;
}

export interface Me {
  username: string;
  email: string | null;
  role: Role | null;
  roles: string[];
  identity: Identity | null;
}

export interface Policy {
  min_role: string;
  mfa_threshold: number;
  deny_threshold: number;
  start_hour: number;
  end_hour: number;
  require_trusted_device: boolean;
  active: boolean;
}

export interface Overview {
  totalSessions: number;
  activeSessions: number;
  /** Décisions comptées dans le journal blockchain (ou, à défaut, dans les sessions). */
  byDecision: Record<string, number>;
  decisionSource?: 'blockchain' | 'sessions';
  auditTotal?: number;
  attackActive?: boolean;
  fastapi: 'UP' | 'DOWN';
  chainId?: number;
  block?: number;
}

export interface AuditEntry {
  index: number;
  request_id: string;
  user_id: string;
  device_id: string;
  resource_id: string;
  evidence_hash: string;
  timestamp: number;
  risk: number;
  decision: DecisionValue;
  reason: string;
}

export interface AuditResponse {
  total: number;
  entries: AuditEntry[];
}

export interface IntegrityResult {
  request_id: string;
  local_hash: string;
  onchain_hash: string | null;
  integrity_ok: boolean;
}

export interface KcUser {
  id: string;
  username: string;
  email: string | null;
  enabled: boolean;
  role: Role | null;
}

export interface NewUser {
  username: string;
  email: string;
  password: string;
  role: Role;
  homeLocation: string;
}

export interface CreatedUser {
  username: string;
  role: Role;
  keycloakId: string;
  device: string;
  txHash: string;
}

/** Inscription en libre-service (POST /api/public/register). Le rôle est toujours « User ». */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  homeLocation?: string;
  acceptTerms: boolean;
  /** Piège à robots : doit rester vide. */
  website?: string;
}

/** État de la MFA de l'utilisateur connecté (GET /api/mfa/status). Ne contient jamais le secret. */
export interface MfaStatus {
  user: string;
  enabled: boolean;
  enabled_at: number | null;
  pending: boolean;
  /** Ancien secret créé par l'admin (avant l'activation par QR code) : à réactiver. */
  needs_reactivation: boolean;
}

/** Réponse de POST /api/mfa/enroll : secret en attente, renvoyé une seule fois au propriétaire du compte. */
export interface MfaEnrollment {
  user: string;
  issuer: string;
  secret: string;
  otpauth_uri: string;
  /** QR code SVG en data URI. */
  qr_svg: string;
  expires_in_seconds: number;
}
