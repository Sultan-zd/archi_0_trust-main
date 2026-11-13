/**
 * Configuration de l'application.
 * Utiliser 127.0.0.1 (et non localhost) pour Keycloak : l'API FastAPI attend l'issuer
 * http://127.0.0.1:8080/realms/ztb (le backend Spring accepte les deux).
 */
export const CONFIG = {
  apiUrl: 'http://localhost:8081/api',
  keycloak: {
    url: 'http://127.0.0.1:8180',
    realm: 'ztb',
    clientId: 'ztb-frontend',
  },
};
