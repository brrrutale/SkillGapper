/**
 * Backend-Konfiguration
 *
 * Hier wird festgelegt, welches Backend verwendet wird.
 * Einfach den 'provider' Wert ändern um zwischen Backends zu wechseln.
 */

export type ProviderType = 'php' | 'supabase';

interface PhpConfig {
  provider: 'php';
  baseUrl: string; // z.B. '/api' oder 'https://euer-server.de/api'
}

interface SupabaseConfig {
  provider: 'supabase';
  projectId: string;
  anonKey: string;
}

export type BackendConfig = PhpConfig | SupabaseConfig;

/**
 * Ermittelt den Basis-Pfad der Anwendung dynamisch.
 * Funktioniert sowohl für Root-Installation (/) als auch für Unterverzeichnisse
 * (z.B. /MWS/Release/Crea/SkillGapper/)
 */
function getBasePath(): string {
  // Get the current page path
  const path = window.location.pathname;

  // Find the last segment that could be a file (index.html) or empty
  // and get everything before it as the base path
  const segments = path.split('/').filter(Boolean);

  // If the last segment looks like a file, remove it
  if (segments.length > 0 && segments[segments.length - 1].includes('.')) {
    segments.pop();
  }

  // Reconstruct the base path
  const basePath = segments.length > 0 ? '/' + segments.join('/') : '';

  return basePath + '/api';
}

/**
 * AKTIVE KONFIGURATION
 *
 * Ändere diese Konfiguration um zwischen Backends zu wechseln:
 *
 * Für eigenen PHP-Server:
 * export const config: BackendConfig = {
 *   provider: 'php',
 *   baseUrl: '/api',  // oder absolute URL zu eurem Server
 * };
 *
 * Für Supabase:
 * export const config: BackendConfig = {
 *   provider: 'supabase',
 *   projectId: 'euer-project-id',
 *   anonKey: 'euer-anon-key',
 * };
 */
// ========================================
// SUPABASE KONFIGURATION (AKTIV)
// ========================================
export const config: BackendConfig = {
  provider: 'supabase',
  projectId: 'alvhsueycgtaowparqyk',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdmhzdWV5Y2d0YW93cGFycXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzY2NzAsImV4cCI6MjA4NTM1MjY3MH0.48FC8n0OYjxiPIB3WpaWMhDgxGhg3Hmtwv5bqJAZkRc',
};

// ========================================
// PHP KONFIGURATION (AUSKOMMENTIERT)
// ========================================
// export const config: BackendConfig = {
//   provider: 'php',
//   baseUrl: getBasePath(),
// };
