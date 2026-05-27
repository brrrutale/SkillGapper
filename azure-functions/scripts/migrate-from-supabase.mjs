/**
 * Einmaliges Migrations-Script: Supabase → Azure Cosmos.
 *
 * Lädt alle Projekte (mit Template, Users, Evaluations) aus Supabase
 * und legt pro Projekt ein denormalisiertes Dokument in Cosmos an
 * (via die produktive Azure Function API).
 *
 * Aufruf:
 *   node scripts/migrate-from-supabase.mjs
 *
 * Erwartet folgende Env-Variablen (oder setzt sinnvolle Defaults):
 *   AZURE_API_BASE     = https://skillgapper-api.azurewebsites.net
 *   AZURE_FUNCTION_KEY = (function key)
 *   AZURE_TEAM_ID      = default
 *   SUPABASE_PROJECT   = alvhsueycgtaowparqyk
 *   SUPABASE_ANON_KEY  = (kompletter anon key)
 */

const AZURE_BASE = process.env.AZURE_API_BASE || 'https://skillgapper-api.azurewebsites.net';
const AZURE_KEY  = process.env.AZURE_FUNCTION_KEY || '';
const TEAM_ID    = process.env.AZURE_TEAM_ID || 'default';

const SB_PROJECT = process.env.SUPABASE_PROJECT || 'alvhsueycgtaowparqyk';
const SB_KEY     = process.env.SUPABASE_ANON_KEY || '';

if (!AZURE_KEY) {
    console.error('AZURE_FUNCTION_KEY env required');
    process.exit(1);
}
if (!SB_KEY) {
    console.error('SUPABASE_ANON_KEY env required');
    process.exit(1);
}

const SB_BASE = `https://${SB_PROJECT}.supabase.co/rest/v1`;
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function sbGet(path) {
    const res = await fetch(`${SB_BASE}/${path}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
    return res.json();
}

async function azurePost(path, body) {
    const url = new URL(`${AZURE_BASE}/api/${path}`);
    url.searchParams.set('code', AZURE_KEY);
    url.searchParams.set('teamId', TEAM_ID);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Azure ${path}: ${res.status} ${txt}`);
    }
    return res.json();
}

async function azurePut(path, body) {
    const url = new URL(`${AZURE_BASE}/api/${path}`);
    url.searchParams.set('code', AZURE_KEY);
    url.searchParams.set('teamId', TEAM_ID);
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Azure PUT ${path}: ${res.status} ${txt}`);
    }
    return res.json();
}

async function main() {
    console.log('Reading from Supabase…');
    const [projects, templates, users, evaluations] = await Promise.all([
        sbGet('projects?select=id,name,password,created_at'),
        sbGet('templates?select=*'),
        sbGet('users?select=*'),
        sbGet('evaluations?select=*'),
    ]);

    console.log(`  projects:     ${projects.length}`);
    console.log(`  templates:    ${templates.length}`);
    console.log(`  users:        ${users.length}`);
    console.log(`  evaluations:  ${evaluations.length}`);

    // Index helpers
    const tplByProject  = new Map(templates.map(t => [t.project_id, t]));
    const usersByProject = new Map();
    for (const u of users) {
        if (!usersByProject.has(u.project_id)) usersByProject.set(u.project_id, []);
        usersByProject.get(u.project_id).push(u);
    }
    const evalsByProject = new Map();
    for (const e of evaluations) {
        if (!evalsByProject.has(e.project_id)) evalsByProject.set(e.project_id, []);
        evalsByProject.get(e.project_id).push(e);
    }

    let ok = 0, skipped = 0, failed = 0;
    for (const p of projects) {
        try {
            const tpl = tplByProject.get(p.id);
            const projUsers = (usersByProject.get(p.id) || [])
                .sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999))
                .map(u => ({
                    id: u.id,
                    name: u.name,
                    color: u.color,
                    disabledSkills: u.disabled_skills || [],
                    order: u.order_index ?? 0,
                }));
            const projEvals = (evalsByProject.get(p.id) || []).map(e => ({
                evaluatorId: e.evaluator_id,
                evaluatedUserId: e.evaluated_user_id,
                skills: e.skills || {},
            }));

            // 1) anlegen — name/password
            try {
                await azurePost('projects', {
                    id: p.id,
                    name: p.name,
                    password: p.password || null,
                });
            } catch (e) {
                if (e.message.includes('409')) {
                    console.log(`  ↺ ${p.name} already in Cosmos, updating…`);
                } else throw e;
            }

            // 2) komplettes Dok per PUT setzen (überschreibt template/users/evaluations)
            await azurePut(`projects/${p.id}`, {
                name: p.name,
                password: p.password || null,
                template: tpl ? {
                    skills: tpl.skills || [],
                    targetValues: tpl.target_values || undefined,
                    ratingLevels: tpl.rating_levels || undefined,
                } : { skills: [] },
                users: projUsers,
                evaluations: projEvals,
            });
            console.log(`  ✓ ${p.name}  (${projUsers.length} users, ${projEvals.length} evals)`);
            ok++;
        } catch (e) {
            console.error(`  ✗ ${p.name} (${p.id}): ${e.message}`);
            failed++;
        }
    }

    console.log(`\nDone — ok=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
