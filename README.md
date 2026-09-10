# SkillGapper

Skill-Gap-Analyse Tool mit Spider-Chart Visualisierung. Mehrere Personen evaluieren sich gegenseitig auf einem konfigurierbaren Set von Skills; die Ergebnisse werden als Radar-Chart und Rankings dargestellt.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, Recharts (Charts), jsPDF (Export)
- **Backend:** Azure Functions v4 (Node ESM) + Cosmos DB (NoSQL, free tier)
- **Schema:** Ein denormalisiertes Dokument pro Projekt (`template + users + evaluations`)
- **Auth:** Azure-Functions-Function-Key (`?code=...`) — kein User-Login

## Setup (Frontend)

```bash
npm install
npm run dev      # Vite Dev-Server auf http://localhost:8765
npm run build    # Produktions-Build → dist/
```

Das Frontend erkennt automatisch ob es auf `localhost` läuft → benutzt die lokale Azure-Functions Instanz (`http://localhost:7072`), sonst die produktive Function-App `skillgapper-api` in Azure.

## Setup (Backend, lokal)

```bash
cd azure-functions
cp local.settings.json.example local.settings.json
# COSMOS_CONNECTION_STRING aus Azure Portal → Cosmos `pricetagger` → Keys einfügen
npm install
npm start        # http://localhost:7072
```

Voraussetzungen:
- Node ≥ 20 (lokal); Azure Functions laufen auf Node 22
- `func` (Azure Functions Core Tools): `brew tap azure/functions && brew install azure-functions-core-tools@4`
- `az` (Azure CLI) + `az login` (Migros-Tenant) — nur wenn du Cloud-Resourcen änderst

## Cloud-Architektur

| Resource             | Name                    | Region            | Resource Group |
| -------------------- | ----------------------- | ----------------- | -------------- |
| Cosmos DB Account    | `pricetagger`           | Switzerland North | Creation       |
| Cosmos Database      | `skillgapper`           | (shared account)  | Creation       |
| Cosmos Container     | `projects`              | Partition `/TeamId` | Creation     |
| Function App         | `skillgapper-api`       | West Europe       | Creation       |
| App Service Plan     | `WestEuropePlan`        | (Y1 Consumption, shared mit vdlTags) | Creation |
| Storage Account      | `pricetaggerstore`      | Switzerland North | Creation       |

Die Cosmos-Account ist im **Free Tier** (1000 RU/s + 25 GB shared). vdlTags und SkillGapper teilen sich die 1000 RU/s (je 400 RU/s manual). Function App auf Consumption-Plan → erste 1M Calls/Monat gratis.

## Deployment

Push auf `main` oder `develop` triggert die GitHub Action [`.github/workflows/deploy-functions.yml`](.github/workflows/deploy-functions.yml) sobald `azure-functions/**` sich ändert. Sie deployed automatisch zu `skillgapper-api`.

Frontend deployst du wie du willst (statisches Hosting). Der `<base>`-Tag in `index.html` wird per Inline-Script dynamisch gesetzt, sodass die App auch in Unterverzeichnissen läuft.

## Projektstruktur

```
src/                     React Frontend (Vite)
  app/                   Components (App.tsx Haupt-Container)
  lib/dataProvider/      Azure-Provider + gemeinsame Types
azure-functions/         Backend (Node 22, Functions v4, Cosmos SDK)
  src/index.js           HTTP-Endpoints (projects CRUD, password validate)
  src/lib/               cosmos.js + http.js Helper
  scripts/               Migrations-Skripte
.github/workflows/       CI/CD
```

## Datenmodell (Cosmos)

Ein Dokument pro Projekt:

```jsonc
{
  "id":         "<projectId>",
  "TeamId":     "<teamId>",          // Partition Key
  "name":       "UX Team 2026",
  "password":   null,                 // oder string
  "template": {
    "skills":          [{ "id": "skill_...", "name": "Kommunikation" }],
    "targetValues":    { "skill_...": 4 },
    "ratingLevels":    [{ "level": 1, "title": "...", "description": "..." }],
    "displaySettings": { "showSeparateEvaluation": true, "showIndividualEvaluations": false }
  },
  "users":       [{ "id": "...", "name": "...", "color": "#3B82F6", "disabledSkills": [], "order": 0 }],
  "evaluations": [{ "evaluatorId": "...", "evaluatedUserId": "...", "skills": { "skill_...": 4 } }],
  "createdAt": 1779875764355,
  "updatedAt": 1779875764355
}
```

## Migration (einmalig)

Daten von Supabase nach Cosmos:

```bash
cd azure-functions
AZURE_FUNCTION_KEY=... SUPABASE_ANON_KEY=... node scripts/migrate-from-supabase.mjs
```

Lief schon durch — die Supabase-Instanz ist als Backup intakt aber wird vom Frontend nicht mehr angesprochen.
