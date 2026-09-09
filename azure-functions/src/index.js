/**
 * index.js — Entry-Point fuer alle SkillGapper HTTP-Functions.
 *
 * Datenmodell (1 Dokument pro Projekt):
 *   {
 *     id: "<projectId>",
 *     TeamId: "<teamId>",           — Partition Key Path /TeamId
 *     name: string,
 *     password: string | null,      — scrypt-Hash, nie Klartext (siehe lib/auth.js)
 *     template: { skills, targetValues, ratingLevels, displaySettings },
 *     users: [ { id, name, color, disabledSkills, orderIndex } ],
 *     evaluations: [ { evaluatorId, evaluatedUserId, skills: { [skillId]: rating } } ],
 *     createdAt: number,            — Unix-ms
 *     updatedAt: number,
 *     deletedAt?: number            — Soft-Delete-Marker
 *   }
 *
 * Endpoints:
 *   GET    /api/projects                            → Meta-Liste (ohne Inhalte, ohne Token)
 *   POST   /api/projects                            → Neues Projekt anlegen
 *   GET    /api/projects/{id}                       → Volles Dokument  [Token]
 *   PUT    /api/projects/{id}                       → Update            [Token + If-Match]
 *   DELETE /api/projects/{id}                       → Soft-Delete       [Token]
 *   POST   /api/projects/{id}/validate-password     → Passwort → Token
 *
 * Autorisierung: Projekt-gebundenes HMAC-Token (8h) aus validate-password.
 * Entra-ID-SSO waere staerker, ist im Migros-Tenant aber nicht moeglich
 * (allowedToCreateApps=false). Sobald eine App-Registrierung vorliegt,
 * sollte hier auf echte Identitaeten umgestellt werden.
 */

import crypto from 'node:crypto';
import { app } from '@azure/functions';
import { getContainer } from './lib/cosmos.js';
import { jsonResponse, emptyResponse, preflightResponse, TEAM_ID } from './lib/http.js';
import {
    hashPassword, isHashed, verifyPassword,
    issueToken, verifyToken, bearerFrom,
    rateLimitCheck, rateLimitRecord, rateLimitReset, clientIp
} from './lib/auth.js';
import {
    readJsonBody, validateProjectFields, guardAgainstWipe, ValidationError
} from './lib/validate.js';

function newProjectId() {
    return crypto.randomUUID();
}

/** Nur Metadaten — nie Inhalte, nie das Passwort(-Hash). */
function projectMeta(doc) {
    return {
        id: doc.id,
        name: doc.name,
        hasPassword: doc.password != null && doc.password !== '',
        createdAt: doc.createdAt || (doc._ts ? doc._ts * 1000 : Date.now())
    };
}

/** Entfernt Felder, die nie an einen Client gehen duerfen. */
function sanitizeProject(doc) {
    const { password, _rid, _self, _attachments, ...safe } = doc;
    return { ...safe, hasPassword: password != null && password !== '' };
}

/** Einheitliche Fehlerantwort — nie interne Details nach aussen. */
function fail(request, context, where, e) {
    const requestId = crypto.randomUUID();
    context.error(`[${requestId}] ${where}: ${e && e.stack ? e.stack : e}`);
    return jsonResponse(request, 500, { error: 'internal error', requestId });
}

