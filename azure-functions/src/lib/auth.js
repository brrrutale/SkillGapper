/**
 * auth.js
 *
 * Serverseitige Autorisierung fuer SkillGapper.
 *
 * Hintergrund: Bis hierher war das Projekt-Passwort reine UI-Kosmetik — es
 * hat den React-Dialog gated, nicht die API. Jeder curl-Aufruf kam an alle
 * Daten inklusive des Klartext-Passworts. Dieses Modul dreht das um:
 *
 *   1. Passwoerter werden mit scrypt + Salt gehasht (nie mehr im Klartext).
 *   2. Nach erfolgreicher Pruefung gibt der Server ein HMAC-signiertes,
 *      projekt-gebundenes Token mit 8h Laufzeit aus.
 *   3. Jeder Zugriff auf Projektinhalte verlangt dieses Token.
 *
 * Bewusst ohne npm-Dependency — node:crypto reicht.
 */

import crypto from 'node:crypto';

// scrypt-Parameter. N=16384 kostet ~100ms pro Versuch; das ist fuer einen
// Login unmerklich, bremst Brute-Force aber wirksam aus.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 Stunden

// ── Passwort-Hashing ───────────────────────────────────────────────────────

export function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const dk = crypto.scryptSync(String(plain), salt, KEY_LEN, {
        N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P
    });
    return [
        'scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P,
        salt.toString('base64'), dk.toString('base64')
    ].join('$');
}

export function isHashed(stored) {
    return typeof stored === 'string' && stored.startsWith('scrypt$');
}

/** Konstantzeit-Vergleich zweier Strings. */
function timingSafeEqualStr(a, b) {
    const ab = Buffer.from(String(a ?? ''), 'utf8');
    const bb = Buffer.from(String(b ?? ''), 'utf8');
    if (ab.length !== bb.length) {
        // Trotzdem Zeit verbrennen, damit die Laenge nicht ueber Timing leakt.
        crypto.timingSafeEqual(ab, ab);
        return false;
    }
    return crypto.timingSafeEqual(ab, bb);
}

/**
 * Prueft ein Passwort gegen den gespeicherten Wert.
 *
 * Legacy-Pfad: Bestandsprojekte haben das Passwort noch im Klartext in der
 * DB. Die werden hier weiterhin akzeptiert (Konstantzeit-Vergleich) — der
 * Aufrufer schreibt den Wert bei Erfolg als Hash zurueck (lazy migration),
 * damit der Klartext nach dem naechsten Login jedes Projekts verschwindet.
 */
export function verifyPassword(plain, stored) {
    if (!isHashed(stored)) return timingSafeEqualStr(plain, stored);

    const parts = stored.split('$');
    if (parts.length !== 6) return false;
    const [, n, r, p, saltB64, dkB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(dkB64, 'base64');
    let actual;
    try {
        actual = crypto.scryptSync(String(plain ?? ''), salt, expected.length, {
            N: Number(n), r: Number(r), p: Number(p)
        });
    } catch {
        return false;
    }
    return crypto.timingSafeEqual(actual, expected);
}

// ── Session-Token ──────────────────────────────────────────────────────────

function signingKey() {
    const k = process.env.SESSION_SIGNING_KEY;
    if (!k) throw new Error('SESSION_SIGNING_KEY ist nicht konfiguriert');
    return Buffer.from(k, 'base64');
}

/** Token ist an genau ein Projekt gebunden und laeuft nach 8h ab. */
export function issueToken(projectId) {
    const payload = { p: projectId, exp: Date.now() + TOKEN_TTL_MS };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifyToken(token, projectId) {
    if (!token || typeof token !== 'string') return false;
    const dot = token.indexOf('.');
    if (dot < 1) return false;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
    const sb = Buffer.from(sig, 'utf8');
    const eb = Buffer.from(expected, 'utf8');
    if (sb.length !== eb.length || !crypto.timingSafeEqual(sb, eb)) return false;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
        return false;
    }
    if (payload.p !== projectId) return false;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
    return true;
}

/** Liest das Bearer-Token aus dem Authorization-Header. */
export function bearerFrom(request) {
    const h = request.headers.get('authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1].trim() : null;
}

// ── Rate-Limiting ──────────────────────────────────────────────────────────

/**
 * In-Memory Sliding-Window pro (IP + Projekt).
 *
 * Bewusste Einschraenkung: Auf dem Consumption-Plan gilt der Zaehler pro
 * Instanz und wird beim Cold Start zurueckgesetzt. Ein verteilter Zaehler
 * (Cosmos-Container) waere strenger, kostet aber RUs aus dem 400er-Budget
 * des Free Tiers. Zusammen mit den ~100ms scrypt-Kosten pro Versuch bleibt
 * die praktische Rate niedrig genug. Falls das Tool je oeffentlich
 * exponiert wird: auf einen verteilten Zaehler wechseln.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

export function rateLimitCheck(key) {
    const now = Date.now();
    const hits = (attempts.get(key) || []).filter(t => now - t < WINDOW_MS);
    attempts.set(key, hits);
    if (attempts.size > 5000) attempts.clear(); // simpler Speicher-Deckel
    return {
        allowed: hits.length < MAX_ATTEMPTS,
        retryAfterSec: hits.length < MAX_ATTEMPTS
            ? 0
            : Math.ceil((WINDOW_MS - (now - hits[0])) / 1000)
    };
}

export function rateLimitRecord(key) {
    const hits = attempts.get(key) || [];
    hits.push(Date.now());
    attempts.set(key, hits);
}

export function rateLimitReset(key) {
    attempts.delete(key);
}

/** Client-IP fuer den Rate-Limit-Key. */
export function clientIp(request) {
    const xff = request.headers.get('x-forwarded-for') || '';
    return xff.split(',')[0].trim() || 'unknown';
}
