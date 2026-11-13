package com.ztb.evcharge.web.dto;

/**
 * @param available       la borne est libre
 * @param activeSessionId identifiant de la charge en cours (null si la borne est libre)
 * @param activeUser      utilisateur qui charge (renseigne uniquement pour un Admin, sinon null)
 * @param canStop         l'utilisateur connecte peut arreter cette charge (la sienne, ou n'importe laquelle pour un Admin)
 */
public record StationDto(Long id, String code, String name, String city, double powerKw, boolean available,
                         Long activeSessionId, String activeUser, boolean canStop) {
}
