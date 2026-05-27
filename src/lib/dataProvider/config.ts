/**
 * Backend-Konfiguration für SkillGapper
 *
 * Single Provider: Azure Functions + Cosmos DB.
 * In Dev (localhost) wird automatisch auf den lokalen Functions-Server
 * (`func start` in azure-functions/, Port 7071) umgeschaltet, sonst zeigt
 * die App auf das produktive Function-App in Azure.
 */

export interface AzureConfig {
  provider: 'azure';
  baseUrl: string;
  functionKey?: string;
  teamId?: string;
}

export type BackendConfig = AzureConfig;

const PROD_BASE_URL = 'https://skillgapper-api.azurewebsites.net';
const LOCAL_BASE_URL = 'http://localhost:7071';

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

// Auto-Detect Dev vs Prod, damit das Frontend ohne Konfiguration funktioniert.
// Die Functions sind anonymous — kein Key nötig (das Frontend-Bundle ist
// public, ein dort eingebetteter Key wäre Fake-Security). Workspace-
// Isolation läuft über die teamId Partition Key.
export const config: BackendConfig = {
  provider: 'azure',
  baseUrl: isLocalhost() ? LOCAL_BASE_URL : PROD_BASE_URL,
  teamId: 'default',
};
