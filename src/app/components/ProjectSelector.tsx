import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Lock, Eye, EyeOff, Search } from 'lucide-react';
import { KroteIcon } from './icons/KroteIcon';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  hasPassword?: boolean;
}

interface ProjectSelectorProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, password?: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProject: (projectId: string, name: string) => void;
  onValidatePassword: (projectId: string, password: string) => Promise<boolean>;
}

export function ProjectSelector({ projects, onSelectProject, onCreateProject, onDeleteProject, onUpdateProject, onValidatePassword }: ProjectSelectorProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPassword, setNewProjectPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Password dialog state
  const [passwordDialogProject, setPasswordDialogProject] = useState<Project | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showEnteredPassword, setShowEnteredPassword] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogProject, setDeleteDialogProject] = useState<Project | null>(null);

  // Create form error state
  const [createError, setCreateError] = useState('');

  // Filter projects based on search query
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;

    // Check if project with same name already exists (case-insensitive)
    const nameExists = projects.some(
      project => project.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameExists) {
      setCreateError('Ein Projekt mit diesem Namen existiert bereits.');
      return;
    }

    onCreateProject(trimmedName, newProjectPassword.trim() || undefined);
    setNewProjectName('');
    setNewProjectPassword('');
    setCreateError('');
    setShowCreateForm(false);
  };

  const handleSelectProject = async (project: Project) => {
    if (project.hasPassword) {
      setPasswordDialogProject(project);
      setEnteredPassword('');
      setPasswordError(false);
      return;
    }
    // Auch Projekte ohne Passwort brauchen ein Zugriffs-Token — die API gibt
    // Inhalte nur noch gegen ein gültiges Bearer-Token heraus. Für
    // ungeschützte Projekte stellt der Server es ohne Passwort aus.
    const ok = await onValidatePassword(project.id, '');
    if (ok) {
      onSelectProject(project);
    } else {
      // Sollte nur passieren, wenn das Projekt zwischenzeitlich geschützt
      // oder gelöscht wurde — dann doch nach dem Passwort fragen.
      setPasswordDialogProject(project);
      setEnteredPassword('');
      setPasswordError(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordDialogProject) return;

    const valid = await onValidatePassword(passwordDialogProject.id, enteredPassword);
    if (valid) {
      onSelectProject(passwordDialogProject);
      setPasswordDialogProject(null);
      setEnteredPassword('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const startEditing = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const saveEdit = (projectId: string) => {
    if (editingProjectName.trim()) {
      onUpdateProject(projectId, editingProjectName.trim());
      setEditingProjectId(null);
      setEditingProjectName('');
    }
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Colorful Header Bar */}
      <div className="h-[10px] w-full flex shrink-0">
        <div className="bg-[#c4a277] w-[16.67%]" />
        <div className="bg-[#ffc32d] w-[16.67%]" />
        <div className="bg-[#f67858] w-[16.67%]" />
        <div className="bg-[#84d160] w-[16.67%]" />
        <div className="bg-[#b384d3] w-[16.67%]" />
        <div className="bg-[#72c7f9] w-[16.67%]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <KroteIcon className="w-16 h-16 text-black mx-auto mb-4" />
            <h1 className="text-[30px] font-bold text-gray-900 mb-2 tracking-[0]">SkillGapper</h1>
            <p className="text-[16px] font-medium text-[#565656] tracking-[0]">Wähle ein Projekt oder erstelle ein neues</p>
          </div>

          {/* Search and Create Button Row */}
          <div className="flex items-center gap-8 mb-6">
            {/* Search Input */}
            <div className="flex-1 flex items-center gap-3 border border-[#ddd] rounded-[77px] pl-[17px] pr-[24px] py-[13px]">
              <Search className="w-5 h-5 text-[#c0c0c0] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Projekte suchen…"
                className="w-full bg-transparent border-none outline-none text-[16px] font-normal leading-[28px] tracking-[0] text-gray-900 placeholder:text-[#c0c0c0]"
              />
            </div>

            {/* New Project Button */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-[10px] px-[12px] py-[12px] bg-black text-white rounded-[8px] hover:bg-gray-800 transition cursor-pointer shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-[14px] leading-[24px] tracking-[0]">Neues Projekt</span>
            </button>
          </div>

          {/* Create New Project Form */}
          {showCreateForm && (
            <div className="border-2 border-blue-500 rounded-lg p-4 mb-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-2 tracking-[0]">
                    Projektname
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => {
                      setNewProjectName(e.target.value);
                      setCreateError('');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="z.B. Q1 2024 Team-Bewertung"
                    className={`w-full px-4 py-3 border rounded-full focus:outline-none focus:ring-2 text-[16px] font-medium tracking-[0] ${
                      createError
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-[#565656] focus:ring-blue-500'
                    }`}
                    autoFocus
                  />
                  {createError && (
                    <p className="text-red-500 text-[14px] font-medium mt-2 tracking-[0]">{createError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-2 tracking-[0]">
                    Passwort (optional)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newProjectPassword}
                      onChange={(e) => setNewProjectPassword(e.target.value)}
                      placeholder="Leer lassen für kein Passwort"
                      className="w-full px-4 py-3 pr-12 border border-[#565656] rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-[16px] font-medium tracking-[0]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleCreate}
                    className="bg-[#eee] relative rounded-[8px] overflow-clip w-full sm:w-auto cursor-pointer"
                  >
                    <div className="flex items-center justify-center px-[20px] py-[10px]">
                      <span className="font-medium text-[14px] text-black tracking-[0] leading-[20px]">Erstellen</span>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.05)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewProjectName('');
                      setNewProjectPassword('');
                      setCreateError('');
                    }}
                    className="bg-white relative rounded-[8px] overflow-clip w-full sm:w-auto cursor-pointer"
                  >
                    <div className="flex items-center justify-center px-[20px] py-[10px]">
                      <span className="font-medium text-[14px] text-[#565656] tracking-[0] leading-[20px]">Abbrechen</span>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project List */}
          <div className="space-y-3 mb-6">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-[#565656]">
                <p className="text-[16px] font-medium tracking-[0]">Noch keine Projekte. Erstelle dein erstes Projekt, um loszulegen!</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-[#565656]">
                <p className="text-[16px] font-medium tracking-[0]">Keine Projekte gefunden für „{searchQuery}"</p>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border border-[#ddd] rounded-lg hover:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] transition group"
                >
                  {editingProjectId === project.id ? (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') saveEdit(project.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 px-4 py-2 border border-[#565656] rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-[16px] font-medium tracking-[0]"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(project.id)}
                          className="text-green-600 hover:text-green-700 p-2 rounded-[8px] hover:bg-green-50 cursor-pointer"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-600 hover:text-gray-700 p-2 rounded-[8px] hover:bg-gray-100 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelectProject(project)}
                        className="flex-1 text-left cursor-pointer"
                      >
                        <h3 className="font-medium text-[18px] text-gray-900 flex items-center gap-2 tracking-[0]">
                          {project.name}
                          {project.hasPassword && <Lock className="w-4 h-4 text-gray-400" />}
                        </h3>
                        <p className="text-[14px] font-medium text-[#565656] tracking-[0]">
                          Erstellt am {new Date(project.createdAt).toLocaleDateString('de-DE')}
                        </p>
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => startEditing(project, e)}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-[8px] hover:bg-blue-50 cursor-pointer"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialogProject(project);
                          }}
                          className="text-red-600 hover:text-red-700 p-2 rounded-[8px] hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      {passwordDialogProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-[18px] font-medium text-gray-900 tracking-[0]">Passwort erforderlich</h2>
              <p className="text-[16px] font-medium text-[#565656] mt-2 tracking-[0]">
                Das Projekt "{passwordDialogProject.name}" ist passwortgeschützt.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-gray-700 mb-2 tracking-[0]">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    type={showEnteredPassword ? 'text' : 'password'}
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder="Passwort eingeben"
                    className={`w-full px-4 py-3 pr-12 border rounded-full focus:outline-none focus:ring-2 text-[16px] font-medium tracking-[0] ${
                      passwordError
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-[#565656] focus:ring-blue-500'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowEnteredPassword(!showEnteredPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    {showEnteredPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-red-500 text-[14px] font-medium mt-2 tracking-[0]">Falsches Passwort</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-[8px] hover:bg-blue-700 transition font-medium text-[14px] tracking-[0] cursor-pointer"
                >
                  Öffnen
                </button>
                <button
                  onClick={() => {
                    setPasswordDialogProject(null);
                    setEnteredPassword('');
                    setPasswordError(false);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-[8px] hover:bg-gray-200 transition font-medium text-[14px] tracking-[0] cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <Trash2 className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-[18px] font-medium text-gray-900 tracking-[0]">Projekt löschen?</h2>
              <p className="text-[16px] font-medium text-[#565656] mt-2 tracking-[0]">
                Möchtest du das Projekt "{deleteDialogProject.name}" wirklich löschen?
              </p>
              <p className="text-red-500 text-[14px] font-medium mt-2 tracking-[0]">
                Dies kann nicht rückgängig gemacht werden.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDeleteProject(deleteDialogProject.id);
                  setDeleteDialogProject(null);
                }}
                className="flex-1 bg-red-600 text-white py-3 rounded-[8px] hover:bg-red-700 transition font-medium text-[14px] tracking-[0] cursor-pointer"
              >
                Löschen
              </button>
              <button
                onClick={() => setDeleteDialogProject(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-[8px] hover:bg-gray-200 transition font-medium text-[14px] tracking-[0] cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
