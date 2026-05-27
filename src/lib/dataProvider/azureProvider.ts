import type { DataProvider, Project, User, Evaluation, Template, Skill } from './types';

export interface AzureConfig {
  /**
   * Base URL of the Azure Function App, e.g. https://skillgapper-api.azurewebsites.net
   * In dev, you can point this at http://localhost:7071 (running `func start` in azure-functions/).
   */
  baseUrl: string;
  /** Azure Functions function-level auth key. Not needed for localhost. */
  functionKey?: string;
  /** Logical team / workspace id — used as Cosmos partition key. Defaults to "default". */
  teamId?: string;
}

interface ProjectDocument {
  id: string;
  TeamId: string;
  name: string;
  password: string | null;
  template?: {
    skills?: Skill[];
    targetValues?: Record<string, number>;
    ratingLevels?: Array<{ level: number; title: string; description: string }>;
    displaySettings?: { showSeparateEvaluation?: boolean; showIndividualEvaluations?: boolean };
  };
  users?: User[];
  evaluations?: Evaluation[];
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Azure Functions / Cosmos DB Backend Provider.
 *
 * Pro Projekt liegt ein einziges Dokument in Cosmos (denormalisiert) — template,
 * users und evaluations sind eingebettet. Dieser Provider kapselt das so, dass
 * die UI weiter mit dem bestehenden DataProvider-Interface arbeiten kann.
 */
export function createAzureProvider(config: AzureConfig): DataProvider {
  const base = config.baseUrl.replace(/\/$/, '');
  const teamId = config.teamId || 'default';

  function buildUrl(path: string, extraQuery?: Record<string, string>): string {
    const url = new URL(`${base}/api/${path}`);
    url.searchParams.set('teamId', teamId);
    if (config.functionKey) url.searchParams.set('code', config.functionKey);
    if (extraQuery) {
      for (const [k, v] of Object.entries(extraQuery)) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async function call<T>(path: string, init: RequestInit = {}, extraQuery?: Record<string, string>): Promise<T> {
    const url = buildUrl(path, extraQuery);
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = '';
      try {
        const t = await res.text();
        detail = t ? `: ${t}` : '';
      } catch { /* ignore */ }
      throw new Error(`Azure API ${res.status}${detail}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async function fetchProject(id: string): Promise<ProjectDocument> {
    return call<ProjectDocument>(`projects/${id}`);
  }

  async function patchProject(id: string, patch: Partial<ProjectDocument>): Promise<void> {
    await call(`projects/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
  }

  return {
    // ===== PROJECTS =====

    async getProjects(): Promise<Project[]> {
      const { projects } = await call<{ projects: Array<{ id: string; name: string; hasPassword: boolean; createdAt: number }> }>('projects');
      return projects.map(p => ({
        id: p.id,
        name: p.name,
        createdAt: new Date(p.createdAt || Date.now()).toISOString(),
        hasPassword: p.hasPassword,
      }));
    },

    async createProject(name: string, password?: string): Promise<Project> {
      const created = await call<{ id: string; name: string; hasPassword: boolean; createdAt: number }>('projects', {
        method: 'POST',
        body: JSON.stringify({ name, password: password || null }),
      });
      return {
        id: created.id,
        name: created.name,
        createdAt: new Date(created.createdAt || Date.now()).toISOString(),
        hasPassword: created.hasPassword,
      };
    },

    async deleteProject(id: string): Promise<void> {
      await call(`projects/${id}`, { method: 'DELETE' });
    },

    async validatePassword(projectId: string, password: string): Promise<boolean> {
      try {
        const { valid } = await call<{ valid: boolean }>(`projects/${projectId}/validate-password`, {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
        return !!valid;
      } catch {
        return false;
      }
    },

    // ===== TEMPLATE =====

    async getTemplate(projectId: string): Promise<Template | null> {
      try {
        const doc = await fetchProject(projectId);
        const t = doc.template;
        if (!t) return null;
        return {
          skills: t.skills || [],
          targetValues: t.targetValues,
          ratingLevels: t.ratingLevels,
          displaySettings: t.displaySettings,
        };
      } catch {
        return null;
      }
    },

    async saveTemplate(projectId: string, template: Template): Promise<void> {
      await patchProject(projectId, { template });
    },

    // ===== USERS =====

    async getUsers(projectId: string): Promise<User[]> {
      try {
        const doc = await fetchProject(projectId);
        // Defensive: sortiere clientseitig nach order falls vorhanden
        const users = (doc.users || []).slice();
        users.sort((a, b) => ((a as User & { order?: number }).order ?? 0) - ((b as User & { order?: number }).order ?? 0));
        return users;
      } catch {
        return [];
      }
    },

    async saveUsers(projectId: string, users: User[]): Promise<void> {
      await patchProject(projectId, { users });
    },

    // ===== EVALUATIONS =====

    async getEvaluations(projectId: string): Promise<Evaluation[]> {
      try {
        const doc = await fetchProject(projectId);
        return doc.evaluations || [];
      } catch {
        return [];
      }
    },

    async saveEvaluations(projectId: string, evaluations: Evaluation[]): Promise<void> {
      await patchProject(projectId, { evaluations });
    },
  };
}
