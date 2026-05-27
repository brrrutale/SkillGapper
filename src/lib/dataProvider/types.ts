// Datentypen
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  hasPassword?: boolean;
}

export interface User {
  id: string;
  name: string;
  color: string;
  disabledSkills?: string[];
}

export interface Evaluation {
  evaluatorId: string;
  evaluatedUserId: string;
  skills: Record<string, number>;
}

export interface RatingLevel {
  level: number;
  title: string;
  description: string;
}

export interface Template {
  skills: string[];
  targetValues?: Record<string, number>;
  ratingLevels?: RatingLevel[];
}

// DataProvider Interface - kann von verschiedenen Backends implementiert werden
export interface DataProvider {
  // Projekte
  getProjects(): Promise<Project[]>;
  createProject(name: string, password?: string): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  validatePassword(projectId: string, password: string): Promise<boolean>;

  // Template
  getTemplate(projectId: string): Promise<Template | null>;
  saveTemplate(projectId: string, template: Template): Promise<void>;

  // Users
  getUsers(projectId: string): Promise<User[]>;
  saveUsers(projectId: string, users: User[]): Promise<void>;

  // Evaluations
  getEvaluations(projectId: string): Promise<Evaluation[]>;
  saveEvaluations(projectId: string, evaluations: Evaluation[]): Promise<void>;
}