/** Token-Gate fuer alle Endpoints, die Projektinhalte anfassen. */
function requireToken(request, projectId) {
    return verifyToken(bearerFrom(request), projectId);
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
                // Die Liste bleibt ohne Token erreichbar — sie ist der
                // Projekt-Picker. Sie liefert aber ausschliesslich Metadaten:
                // keine Personen, keine Bewertungen, kein Passwort-Hash.
                // Soft-geloeschte Projekte werden ausgeblendet.
                const querySpec = {
                    query: 'SELECT c.id, c.name, c.password, c.createdAt, c._ts FROM c '
                         + 'WHERE c.TeamId = @teamId AND (NOT IS_DEFINED(c.deletedAt) OR IS_NULL(c.deletedAt))',
                    parameters: [{ name: '@teamId', value: TEAM_ID }]
                };
                const { resources } = await container.items
                    .query(querySpec, { partitionKey: TEAM_ID }).fetchAll();
                const projects = resources
                    .map(projectMeta)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                return jsonResponse(request, 200, { projects });
            }

            if (request.method === 'POST') {
                const body = await readJsonBody(request);
                if (!body || !body.name) return jsonResponse(request, 400, { error: 'name required' });
                validateProjectFields(body);

                // id und teamId kommen bewusst NICHT vom Client — sonst kann
                // ein Aufrufer fremde IDs belegen oder in andere Partitionen
                // schreiben.
                const doc = {
                    id: newProjectId(),
                    TeamId: TEAM_ID,
                    name: String(body.name),
                    password: body.password ? hashPassword(body.password) : null,
                    template: body.template || { skills: [] },
                    users: body.users || [],
                    evaluations: body.evaluations || [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                const { resource } = await container.items.create(doc);
                // Direkt ein Token mitgeben, damit der Ersteller ohne
                // zusaetzlichen Login weiterarbeiten kann.
                return jsonResponse(request, 201, {
                    ...projectMeta(resource),
                    token: issueToken(resource.id)
                });
            }

            return jsonResponse(request, 405, { error: 'method not allowed' });
        } catch (e) {
            if (e instanceof ValidationError) return jsonResponse(request, 400, { error: e.message });
            if (e.code === 409) return jsonResponse(request, 409, { error: 'project id already exists' });
            return fail(request, context, 'projectsRoot ' + request.method, e);
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

        // Jeder Zugriff auf Projektinhalte braucht ein gueltiges,
        // projekt-gebundenes Token aus validate-password.
        if (!requireToken(request, id)) {
            return jsonResponse(request, 401, { error: 'unauthorized' });
        }

        try {
            if (request.method === 'GET') {
                const { resource } = await container.item(id, TEAM_ID).read();
                if (!resource || resource.deletedAt) {
                    return jsonResponse(request, 404, { error: 'not found' });
                }
                // ETag mitgeben, damit der Client ihn beim PUT zurueckschicken kann.
                const res = jsonResponse(request, 200, sanitizeProject(resource));
                res.headers.ETag = resource._etag;
                return res;
            }

            if (request.method === 'PUT') {
                const body = await readJsonBody(request);
                validateProjectFields(body);

                const ifMatch = request.headers.get('if-match');
                if (!ifMatch) {
                    return jsonResponse(request, 428, {
                        error: 'If-Match header required — GET the project first and echo its ETag'
                    });
                }

                const { resource: existing } = await container.item(id, TEAM_ID).read();
                if (!existing || existing.deletedAt) {
                    return jsonResponse(request, 404, { error: 'not found' });
                }

                guardAgainstWipe(body, existing);

                const next = {
                    ...existing,
                    name:        body.name        != null ? String(body.name)  : existing.name,
                    template:    body.template    != null ? body.template      : existing.template,
                    users:       body.users       != null ? body.users         : existing.users,
                    evaluations: body.evaluations != null ? body.evaluations   : existing.evaluations,
                    updatedAt:   Date.now()
                };

                // Passwort nur anfassen, wenn es explizit mitgeschickt wurde —
                // und dann immer gehasht ablegen.
                if (body.password !== undefined) {
                    next.password = body.password ? hashPassword(body.password) : null;
                }

                const { resource } = await container.items.upsert(next, {
                    accessCondition: { type: 'IfMatch', condition: ifMatch }
                });
                const res = jsonResponse(request, 200, sanitizeProject(resource));
                res.headers.ETag = resource._etag;
                return res;
            }

            if (request.method === 'DELETE') {
                // Soft-Delete: das Dokument bleibt erhalten und faellt nur aus
                // der Liste. Zusammen mit Cosmos Continuous Backup (7 Tage
                // Point-in-Time-Restore) gibt es damit zwei unabhaengige Wege
                // zurueck.
                const { resource: existing } = await container.item(id, TEAM_ID).read();
                if (!existing || existing.deletedAt) return emptyResponse(request, 204);
                await container.items.upsert({
                    ...existing,
                    deletedAt: Date.now(),
                    updatedAt: Date.now()
                });
                return emptyResponse(request, 204);
            }

            return jsonResponse(request, 405, { error: 'method not allowed' });
        } catch (e) {
            if (e instanceof ValidationError) return jsonResponse(request, 400, { error: e.message });
            if (e.code === 404 && request.method === 'DELETE') return emptyResponse(request, 204);
            if (e.code === 404) return jsonResponse(request, 404, { error: 'not found' });
            if (e.code === 412) return jsonResponse(request, 412, { error: 'etag mismatch (conflict)' });
            return fail(request, context, 'projectById ' + request.method, e);
        }
    }
});

// ── Password validate → Token ──────────────────────────────────────────────
app.http('validatePassword', {
    methods: ['POST', 'OPTIONS'],
    route: 'projects/{id}/validate-password',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return preflightResponse(request);
        const id = request.params.id;
        const rlKey = `${clientIp(request)}:${id}`;

        try {
            const limit = rateLimitCheck(rlKey);
            if (!limit.allowed) {
                const res = jsonResponse(request, 429, { error: 'too many attempts' });
                res.headers['Retry-After'] = String(limit.retryAfterSec);
                return res;
            }

            const body = await readJsonBody(request);
            const { resource } = await getContainer().item(id, TEAM_ID).read().catch(() => ({ resource: null }));

            // Nicht existierendes Projekt und falsches Passwort geben dieselbe
            // Antwort — sonst laesst sich ueber den Statuscode herausfinden,
            // welche Projekt-IDs existieren.
            if (!resource || resource.deletedAt) {
                rateLimitRecord(rlKey);
                return jsonResponse(request, 200, { valid: false });
            }

            const unprotected = resource.password == null || resource.password === '';
            const ok = unprotected || verifyPassword(body && body.password, resource.password);

            if (!ok) {
                rateLimitRecord(rlKey);
                return jsonResponse(request, 200, { valid: false });
            }

            // Lazy migration: Bestandsprojekte haben das Passwort noch im
            // Klartext. Beim ersten erfolgreichen Login wird es durch den
            // scrypt-Hash ersetzt.
            if (!unprotected && !isHashed(resource.password)) {
                try {
                    await getContainer().items.upsert({
                        ...resource,
                        password: hashPassword(body.password),
                        updatedAt: Date.now()
                    });
                    context.log(`migrated plaintext password to scrypt hash for project ${id}`);
                } catch (migErr) {
                    // Migration ist best-effort — der Login soll daran nicht scheitern.
                    context.error('password hash migration failed:', migErr.message);
                }
            }

            rateLimitReset(rlKey);
            return jsonResponse(request, 200, { valid: true, token: issueToken(id) });
        } catch (e) {
            if (e instanceof ValidationError) return jsonResponse(request, 400, { error: e.message });
            return fail(request, context, 'validatePassword', e);
        }
    }
});
