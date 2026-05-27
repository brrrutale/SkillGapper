import type { DataProvider, Project, User, Evaluation, Template } from './types';

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
        return await apiCall<Template>(`projects/${projectId}/template`);
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
        return await apiCall<User[]>(`projects/${projectId}/users`);
      } catch {
        return [];
      }
    },

    async saveUsers(projectId: string, users: User[]): Promise<void> {
      await apiCall(`projects/${projectId}/users`, 'POST', users);
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
