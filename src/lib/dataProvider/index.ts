import { config } from './config';
import { createPhpProvider } from './phpProvider';
import { createSupabaseProvider } from './supabaseProvider';
import type { DataProvider } from './types';

// Re-export types
export type { DataProvider, Project, User, Skill, Evaluation, Template, RatingLevel } from './types';

/**
 * Erstellt den DataProvider basierend auf der Konfiguration in config.ts
 */
function createDataProvider(): DataProvider {
  switch (config.provider) {
    case 'php':
      console.log('📡 Using PHP backend:', config.baseUrl);
      return createPhpProvider(config.baseUrl);

    case 'supabase':
      console.log('📡 Using Supabase backend:', config.projectId);
      return createSupabaseProvider({
        projectId: config.projectId,
        anonKey: config.anonKey,
      });

    default:
      throw new Error(`Unknown provider type: ${(config as { provider: string }).provider}`);
  }
}

// Singleton-Instanz des DataProviders
export const dataProvider = createDataProvider();
