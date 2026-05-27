/**
 * http.js
 *
 * Gemeinsame HTTP-Utilities fuer alle Function-Endpoints:
 * - CORS-Header (whitelist via Env-Var CORS_ALLOWED_ORIGINS)
 * - JSON-Responses
 * - teamId-Extraction aus Request (query/body/header)
 */

const DEFAULT_ALLOWED = ['http://localhost:5173', 'http://localhost:8765'];

export function corsHeaders(request) {
    // Note: env var is ALLOWED_ORIGINS, not CORS_ALLOWED_ORIGINS — Azure
    // Functions host swallows the latter and tries to parse it as JSON.
    const allowed = (process.env.ALLOWED_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    const allowList = allowed.length ? allowed : DEFAULT_ALLOWED;
    const origin = request.headers.get('origin') || '';
    const isAllowed = allowList.includes('*') || allowList.includes(origin);
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin || '*' : allowList[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key, x-team-id, if-match',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

export function jsonResponse(request, status, body) {
    return {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
        jsonBody: body
    };
}

export function emptyResponse(request, status) {
    return { status, headers: corsHeaders(request) };
}

export function preflightResponse(request) {
    return { status: 204, headers: corsHeaders(request) };
}

/**
 * Holt die teamId aus der Anfrage. Praezedenz:
 *   1. Query-Param `?teamId=...`
 *   2. Header `x-team-id`
 *   3. Body-Feld `teamId` / `TeamId`
 *   4. Fallback "default"
 */
export async function readTeamId(request) {
    const url = new URL(request.url);
    const q = url.searchParams.get('teamId') || url.searchParams.get('TeamId');
    if (q) return q;
    const h = request.headers.get('x-team-id');
    if (h) return h;
    try {
        const body = await request.clone().json();
        if (body && (body.teamId || body.TeamId)) return body.teamId || body.TeamId;
    } catch (e) { /* no body */ }
    return 'default';
}
