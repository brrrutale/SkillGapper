import { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, Trash2, Users, Settings, BarChart3, X, GripVertical, CheckCircle2, FolderOpen, ChevronDown, Info, Download, ClipboardList } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ProjectSelector } from './components/ProjectSelector';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { dataProvider, type Project, type User, type Skill, type Evaluation, type Template, type RatingLevel } from '@/lib/dataProvider';

// SVG Pfad für das Chart-Icon (war vorher in Figma-Import)
const svgPaths = {
  p90824c0: "M2 2V12.6667C2 13.0203 2.14048 13.3594 2.39052 13.6095C2.64057 13.8595 2.97971 14 3.33333 14H14",
};

interface DraggableSkillItemProps {
  skill: Skill;
  index: number;
  targetValue?: number;
  moveSkill: (dragIndex: number, hoverIndex: number) => void;
  updateSkillInTemplate: (skillId: string, newName: string) => void;
  removeSkillFromTemplate: (skillId: string) => void;
  updateTargetValue: (skillId: string, value: number | undefined) => void;
}

const DraggableSkillItem = ({ skill, index, targetValue, moveSkill, updateSkillInTemplate, removeSkillFromTemplate, updateTargetValue }: DraggableSkillItemProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'skill',
    item: { index, id: skill.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'skill',
    hover: (item: { index: number; id: string }) => {
      if (item.index !== index) {
        moveSkill(item.index, index);
        item.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`flex items-center gap-3 p-4 bg-white border border-[#ddd] rounded-lg hover:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] transition cursor-move ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm font-medium text-gray-500 w-8 flex-shrink-0">
        {index + 1}.
      </span>
      <input
        type="text"
        value={skill.name}
        onChange={(e) => updateSkillInTemplate(skill.id, e.target.value)}
        className="flex-1 bg-transparent border-none outline-none font-medium min-w-0 text-gray-900"
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-[#565656]">Ziel:</span>
        <input
          type="number"
          min="0"
          max="5"
          step="1"
          value={targetValue ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            updateTargetValue(skill.id, val === '' ? undefined : Math.min(5, Math.max(0, parseInt(val) || 0)));
          }}
          placeholder="-"
          className="w-12 px-2 py-1 text-center text-sm border border-[#ddd] rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={() => removeSkillFromTemplate(skill.id)}
        className="text-red-600 hover:text-red-700 p-2 rounded-[8px] hover:bg-red-50 cursor-pointer flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const DEFAULT_SKILLS = [
  'Kommunikation',
  'Führung',
  'Problemlösung',
  'Kreativität',
  'Zeitmanagement',
  'Teamarbeit',
  'Anpassungsfähigkeit',
  'Technische Fähigkeiten',
  'Kritisches Denken',
  'Entscheidungsfindung',
  'Emotionale Intelligenz',
  'Konfliktlösung',
  'Projektmanagement',
  'Strategisches Denken',
  'Detailgenauigkeit',
  'Kundenservice',
  'Verhandlung',
  'Präsentationsfähigkeiten',
  'Recherchefähigkeiten',
  'Datenanalyse',
  'Innovation',
  'Selbstmotivation',
  'Verantwortlichkeit'
];

const makeDefaultSkills = (): Skill[] =>
  DEFAULT_SKILLS.map((name, i) => ({
    id: `skill_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
  }));

const generateSkillId = (): string =>
  `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_RATING_LEVELS = [
  {
    level: 1,
    title: 'Anfängerin',
    description: 'Du befindest dich am Anfang deiner Entwicklung in dieser Rolle. Du hast noch keine oder nur sehr begrenzt praktische Erfahrung (z.B. als Assistenz oder Beobachterin mitgewirkt). Evtl. hast du bei kleineren Projekten in einer vergleichbaren Rolle Erfahrung. Du hast Interesse daran, dich in dieser Rolle weiterzuentwickeln.'
  },
  {
    level: 2,
    title: 'Neuling',
    description: 'Du bist dran, aktiv zu lernen und dich in dieser Fähigkeit weiterzubilden. Du hast erste praktische Erfahrung in dieser Rolle gesammelt. Du hast 1-2x aktiv in dieser Rolle gearbeitet und kennst die grundlegenden Abläufe. Du bist bei gewissen Teilbereichen dieser Rolle auf Unterstützung/Anleitung einer erfahrenen Person angewiesen. Du lernst aktiv dazu und baust deine Fähigkeiten gezielt aus.'
  },
  {
    level: 3,
    title: 'Fortgeschritten',
    description: 'Du kannst sämtliche Aufgaben dieser Rolle von Anfang bis Ende übernehmen. Du hast in mehreren Projekten eigenverantwortlich in dieser Rolle gearbeitet. Du verfügst über ein solides fachliches Verständnis und kennst die gängigen Workflows, Werkzeuge und Anforderungen. In Standardsituationen arbeitest du sicher, effizient und zuverlässig.'
  },
  {
    level: 4,
    title: 'Expertin',
    description: 'Du hast ein sehr hohes fachliches und praktisches Verständnis dieser Rolle. Du hast bei mehreren, unterschiedlichen Projekten erfolgreich eigenständig in dieser Rolle gearbeitet. Du kannst dich flexibel auf verschiedene Produktionsbedingungen, Teams und Anforderungen einstellen. Du erkennst Probleme frühzeitig und findest eigenständig tragfähige Lösungen. Du kannst andere in dieser Rolle unterstützen, anleiten und fachlich begleiten.'
  },
  {
    level: 5,
    title: 'Meisterin',
    description: 'Du giltst innerhalb und ausserhalb des Unternehmens als ausgewiesene Fachperson in dieser Rolle. Du verfügst über langjährige, umfangreiche Erfahrung in verschiedensten Projekten und Kontexten. Auch unter erschwerten Bedingungen, Budgetrestriktionen oder komplexen Produktionsprozessen lieferst du konstant höchste Qualität. Du entwickelst Prozesse, Arbeitsweisen und die Rolle selbst aktiv weiter und bringst neue, innovative Ansätze ein. Du bist eine zentrale Ansprechperson, Mentorin und Impulsgeberin für andere in dieser Rolle.'
  }
];

const COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export default function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'results' | 'export'>('evaluation');
  const [showSettings, setShowSettings] = useState(false);
  const [resultsView, setResultsView] = useState<'individual' | 'global'>('individual');
  const [selectedUsersForExport, setSelectedUsersForExport] = useState<string[]>([]);
  const [includeGlobalOverview, setIncludeGlobalOverview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMode, setShowExportMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [template, setTemplate] = useState<Template>({
    skills: makeDefaultSkills(),
    ratingLevels: [...DEFAULT_RATING_LEVELS],
  });
  const [newSkillName, setNewSkillName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  
  const [users, setUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [currentEvaluatorId, setCurrentEvaluatorId] = useState<string | null>(null);
  const [currentEvaluatedId, setCurrentEvaluatedId] = useState<string | null>(null);
  const [hoveredRadarName, setHoveredRadarName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluationSaveStatus, setEvaluationSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [isEvaluationCenterCollapsed, setIsEvaluationCenterCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');

  // Track if user is actively interacting to prevent polling conflicts
  const userInteractingRef = useRef(false);
  const interactionTimerRef = useRef<number | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(0); // Track last save time
  const saveStatusTimerRef = useRef<number | null>(null); // Track save status hide timer
  const templateRef = useRef(template);
  const usersRef = useRef(users);
  const evaluationsRef = useRef(evaluations);

  // Keep refs in sync with state
  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    evaluationsRef.current = evaluations;
  }, [evaluations]);

  // Auto-collapse Evaluationszentrum on mobile when both evaluator and evaluated are selected
  useEffect(() => {
    if (currentEvaluatorId && currentEvaluatedId) {
      // Check if we're on mobile (less than lg breakpoint which is 1024px)
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setIsEvaluationCenterCollapsed(true);
      }
    }
  }, [currentEvaluatorId, currentEvaluatedId]);

  // Auto-hide "Gespeichert" message after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      // Clear any existing timer
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      
      // Set a new timer to hide the message after 2 seconds
      saveStatusTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle'); // Reset to idle state (hidden)
      }, 2000);
    }
    
    // Cleanup on unmount
    return () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, [saveStatus]);

  // Load projects on mount and restore last session
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = await dataProvider.getProjects();
        setProjects(projectsData);
        setIsOnline(true);

        // Restore last selected project from localStorage
        const lastProjectId = localStorage.getItem('lastSelectedProjectId');
        const lastTab = localStorage.getItem('lastActiveTab') as 'evaluation' | 'results' | 'export' | null;

        if (lastProjectId) {
          const lastProject = projectsData.find(p => p.id === lastProjectId);
          if (lastProject) {
            // Check if project has password protection
            if (lastProject.hasPassword) {
              // Don't auto-restore password-protected projects
              console.log('Last project is password protected, showing project selector');
            } else {
              setCurrentProject(lastProject);
              console.log('Restored last session:', lastProject.name);
            }
          }
        }

        if (lastTab) {
          setActiveTab(lastTab);
        }
      } catch (error) {
        console.log('Could not load projects, working in offline mode:', error);
        setProjects([]);
        setIsOnline(false);
      }
    };

    loadProjects();
  }, []);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('lastActiveTab', activeTab);
  }, [activeTab]);

  // Save currentEvaluatorId to localStorage when it changes (scoped per project)
  useEffect(() => {
    if (!currentProject) return;
    const key = `lastEvaluatorId:${currentProject.id}`;
    if (currentEvaluatorId) {
      localStorage.setItem(key, currentEvaluatorId);
    } else {
      localStorage.removeItem(key);
    }
  }, [currentEvaluatorId, currentProject]);

  // Save currentEvaluatedId to localStorage when it changes (scoped per project)
  useEffect(() => {
    if (!currentProject) return;
    const key = `lastEvaluatedId:${currentProject.id}`;
    if (currentEvaluatedId) {
      localStorage.setItem(key, currentEvaluatedId);
    } else {
      localStorage.removeItem(key);
    }
  }, [currentEvaluatedId, currentProject]);

  // Display settings (showSeparateEvaluation, showIndividualEvaluations) now
  // live on template.displaySettings — persisted in the database so all users
  // of the same project share them. No localStorage syncing required.

  // Save resultsView to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('lastResultsView', resultsView);
  }, [resultsView]);

  // Load project data when project changes
  useEffect(() => {
    // Reset project-scoped selections when switching projects so stale IDs
    // from a previous project don't reference users that don't exist here.
    setCurrentEvaluatorId(null);
    setCurrentEvaluatedId(null);

    if (!currentProject) {
      setLoading(false);
      return;
    }

    // Save current project to localStorage
    localStorage.setItem('lastSelectedProjectId', currentProject.id);

    const loadProjectData = async () => {
      try {
        setLoading(true);
        console.log('Loading data for project:', currentProject.id, currentProject.name);
        
        // Try to load from localStorage first as backup
        const localStorageKey = `project:${currentProject.id}:backup`;
        const backupData = localStorage.getItem(localStorageKey);
        
        if (backupData) {
          try {
            const parsed = JSON.parse(backupData);
            console.log('📦 Found localStorage backup from:', new Date(parsed.timestamp).toLocaleString());
          } catch (e) {
            console.warn('Could not parse localStorage backup');
          }
        }
        
        try {
          const [templateData, usersData, evaluationsData] = await Promise.all([
            dataProvider.getTemplate(currentProject.id),
            dataProvider.getUsers(currentProject.id),
            dataProvider.getEvaluations(currentProject.id)
          ]);
          
          console.log('Loaded template:', templateData);
          console.log('📥 LOADED USERS FROM SERVER:', JSON.stringify(usersData, null, 2));
          console.log('📥 Users with disabled skills:', usersData?.map(u => ({ name: u.name, disabledSkills: u.disabledSkills || [] })));
          console.log('Loaded evaluations:', evaluationsData); 
          
          // Use template exactly as it is from the database - no reconstruction or default skills
          // Add default rating levels if not present
          const finalTemplate = templateData
            ? { ...templateData, ratingLevels: templateData.ratingLevels || [...DEFAULT_RATING_LEVELS] }
            : { skills: [], ratingLevels: [...DEFAULT_RATING_LEVELS] };
          console.log('✅ Using template from database as-is:', finalTemplate);
          
          // Always use server data - no backup restoration
          setTemplate(finalTemplate);
          setUsers(usersData || []);
          setEvaluations(evaluationsData || []);
          console.log('✅ Loaded from server - Template:', finalTemplate.skills?.length || 0, 'skills, Users:', usersData?.length || 0, 'users');

          // Restore session state from localStorage (scoped per project)
          const lastEvaluatorId = localStorage.getItem(`lastEvaluatorId:${currentProject.id}`);
          const lastEvaluatedId = localStorage.getItem(`lastEvaluatedId:${currentProject.id}`);
          const lastResultsView = localStorage.getItem('lastResultsView') as 'individual' | 'global' | null;

          if (lastEvaluatorId && usersData?.some(u => u.id === lastEvaluatorId)) {
            setCurrentEvaluatorId(lastEvaluatorId);
            console.log('Restored last evaluator:', lastEvaluatorId);
          }
          if (lastEvaluatedId && usersData?.some(u => u.id === lastEvaluatedId)) {
            setCurrentEvaluatedId(lastEvaluatedId);
            console.log('Restored last evaluated:', lastEvaluatedId);
          }
          if (lastResultsView) {
            setResultsView(lastResultsView);
            console.log('Restored results view:', lastResultsView);
          }

          setIsOnline(true);
          
        } catch (error) {
          console.error('Error loading project data from server:', error);
          console.log('⚠️ Server not available - starting with empty template');
          
          // Start with empty data if server is not available
          setTemplate({ skills: [], ratingLevels: [...DEFAULT_RATING_LEVELS] });
          setUsers([]);
          setEvaluations([]);
          
          setIsOnline(false);
        }
      } catch (error) {
        console.error('Error in loadProjectData:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [currentProject]);

  // Auto-save disabled - using manual save button instead
  // useEffect(() => {
  //   if (!loading && currentProject) {
  //     // Always save to localStorage as backup
  //     const localStorageKey = `project:${currentProject.id}:backup`;
  //     try {
  //       const existingBackup = localStorage.getItem(localStorageKey);
  //       const backup = existingBackup ? JSON.parse(existingBackup) : {};
  //       backup.template = template;
  //       backup.timestamp = Date.now();
  //       localStorage.setItem(localStorageKey, JSON.stringify(backup));
  //       console.log('💾 Backed up template to localStorage');
  //     } catch (e) {
  //       console.error('Failed to backup to localStorage:', e);
  //     }
  //     
  //     // If online, also save to server
  //     if (isOnline) {
  //       setSaveStatus('saving');
  //       lastSaveRef.current = Date.now();
  //       console.log('💾 Auto-saving template:', template.skills.length, 'skills');
  //       apiCall(`/projects/${currentProject.id}/template`, 'POST', template)
  //         .then(() => {
  //           console.log('✅ Template saved successfully');
  //           setSaveStatus('saved');
  //           lastSaveRef.current = Date.now();
  //         })
  //         .catch((error) => {
  //           console.error('❌ Error saving template:', error);
  //           setSaveStatus('error');
  //           setIsOnline(false);
  //         });
  //     }
  //   }
  // }, [template, loading, isOnline, currentProject]);

  // Auto-save disabled - using manual save button instead
  // useEffect(() => {
  //   if (!loading && currentProject) {
  //     // Always save to localStorage as backup
  //     const localStorageKey = `project:${currentProject.id}:backup`;
  //     try {
  //       const existingBackup = localStorage.getItem(localStorageKey);
  //       const backup = existingBackup ? JSON.parse(existingBackup) : {};
  //       backup.users = users;
  //       backup.timestamp = Date.now();
  //       localStorage.setItem(localStorageKey, JSON.stringify(backup));
  //       console.log('💾 Backed up users to localStorage');
  //     } catch (e) {
  //       console.error('Failed to backup to localStorage:', e);
  //     }
  //     
  //     // If online, also save to server
  //     if (isOnline) {
  //       setSaveStatus('saving');
  //       lastSaveRef.current = Date.now();
  //       console.log('💾 Auto-saving users:', users.length, 'users', users.map(u => u.name));
  //       console.log('📤 SENDING USERS TO SERVER:', JSON.stringify(users, null, 2));
  //       apiCall(`/projects/${currentProject.id}/users`, 'POST', users)
  //         .then(() => {
  //           console.log('✅ Users saved successfully');
  //           setSaveStatus('saved');
  //           lastSaveRef.current = Date.now();
  //         })
  //         .catch((error) => {
  //           console.error('❌ Error saving users:', error);
  //           setSaveStatus('error');
  //           setIsOnline(false);
  //         });
  //     }
  //   }
  // }, [users, loading, isOnline, currentProject]);

  // Auto-save evaluations when they change - DISABLED for manual save
  // useEffect(() => {
  //   if (!loading && currentProject) {
  //     // Always save to localStorage as backup
  //     const localStorageKey = `project:${currentProject.id}:backup`;
  //     try {
  //       const existingBackup = localStorage.getItem(localStorageKey);
  //       const backup = existingBackup ? JSON.parse(existingBackup) : {};
  //       backup.evaluations = evaluations;
  //       backup.timestamp = Date.now();
  //       localStorage.setItem(localStorageKey, JSON.stringify(backup));
  //       console.log('💾 Backed up evaluations to localStorage');
  //     } catch (e) {
  //       console.error('Failed to backup to localStorage:', e);
  //     }
  //     
  //     // If online, also save to server
  //     if (isOnline) {
  //       setSaveStatus('saving');
  //       lastSaveRef.current = Date.now();
  //       console.log('💾 Auto-saving evaluations:', evaluations.length, 'evaluations');
  //       apiCall(`/projects/${currentProject.id}/evaluations`, 'POST', evaluations)
  //         .then(() => {
  //           console.log('✅ Evaluations saved successfully');
  //           setSaveStatus('saved');
  //           lastSaveRef.current = Date.now();
  //         })
  //         .catch((error) => {
  //           console.error('❌ Error saving evaluations:', error);
  //           setSaveStatus('error');
  //           setIsOnline(false);
  //         });
  //     }
  //   }
  // }, [evaluations, loading, isOnline, currentProject]);

  // Polling for real-time updates - DISABLED to prevent data conflicts
  // useEffect(() => {
  //   if (!isOnline || !currentProject) return;

  //   const pollInterval = setInterval(async () => {
  //     // Skip polling if Settings modal is open (user is editing template)
  //     if (showSettings) {
  //       console.log('Skipping poll - Settings modal is open');
  //       return;
  //     }

  //     // Skip polling if user is actively interacting
  //     if (userInteractingRef.current) {
  //       console.log('Skipping poll - user is interacting');
  //       return;
  //     }

  //     // Skip polling if recent local update (within 5 seconds)
  //     const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
  //     if (timeSinceLastUpdate < 5000) {
  //       console.log('Skipping poll - recent local update');
  //       return;
  //     }

  //     // Skip polling if recent save (within 10 seconds)
  //     const timeSinceLastSave = Date.now() - lastSaveRef.current;
  //     if (timeSinceLastSave < 10000) {
  //       console.log('Skipping poll - recent save operation');
  //       return;
  //     }

  //     try {
  //       const [templateData, usersData, evaluationsData] = await Promise.all([
  //         apiCall(`/projects/${currentProject.id}/template`),
  //         apiCall(`/projects/${currentProject.id}/users`),
  //         apiCall(`/projects/${currentProject.id}/evaluations`)
  //       ]);
  //       
  //       // Only update if data has actually changed (using refs to get current state)
  //       const templateChanged = JSON.stringify(templateData) !== JSON.stringify(templateRef.current);
  //       const usersChanged = JSON.stringify(usersData) !== JSON.stringify(usersRef.current);
  //       const evaluationsChanged = JSON.stringify(evaluationsData) !== JSON.stringify(evaluationsRef.current);
  //       
  //       if (templateChanged) {
  //         const newTemplate = templateData || { skills: [] };
  //         console.log('📊 Template changed during polling, updating to:', newTemplate.skills.length, 'skills -', newTemplate.skills);
  //         setTemplate(newTemplate);
  //       }
  //       
  //       if (usersChanged) {
  //         // Safety check: don't replace existing data with empty array unless we're intentionally clearing
  //         if (usersData.length === 0 && usersRef.current.length > 0) {
  //           console.warn('⚠️ Server returned empty users array, but we have local data. Re-syncing to server...');
  //           console.log('📤 Attempting to re-sync', usersRef.current.length, 'users to server');
  //           // Push local data back to server
  //           apiCall(`/projects/${currentProject.id}/users`, 'POST', usersRef.current)
  //             .then(() => console.log('✅ Re-synced local users to server'))
  //             .catch((error) => console.error('❌ Failed to re-sync users to server:', error));
  //         } else {
  //           console.log('Users data changed, updating...', usersData.length, 'users');
  //           setUsers(usersData);
  //         }
  //       }
  //       if (evaluationsChanged) {
  //         // Safety check: don't replace existing data with empty array
  //         if (evaluationsData.length === 0 && evaluationsRef.current.length > 0) {
  //           console.warn('⚠️ Server returned empty evaluations array, but we have local data. Re-syncing to server...');
  //           console.log('📤 Attempting to re-sync', evaluationsRef.current.length, 'evaluations to server');
  //           // Push local data back to server
  //           apiCall(`/projects/${currentProject.id}/evaluations`, 'POST', evaluationsRef.current)
  //             .then(() => console.log('✅ Re-synced local evaluations to server'))
  //             .catch((error) => console.error('❌ Failed to re-sync evaluations to server:', error));
  //         } else {
  //           console.log('Evaluations data changed, updating...', evaluationsData.length, 'evaluations');
  //           setEvaluations(evaluationsData);
  //         }
  //       }
  //       
  //       setIsOnline(true);
  //     } catch (error) {
  //       setIsOnline(false);
  //     }
  //   }, 3000);

  //   return () => clearInterval(pollInterval);
  // }, [isOnline, currentProject, showSettings]);

  // Project management functions
  const handleCreateProject = async (name: string, password?: string) => {
    try {
      const newProject = await dataProvider.createProject(name, password);
      setProjects([...projects, newProject]);
      setCurrentProject(newProject);
    } catch (error) {
      console.error('Error creating project:', error);
      // Offline mode - create locally
      const localProject: Project = {
        id: Date.now().toString(),
        name,
        createdAt: new Date().toISOString()
      };
      setProjects([...projects, localProject]);
      setCurrentProject(localProject);
    }
  };

  const handleValidatePassword = async (projectId: string, password: string): Promise<boolean> => {
    try {
      return await dataProvider.validatePassword(projectId, password);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await dataProvider.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleUpdateProject = async (projectId: string, newName: string) => {
    // Note: Update is handled locally, full save syncs to server
    setProjects(projects.map(p => p.id === projectId ? { ...p, name: newName } : p));
    if (currentProject?.id === projectId) {
      setCurrentProject({ ...currentProject, name: newName });
    }
  };

  // Manual save function
  const manualSave = async () => {
    if (!currentProject) return;

    setSaveStatus('saving');
    console.log('🔄 Manual save triggered');
    console.log('📤 Saving template with', template.skills.length, 'skills:', template.skills);
    console.log('📤 Saving', users.length, 'users with disabledSkills:', users.map(u => ({ name: u.name, disabledSkills: u.disabledSkills || [] })));
    console.log('📤 Saving', evaluations.length, 'evaluations');

    try {
      await Promise.all([
        dataProvider.saveTemplate(currentProject.id, template),
        dataProvider.saveUsers(currentProject.id, users),
        dataProvider.saveEvaluations(currentProject.id, evaluations)
      ]);
      console.log('✅ All data saved successfully to database');
      setSaveStatus('saved');
    } catch (error) {
      console.error('❌ Error during manual save:', error);
      setSaveStatus('error');
    }
  };

  // Save current evaluation to database
  const saveCurrentEvaluation = async () => {
    if (!currentProject || !currentEvaluatorId || !currentEvaluatedId) return;

    setEvaluationSaveStatus('saving');
    console.log(`💾 Saving evaluation: ${currentEvaluatorId} → ${currentEvaluatedId}`);

    try {
      // Save all evaluations to server
      await dataProvider.saveEvaluations(currentProject.id, evaluations);

      // Also backup to localStorage
      const localStorageKey = `project:${currentProject.id}:backup`;
      try {
        const existingBackup = localStorage.getItem(localStorageKey);
        const backup = existingBackup ? JSON.parse(existingBackup) : {};
        backup.evaluations = evaluations;
        backup.timestamp = Date.now();
        localStorage.setItem(localStorageKey, JSON.stringify(backup));
      } catch (e) {
        console.error('Failed to backup to localStorage:', e);
      }

      console.log('✅ Evaluation saved successfully');
      setEvaluationSaveStatus('saved');

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setEvaluationSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving evaluation:', error);
      setEvaluationSaveStatus('idle');
    }
  };

  // Debug function to check what's in database
  const debugCheckDatabase = async () => {
    if (!currentProject) return;

    console.log('🔍 === DATABASE DEBUG CHECK ===');
    try {
      const [templateData, usersData, evaluationsData] = await Promise.all([
        dataProvider.getTemplate(currentProject.id),
        dataProvider.getUsers(currentProject.id),
        dataProvider.getEvaluations(currentProject.id)
      ]);

      console.log('📋 Template in DB:', templateData);
      console.log('👥 Users in DB:', usersData);
      console.log('📊 Evaluations in DB:', evaluationsData);

      alert(`Database Status:\n\nTemplate: ${templateData?.skills?.length || 0} skills\nUsers: ${usersData.length} users\nEvaluations: ${evaluationsData.length} evaluations\n\nCheck console for details.`);
    } catch (error) {
      console.error('❌ Error checking database:', error);
      alert('Fehler beim Abrufen der Datenbankdaten!');
    }
  };

  // Show project selector if no project selected
  if (!currentProject) {
    return (
      <ProjectSelector
        projects={projects}
        onSelectProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onUpdateProject={handleUpdateProject}
        onValidatePassword={handleValidatePassword}
      />
    );
  }

  // Template functions
  const addSkillToTemplate = () => {
    if (!newSkillName.trim()) return;

    const existingNames = new Set(template.skills.map(s => s.name.toLowerCase()));
    const seen = new Set<string>();

    // Split by line breaks and process each line
    const skillsToAdd: Skill[] = newSkillName
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0) // Remove empty lines
      .filter(name => {
        const lower = name.toLowerCase();
        if (existingNames.has(lower) || seen.has(lower)) return false;
        seen.add(lower);
        return true;
      })
      .map(name => ({ id: generateSkillId(), name }));

    if (skillsToAdd.length > 0) {
      setTemplate({
        ...template,
        skills: [...template.skills, ...skillsToAdd]
      });
      setNewSkillName('');
    }
  };

  const removeSkillFromTemplate = (skillId: string) => {
    const newTargetValues = { ...template.targetValues };
    delete newTargetValues[skillId];
    setTemplate({
      ...template,
      skills: template.skills.filter(s => s.id !== skillId),
      targetValues: Object.keys(newTargetValues).length > 0 ? newTargetValues : undefined
    });

    // Remove the skill from each user's disabledSkills
    setUsers(prevUsers => prevUsers.map(user => {
      if (!user.disabledSkills || !user.disabledSkills.includes(skillId)) return user;
      return { ...user, disabledSkills: user.disabledSkills.filter(id => id !== skillId) };
    }));

    // Remove the skill from each evaluation's skills map
    setEvaluations(prevEvaluations => prevEvaluations.map(evalItem => {
      if (!(skillId in evalItem.skills)) return evalItem;
      const { [skillId]: _removed, ...rest } = evalItem.skills;
      return { ...evalItem, skills: rest };
    }));
  };

  const updateSkillInTemplate = (skillId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Check duplicate by name (case-insensitive), excluding the skill being renamed
    const isDuplicate = template.skills.some(
      s => s.id !== skillId && s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) return;
    setTemplate({
      ...template,
      skills: template.skills.map(s => s.id === skillId ? { ...s, name: trimmed } : s),
    });
  };

  const moveSkill = (dragIndex: number, hoverIndex: number) => {
    const dragSkill = template.skills[dragIndex];
    const hoverSkill = template.skills[hoverIndex];
    setTemplate({
      ...template,
      skills: template.skills.map((skill, index) => {
        if (index === dragIndex) return hoverSkill;
        if (index === hoverIndex) return dragSkill;
        return skill;
      })
    });
  };

  const updateTargetValue = (skillId: string, value: number | undefined) => {
    setTemplate((prev: Template) => {
      const newTargetValues = { ...prev.targetValues };
      if (value === undefined) {
        delete newTargetValues[skillId];
      } else {
        newTargetValues[skillId] = value;
      }
      return {
        ...prev,
        targetValues: Object.keys(newTargetValues).length > 0 ? newTargetValues : undefined
      };
    });
  };

  // User functions
  const addUser = () => {
    lastLocalUpdateRef.current = Date.now();
    const userName = newUserName.trim() || `User ${users.length + 1}`;
    const newUser: User = {
      id: Date.now().toString(),
      name: userName,
      color: COLORS[users.length % COLORS.length],
      disabledSkills: [], // Initialize with no disabled skills
    };
    setUsers([...users, newUser]);
    setNewUserName('');
  };

  const removeUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
    setEvaluations(evaluations.filter(e => e.evaluatorId !== userId && e.evaluatedUserId !== userId));
  };

  const updateUserName = (userId: string, newName: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, name: newName } : u));
  };

  const toggleUserSkill = (userId: string, skillId: string) => {
    setUsers(users.map(user => {
      if (user.id !== userId) return user;

      const disabledSkills = user.disabledSkills || [];
      const isDisabled = disabledSkills.includes(skillId);

      return {
        ...user,
        disabledSkills: isDisabled
          ? disabledSkills.filter(id => id !== skillId)
          : [...disabledSkills, skillId]
      };
    }));
  };

  // Evaluation functions
  const getEvaluation = (evaluatorId: string, evaluatedUserId: string): Evaluation | undefined => {
    return evaluations.find(e => e.evaluatorId === evaluatorId && e.evaluatedUserId === evaluatedUserId);
  };

  const updateEvaluation = (evaluatorId: string, evaluatedUserId: string, skillId: string, value: number) => {
    // Mark user as interacting
    userInteractingRef.current = true;
    lastLocalUpdateRef.current = Date.now();

    // Clear existing timer
    if (interactionTimerRef.current) {
      window.clearTimeout(interactionTimerRef.current);
    }

    // Set timer to mark interaction as complete after 5 seconds of inactivity
    interactionTimerRef.current = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, 5000);

    const existingEval = getEvaluation(evaluatorId, evaluatedUserId);

    let updatedEvaluations: Evaluation[];

    if (existingEval) {
      updatedEvaluations = evaluations.map(e =>
        e.evaluatorId === evaluatorId && e.evaluatedUserId === evaluatedUserId
          ? { ...e, skills: { ...e.skills, [skillId]: value } }
          : e
      );
      setEvaluations(updatedEvaluations);
    } else {
      // Create new evaluation - only set the skill that was rated, leave others undefined
      const newEval: Evaluation = {
        evaluatorId,
        evaluatedUserId,
        skills: { [skillId]: value }
      };
      updatedEvaluations = [...evaluations, newEval];
      setEvaluations(updatedEvaluations);
    }
    
    // Auto-save disabled - using manual save button
    // if (currentProject && isOnline) {
    //   console.log('💾 Auto-saving evaluations after rating change...');
    //   apiCall(`/projects/${currentProject.id}/evaluations`, 'POST', updatedEvaluations)
    //     .then(() => {
    //       console.log('✅ Evaluations auto-saved successfully');
    //     })
    //     .catch((error) => {
    //       console.error('❌ Error auto-saving evaluations:', error);
    //     });
    // }
  };

  const isEvaluationComplete = (evaluatorId: string, evaluatedUserId: string): boolean => {
    const evaluation = getEvaluation(evaluatorId, evaluatedUserId);
    if (!evaluation) return false;

    // Get the evaluated user's disabled skills
    const evaluatedUser = users.find(u => u.id === evaluatedUserId);
    const disabledSkills = evaluatedUser?.disabledSkills || [];

    // Only check enabled skills (filter out disabled ones)
    const enabledSkills = template.skills.filter(skill => !disabledSkills.includes(skill.id));

    // Check if all enabled skills have a valid rating (defined and >= 0)
    return enabledSkills.length > 0 && enabledSkills.every(skill => {
      const rating = evaluation.skills[skill.id];
      return rating !== undefined && rating >= 0;
    });
  };

  // Reset evaluation for a specific person (from current evaluator)
  const resetEvaluationForPerson = (evaluatorId: string, evaluatedUserId: string) => {
    const evaluatedName = users.find(u => u.id === evaluatedUserId)?.name || 'Unbekannt';
    const hasEvaluation = evaluations.some(
      e => e.evaluatorId === evaluatorId && e.evaluatedUserId === evaluatedUserId
    );

    if (!hasEvaluation) {
      return;
    }

    if (confirm(`Möchtest du deine Evaluation für "${evaluatedName}" zurücksetzen?`)) {
      const updatedEvaluations = evaluations.filter(
        e => !(e.evaluatorId === evaluatorId && e.evaluatedUserId === evaluatedUserId)
      );
      setEvaluations(updatedEvaluations);
    }
  };

  // Display preferences derived from the template (DB-backed, project-wide).
  // Defaults match the previous local-only behaviour.
  const showSeparateEvaluation = template.displaySettings?.showSeparateEvaluation ?? true;
  const showIndividualEvaluations = template.displaySettings?.showIndividualEvaluations ?? false;

  const updateDisplaySetting = (patch: { showSeparateEvaluation?: boolean; showIndividualEvaluations?: boolean }) => {
    setTemplate(prev => ({
      ...prev,
      displaySettings: { ...(prev.displaySettings || {}), ...patch },
    }));
  };

  // Calculate average ratings for a user (keyed by skill ID)
  const calculateAverageRatings = (evaluatedUserId: string) => {
    const userEvaluations = evaluations.filter(e => e.evaluatedUserId === evaluatedUserId);

    if (userEvaluations.length === 0) return null;

    const averages: Record<string, number> = {};

    template.skills.forEach(skill => {
      const ratings = userEvaluations
        .map(e => e.skills[skill.id] ?? 0)
        .filter(rating => rating > 0); // Exclude 0 (abstain) from average

      if (ratings.length > 0) {
        averages[skill.id] = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      } else {
        averages[skill.id] = 0; // No valid ratings
      }
    });

    return averages;
  };

  // Calculate ratings separately for self-evaluation and others (keyed by skill ID)
  const calculateSeparateRatings = (evaluatedUserId: string) => {
    const selfEvaluation = evaluations.find(e => e.evaluatedUserId === evaluatedUserId && e.evaluatorId === evaluatedUserId);
    const otherEvaluations = evaluations.filter(e => e.evaluatedUserId === evaluatedUserId && e.evaluatorId !== evaluatedUserId);

    const selfRatings: Record<string, number> = {};
    const othersAverages: Record<string, number> = {};
    // Individual non-self ratings per skill (skip 0 / missing so the breakdown
    // only shows people who actually rated)
    const individualOtherRatings: Record<string, Array<{ evaluatorId: string; evaluatorName: string; color: string; rating: number }>> = {};

    template.skills.forEach(skill => {
      // Self rating
      if (selfEvaluation) {
        const rating = selfEvaluation.skills[skill.id];
        selfRatings[skill.id] = (rating !== undefined && rating > 0) ? rating : 0;
      }

      // Others average
      const otherRatings = otherEvaluations
        .map(e => e.skills[skill.id] ?? 0)
        .filter(rating => rating > 0);

      if (otherRatings.length > 0) {
        othersAverages[skill.id] = otherRatings.reduce((sum, rating) => sum + rating, 0) / otherRatings.length;
      } else {
        othersAverages[skill.id] = 0;
      }

      // Per-evaluator breakdown for this skill
      individualOtherRatings[skill.id] = otherEvaluations
        .map(e => {
          const rating = e.skills[skill.id];
          if (rating === undefined || rating <= 0) return null;
          const evaluator = users.find(u => u.id === e.evaluatorId);
          if (!evaluator) return null;
          return { evaluatorId: evaluator.id, evaluatorName: evaluator.name, color: evaluator.color, rating };
        })
        .filter((x): x is { evaluatorId: string; evaluatorName: string; color: string; rating: number } => x !== null);
    });

    return { selfRatings, othersAverages, individualOtherRatings, hasSelfEvaluation: !!selfEvaluation, hasOtherEvaluations: otherEvaluations.length > 0 };
  };

  // Prepare chart data for results
  const prepareResultsChartData = (evaluatedUserId: string, separateSelf: boolean = false) => {
    const user = users.find(u => u.id === evaluatedUserId);
    const disabledSkills = user?.disabledSkills || [];

    if (separateSelf) {
      // Separate self-evaluation from others
      const { selfRatings, othersAverages, individualOtherRatings } = calculateSeparateRatings(evaluatedUserId);

      return template.skills.map(skill => ({
        skill: skill.name,
        skillId: skill.id,
        selfEvaluation: Math.round(selfRatings[skill.id] || 0),
        othersAverage: Math.round(othersAverages[skill.id] || 0),
        individualOtherRatings: individualOtherRatings[skill.id] || [],
        isDisabled: disabledSkills.includes(skill.id),
        target: template.targetValues?.[skill.id]
      }));
    } else {
      // Combined average (original behavior)
      const averages = calculateAverageRatings(evaluatedUserId);
      if (!averages) return [];

      return template.skills.map(skill => ({
        skill: skill.name,
        skillId: skill.id,
        average: Math.round(averages[skill.id] || 0),
        isDisabled: disabledSkills.includes(skill.id),
        target: template.targetValues?.[skill.id]
      }));
    }
  };

  // Prepare global chart data with all users overlaid
  const prepareGlobalChartData = () => {
    // Start with the skill names and target values
    const chartData = template.skills.map(skill => ({
      skill: skill.name,
      skillId: skill.id,
      target: template.targetValues?.[skill.id]
    } as any));

    // Add each user's average as a separate key
    users.forEach(user => {
      const averages = calculateAverageRatings(user.id);
      if (averages) {
        chartData.forEach((dataPoint) => {
          dataPoint[user.name] = Math.round(averages[dataPoint.skillId] || 0);
        });
      }
    });

    return chartData;
  };

  // Export selected users as PDF
  const exportUserChartsToPDF = async () => {
    if (selectedUsersForExport.length === 0) {
      alert('Bitte wähle mindestens einen User zum Exportieren aus.');
      return;
    }

    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      for (let i = 0; i < selectedUsersForExport.length; i++) {
        const userId = selectedUsersForExport[i];
        const user = users.find(u => u.id === userId);
        if (!user) continue;

        // Find the chart element for this user
        const chartElement = document.getElementById(`chart-${userId}`);
        if (!chartElement) continue;

        // Capture the chart as canvas
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
        });

        // Add new page if not the first chart
        if (i > 0) {
          pdf.addPage();
        }

        // Add user name as title
        pdf.setFontSize(16);
        pdf.text(user.name, margin, margin + 5);

        // Calculate image dimensions to fit page
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const yPos = margin + 15;

        // Add image to PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);

        // Add evaluation count
        const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === userId).length;
        pdf.setFontSize(10);
        pdf.text(
          `${evaluatorCount} Evaluation${evaluatorCount !== 1 ? 'en' : ''}`,
          margin,
          yPos + imgHeight + 10
        );
      }

      // Save the PDF
      pdf.save('skill-gap-analyse.pdf');
      
      // Close export mode and clear selections after successful export
      setShowExportMode(false);
      setSelectedUsersForExport([]);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Fehler beim Exportieren der PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export global chart (all users overlay) as PDF
  const exportGlobalChartToPDF = async () => {
    setIsExporting(true);
    try {
      // Find the global chart element (just the SVG chart, not the whole container)
      const chartElement = document.getElementById('global-chart');
      if (!chartElement) {
        alert('Chart nicht gefunden.');
        setIsExporting(false);
        return;
      }

      // Capture the chart as canvas with ignoreElements to skip problematic CSS
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        onclone: (clonedDoc) => {
          // Convert any oklch colors to rgb in the cloned document
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const computedStyle = window.getComputedStyle(el as Element);
            const bgColor = computedStyle.backgroundColor;
            const color = computedStyle.color;
            if (bgColor.includes('oklch')) {
              (el as HTMLElement).style.backgroundColor = '#ffffff';
            }
            if (color.includes('oklch')) {
              (el as HTMLElement).style.color = '#000000';
            }
          });
        }
      });

      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for better chart display
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Add title
      pdf.setFontSize(18);
      pdf.text('Skill-Gap Analyse - Alle User', margin, margin + 5);

      // Add project name
      if (currentProject) {
        pdf.setFontSize(12);
        pdf.text(currentProject.name, margin, margin + 12);
      }

      // Add legend (user names with colors)
      let legendY = margin + 20;
      pdf.setFontSize(10);
      users.forEach((user, index) => {
        const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === user.id).length;
        // Draw colored circle
        pdf.setFillColor(user.color);
        pdf.circle(margin + 2, legendY + (index * 5), 1.5, 'F');
        // Draw user name
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${user.name} (${evaluatorCount} Evaluation${evaluatorCount !== 1 ? 'en' : ''})`, margin + 6, legendY + (index * 5) + 0.5);
      });

      // Calculate image dimensions to fit page
      const chartStartY = legendY + (users.length * 5) + 5;
      const availableHeight = pageHeight - chartStartY - margin;
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Scale down if too tall
      const finalHeight = Math.min(imgHeight, availableHeight);
      const finalWidth = (finalHeight === availableHeight)
        ? (canvas.width * availableHeight) / canvas.height
        : imgWidth;

      const xPos = (pageWidth - finalWidth) / 2; // Center horizontally

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xPos, chartStartY, finalWidth, finalHeight);

      // Save the PDF
      pdf.save('skill-gap-analyse-global.pdf');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Fehler beim Exportieren der PDF: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle user selection for export
  const toggleUserSelection = (userId: string) => {
    setSelectedUsersForExport(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select/deselect all users
  const toggleSelectAll = () => {
    if (selectedUsersForExport.length === users.length) {
      setSelectedUsersForExport([]);
    } else {
      setSelectedUsersForExport(users.map(u => u.id));
    }
  };

  // Export from Export Tab - uses offscreen charts, A4 landscape with centered charts
  const exportFromExportTab = async () => {
    if (selectedUsersForExport.length === 0 && !includeGlobalOverview) {
      alert('Bitte wähle mindestens einen Eintrag zum Exportieren aus.');
      return;
    }

    setIsExporting(true);
    try {
      // Create PDF in landscape A4 format
      const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape
      const pageWidth = pdf.internal.pageSize.getWidth();  // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 15;
      let isFirstPage = true;

      // Helper function to convert oklch colors
      const convertOklchColors = (clonedDoc: Document) => {
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const computedStyle = window.getComputedStyle(el as Element);
          const bgColor = computedStyle.backgroundColor;
          const color = computedStyle.color;
          if (bgColor.includes('oklch')) {
            (el as HTMLElement).style.backgroundColor = '#ffffff';
          }
          if (color.includes('oklch')) {
            (el as HTMLElement).style.color = '#000000';
          }
        });
      };

      // Helper function to capture chart and add to PDF (centered)
      const captureChartCentered = async (chartElement: HTMLElement, title: string, subtitle?: string) => {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          onclone: convertOklchColors
        });

        if (!isFirstPage) {
          pdf.addPage('l'); // Always landscape
        }
        isFirstPage = false;

        // Add title (centered)
        pdf.setFontSize(18);
        pdf.text(title, pageWidth / 2, margin + 5, { align: 'center' });

        // Add subtitle if provided (centered)
        let headerHeight = margin + 12;
        if (subtitle) {
          pdf.setFontSize(11);
          pdf.text(subtitle, pageWidth / 2, margin + 14, { align: 'center' });
          headerHeight = margin + 22;
        }

        // Calculate available space for chart
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - headerHeight - margin;

        // Calculate image dimensions to fit and maintain aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        const availableAspect = availableWidth / availableHeight;

        let finalWidth: number;
        let finalHeight: number;

        if (canvasAspect > availableAspect) {
          // Canvas is wider relative to available space - fit by width
          finalWidth = availableWidth;
          finalHeight = availableWidth / canvasAspect;
        } else {
          // Canvas is taller relative to available space - fit by height
          finalHeight = availableHeight;
          finalWidth = availableHeight * canvasAspect;
        }

        // Center the chart horizontally and vertically in available space
        const xPos = (pageWidth - finalWidth) / 2;
        const yPos = headerHeight + (availableHeight - finalHeight) / 2;

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight);
      };

      // Export individual user charts
      for (const userId of selectedUsersForExport) {
        const user = users.find(u => u.id === userId);
        if (!user) continue;

        const chartElement = document.getElementById(`offscreen-chart-${userId}`);
        if (!chartElement) {
          console.warn(`Chart element not found for user ${userId}`);
          continue;
        }

        const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === userId).length;
        await captureChartCentered(
          chartElement,
          user.name,
          `${evaluatorCount} Evaluation${evaluatorCount !== 1 ? 'en' : ''}`
        );
      }

      // Export global overview if selected
      if (includeGlobalOverview) {
        const globalChartElement = document.getElementById('offscreen-global-chart');
        if (globalChartElement) {
          if (!isFirstPage) {
            pdf.addPage('l');
          }
          isFirstPage = false;

          const canvas = await html2canvas(globalChartElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            onclone: convertOklchColors
          });

          // Add title (centered)
          pdf.setFontSize(18);
          pdf.text('Skill-Gap Analyse - Alle User', pageWidth / 2, margin + 5, { align: 'center' });

          // Add project name (centered)
          let headerHeight = margin + 12;
          if (currentProject) {
            pdf.setFontSize(12);
            pdf.text(currentProject.name, pageWidth / 2, margin + 14, { align: 'center' });
            headerHeight = margin + 22;
          }

          // Add legend (horizontally centered, multi-column if many users)
          const legendY = headerHeight + 5;
          pdf.setFontSize(9);
          const legendItemWidth = 60; // Width per legend item
          const maxItemsPerRow = Math.floor((pageWidth - margin * 2) / legendItemWidth);

          users.forEach((user, index) => {
            const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === user.id).length;
            const row = Math.floor(index / maxItemsPerRow);
            const col = index % maxItemsPerRow;

            // Calculate starting X to center the legend
            const itemsInThisRow = Math.min(maxItemsPerRow, users.length - row * maxItemsPerRow);
            const rowWidth = itemsInThisRow * legendItemWidth;
            const startX = (pageWidth - rowWidth) / 2;

            const xPos = startX + col * legendItemWidth;
            const yPos = legendY + row * 6;

            // Draw colored circle
            pdf.setFillColor(user.color);
            pdf.circle(xPos + 2, yPos, 1.5, 'F');
            // Draw user name
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${user.name} (${evaluatorCount})`, xPos + 6, yPos + 0.5);
          });

          // Calculate chart area
          const legendRows = Math.ceil(users.length / maxItemsPerRow);
          const chartStartY = legendY + (legendRows * 6) + 5;
          const availableWidth = pageWidth - (margin * 2);
          const availableHeight = pageHeight - chartStartY - margin;

          // Calculate image dimensions
          const canvasAspect = canvas.width / canvas.height;
          const availableAspect = availableWidth / availableHeight;

          let finalWidth: number;
          let finalHeight: number;

          if (canvasAspect > availableAspect) {
            finalWidth = availableWidth;
            finalHeight = availableWidth / canvasAspect;
          } else {
            finalHeight = availableHeight;
            finalWidth = availableHeight * canvasAspect;
          }

          // Center the chart
          const xPos = (pageWidth - finalWidth) / 2;
          const yPos = chartStartY + (availableHeight - finalHeight) / 2;

          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight);
        }
      }

      // Save the PDF
      pdf.save('skill-gap-analyse.pdf');

      // Clear selections after successful export
      setSelectedUsersForExport([]);
      setIncludeGlobalOverview(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Fehler beim Exportieren der PDF: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const currentEvaluator = users.find(u => u.id === currentEvaluatorId);
  const currentEvaluated = users.find(u => u.id === currentEvaluatedId);
  const currentEvaluation = currentEvaluatorId && currentEvaluatedId 
    ? getEvaluation(currentEvaluatorId, currentEvaluatedId)
    : undefined;

  return (
    <div className="size-full flex flex-col bg-gray-50">
      {/* Colorful Header Bar */}
      
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]">
        <div className="h-12 lg:h-[64px] flex items-center lg:items-end px-4 lg:px-0">
          {/* Left: Back button + Logo + Project name */}
          <div className="flex lg:w-[299px] h-full items-center gap-3 lg:gap-4 lg:px-6 shrink-0">
            <div className="flex flex-col gap-0.5 lg:gap-1 min-w-0">
              <button
                onClick={() => setCurrentProject(null)}
                title="Zurück zu Projekten"
                className="text-base lg:text-xl font-bold text-[#202020] leading-none truncate cursor-pointer hover:text-blue-600 transition text-left"
              >
                SkillGapper
              </button>
              <p className="text-xs lg:text-sm text-[#4a5565] leading-none truncate">{currentProject.name}</p>
            </div>
          </div>

          {/* Mobile: Tab Toggle Button */}
          <div className="lg:hidden flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition cursor-pointer ${
                isMobileMenuOpen ? 'bg-[#dbeafe] text-[#155dfc]' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {activeTab === 'evaluation' ? (
                <ClipboardList className="w-4 h-4" />
              ) : activeTab === 'results' ? (
                <BarChart3 className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {activeTab === 'evaluation' ? 'Evaluation' : activeTab === 'results' ? 'Ergebnisse' : 'Export'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Desktop: Tab Navigation - Browser-style tabs */}
          <div className="hidden lg:flex items-end gap-1 flex-1">
            <button
              onClick={() => setActiveTab('evaluation')}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition cursor-pointer border-l border-r border-t ${
                activeTab === 'evaluation'
                  ? 'bg-[#f9fafb] border-gray-200 shadow-[1px_0px_4px_0px_rgba(0,0,0,0.1)] text-[#155dfc]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="font-medium text-base">Evaluation</span>
              {users.length > 0 && (
                <div className={`h-5 rounded-full px-2 flex items-center justify-center ${
                  activeTab === 'evaluation' ? 'bg-[#dbeafe]' : 'bg-gray-200'
                }`}>
                  <span className={`font-medium leading-4 text-xs ${
                    activeTab === 'evaluation' ? 'text-[#155dfc]' : 'text-gray-600'
                  }`}>
                    {users.length}
                  </span>
                </div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition cursor-pointer border-l border-r border-t ${
                activeTab === 'results'
                  ? 'bg-[#f9fafb] border-gray-200 shadow-[1px_0px_4px_0px_rgba(0,0,0,0.1)] text-[#155dfc]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium text-base">Ergebnisse</span>
            </button>
          </div>

          {/* Desktop: Save Status */}
          <div className="hidden lg:flex items-center gap-2 text-sm px-6 h-full">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                Wird gespeichert...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Gespeichert
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-600">
                <X className="w-4 h-4" />
                Fehler beim Speichern
              </span>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden px-4 pb-4 space-y-2 border-t border-gray-200 pt-3 bg-white">
            <button
              onClick={() => {
                setActiveTab('evaluation');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition cursor-pointer ${
                activeTab === 'evaluation'
                  ? 'bg-[#dbeafe] text-[#155dfc]'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5" />
                <span className="font-medium">Evaluation</span>
              </div>
              {users.length > 0 && (
                <div className={`h-6 rounded-full px-2.5 flex items-center justify-center ${
                  activeTab === 'evaluation' ? 'bg-white' : 'bg-gray-200'
                }`}>
                  <span className={`font-medium text-sm ${
                    activeTab === 'evaluation' ? 'text-[#155dfc]' : 'text-gray-600'
                  }`}>
                    {users.length}
                  </span>
                </div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('results');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-[#dbeafe] text-[#155dfc]'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">Ergebnisse</span>
            </button>

            {/* Mobile Save Status */}
            {saveStatus !== 'idle' && (
              <div className="flex items-center justify-center gap-2 text-sm pt-2 pb-1">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-2 text-blue-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    Wird gespeichert...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Gespeichert
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-2 text-red-600">
                    <X className="w-4 h-4" />
                    Fehler beim Speichern
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'evaluation' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - Select Evaluator and Evaluated */}
          <div className={`w-full lg:w-[300px] bg-white flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 ${
            isEvaluationCenterCollapsed ? 'overflow-visible' : 'overflow-auto'
          }`}>
            <div className="p-4 lg:p-6">
              {/* Collapsible Header for Mobile */}
              <button
                onClick={() => setIsEvaluationCenterCollapsed(!isEvaluationCenterCollapsed)}
                className={`w-full flex items-center justify-between lg:mb-6 lg:pointer-events-none cursor-pointer lg:cursor-default ${
                  isEvaluationCenterCollapsed ? 'mb-0' : 'mb-4'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-lg lg:text-xl font-medium text-[#202020]">Evaluationszentrum</h2>
                </div>
                <div className="flex items-center gap-2 lg:hidden">
                  {isEvaluationCenterCollapsed && currentEvaluatorId && currentEvaluatedId && (
                    <span className="text-sm text-gray-500 truncate max-w-[150px]">
                      {currentEvaluator?.name} → {currentEvaluated?.name}
                    </span>
                  )}
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isEvaluationCenterCollapsed ? '' : 'rotate-180'}`} />
                </div>
              </button>

              {!isEvaluationCenterCollapsed && (
                users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Keine User konfiguriert. Gehe zu den Einstellungen, um User hinzuzufügen.</p>
                  </div>
                ) : (
                  <>
                    {/* Select Evaluator */}
                    {!currentEvaluatorId ? (
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Wer evaluiert?
                        </label>
                        <div className="space-y-2">
                          {users.map(user => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setCurrentEvaluatorId(user.id);
                                setCurrentEvaluatedId(null);
                              }}
                              className="w-full flex items-center gap-3 py-[10px] px-3 rounded-[8px] transition bg-gray-50 hover:bg-gray-100 border-2 border-transparent cursor-pointer"
                            >
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: user.color }}
                              />
                              <span className="font-medium">{user.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Evaluator*in
                        </label>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border-2 border-blue-500">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: currentEvaluator?.color }}
                          />
                          <span className="font-medium flex-1">{currentEvaluator?.name}</span>
                          <button
                            onClick={() => {
                              setCurrentEvaluatorId(null);
                              setCurrentEvaluatedId(null);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                          >
                            Ändern
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Select Who to Evaluate */}
                    {currentEvaluatorId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Person zum Evaluieren auswählen:
                        </label>
                        <div className="space-y-2">
                          {users.map(user => {
                            const hasEvaluation = evaluations.some(
                              e => e.evaluatorId === currentEvaluatorId && e.evaluatedUserId === user.id
                            );
                            const isComplete = isEvaluationComplete(currentEvaluatorId, user.id);
                            const isSelected = currentEvaluatedId === user.id;
                            return (
                              <div
                                key={user.id}
                                className={`group w-full flex items-center gap-3 py-[10px] px-3 rounded-[8px] transition ${
                                  isSelected
                                    ? 'bg-green-50 border-2 border-green-500'
                                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                }`}
                              >
                                <button
                                  onClick={() => setCurrentEvaluatedId(user.id)}
                                  className="flex items-center gap-3 flex-1 cursor-pointer"
                                >
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: user.color }}
                                  />
                                  <span className="flex-1 text-left font-medium">{user.name}</span>
                                </button>
                                {hasEvaluation && (
                                  <div className="relative ml-2 flex items-center">
                                    {isComplete && (
                                      <CheckCircle2
                                        className="w-5 h-5 text-green-600 group-hover:opacity-0 transition-opacity"
                                        aria-label="Alle Skills evaluiert"
                                      />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resetEvaluationForPerson(currentEvaluatorId, user.id);
                                      }}
                                      className={`text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isComplete ? 'absolute right-0' : ''}`}
                                      title="Evaluation zurücksetzen"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Reset
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mobile Settings Button - Inside collapsible */}
                    <div className="lg:hidden mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-[8px] hover:bg-gray-200 transition text-sm cursor-pointer w-full justify-center"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Einstellungen</span>
                      </button>
                    </div>
                  </>
                )
              )}
            </div>

            {/* Settings Button - Desktop only (always visible at bottom) */}
            <div className="hidden lg:block p-4 lg:p-6 border-t border-gray-200 mt-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-[8px] hover:bg-gray-200 transition text-sm cursor-pointer w-full justify-center"
              >
                <Settings className="w-4 h-4" />
                <span>Einstellungen</span>
              </button>
            </div>
          </div>

          {/* Right Panel - Evaluation Form */}
          <div className="flex-1 flex flex-col bg-gray-50">
            <div className="flex-1 overflow-auto p-4 lg:p-8">
            {!currentEvaluatorId ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                <Users className="w-12 h-12 lg:w-16 lg:h-16 mb-4 opacity-50" />
                <p className="text-lg lg:text-xl">Wähle, wer evaluiert</p>
              </div>
            ) : !currentEvaluatedId ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                <BarChart3 className="w-12 h-12 lg:w-16 lg:h-16 mb-4 opacity-50" />
                <p className="text-lg lg:text-xl">Wähle eine Person zum Evaluieren</p>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-0 lg:px-4">
                <div className="bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] p-4 lg:p-6 mb-3 lg:mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs lg:text-sm text-[#565656]">Evaluator*in:</p>
                      <p className="text-sm lg:text-base font-medium" style={{ color: currentEvaluator?.color }}>
                        {currentEvaluator?.name}
                      </p>
                    </div>
                    <div className="text-xl lg:text-2xl">→</div>
                    <div>
                      <p className="text-xs lg:text-sm text-[#565656]">Evaluiert:</p>
                      <p className="text-sm lg:text-base font-medium" style={{ color: currentEvaluated?.color }}>
                        {currentEvaluated?.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 lg:space-y-4">
                  {template.skills.map((skill) => {
                    const isDisabled = currentEvaluated?.disabledSkills?.includes(skill.id) || false;
                    const value = currentEvaluation?.skills[skill.id] ?? 0;
                    return (
                      <div key={skill.id} className={`bg-white p-4 lg:p-6 rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] ${isDisabled ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between mb-3">
                          <label className={`font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
                            {skill.name}
                            {isDisabled}
                          </label>
                          {!isDisabled && (
                            <span className="text-xl font-bold" style={{ color: currentEvaluated?.color }}>
                              {value}
                            </span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="1"
                          value={value}
                          onChange={(e) => updateEvaluation(
                            currentEvaluatorId,
                            currentEvaluatedId,
                            skill.id,
                            parseInt(e.target.value)
                          )}
                          disabled={isDisabled}
                          className={`w-full h-2 bg-gray-200 rounded-lg appearance-none ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{ accentColor: isDisabled ? '#9CA3AF' : currentEvaluated?.color }}
                        />
                        {!isDisabled && (
                          <div className="hidden lg:flex justify-between text-xs text-gray-500 mt-2">
                            <span>Weiss nicht</span>
                            {(template.ratingLevels || DEFAULT_RATING_LEVELS).map((rl: RatingLevel) => (
                              <span key={rl.level}>{rl.level} - {rl.title}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
            {/* Save Button - Floating centered */}
            {currentEvaluatorId && currentEvaluatedId && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:left-[calc(50%+200px)]">
                <button
                  onClick={saveCurrentEvaluation}
                  disabled={evaluationSaveStatus === 'saving'}
                  className={`flex items-center justify-center gap-2 px-6 py-3 text-white rounded-full transition disabled:cursor-not-allowed font-medium shadow-xl cursor-pointer ${
                    evaluationSaveStatus === 'saved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
                  }`}
                >
                  {evaluationSaveStatus === 'saving' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Speichert...
                    </>
                  ) : evaluationSaveStatus === 'saved' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Gespeichert!
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Evaluation speichern
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - View Selector (same width / look as the Evaluation panel) */}
          <div className="w-full lg:w-[300px] bg-white flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 overflow-auto">
            <div className="p-4 lg:p-6">
              <h2 className="text-lg lg:text-xl font-medium text-[#202020] mb-4 lg:mb-6">Ansicht</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setResultsView('individual')}
                  className={`w-full flex items-center gap-3 py-[10px] px-3 rounded-[8px] transition cursor-pointer border ${
                    resultsView === 'individual'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 flex-shrink-0 ${resultsView === 'individual' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium text-left flex-1">Einzelne User</span>
                </button>
                <button
                  onClick={() => setResultsView('global')}
                  className={`w-full flex items-center gap-3 py-[10px] px-3 rounded-[8px] transition cursor-pointer border ${
                    resultsView === 'global'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                  }`}
                >
                  <Users className={`w-4 h-4 flex-shrink-0 ${resultsView === 'global' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium text-left flex-1">Globale Übersicht</span>
                </button>
              </div>
            </div>

            {/* Export Button — bottom of panel (Desktop only, same slot as Einstellungen) */}
            <div className="hidden lg:block p-4 lg:p-6 border-t border-gray-200 mt-auto">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-[8px] hover:bg-blue-700 transition text-sm cursor-pointer w-full justify-center font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-8 bg-gray-50">
            <div className="max-w-full mx-auto px-0 lg:px-4">
              <h2 className="text-xl lg:text-2xl font-medium mb-6">Evaluationsergebnisse</h2>

            {/* Select All Checkbox (only in export mode) */}
            {showExportMode && resultsView === 'individual' && users.length > 0 && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="select-all-users"
                  checked={selectedUsersForExport.length === users.length && users.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="select-all-users" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Alle User auswählen ({users.length})
                </label>
              </div>
            )}

            {users.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">Noch keine User konfiguriert</p>
                </div>
              </div>
            ) : resultsView === 'individual' ? (
              <>
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">{users.map(user => {
                const { hasSelfEvaluation, hasOtherEvaluations } = calculateSeparateRatings(user.id);
                // Only render in separate mode if at least one side has data; otherwise fall back to combined
                const isSeparate = showSeparateEvaluation && (hasSelfEvaluation || hasOtherEvaluations);
                const chartData = prepareResultsChartData(user.id, isSeparate);
                const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === user.id).length;

                return (
                  <div key={user.id} className="bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {showExportMode && (
                          <input
                            type="checkbox"
                            checked={selectedUsersForExport.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        )}
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        <h3 className="text-xl font-medium">{user.name}</h3>
                      </div>
                      <span className="text-sm text-[#565656]">
                        {evaluatorCount} Evaluation{evaluatorCount !== 1 ? 'en' : ''}
                      </span>
                    </div>

                    {chartData.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>Noch keine Evaluationen</p>
                      </div>
                    ) : (
                      <div id={`chart-${user.id}`} className="h-[300px] lg:h-[650px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={chartData} margin={{ top: window.innerWidth < 1024 ? -10 : 10, right: window.innerWidth < 1024 ? 60 : 120, bottom: window.innerWidth < 1024 ? -10 : 10, left: window.innerWidth < 1024 ? 60 : 120 }}>
                            <PolarGrid />
                            <PolarAngleAxis
                              dataKey="skill"
                              tick={(props) => {
                                const { x, y, payload, index } = props;
                                const dataPoint = chartData.find(d => d.skill === payload.value);
                                const isDisabled = dataPoint?.isDisabled || false;
                                
                                // Calculate angle for this point
                                const RADIAN = Math.PI / 180;
                                const total = chartData.length;
                                const angle = 90 - (360 / total) * index;
                                const isMobile = window.innerWidth < 1024;
                                const radius = isMobile ? 10 : 15; // Smaller offset on mobile
                                
                                // Calculate offset based on angle
                                const offsetX = Math.cos(-angle * RADIAN) * radius;
                                const offsetY = Math.sin(-angle * RADIAN) * radius;
                                
                                // Normalize angle to 0-360 range
                                let normalizedAngle = angle % 360;
                                if (normalizedAngle < 0) normalizedAngle += 360;
                                
                                // Determine text anchor based on which side of the chart
                                let textAnchor = 'middle';
                                if (normalizedAngle > 90 && normalizedAngle < 270) {
                                  // Left side of chart - align right
                                  textAnchor = 'end';
                                } else if ((normalizedAngle >= 0 && normalizedAngle < 90) || (normalizedAngle >= 270 && normalizedAngle < 360)) {
                                  // Right side of chart - align left
                                  textAnchor = 'start';
                                }
                                // Top and bottom stay 'middle'
                                  
                                return (
                                  <text
                                    x={x + offsetX}
                                    y={y + offsetY}
                                    textAnchor={textAnchor}
                                    fill={isDisabled ? '#D1D5DB' : '#374151'}
                                    fontSize={isMobile ? 11 : 13}
                                    dominantBaseline="middle"
                                  >
                                    {payload.value}
                                  </text>
                                );
                              }}
                            />
                            <PolarRadiusAxis
                              angle={90}
                              domain={[0, 5]}
                              ticks={[0, 1, 2, 3, 4, 5]}
                              tick={{ fill: '#6B7280', fontSize: window.innerWidth < 1024 ? 11 : 13 }}
                            />
                            {/* Radar lines based on toggle state. Each Radar renders a
                                transparent hit-zone circle (dot prop) at each vertex so
                                overlapping polygons don't swallow hover events. */}
                            {isSeparate ? (
                              <>
                                {/* Self-evaluation line — always blue, hoverable */}
                                {hasSelfEvaluation && (
                                  <Radar
                                    name="Selbstevaluation"
                                    dataKey="selfEvaluation"
                                    stroke="#3B82F6"
                                    fill="#3B82F6"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                    onMouseEnter={() => setHoveredRadarName('Selbstevaluation')}
                                    onMouseLeave={() => setHoveredRadarName(null)}
                                    dot={(props: { cx?: number; cy?: number; index?: number }) => (
                                      <circle
                                        key={props.index}
                                        cx={props.cx}
                                        cy={props.cy}
                                        r={10}
                                        fill="transparent"
                                        style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredRadarName('Selbstevaluation')}
                                        onMouseLeave={() => setHoveredRadarName(null)}
                                      />
                                    )}
                                    activeDot={{ r: 4, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2, style: { pointerEvents: 'none' } }}
                                  />
                                )}
                                {/* Others average line — always green, hoverable */}
                                {hasOtherEvaluations && (
                                  <Radar
                                    name="Fremdevaluation"
                                    dataKey="othersAverage"
                                    stroke="#10B981"
                                    fill="#10B981"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                    onMouseEnter={() => setHoveredRadarName('Fremdevaluation')}
                                    onMouseLeave={() => setHoveredRadarName(null)}
                                    dot={(props: { cx?: number; cy?: number; index?: number }) => (
                                      <circle
                                        key={props.index}
                                        cx={props.cx}
                                        cy={props.cy}
                                        r={10}
                                        fill="transparent"
                                        style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredRadarName('Fremdevaluation')}
                                        onMouseLeave={() => setHoveredRadarName(null)}
                                      />
                                    )}
                                    activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2, style: { pointerEvents: 'none' } }}
                                  />
                                )}
                              </>
                            ) : (
                              <Radar
                                name={user.name}
                                dataKey="average"
                                stroke={user.color}
                                fill={user.color}
                                fillOpacity={0.3}
                                strokeWidth={2}
                                isAnimationActive={false}
                                onMouseEnter={() => setHoveredRadarName(user.name)}
                                onMouseLeave={() => setHoveredRadarName(null)}
                                dot={(props: { cx?: number; cy?: number; index?: number }) => (
                                  <circle
                                    key={props.index}
                                    cx={props.cx}
                                    cy={props.cy}
                                    r={10}
                                    fill="transparent"
                                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredRadarName(user.name)}
                                    onMouseLeave={() => setHoveredRadarName(null)}
                                  />
                                )}
                                activeDot={{ r: 4, fill: user.color, stroke: '#fff', strokeWidth: 2, style: { pointerEvents: 'none' } }}
                              />
                            )}
                            {/* Target value line - only show if any target values are set.
                                Zielwert has no hover interaction by design — it's a
                                reference line, no tooltip needed. */}
                            {chartData.some(d => d.target !== undefined) && (
                              <Radar
                                name="Zielwert"
                                dataKey="target"
                                stroke="#EF4444"
                                fill="transparent"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                                dot={false}
                                activeDot={false}
                              />
                            )}
                            <Tooltip
                              content={(props) => {
                                const { active, payload } = props;
                                if (!active || !payload?.length || !hoveredRadarName) return null;
                                const data = payload[0].payload;
                                if (data.isDisabled) {
                                  return (
                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                                      <p className="font-medium text-gray-400">{data.skill}</p>
                                      <p className="text-sm text-gray-500">Deaktiviert</p>
                                    </div>
                                  );
                                }
                                const entry = payload.find(p => p.name === hoveredRadarName);
                                if (!entry) return null;
                                // When hovering Selbst or Fremd and both lines share the same
                                // value at this skill (so the vertices overlap), merge them.
                                const isSelbstOrFremd = hoveredRadarName === 'Selbstevaluation' || hoveredRadarName === 'Fremdevaluation';
                                const selfVal = data.selfEvaluation;
                                const otherVal = data.othersAverage;
                                const showBreakdown = showIndividualEvaluations;
                                const breakdown: Array<{ evaluatorName: string; color: string; rating: number }> = data.individualOtherRatings || [];
                                const isMerged = isSelbstOrFremd && hasSelfEvaluation && hasOtherEvaluations && selfVal === otherVal && selfVal > 0;
                                if (isMerged) {
                                  return (
                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                                      <p className="font-medium">{data.skill}</p>
                                      <p className="text-sm font-medium mt-1 text-gray-700">
                                        Selbst- &amp; Fremdevaluation: {selfVal}
                                      </p>
                                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3B82F6' }} />Selbst</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} />Fremd (Ø)</span>
                                      </div>
                                      {showBreakdown && (
                                        breakdown.length === 0 ? (
                                          <p className="text-xs text-gray-500 mt-2">Noch keine Fremdevaluationen</p>
                                        ) : (
                                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                                            {breakdown.map((b, i) => (
                                              <div key={i} className="flex items-center gap-2 text-xs">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                                                <span className="text-gray-700">{b.evaluatorName}:</span>
                                                <span className="font-medium">{b.rating}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  );
                                }
                                // Per-evaluator breakdown for Fremdevaluation (non-merged)
                                if (hoveredRadarName === 'Fremdevaluation' && showBreakdown) {
                                  return (
                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                                      <p className="font-medium">{data.skill}</p>
                                      <p className="text-sm font-medium mt-1" style={{ color: entry.color }}>
                                        Fremdevaluation (Ø {entry.value})
                                      </p>
                                      {breakdown.length === 0 ? (
                                        <p className="text-xs text-gray-500 mt-1">Noch keine Fremdevaluationen</p>
                                      ) : (
                                        <div className="mt-1 space-y-0.5">
                                          {breakdown.map((b, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                                              <span className="text-gray-700">{b.evaluatorName}:</span>
                                              <span className="font-medium">{b.rating}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                                    <p className="font-medium">{data.skill}</p>
                                    <p className="text-sm" style={{ color: entry.color }}>
                                      {entry.name}: {entry.value}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Legend when separate mode is active */}
                    {isSeparate && chartData.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
                        {hasSelfEvaluation && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3B82F6' }} />
                            <span>Selbstevaluation</span>
                          </div>
                        )}
                        {hasOtherEvaluations && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }} />
                            <span>Fremdevaluation (Durchschnitt)</span>
                          </div>
                        )}
                        {chartData.some(d => d.target !== undefined) && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-1 border-t-2 border-dashed border-red-500" />
                            <span>Zielwert</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              
              </>
            ) : (
              // Global View - All users overlaid on one chart
              <div className="bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-medium">Alle User</h3>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {users.map(user => {
                      const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === user.id).length;
                      return (
                        <div key={user.id} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: user.color }}
                          />
                          <span className="text-sm font-medium">{user.name}</span>
                          <span className="text-xs text-gray-500">
                            ({evaluatorCount} {evaluatorCount !== 1 ? 'Evaluationen' : 'Evaluation'})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div id="global-chart" className="h-[300px] lg:h-[650px]" style={{ backgroundColor: '#ffffff' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={prepareGlobalChartData()} margin={{ top: window.innerWidth < 1024 ? -10 : 10, right: window.innerWidth < 1024 ? 60 : 120, bottom: window.innerWidth < 1024 ? -10 : 10, left: window.innerWidth < 1024 ? 60 : 120 }}>
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="skill"
                        tick={(props) => {
                          const { x, y, payload, index } = props;
                          
                          // Calculate angle for this point
                          const RADIAN = Math.PI / 180;
                          const total = template.skills.length;
                          const angle = 90 - (360 / total) * index;
                          const isMobile = window.innerWidth < 1024;
                          const radius = isMobile ? 10 : 15; // Smaller offset on mobile
                          
                          // Calculate offset based on angle
                          const offsetX = Math.cos(-angle * RADIAN) * radius;
                          const offsetY = Math.sin(-angle * RADIAN) * radius;
                          
                          // Normalize angle to 0-360 range
                          let normalizedAngle = angle % 360;
                          if (normalizedAngle < 0) normalizedAngle += 360;
                          
                          // Determine text anchor based on which side of the chart
                          let textAnchor = 'middle';
                          if (normalizedAngle > 90 && normalizedAngle < 270) {
                            // Left side of chart - align right
                            textAnchor = 'end';
                          } else if ((normalizedAngle >= 0 && normalizedAngle < 90) || (normalizedAngle >= 270 && normalizedAngle < 360)) {
                            // Right side of chart - align left
                            textAnchor = 'start';
                          }
                          // Top and bottom stay 'middle'
                            
                          return (
                            <text
                              x={x + offsetX}
                              y={y + offsetY}
                              textAnchor={textAnchor}
                              fill="#374151"
                              fontSize={isMobile ? 11 : 13}
                              dominantBaseline="middle"
                            >
                              {payload.value}
                            </text>
                          );
                        }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        tick={{ fill: '#6B7280', fontSize: window.innerWidth < 1024 ? 11 : 13 }}
                      />
                      {users.map(user => {
                        const averages = calculateAverageRatings(user.id);
                        if (!averages) return null;

                        return (
                          <Radar
                            key={user.id}
                            name={user.name}
                            dataKey={user.name}
                            stroke={user.color}
                            fill={user.color}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            isAnimationActive={false}
                            onMouseEnter={() => setHoveredRadarName(user.name)}
                            onMouseLeave={() => setHoveredRadarName(null)}
                            dot={(props: { cx?: number; cy?: number; index?: number }) => (
                              <circle
                                key={props.index}
                                cx={props.cx}
                                cy={props.cy}
                                r={10}
                                fill="transparent"
                                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredRadarName(user.name)}
                                onMouseLeave={() => setHoveredRadarName(null)}
                              />
                            )}
                            activeDot={{ r: 4, fill: user.color, stroke: '#fff', strokeWidth: 2, style: { pointerEvents: 'none' } }}
                          />
                        );
                      })}
                      {/* Target value line - reference only, no hover interaction */}
                      {prepareGlobalChartData().some(d => d.target !== undefined) && (
                        <Radar
                          name="Zielwert"
                          dataKey="target"
                          stroke="#EF4444"
                          fill="transparent"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          isAnimationActive={false}
                          style={{ pointerEvents: 'none' }}
                          dot={false}
                          activeDot={false}
                        />
                      )}
                      <Tooltip
                        content={(props) => {
                          const { active, payload } = props;
                          if (!active || !payload?.length || !hoveredRadarName) return null;
                          const entry = payload.find(p => p.name === hoveredRadarName);
                          if (!entry) return null;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                              <p className="font-medium mb-2">{payload[0].payload.skill}</p>
                              <div className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{entry.name}:</span>
                                <span className="font-medium">{entry.value}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Skills Ranking Section - Separate from chart */}
            {resultsView === 'global' && users.length > 0 && evaluations.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] p-6">
                <h3 className="text-xl font-medium mb-4">Skill-Ranking</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Diese Rangliste zeigt alle Skills sortiert nach dem durchschnittlichen Team-Level. Sie hilft dir, Stärken und Entwicklungsbereiche im Team zu identifizieren.
                </p>
                
                <div className="space-y-3">
                  {(() => {
                    // Calculate average rating for each skill across all users
                    const skillAverages = template.skills.map(skill => {
                      let totalRating = 0;
                      let count = 0;

                      users.forEach(user => {
                        // Skip if skill is disabled for this user
                        if (user.disabledSkills?.includes(skill.id)) return;

                        const userEvaluations = evaluations.filter(e => e.evaluatedUserId === user.id);
                        userEvaluations.forEach(evaluation => {
                          const rating = evaluation.skills[skill.id];
                          if (rating !== undefined && rating > 0) { // Exclude 0 (abstain) from average
                            totalRating += rating;
                            count++;
                          }
                        });
                      });

                      const average = count > 0 ? totalRating / count : 0;
                      return {
                        skillId: skill.id,
                        skillName: skill.name,
                        average,
                        count,
                        roundedAverage: Math.round(average)
                      };
                    });
                    
                    // Sort by average (highest to lowest)
                    const sortedSkills = skillAverages.sort((a, b) => b.average - a.average);
                    
                    // Function to get level label
                    const getLevelLabel = (level: number) => {
                      if (level === 0) return 'Weiss nicht';
                      const ratingLevels = template.ratingLevels || DEFAULT_RATING_LEVELS;
                      const ratingLevel = ratingLevels.find((rl: RatingLevel) => rl.level === level);
                      return ratingLevel?.title || '';
                    };
                    
                    // Function to get color based on level
                    const getLevelColor = (level: number) => {
                      if (level >= 4.5) return '#10B981'; // Green - Expert/Specialist
                      if (level >= 3.5) return '#3B82F6'; // Blue - Advanced
                      if (level >= 2.5) return '#F59E0B'; // Orange - Intermediate
                      return '#EF4444'; // Red - Beginner
                    };
                    
                    return sortedSkills.map((item, index) => (
                      <div
                        key={item.skillId}
                        className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors p-3 lg:pt-[16px] lg:pr-[24px] lg:pb-[16px] lg:pl-[16px]"
                      >
                        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                          {/* Rank */}
                          <div className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-full bg-white font-bold text-xs lg:text-sm" style={{
                            color: getLevelColor(item.average),
                            border: `2px solid ${getLevelColor(item.average)}`
                          }}>
                            {index + 1}
                          </div>

                          {/* Skill Name */}
                          <div className="flex-1 min-w-0 lg:w-48 lg:flex-shrink-0">
                            <h4 className="font-medium text-gray-900 truncate">{item.skillName}</h4>
                            <p className="text-xs text-gray-500 truncate">
                              {item.count} Evaluation{item.count !== 1 ? 'en' : ''}
                            </p>
                          </div>
                          
                          {/* Average Score - Mobile (shown on right) */}
                          <div className="flex-shrink-0 flex flex-col items-end lg:hidden whitespace-nowrap">
                            <div className="font-bold text-base" style={{ color: getLevelColor(item.average) }}>
                              {item.average.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-600">
                              {getLevelLabel(item.roundedAverage)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Visual Bar */}
                        <div className="flex-1 lg:w-64 lg:flex-shrink-0 flex items-center lg:ml-auto lg:mr-6">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full transition-all" 
                              style={{ 
                                width: `${(item.average / 5) * 100}%`,
                                backgroundColor: getLevelColor(item.average)
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Average Score - Desktop */}
                        <div className="hidden lg:flex w-20 flex-shrink-0 flex-col items-end">
                          <div className="font-bold text-lg" style={{ color: getLevelColor(item.average) }}>
                            {item.average.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-600">
                            {getLevelLabel(item.roundedAverage)}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal — opened from the Ergebnisse panel's Export button */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 lg:p-4" onClick={() => setShowExportModal(false)}>
          <div
            className="bg-white rounded-none lg:rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] w-full h-full lg:max-w-2xl lg:w-full lg:max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 lg:p-6 border-b border-[#ddd]">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">PDF Export</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-[8px] hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 lg:p-6">
              <p className="text-gray-600 mb-6">
                Wähle aus, welche Charts du exportieren möchtest.
              </p>

              {/* Select All */}
              <div className="border-b border-gray-200 pb-4 mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUsersForExport.length === users.length && includeGlobalOverview}
                    onChange={() => {
                      const allSelected = selectedUsersForExport.length === users.length && includeGlobalOverview;
                      if (allSelected) {
                        setSelectedUsersForExport([]);
                        setIncludeGlobalOverview(false);
                      } else {
                        setSelectedUsersForExport(users.map(u => u.id));
                        setIncludeGlobalOverview(true);
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-medium">Alles auswählen</span>
                </label>
              </div>

              {/* Global Overview Option */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Übersicht</h3>
                <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGlobalOverview}
                    onChange={() => setIncludeGlobalOverview(!includeGlobalOverview)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Globale Übersicht (alle User)</span>
                  </div>
                </label>
              </div>

              {/* Individual Users */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Einzelne User ({users.length})</h3>
                <div className="space-y-2">
                  {users.map(user => {
                    const evaluatorCount = evaluations.filter(e => e.evaluatedUserId === user.id).length;
                    const isSelected = selectedUsersForExport.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer border ${
                          isSelected ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedUsersForExport(prev => prev.filter(id => id !== user.id));
                            } else {
                              setSelectedUsersForExport(prev => [...prev, user.id]);
                            }
                          }}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: user.color }}
                        />
                        <span className="font-medium flex-1">{user.name}</span>
                        <span className="text-sm text-gray-500">
                          {evaluatorCount} {evaluatorCount !== 1 ? 'Evaluationen' : 'Evaluation'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer / Export Button */}
            <div className="p-4 lg:p-6 border-t border-[#ddd]">
              <button
                onClick={async () => {
                  await exportFromExportTab();
                  if (!isExporting) setShowExportModal(false);
                }}
                disabled={isExporting || (selectedUsersForExport.length === 0 && !includeGlobalOverview)}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition cursor-pointer ${
                  isExporting || (selectedUsersForExport.length === 0 && !includeGlobalOverview)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Download className="w-5 h-5" />
                {isExporting ? 'Exportiere...' : `PDF exportieren (${selectedUsersForExport.length + (includeGlobalOverview ? 1 : 0)} ${selectedUsersForExport.length + (includeGlobalOverview ? 1 : 0) === 1 ? 'Seite' : 'Seiten'})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <DndProvider backend={HTML5Backend}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 lg:p-4">
            <div className="bg-white rounded-none lg:rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] w-full h-full lg:max-w-6xl lg:w-full lg:max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 lg:p-6 border-b border-[#ddd]">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Template-Setup</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-[8px] hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4 lg:p-6">
                <div className="grid grid-cols-1 gap-6 lg:gap-8">
                  {/* Skills Section */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                        <div>
                          <h3 className="text-lg font-medium mb-2 lg:mb-4">Kompetenzen-Konfiguration</h3>
                          <p className="text-sm text-gray-600">
                            Füge die Kompetenzen hizu die evaluiert werden sollen.
                          </p>
                        </div>
                        {template.skills.length > 0 && (
                          <button
                            onClick={() => {
                              if (confirm('Möchtest du wirklich alle Kompetenzen löschen?')) {
                                setTemplate({ skills: [] });
                              }
                            }}
                            className="text-sm text-red-600 hover:text-red-700 underline whitespace-nowrap self-start cursor-pointer"
                          >
                            Alle löschen
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                      <textarea
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            addSkillToTemplate();
                          }
                        }}
                        placeholder="Neue Kompetenzen (eine pro Zeile)..."
                        className="flex-1 px-4 py-3 border border-[#ddd] rounded-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-y min-h-[48px]"
                      />
                      <button
                        onClick={addSkillToTemplate}
                        className="bg-[#eee] relative rounded-[8px] overflow-clip w-full sm:w-auto cursor-pointer"
                      >
                        <div className="flex gap-2 items-center justify-center px-[16px] py-[10px]">
                          <Plus className="w-4 h-4" />
                          <span className="font-normal text-[16px] text-black tracking-[0.14px] leading-[20px]">Hinzufügen</span>
                        </div>
                        <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.05)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {template.skills.map((skill, index) => (
                        <DraggableSkillItem
                          key={skill.id}
                          skill={skill}
                          index={index}
                          targetValue={template.targetValues?.[skill.id]}
                          moveSkill={moveSkill}
                          updateSkillInTemplate={updateSkillInTemplate}
                          removeSkillFromTemplate={removeSkillFromTemplate}
                          updateTargetValue={updateTargetValue}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Users Section */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2 lg:mb-4">Userverwaltung</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Füge User hinzu, die evaluieren und evaluiert werden.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addUser()}
                        placeholder="Neuer Username..."
                        className="flex-1 px-4 py-3 border border-[#ddd] rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                      <button
                        onClick={addUser}
                        className="bg-[#eee] relative rounded-[8px] overflow-clip w-full sm:w-auto cursor-pointer"
                      >
                        <div className="flex gap-2 items-center justify-center px-[16px] py-[10px]">
                          <Plus className="w-4 h-4" />
                          <span className="font-normal text-[16px] text-black tracking-[0.14px] leading-[20px]">Hinzufügen</span>
                        </div>
                        <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.05)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {users.map((user) => {
                        const isExpanded = expandedUserId === user.id;
                        const disabledSkills = user.disabledSkills || [];
                        const disabledCount = disabledSkills.length;
                        
                        return (
                          <div
                            key={user.id}
                            className="bg-white border border-[#ddd] rounded-lg overflow-hidden hover:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] transition"
                          >
                            {/* User Header */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-4">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                                <input
                                  type="color"
                                  value={user.color}
                                  onChange={(e) => {
                                    const newUsers = users.map(u =>
                                      u.id === user.id ? { ...u, color: e.target.value } : u
                                    );
                                    setUsers(newUsers);
                                  }}
                                  className="w-10 h-10 cursor-pointer rounded-full overflow-hidden flex-shrink-0"
                                  style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', border: 'none', padding: 0 }}
                                />
                                <input
                                  type="text"
                                  value={user.name}
                                  onChange={(e) => updateUserName(user.id, e.target.value)}
                                  className="flex-1 px-4 py-2 bg-white border border-[#ddd] rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
                                />
                              </div>
                              <div className="flex items-center gap-2 justify-end sm:justify-start">
                                <button
                                  onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                  className="px-3 py-[10px] text-sm text-[#565656] hover:bg-gray-100 rounded-[8px] transition flex items-center gap-1 flex-1 sm:flex-initial justify-start cursor-pointer"
                                  title="Kompetenzen verwalten"
                                >
                                  <Settings className="w-4 h-4" />
                                  <span className="sm:hidden">Kompetenzen</span>
                                  {disabledCount > 0 && (
                                    <span className="text-xs bg-orange-500 text-white px-1.5 rounded-full">{disabledCount}</span>
                                  )}
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                <button
                                  onClick={() => removeUser(user.id)}
                                  className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-[8px] cursor-pointer"
                                  title="User entfernen"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Expandable Skills List */}
                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-[#ddd] pt-4">
                                <p className="text-xs text-[#565656] mb-3 font-medium">
                                  Deaktivierte Kompetenzen werden ausgegraut und können nicht evaluiert werden:
                                </p>
                                <div className="space-y-2">
                                  {template.skills.map((skill) => {
                                    const isDisabled = disabledSkills.includes(skill.id);
                                    return (
                                      <label
                                        key={skill.id}
                                        className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition border ${
                                          isDisabled ? 'bg-gray-100 border-gray-200' : 'bg-white border-[#ddd] hover:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)]'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!isDisabled}
                                          onChange={() => toggleUserSkill(user.id, skill.id)}
                                          className="w-4 h-4 rounded"
                                        />
                                        <span className={`text-sm ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                          {skill.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Display Options Section */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2 lg:mb-4">Anzeige-Optionen</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Einstellungen für die Darstellung der Ergebnisse.
                      </p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => updateDisplaySetting({ showSeparateEvaluation: !showSeparateEvaluation })}
                        aria-pressed={showSeparateEvaluation}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${showSeparateEvaluation ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSeparateEvaluation ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-sm">
                        <span className="font-medium block">Selbst- und Fremdevaluation separat anzeigen</span>
                        <span className="text-gray-600">Selbsteinschätzung (blau) und gemittelte Fremdeinschätzung (grün) als zwei getrennte Polygone darstellen. Aus: alle Evaluationen werden gemittelt.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => updateDisplaySetting({ showIndividualEvaluations: !showIndividualEvaluations })}
                        aria-pressed={showIndividualEvaluations}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${showIndividualEvaluations ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showIndividualEvaluations ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-sm">
                        <span className="font-medium block">Fremdevaluation aufschlüsseln</span>
                        <span className="text-gray-600">Im Ergebnis-Chart-Tooltip die einzelnen Evaluationen jeder Person anzeigen, nicht nur den Durchschnitt.</span>
                      </span>
                    </label>
                  </div>

                  {/* Rating Levels Section */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div>
                        <h3 className="text-lg font-medium mb-2 lg:mb-4">Evaluationsstufen</h3>
                        <p className="text-sm text-gray-600">
                          Passe die Titel und Beschreibungen der Evaluationsstufen an.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Möchtest du die Evaluationsstufen auf die Standardwerte zurücksetzen?')) {
                            setTemplate((prev: Template) => ({ ...prev, ratingLevels: [...DEFAULT_RATING_LEVELS] }));
                          }
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 underline whitespace-nowrap self-start cursor-pointer"
                      >
                        Auf Standard zurücksetzen
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(template.ratingLevels || DEFAULT_RATING_LEVELS).map((ratingLevel: RatingLevel, index: number) => (
                        <div
                          key={ratingLevel.level}
                          className="bg-white border border-[#ddd] rounded-lg p-4 hover:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] transition"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {ratingLevel.level}
                            </div>
                            <input
                              type="text"
                              value={ratingLevel.title}
                              onChange={(e) => {
                                const newRatingLevels = [...(template.ratingLevels || DEFAULT_RATING_LEVELS)];
                                newRatingLevels[index] = { ...newRatingLevels[index], title: e.target.value };
                                setTemplate((prev: Template) => ({ ...prev, ratingLevels: newRatingLevels }));
                              }}
                              className="flex-1 px-4 py-2 border border-[#ddd] rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                              placeholder="Titel der Stufe..."
                            />
                          </div>
                          <textarea
                            value={ratingLevel.description}
                            onChange={(e) => {
                              const newRatingLevels = [...(template.ratingLevels || DEFAULT_RATING_LEVELS)];
                              newRatingLevels[index] = { ...newRatingLevels[index], description: e.target.value };
                              setTemplate((prev: Template) => ({ ...prev, ratingLevels: newRatingLevels }));
                              // Auto-resize
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            className="w-full px-4 py-3 border border-[#ddd] rounded-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none overflow-hidden"
                            placeholder="Beschreibung der Stufe..."
                            style={{ minHeight: '80px' }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = Math.max(80, el.scrollHeight) + 'px';
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 lg:p-6 border-t border-[#ddd] flex flex-col sm:flex-row justify-end gap-2 lg:gap-3">
                <button
                  onClick={manualSave}
                  disabled={saveStatus === 'saving'}
                  className={`text-white relative rounded-[8px] overflow-clip order-2 sm:order-1 cursor-pointer transition-colors ${
                    saveStatus === 'saved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
                  }`}
                >
                  <div className="flex gap-2 items-center justify-center px-[20px] py-[10px]">
                    {saveStatus === 'saving' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="font-normal text-[16px] tracking-[0.14px] leading-[20px]">Speichern...</span>
                      </>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-normal text-[16px] tracking-[0.14px] leading-[20px]">Gespeichert!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <span className="font-normal text-[16px] tracking-[0.14px] leading-[20px]">Speichern</span>
                      </>
                    )}
                  </div>
                  <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.05)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="bg-[#eee] relative rounded-[8px] overflow-clip order-1 sm:order-2 cursor-pointer"
                >
                  <div className="flex gap-2 items-center justify-center px-[20px] py-[10px]">
                    <span className="font-normal text-[16px] text-black tracking-[0.14px] leading-[20px]">Fertig</span>
                  </div>
                  <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.05)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                </button>
              </div>
            </div>
          </div>
        </DndProvider>
      )}

      {/* Offscreen Charts Container - Always rendered but invisible, used for PDF export */}
      <div className="fixed -left-[9999px] top-0" style={{ width: '800px' }} aria-hidden="true">
        {/* Individual User Charts */}
        {users.map(user => {
          const chartData = prepareResultsChartData(user.id);
          return (
            <div key={user.id} id={`offscreen-chart-${user.id}`} className="bg-white p-4" style={{ width: '800px', height: '600px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} margin={{ top: 60, right: 100, bottom: 60, left: 100 }}>
                  <PolarGrid />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={(props) => {
                      const { x, y, payload, index } = props;
                      const dataPoint = chartData.find(d => d.skill === payload.value);
                      const isDisabled = dataPoint?.isDisabled || false;

                      const RADIAN = Math.PI / 180;
                      const total = chartData.length;
                      const angle = 90 - (360 / total) * index;
                      const radius = 15;

                      const offsetX = Math.cos(-angle * RADIAN) * radius;
                      const offsetY = Math.sin(-angle * RADIAN) * radius;

                      let normalizedAngle = angle % 360;
                      if (normalizedAngle < 0) normalizedAngle += 360;

                      let textAnchor = 'middle';
                      if (normalizedAngle > 90 && normalizedAngle < 270) {
                        textAnchor = 'end';
                      } else if ((normalizedAngle >= 0 && normalizedAngle < 90) || (normalizedAngle >= 270 && normalizedAngle < 360)) {
                        textAnchor = 'start';
                      }

                      return (
                        <text
                          x={x + offsetX}
                          y={y + offsetY}
                          textAnchor={textAnchor}
                          fill={isDisabled ? '#D1D5DB' : '#374151'}
                          fontSize={13}
                          dominantBaseline="middle"
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tick={{ fill: '#6B7280', fontSize: 13 }}
                  />
                  <Radar
                    name={user.name}
                    dataKey="average"
                    stroke={user.color}
                    fill={user.color}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  {chartData.some(d => d.target !== undefined) && (
                    <Radar
                      name="Zielwert"
                      dataKey="target"
                      stroke="#EF4444"
                      fill="transparent"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          );
        })}

        {/* Global Chart */}
        <div id="offscreen-global-chart" className="bg-white p-4" style={{ width: '1000px', height: '700px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={prepareGlobalChartData()} margin={{ top: 80, right: 120, bottom: 80, left: 120 }}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="skill"
                tick={(props) => {
                  const { x, y, payload, index } = props;

                  const RADIAN = Math.PI / 180;
                  const total = template.skills.length;
                  const angle = 90 - (360 / total) * index;
                  const radius = 15;

                  const offsetX = Math.cos(-angle * RADIAN) * radius;
                  const offsetY = Math.sin(-angle * RADIAN) * radius;

                  let normalizedAngle = angle % 360;
                  if (normalizedAngle < 0) normalizedAngle += 360;

                  let textAnchor = 'middle';
                  if (normalizedAngle > 90 && normalizedAngle < 270) {
                    textAnchor = 'end';
                  } else if ((normalizedAngle >= 0 && normalizedAngle < 90) || (normalizedAngle >= 270 && normalizedAngle < 360)) {
                    textAnchor = 'start';
                  }

                  return (
                    <text
                      x={x + offsetX}
                      y={y + offsetY}
                      textAnchor={textAnchor}
                      fill="#374151"
                      fontSize={13}
                      dominantBaseline="middle"
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fill: '#6B7280', fontSize: 13 }}
              />
              {users.map((user) => (
                <Radar
                  key={user.id}
                  name={user.name}
                  dataKey={user.name}
                  stroke={user.color}
                  fill={user.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
              {template.targetValues && Object.keys(template.targetValues).length > 0 && (
                <Radar
                  name="Zielwert"
                  dataKey="target"
                  stroke="#EF4444"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Floating Legend Button */}
      <button
        onClick={() => setShowLegend(!showLegend)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition z-40 flex items-center gap-2 p-[12px] p-[8px] cursor-pointer"
        title="Evaluationsstufen anzeigen"
      >
        <Info className="w-6 h-6" />
      </button>

      {/* Legend Overlay */}
      {showLegend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLegend(false)}>
          <div className="bg-white rounded-lg shadow-[0px_0px_2px_0px_rgba(0,0,0,0.16),0px_4px_8px_0px_rgba(0,0,0,0.08)] max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-[#ddd]">
              <h2 className="text-2xl font-bold text-gray-900">Evaluationsstufen</h2>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-[8px] hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {(template.ratingLevels || DEFAULT_RATING_LEVELS).map((ratingLevel: RatingLevel) => (
                <div key={ratingLevel.level} className="space-y-1">
                  <h3 className="text-lg font-medium text-gray-900">{ratingLevel.level}. {ratingLevel.title}</h3>
                  <p className="text-gray-700">
                    {ratingLevel.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}