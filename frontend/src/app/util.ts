import { HttpErrorResponse } from '@angular/common/http';

/** Codes de raison du smart contract AccessPolicy -> texte lisible. */
const REASONS: Record<string, string> = {
  OK: 'Accès autorisé',
  RESOURCE_UNKNOWN: 'Ressource inconnue',
  RESOURCE_DISABLED: 'Ressource désactivée',
  USER_UNKNOWN: 'Utilisateur inconnu de la blockchain (IdentityRegistry)',
  USER_REVOKED: 'Compte révoqué',
  ROLE_TOO_LOW: 'Rôle insuffisant pour cette ressource (moindre privilège)',
  OUTSIDE_HOURS: 'Hors de la plage horaire autorisée',
  DEVICE_UNTRUSTED: 'Appareil non fiable pour cette ressource',
  RISK_MFA: 'Risque élevé : vérification supplémentaire (MFA) requise',
  RISK_DENY: 'Risque trop élevé : accès refusé',
  DEVICE_UNKNOWN_MFA: 'Appareil inconnu : vérification supplémentaire (MFA) requise',
  SESSION_EXPIRED: 'Session expirée',
};

export function reasonText(code: string | null | undefined): string {
  if (!code) return '';
  return REASONS[code] ?? code;
}

/** Extrait un message lisible d'une erreur HTTP du backend (ou d'un service amont relayé par lui). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (err.status === 0) return 'Backend injoignable (http://localhost:8081). Est-il démarré ?';
    if (body && typeof body === 'object') {
      if (body.fields && typeof body.fields === 'object') {
        return Object.entries(body.fields as Record<string, string>)
          .map(([field, msg]) => `${field} : ${msg}`)
          .join(' ; ');
      }
      const detail = body.detail ?? body.message ?? body.error;
      if (typeof detail === 'string') return upstreamDetail(detail);
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Le détail relayé par le backend est parfois le corps JSON de FastAPI : {"detail":"..."}. */
function upstreamDetail(detail: string): string {
  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    /* texte brut */
  }
  return detail;
}

export function shortHash(hash: string | null | undefined, n = 10): string {
  if (!hash) return '-';
  return hash.length > 2 * n + 2 ? `${hash.slice(0, n + 2)}...${hash.slice(-6)}` : hash;
}

/** Copie un texte dans le presse-papiers ; renvoie false si le navigateur refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
