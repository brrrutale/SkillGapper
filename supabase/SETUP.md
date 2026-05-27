# SkillGapper - Supabase Setup Anleitung

## 1. Supabase Projekt erstellen (falls noch nicht vorhanden)

1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle ein neues Projekt oder verwende ein bestehendes

## 2. Datenbank-Schema einrichten

1. Öffne dein Supabase Projekt
2. Gehe zu **SQL Editor** (linke Sidebar)
3. Klicke auf **New query**
4. Kopiere den gesamten Inhalt von `schema.sql` in den Editor
5. Klicke auf **Run** (oder Ctrl+Enter)

Das Script erstellt:
- 4 Tabellen: `projects`, `templates`, `users`, `evaluations`
- Indizes für bessere Performance
- Row Level Security (RLS) Policies für öffentlichen Zugriff
- Eine Hilfsfunktion für Passwort-Validierung
- Ein öffentliches View ohne Passwörter

## 3. API-Schlüssel holen

1. Gehe zu **Settings** (Zahnrad-Icon)
2. Klicke auf **API** in der linken Sidebar
3. Kopiere:
   - **Project URL**: `https://xxxxx.supabase.co` (nur die ID `xxxxx`)
   - **anon public** Key (unter "Project API keys")

## 4. Konfiguration anpassen

Öffne `src/lib/dataProvider/config.ts` und trage deine Werte ein:

```typescript
export const config: BackendConfig = {
  provider: 'supabase',
  projectId: 'deine-project-id',    // z.B. 'abcdefghijklmnop'
  anonKey: 'dein-anon-public-key',  // Der lange String aus dem Dashboard
};
```

## 5. App starten

```bash
npm install
npm run dev
```

Die App verbindet sich jetzt mit Supabase statt dem PHP-Backend.

---

## Datenbank-Struktur

### projects
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primärschlüssel (auto-generiert) |
| name | TEXT | Projektname |
| password | TEXT | Optionales Passwort (NULL = kein Schutz) |
| created_at | TIMESTAMPTZ | Erstellungsdatum |

### templates
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primärschlüssel |
| project_id | UUID | Fremdschlüssel zu projects |
| skills | JSONB | Array von Skill-Namen |
| target_values | JSONB | Zielwerte pro Skill |
| rating_levels | JSONB | Userdefinierte Bewertungsstufen |

### users
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primärschlüssel |
| project_id | UUID | Fremdschlüssel zu projects |
| name | TEXT | Username |
| color | TEXT | Farbe für Charts (Hex) |
| disabled_skills | JSONB | Deaktivierte Skills für diesen User |

### evaluations
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primärschlüssel |
| project_id | UUID | Fremdschlüssel zu projects |
| evaluator_id | UUID | Wer bewertet |
| evaluated_user_id | UUID | Wer wird bewertet |
| skills | JSONB | Bewertungen {skill: note} |

---

## Zurück zu PHP wechseln

Um wieder das PHP-Backend zu verwenden, ändere `config.ts`:

```typescript
export const config: BackendConfig = {
  provider: 'php',
  baseUrl: getBasePath(),
};
```

---

## Troubleshooting

### "Failed to fetch" Fehler
- Überprüfe ob `projectId` und `anonKey` korrekt sind
- Stelle sicher, dass RLS Policies aktiv sind

### Keine Daten sichtbar
- Überprüfe im Supabase Dashboard unter **Table Editor** ob Daten vorhanden sind
- Prüfe die Browser-Konsole auf Fehlermeldungen

### CORS Fehler
- Supabase erlaubt standardmässig alle Origins
- Falls Problem besteht: **Settings** → **API** → **CORS** überprüfen
