import { config } from './config';
import { createAzureProvider } from './azureProvider';
import type { DataProvider } from './types';

// Re-export types
export type { DataProvider, Project, User, Skill, Evaluation, Template, RatingLevel, DisplaySettings } from './types';

/**
 * Erstellt den DataProvider basierend auf der Konfiguration in config.ts
 */
function createDataProvider(): DataProvider {
  if (config.provider === 'azure') {
    console.log('📡 Using Azure Functions backend:', config.baseUrl);
    return createAzureProvider({
      baseUrl: config.baseUrl,
      functionKey: config.functionKey,
      teamId: config.teamId,
    });
  }
  throw new Error(`Unknown provider: ${(config as { provider: string }).provider}`);
}

// Singleton-Instanz des DataProviders
export const dataProvider = createDataProvider();
