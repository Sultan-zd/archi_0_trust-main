package com.ztb.evcharge.domain;

public enum ChargeStatus {
    /** Le PDP a demande une MFA : en attente du code TOTP. */
    PENDING_MFA,
    /** Acces accorde, charge en cours. */
    ACTIVE,
    /** Acces refuse par la politique Zero Trust. */
    DENIED,
    /** Charge terminee. */
    STOPPED
}
