package com.ztb.evcharge.web.dto;

/** Resultat d'une demande de charge : la session enregistree et la decision Zero Trust (null si le PDP etait injoignable a l'arret). */
public record ChargeResult(ChargeSessionDto session, Decision decision) {
}
