import type { DataProvider, Project, User, Evaluation, Template } from './types';

export interface SupabaseConfig {
  projectId: string;
  anonKey: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  password: string | null;
  created_at: string;
}

interface SupabaseTemplate {
  id: string;
  project_id: string;
  skills: Array<{ id: string; name: string }>;
  target_values: Record<string, number> | null;
  rating_levels: Array<{ level: number; title: string; description: string }> | null;
  display_settings: Record<string, unknown> | null;
}

interface SupabaseUser {
  id: string;
  project_id: string;
  name: string;
  color: string;
  disabled_skills: string[];
}

interface SupabaseEvaluation {
  id: string;
  project_id: string;
  evaluator_id: string;
  evaluated_user_id: string;
  skills: Record<string, number>;
}

/**
 * Supabase Backend Provider
 * Kommuniziert direkt mit der Supabase REST API (PostgREST)
 */
export function createSupabaseProvider(config: SupabaseConfig): DataProvider {
  const { projectId, anonKey } = config;
  const baseUrl = `https://${projectId}.supabase.co/rest/v1`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
    'Prefer': 'return=representation',
  };

  async function query<T>(
    table: string,
    options: {
      method?: string;
      filter?: string;
      body?: unknown;
      select?: string;
      single?: boolean;
    } = {}
  ): Promise<T> {
    const { method = 'GET', filter = '', body, select, single } = options;

    let url = `${baseUrl}/${table}`;
    const params: string[] = [];

    if (filter) params.push(filter);
    if (select) params.push(`select=${encodeURIComponent(select)}`);
    if (params.length > 0) url += '?' + params.join('&');

    const requestHeaders: Record<string, string> = { ...headers };
    if (single) {
      requestHeaders['Accept'] = 'application/vnd.pgrst.object+json';
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Supabase query failed [${method} ${table}]:`, errorText);
      throw new Error(`Supabase query failed: ${response.statusText}`);
    }

    // DELETE returns empty response
    if (method === 'DELETE') {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) return (single ? null : []) as T;

    return JSON.parse(text);
  }

  // Map für User-IDs (Frontend verwendet string-basierte IDs, Supabase UUIDs)
  // Wir speichern die Zuordnung im localStorage für Konsistenz
  function setStoredUserMap(projectId: string, map: Record<string, string>): void {
    const key = `skillgapper_user_map_${projectId}`;
    localStorage.setItem(key, JSON.stringify(map));
  }

  return {
    // ===== PROJEKTE =====

    async getProjects(): Promise<Project[]> {
      const projects = await query<SupabaseProject[]>('projects', {
        select: 'id,name,password,created_at',
      });

      return projects
        .map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.created_at,
          hasPassword: p.password !== null,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async createProject(name: string, password?: string): Promise<Project> {
      const [project] = await query<SupabaseProject[]>('projects', {
        method: 'POST',
        body: {
          name,
          password: password || null,
        },
      });

      return {
        id: project.id,
        name: project.name,
        createdAt: project.created_at,
        hasPassword: project.password !== null,
      };
    },

    async deleteProject(id: string): Promise<void> {
      // Cascade Delete ist in der DB konfiguriert
      await query('projects', {
        method: 'DELETE',
        filter: `id=eq.${id}`,
      });

      // Lokale User-Map löschen
      localStorage.removeItem(`skillgapper_user_map_${id}`);
    },

    async validatePassword(projectId: string, password: string): Promise<boolean> {
      try {
        const [project] = await query<SupabaseProject[]>('projects', {
          filter: `id=eq.${projectId}`,
          select: 'password',
        });

        if (!project) return false;
        if (project.password === null) return true;
        return project.password === password;
      } catch {
        return false;
      }
    },

    // ===== TEMPLATE =====

    async getTemplate(projectId: string): Promise<Template | null> {
      try {
        const templates = await query<SupabaseTemplate[]>('templates', {
          filter: `project_id=eq.${projectId}`,
        });

        if (templates.length === 0) return null;

        const t = templates[0];
        return {
          skills: t.skills || [],
          targetValues: t.target_values || undefined,
          ratingLevels: t.rating_levels || undefined,
          displaySettings: (t.display_settings as Template['displaySettings']) || undefined,
        };
      } catch {
        return null;
      }
    },

    async saveTemplate(projectId: string, template: Template): Promise<void> {
      // Check if template exists
      const existing = await query<SupabaseTemplate[]>('templates', {
        filter: `project_id=eq.${projectId}`,
        select: 'id',
      });

      const data = {
        project_id: projectId,
        skills: template.skills,
        target_values: template.targetValues || null,
        rating_levels: template.ratingLevels || null,
        display_settings: template.displaySettings || null,
      };

      if (existing.length > 0) {
        // Update
        await query('templates', {
          method: 'PATCH',
          filter: `project_id=eq.${projectId}`,
          body: data,
        });
      } else {
        // Insert
        await query('templates', {
          method: 'POST',
          body: data,
        });
      }
    },

    // ===== USERS =====

    async getUsers(projectId: string): Promise<User[]> {
      try {
        const users = await query<SupabaseUser[]>('users', {
          filter: `project_id=eq.${projectId}`,
        });

        // Update local map
        const userMap: Record<string, string> = {};
        users.forEach((u) => {
          userMap[u.id] = u.id;
        });
        setStoredUserMap(projectId, userMap);

        return users.map((u) => ({
          id: u.id,
          name: u.name,
          color: u.color,
          disabledSkills: u.disabled_skills || [],
        }));
      } catch {
        return [];
      }
    },

    async saveUsers(projectId: string, users: User[]): Promise<void> {
      // Get existing users from DB
      const existingUsers = await query<SupabaseUser[]>('users', {
        filter: `project_id=eq.${projectId}`,
        select: 'id',
      });

      const existingIds = new Set(existingUsers.map((u) => u.id));
      const newIds = new Set(users.map((u) => u.id));

      // Delete removed users
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      for (const id of toDelete) {
        await query('users', {
          method: 'DELETE',
          filter: `id=eq.${id}`,
        });
      }

      // Upsert users
      for (const user of users) {
        const data = {
          project_id: projectId,
          name: user.name,
          color: user.color,
          disabled_skills: user.disabledSkills || [],
        };

        if (existingIds.has(user.id)) {
          // Update existing
          await query('users', {
            method: 'PATCH',
            filter: `id=eq.${user.id}`,
            body: data,
          });
        } else {
          // Check if ID is a UUID or timestamp-based
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);

          if (isUUID) {
            // Use existing UUID
            await query('users', {
              method: 'POST',
              body: { id: user.id, ...data },
            });
          } else {
            // Let Supabase generate new UUID, but we need to track mapping
            const [newUser] = await query<SupabaseUser[]>('users', {
              method: 'POST',
              body: data,
            });

            // Update user ID in memory for this session
            user.id = newUser.id;
          }
        }
      }

      // Update local map
      const userMap: Record<string, string> = {};
      users.forEach((u) => {
        userMap[u.id] = u.id;
      });
      setStoredUserMap(projectId, userMap);
    },

    // ===== EVALUATIONS =====

    async getEvaluations(projectId: string): Promise<Evaluation[]> {
      try {
        const evaluations = await query<SupabaseEvaluation[]>('evaluations', {
          filter: `project_id=eq.${projectId}`,
        });

        return evaluations.map((e) => ({
          evaluatorId: e.evaluator_id,
          evaluatedUserId: e.evaluated_user_id,
          skills: e.skills || {},
        }));
      } catch {
        return [];
      }
    },

    async saveEvaluations(projectId: string, evaluations: Evaluation[]): Promise<void> {
      // Get existing evaluations
      const existing = await query<SupabaseEvaluation[]>('evaluations', {
        filter: `project_id=eq.${projectId}`,
        select: 'id,evaluator_id,evaluated_user_id',
      });

      // Create lookup for existing evaluations
      const existingMap = new Map(
        existing.map((e) => [`${e.evaluator_id}_${e.evaluated_user_id}`, e.id])
      );

      // Track which evaluations we're keeping
      const keepKeys = new Set<string>();

      // Upsert evaluations
      for (const evaluation of evaluations) {
        const key = `${evaluation.evaluatorId}_${evaluation.evaluatedUserId}`;
        keepKeys.add(key);

        const data = {
          project_id: projectId,
          evaluator_id: evaluation.evaluatorId,
          evaluated_user_id: evaluation.evaluatedUserId,
          skills: evaluation.skills,
        };

        const existingId = existingMap.get(key);

        if (existingId) {
          // Update
          await query('evaluations', {
            method: 'PATCH',
            filter: `id=eq.${existingId}`,
            body: { skills: evaluation.skills },
          });
        } else {
          // Insert
          await query('evaluations', {
            method: 'POST',
            body: data,
          });
        }
      }

      // Delete removed evaluations
      for (const [key, id] of existingMap) {
        if (!keepKeys.has(key)) {
          await query('evaluations', {
            method: 'DELETE',
            filter: `id=eq.${id}`,
          });
        }
      }
    },
  };
}
