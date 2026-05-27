-- SkillGapper Supabase Database Schema
-- Führe dieses SQL im Supabase SQL Editor aus

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABELLEN
-- =============================================

-- Projects Tabelle
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  password TEXT, -- Optional, NULL = kein Passwort
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates Tabelle (1:1 Beziehung zu Project)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_values JSONB DEFAULT '{}'::jsonb,
  rating_levels JSONB DEFAULT NULL,
  -- Project-wide UI preferences (showSeparateEvaluation, showIndividualEvaluations, ...)
  display_settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing installs: add display_settings to an older templates table.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS display_settings JSONB DEFAULT '{}'::jsonb;

-- Users Tabelle (User innerhalb eines Projekts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  disabled_skills JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluations Tabelle
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evaluated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ein Bewerter kann jeden User nur einmal bewerten
  UNIQUE(project_id, evaluator_id, evaluated_user_id)
);

-- =============================================
-- INDIZES für bessere Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_templates_project_id ON templates(project_id);
CREATE INDEX IF NOT EXISTS idx_users_project_id ON users(project_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_project_id ON evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id ON evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_user_id ON evaluations(evaluated_user_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- RLS aktivieren
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Policies für anonymen Zugriff (anon key)
-- Jeder kann alle Projekte sehen und erstellen

-- Projects: Lesen (ohne Passwort), Erstellen, Löschen
CREATE POLICY "Allow public read projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert projects" ON projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete projects" ON projects
  FOR DELETE USING (true);

CREATE POLICY "Allow public update projects" ON projects
  FOR UPDATE USING (true);

-- Templates: Voller Zugriff
CREATE POLICY "Allow public read templates" ON templates
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert templates" ON templates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update templates" ON templates
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete templates" ON templates
  FOR DELETE USING (true);

-- Users: Voller Zugriff
CREATE POLICY "Allow public read users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update users" ON users
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete users" ON users
  FOR DELETE USING (true);

-- Evaluations: Voller Zugriff
CREATE POLICY "Allow public read evaluations" ON evaluations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert evaluations" ON evaluations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update evaluations" ON evaluations
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete evaluations" ON evaluations
  FOR DELETE USING (true);

-- =============================================
-- HILFSFUNKTIONEN
-- =============================================

-- Funktion zum Validieren eines Projekt-Passworts
CREATE OR REPLACE FUNCTION validate_project_password(p_project_id UUID, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_password TEXT;
BEGIN
  SELECT password INTO stored_password FROM projects WHERE id = p_project_id;

  IF stored_password IS NULL THEN
    -- Kein Passwort gesetzt = immer gültig
    RETURN true;
  END IF;

  RETURN stored_password = p_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VIEW für Projekte (ohne Passwort, mit hasPassword Flag)
-- =============================================

CREATE OR REPLACE VIEW projects_public AS
SELECT
  id,
  name,
  created_at,
  (password IS NOT NULL) AS has_password
FROM projects;

-- Grant access to the view
GRANT SELECT ON projects_public TO anon;
GRANT SELECT ON projects_public TO authenticated;
