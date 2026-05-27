/**
 * Backend-Konfiguration für SkillGapper
 *
 * Wähle zwischen 'php' und 'supabase' als Provider
 */

export type ProviderType = 'php' | 'supabase';

export interface PhpConfig {
  provider: 'php';
  baseUrl: string;
}

export interface SupabaseConfig {
  provider: 'supabase';
  projectId: string;
  anonKey: string;
}

export type BackendConfig = PhpConfig | SupabaseConfig;

/**
 * Ermittelt den Basis-Pfad der Anwendung dynamisch.
 * Funktioniert sowohl für Root-Installation (/) als auch für Unterverzeichnisse
 */
function getBasePath(): string {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);

  if (segments.length > 0 && segments[segments.length - 1].includes('.')) {
    segments.pop();
  }

  const basePath = segments.length > 0 ? '/' + segments.join('/') : '';
  return basePath + '/api';
}

/**
 * AKTIVE KONFIGURATION
 *
 * === FÜR PHP BACKEND ===
 * export const config: BackendConfig = {
 *   provider: 'php',
 *   baseUrl: getBasePath(),
 * };
 *
 * === FÜR SUPABASE BACKEND ===
 * export const config: BackendConfig = {
 *   provider: 'supabase',
 *   projectId: 'dein-projekt-id',  // z.B. 'abcdefghijklmnop'
 *   anonKey: 'dein-anon-key',      // Aus Supabase Dashboard > Settings > API
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
