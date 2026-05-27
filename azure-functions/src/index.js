/**
 * index.js — Entry-Point fuer alle SkillGapper HTTP-Functions.
 *
 * Datenmodell (1 Dokument pro Projekt):
 *   {
 *     id: "<projectId>",
 *     TeamId: "<teamId>",           — Partition Key Path /TeamId
 *     name: string,
 *     password: string | null,
 *     template: { skills, targetValues, ratingLevels, displaySettings },
 *     users: [ { id, name, color, disabledSkills, orderIndex } ],
 *     evaluations: [ { evaluatorId, evaluatedUserId, skills: { [skillId]: rating } } ],
 *     createdAt: number,            — Unix-ms
 *     updatedAt: number
 *   }
 *
 * Endpoints:
 *   GET    /api/projects                            → Meta-Liste (id, name, hasPassword, createdAt)
 *   POST   /api/projects                            → Neues Projekt anlegen
 *   GET    /api/projects/{id}                       → Volles Projekt-Dokument
 *   PUT    /api/projects/{id}                       → Update (template / users / evaluations)
 *   DELETE /api/projects/{id}                       → Loeschen
 *   POST   /api/projects/{id}/validate-password     → Passwort pruefen
 *
 * Auth: Azure-Functions Function-Key (?code= oder x-functions-key). Reicht
 * fuer den Prototyp / internen Tool-Zugriff.
 */

import { app } from '@azure/functions';
import { getContainer } from './lib/cosmos.js';
import { jsonResponse, emptyResponse, preflightResponse, readTeamId } from './lib/http.js';

function newProjectId() {
    // Kurze 16-stellige Hex-ID — kompatibel mit der bisherigen PHP-Implementation,
    // die dieselbe Form benutzt (siehe data/projects/* IDs).
    return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

function projectMeta(doc) {
    return {
        id: doc.id,
        name: doc.name,
        hasPassword: doc.password != null && doc.password !== '',
        createdAt: doc.createdAt || doc._ts * 1000
    };
}

// ── /projects — GET (list) + POST (create) ─────────────────────────────────
// Azure Functions v4 erlaubt nur EINE Function-Declaration pro Route,
// darum kombinieren wir beide HTTP-Methoden in einem Handler.
app.http('projectsRoot', {
    methods: ['GET', 'POST', 'OPTIONS'],
    route: 'projects',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return preflightResponse(request);
        const container = getContainer();
        try {
            if (request.method === 'GET') {
                const teamId = await readTeamId(request);
                // Nur Meta-Felder selecten — die vollen Doks koennen mehrere KB
                // gross sein.
                const querySpec = {
                    query: 'SELECT c.id, c.name, c.password, c.createdAt, c._ts FROM c WHERE c.TeamId = @teamId',
                    parameters: [{ name: '@teamId', value: teamId }]
                };
                const { resources } = await container.items.query(querySpec, { partitionKey: teamId }).fetchAll();
                const projects = resources
                    .map(projectMeta)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                return jsonResponse(request, 200, { projects });
            }

            if (request.method === 'POST') {
                const body = await request.json();
                if (!body || !body.name) return jsonResponse(request, 400, { error: 'name required' });
                const teamId = body.teamId || await readTeamId(request);
                const id = body.id || newProjectId();
                const doc = {
                    id,
                    TeamId: teamId,
                    name: String(body.name),
                    password: body.password || null,
                    template: body.template || { skills: [] },
                    users: body.users || [],
                    evaluations: body.evaluations || [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                const { resource } = await container.items.create(doc);
                return jsonResponse(request, 201, projectMeta(resource));
            }

            return jsonResponse(request, 405, { error: 'method not allowed' });
        } catch (e) {
            if (e.code === 409) return jsonResponse(request, 409, { error: 'project id already exists' });
            context.error('projectsRoot ' + request.method + ':', e.message);
            return jsonResponse(request, 500, { error: e.message });
        }
    }
});

// ── projects/{id} — GET / PUT / DELETE ─────────────────────────────────────
app.http('projectById', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    route: 'projects/{id}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return preflightResponse(request);
        const id = request.params.id;
        const container = getContainer();
        try {
            const teamId = await readTeamId(request);

            if (request.method === 'GET') {
                const { resource } = await container.item(id, teamId).read();
                if (!resource) return jsonResponse(request, 404, { error: 'not found' });
                return jsonResponse(request, 200, resource);
            }

            if (request.method === 'PUT') {
                const body = await request.json();
                // Read existing for partial-update semantics — der Frontend-Provider
                // schickt manchmal nur einen Teilbereich (z.B. nur evaluations).
                const { resource: existing } = await container.item(id, teamId).read();
                if (!existing) return jsonResponse(request, 404, { error: 'not found' });
                const next = {
                    ...existing,
                    name:        body.name        != null ? String(body.name)         : existing.name,
                    password:    body.password    !== undefined ? body.password       : existing.password,
                    template:    body.template    != null ? body.template             : existing.template,
                    users:       body.users       != null ? body.users                : existing.users,
                    evaluations: body.evaluations != null ? body.evaluations          : existing.evaluations,
                    updatedAt:   Date.now()
                };
                const ifMatch = request.headers.get('if-match');
                const opts = ifMatch ? { accessCondition: { type: 'IfMatch', condition: ifMatch } } : {};
                const { resource } = await container.items.upsert(next, opts);
                return jsonResponse(request, 200, resource);
            }

            if (request.method === 'DELETE') {
                await container.item(id, teamId).delete();
                return emptyResponse(request, 204);
            }

            return jsonResponse(request, 405, { error: 'method not allowed' });
        } catch (e) {
            if (e.code === 404 && request.method === 'DELETE') return emptyResponse(request, 204);
            if (e.code === 404) return jsonResponse(request, 404, { error: 'not found' });
            if (e.code === 412) return jsonResponse(request, 412, { error: 'etag mismatch (conflict)' });
            context.error('projectById ' + request.method + ':', e.message);
            return jsonResponse(request, 500, { error: e.message });
        }
    }
});

// ── Password validate ──────────────────────────────────────────────────────
app.http('validatePassword', {
    methods: ['POST', 'OPTIONS'],
    route: 'projects/{id}/validate-password',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return preflightResponse(request);
        const id = request.params.id;
        try {
            const body = await request.json();
            const teamId = await readTeamId(request);
            const { resource } = await getContainer().item(id, teamId).read();
            if (!resource) return jsonResponse(request, 404, { error: 'not found' });
            const ok = resource.password == null || resource.password === '' || resource.password === (body && body.password);
            return jsonResponse(request, 200, { valid: ok });
        } catch (e) {
            if (e.code === 404) return jsonResponse(request, 404, { error: 'not found' });
            context.error('validatePassword:', e.message);
            return jsonResponse(request, 500, { error: e.message });
        }
    }
});
