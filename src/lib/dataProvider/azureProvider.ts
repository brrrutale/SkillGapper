import type { DataProvider, Project, User, Evaluation, Template, Skill } from './types';

export interface AzureConfig {
  /**
   * Base URL of the Azure Function App, e.g. https://skillgapper-api.azurewebsites.net
   * In dev, you can point this at http://localhost:7072 (running `func start` in azure-functions/).
   */
  baseUrl: string;
  /** Logical team / workspace id — informational only; the server pins the partition. */
  teamId?: string;
}

interface ProjectDocument {
  id: string;
  TeamId: string;
  name: string;
  hasPassword?: boolean;
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

/** Wird geworfen, wenn der Server 401 liefert — die UI soll dann den Passwort-Dialog zeigen. */
export class UnauthorizedError extends Error {
  constructor(public projectId: string) {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

const TOKEN_PREFIX = 'sg_token:';

/**
 * Session-Token pro Projekt.
 *
 * sessionStorage statt localStorage: das Token verschwindet, wenn der Tab
 * geschlossen wird. Auf einem geteilten Rechner erbt der naechste Nutzer
 * damit keinen Zugriff.
 */
function readToken(projectId: string): string | null {
  try {
    return sessionStorage.getItem(TOKEN_PREFIX + projectId);
  } catch {
    return null;
  }
}

function writeToken(projectId: string, token: string): void {
  try {
    sessionStorage.setItem(TOKEN_PREFIX + projectId, token);
  } catch { /* Storage kann blockiert sein — dann eben kein Persist */ }
}

export function clearToken(projectId: string): void {
  try {
    sessionStorage.removeItem(TOKEN_PREFIX + projectId);
  } catch { /* ignore */ }
}

export function clearAllTokens(): void {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(TOKEN_PREFIX))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Azure Functions / Cosmos DB Backend Provider.
 *
 * Pro Projekt liegt ein einziges Dokument in Cosmos (denormalisiert) — template,
 * users und evaluations sind eingebettet. Dieser Provider kapselt das so, dass
 * die UI weiter mit dem bestehenden DataProvider-Interface arbeiten kann.
 *
 * Zugriff auf Projektinhalte ist token-gebunden: `validatePassword` holt ein
 * 8h gueltiges Token vom Server, alle weiteren Calls schicken es als Bearer
 * mit. Schreibzugriffe nutzen zusaetzlich ETag/If-Match, damit zwei
 * gleichzeitige Bearbeiter sich nicht stillschweigend ueberschreiben.
 */
export function createAzureProvider(config: AzureConfig): DataProvider {
  const base = config.baseUrl.replace(/\/$/, '');

  // Letzter bekannter ETag pro Projekt, fuer If-Match beim PUT.
  const etags = new Map<string, string>();

  function buildUrl(path: string): string {
    return `${base}/api/${path}`;
  }

  async function call<T>(
    path: string,
    init: RequestInit = {},
    opts: { projectId?: string } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> || {}),
    };

    if (opts.projectId) {
      const token = readToken(opts.projectId);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(buildUrl(path), { ...init, headers });

    if (res.status === 401 && opts.projectId) {
      clearToken(opts.projectId);
      throw new UnauthorizedError(opts.projectId);
    }

    if (!res.ok) {
      let detail = '';
      try {
        const t = await res.text();
        detail = t ? `: ${t}` : '';
      } catch { /* ignore */ }
      const err = new Error(`Azure API ${res.status}${detail}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    // ETag merken, damit der naechste PUT ihn mitschicken kann.
    if (opts.projectId) {
      const etag = res.headers.get('etag');
      if (etag) etags.set(opts.projectId, etag);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async function fetchProject(id: string): Promise<ProjectDocument> {
    return call<ProjectDocument>(`projects/${id}`, {}, { projectId: id });
  }

  /**
   * Teil-Update mit Optimistic Concurrency.
   *
   * Bei 412 (jemand anders hat zwischenzeitlich gespeichert) wird der
   * aktuelle Stand einmal nachgeladen und der Schreibvorgang wiederholt.
   * Das deckt den haeufigen Fall ab, dass mehrere Saves der eigenen Session
   * kurz hintereinander laufen.
   */
  async function patchProject(id: string, patch: Partial<ProjectDocument>): Promise<void> {
    const attempt = async (): Promise<void> => {
      const etag = etags.get(id);
      await call(`projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
        headers: etag ? { 'If-Match': etag } : {},
      }, { projectId: id });
    };

    try {
      if (!etags.has(id)) await fetchProject(id); // ETag besorgen
      await attempt();
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 412 || status === 428) {
        await fetchProject(id); // frischen ETag holen
        await attempt();
        return;
      }
      throw e;
    }
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
      const created = await call<{ id: string; name: string; hasPassword: boolean; createdAt: number; token?: string }>('projects', {
        method: 'POST',
        body: JSON.stringify({ name, password: password || null }),
      });
      // Der Server gibt beim Anlegen direkt ein Token mit, damit der Ersteller
      // ohne zusaetzlichen Login weiterarbeiten kann.
      if (created.token) writeToken(created.id, created.token);
      return {
        id: created.id,
        name: created.name,
        createdAt: new Date(created.createdAt || Date.now()).toISOString(),
        hasPassword: created.hasPassword,
      };
    },

    async deleteProject(id: string): Promise<void> {
      await call(`projects/${id}`, { method: 'DELETE' }, { projectId: id });
      clearToken(id);
      etags.delete(id);
    },

    /**
     * Holt das Zugriffs-Token fuer ein Projekt.
     *
     * Auch fuer Projekte ohne Passwort noetig — dann einfach mit leerem
     * String aufrufen. Der Server entscheidet, ob er ein Token ausgibt.
     */
    async validatePassword(projectId: string, password: string): Promise<boolean> {
      try {
        const { valid, token } = await call<{ valid: boolean; token?: string }>(
          `projects/${projectId}/validate-password`,
          { method: 'POST', body: JSON.stringify({ password }) }
        );
        if (valid && token) writeToken(projectId, token);
        return !!valid;
      } catch {
        return false;
      }
    },

    // ===== TEMPLATE =====

    async getTemplate(projectId: string): Promise<Template | null> {
      const doc = await fetchProject(projectId);
      const t = doc.template;
      if (!t) return null;
      return {
        skills: t.skills || [],
        targetValues: t.targetValues,
        ratingLevels: t.ratingLevels,
        displaySettings: t.displaySettings,
      };
    },

    async saveTemplate(projectId: string, template: Template): Promise<void> {
      await patchProject(projectId, { template });
    },

    // ===== USERS =====

    async getUsers(projectId: string): Promise<User[]> {
      const doc = await fetchProject(projectId);
      const users = (doc.users || []).slice();
      users.sort((a, b) => ((a as User & { order?: number }).order ?? 0) - ((b as User & { order?: number }).order ?? 0));
      return users;
    },

    async saveUsers(projectId: string, users: User[]): Promise<void> {
      await patchProject(projectId, { users });
    },

    // ===== EVALUATIONS =====

    async getEvaluations(projectId: string): Promise<Evaluation[]> {
      const doc = await fetchProject(projectId);
      return doc.evaluations || [];
    },

    async saveEvaluations(projectId: string, evaluations: Evaluation[]): Promise<void> {
      await patchProject(projectId, { evaluations });
    },
  };
}
