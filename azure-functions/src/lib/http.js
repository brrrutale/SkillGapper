/**
 * http.js
 *
 * Gemeinsame HTTP-Utilities fuer alle Function-Endpoints:
 * - CORS-Header (Allowlist via Env-Var ALLOWED_ORIGINS)
 * - JSON-Responses
 * - Partition-Key-Konstante
 */

/**
 * Partition Key.
 *
 * Frueher kam der Wert aus Query-Param, Header oder Body — also vom Client.
 * Das war keine Isolation, sondern nur die Illusion davon: jeder konnte
 * `?teamId=beliebig` schicken. Solange es keine echten Identitaeten gibt
 * (Entra-ID-App-Registrierung ist im Migros-Tenant nicht moeglich), ist eine
 * ehrliche Konstante besser als ein frei waehlbarer Parameter.
 *
 * Sobald SSO existiert: hier die teamId aus den Token-Claims ableiten.
 */
export const TEAM_ID = 'default';

export function corsHeaders(request) {
    // Note: env var is ALLOWED_ORIGINS, not CORS_ALLOWED_ORIGINS — Azure
    // Functions host swallows the latter and tries to parse it as JSON.
    const allowList = (process.env.ALLOWED_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);

    const origin = request.headers.get('origin') || '';
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
        'Access-Control-Expose-Headers': 'ETag',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };

    // Fail closed: nur exakt gelistete Origins bekommen einen ACAO-Header.
    // Kein '*'-Sonderfall, und fuer nicht erlaubte Origins gar keinen Header
    // (statt wie frueher den ersten Eintrag der Allowlist zurueckzugeben).
    if (origin && allowList.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
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
