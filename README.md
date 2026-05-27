# SkillGapper

Skill-Gap-Analyse Tool mit Spider-Chart Visualisierung. Mehrere Personen evaluieren sich gegenseitig auf einem konfigurierbaren Set von Skills; die Ergebnisse werden als Radar-Chart und Rankings dargestellt.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, Recharts (Charts), jsPDF (Export)
- **Backend:** Wahlweise PHP (JSON-Dateien, siehe `api/`) oder Supabase (siehe `supabase/`)
- **Auswahl:** in [src/lib/dataProvider/config.ts](src/lib/dataProvider/config.ts)

## Setup

```bash
npm install
npm run dev      # Dev-Server (Vite) — proxiet /api/* nach localhost:8888 (MAMP)
npm run build    # Produktions-Build nach dist/
```

### Backend-Konfiguration

`src/lib/dataProvider/config.ts` schaltet zwischen PHP und Supabase um. Per Default ist Supabase aktiv. Für lokales PHP brauchst du MAMP (oder PHPs eingebauten Server) und einen schreibbaren `data/projects/` Ordner.

### Supabase Setup

Schema und Setup-Anleitung: [supabase/SETUP.md](supabase/SETUP.md), [supabase/schema.sql](supabase/schema.sql).

## Deployment

Der Build erzeugt `dist/`. Inhalt nach Webroot kopieren (PHP-Backend braucht zusätzlich `api/` und `data/`):

```bash
npm run build
cp -R dist/* /path/to/webroot/
cp -R api data /path/to/webroot/
```

Der `<base>`-Tag in `index.html` wird per Inline-Script dynamisch gesetzt, sodass die App auch in Unterverzeichnissen läuft.

## Projektstruktur

```
src/
  app/               React Components (App.tsx ist der Haupt-Container)
  lib/dataProvider/  PHP / Supabase Provider mit gemeinsamen Types
api/                 PHP REST API (JSON-Dateien)
supabase/            Schema + Setup-Doku
data/projects/       Lokaler PHP-Datenspeicher (ignoriert in git)
```
