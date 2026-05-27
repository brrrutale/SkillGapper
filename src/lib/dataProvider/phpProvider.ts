import type { DataProvider, Project, User, Evaluation, Template, Skill } from './types';

// Hilfsfunktion zur Migration von alten Skills (string[]) zu neuen Skills (Skill[])
function migrateSkills(skills: Skill[] | string[] | undefined): Skill[] {
  if (!skills || skills.length === 0) return [];

  // Prüfe ob bereits neues Format (erstes Element ist ein Objekt mit id und name)
  if (typeof skills[0] === 'object' && skills[0] !== null && 'id' in skills[0] && 'name' in skills[0]) {
    return skills as Skill[];
  }

  // Altes Format: string[] -> Skill[] migrieren
  // Generiere eine stabile ID basierend auf dem Index
  return (skills as string[]).map((name, index) => ({
    id: `skill_${index}_${Date.now()}`,
    name: name,
  }));
}

/**
 * PHP/JSON Backend Provider
 * Kommuniziert mit dem eigenen PHP-Server der JSON-Dateien verwaltet
 * Verwendet Query-Parameter für Kompatibilität mit Nginx (ohne URL-Rewriting)
 */
export function createPhpProvider(baseUrl: string = '/api'): DataProvider {

  async function apiCall<T>(route: string, method: string = 'GET', body?: unknown): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    // Verwende Query-Parameter statt URL-Rewriting für Nginx-Kompatibilität
    // z.B. /api/index.php?route=projects/123/template
    const url = `${baseUrl}/index.php?route=${encodeURIComponent(route.replace(/^\//, ''))}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API call failed with status ${response.status}:`, errorText);
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
  }

  return {
    // Projekte
    async getProjects(): Promise<Project[]> {
      return apiCall<Project[]>('projects');
    },

    async createProject(name: string, password?: string): Promise<Project> {
      return apiCall<Project>('projects', 'POST', { name, password });
    },

    async deleteProject(id: string): Promise<void> {
      await apiCall(`projects/${id}`, 'DELETE');
    },

    async validatePassword(projectId: string, password: string): Promise<boolean> {
      try {
        const result = await apiCall<{ valid: boolean }>(`projects/${projectId}/validate-password`, 'POST', { password });
        return result.valid;
      } catch {
        return false;
      }
    },

    // Template
    async getTemplate(projectId: string): Promise<Template | null> {
      try {
        const rawTemplate = await apiCall<{ skills?: Skill[] | string[]; targetValues?: Record<string, number>; ratingLevels?: Template['ratingLevels'] }>(`projects/${projectId}/template`);
        return {
          skills: migrateSkills(rawTemplate.skills),
          targetValues: rawTemplate.targetValues,
          ratingLevels: rawTemplate.ratingLevels,
        };
      } catch {
        return null;
      }
    },

    async saveTemplate(projectId: string, template: Template): Promise<void> {
      await apiCall(`projects/${projectId}/template`, 'POST', template);
    },

    // Users
    async getUsers(projectId: string): Promise<User[]> {
      try {
        const users = await apiCall<User[]>(`projects/${projectId}/users`);
        // Sortiere nach order falls vorhanden, sonst behalte Array-Reihenfolge
        return users
          .map((u, index) => ({ ...u, order: u.order ?? index }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      } catch {
        return [];
      }
    },

    async saveUsers(projectId: string, users: User[]): Promise<void> {
      // Speichere mit order basierend auf Array-Index
      const usersWithOrder = users.map((u, index) => ({ ...u, order: index }));
      await apiCall(`projects/${projectId}/users`, 'POST', usersWithOrder);
    },

    // Evaluations
    async getEvaluations(projectId: string): Promise<Evaluation[]> {
      try {
        return await apiCall<Evaluation[]>(`projects/${projectId}/evaluations`);
      } catch {
        return [];
      }
    },

    async saveEvaluations(projectId: string, evaluations: Evaluation[]): Promise<void> {
      await apiCall(`projects/${projectId}/evaluations`, 'POST', evaluations);
    },
  };
}
