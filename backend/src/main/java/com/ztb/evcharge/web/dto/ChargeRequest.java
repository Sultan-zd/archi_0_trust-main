package com.ztb.evcharge.web.dto;

/**
 * Corps (facultatif) d'une demande de charge ou de controle d'acces.
 *
 * @param device   appareil utilise ; vide = appareil par defaut "<utilisateur>-device" (de confiance pour les comptes de demo).
 *                 Un appareil inconnu declenche une MFA.
 * @param otp      code TOTP, a fournir apres une decision MFA
 * @param location zone de la requete (pour /api/access/{resource} ; pour une charge, la ville de la borne est utilisee)
 * @param nonce    identifiant unique de cette demande, utilise pour la protection anti-rejeu
 * @param timestamp heure d'envoi en millisecondes depuis l'époque Unix
 */
public record ChargeRequest(String device, String otp, String location, String nonce, Long timestamp) {
}
