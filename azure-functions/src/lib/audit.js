/**
 * audit.js — Nachvollziehbarkeit fuer schreibende Zugriffe.
 *
 * Bewusst NUR fuer Schreibzugriffe (POST/PUT/DELETE) und fehlgeschlagene
 * Logins. Lesende Requests machen den Grossteil des Verkehrs aus; ihre
 * IPs braucht niemand, und je weniger Personendaten gespeichert werden,
 * desto besser. Die Eintraege, die es dann gibt, sind dafuer aussagekraeftig.
 *
 * Warum ueberhaupt: Application Insights maskiert `client_IP` in der
 * requests-Tabelle standardmaessig auf 0.0.0.0. Nach einem Vorfall am
 * 09.09.2026 (jemand legte ueber die Weboberflaeche ein Projekt mit einem
 * XSS-Payload als Namen an) liess sich deshalb nur die Stadt bestimmen,
 * nicht die Herkunft. Diese Zeilen landen als gewoehnliche Traces in der
 * traces-Tabelle und sind von der Maskierung nicht betroffen.
 *
 * Auswertung in Application Insights:
 *
 *   traces
 *   | where message startswith "AUDIT "
 *   | extend e = parse_json(substring(message, 6))
 *   | project timestamp, action = e.action, ip = e.ip, project = e.project,
 *             name = e.name, ua = e.ua
 *   | order by timestamp desc
 */

import { clientIp } from './auth.js';

/** Laenge, ab der freie Textfelder abgeschnitten werden. */
const MAX_FIELD = 200;

function trim(value) {
    if (value == null) return undefined;
    const s = String(value);
    return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) + '…' : s;
}

/**
 * Schreibt eine Audit-Zeile.
 *
 * @param context   Azure-Functions-Context (fuer context.log)
 * @param request   HttpRequest — liefert IP und User-Agent
 * @param action    z.B. 'project.create', 'login.failed'
 * @param details   zusaetzliche Felder, werden gekuerzt
 */
export function audit(context, request, action, details = {}) {
    const entry = { action, ip: clientIp(request), ua: trim(request.headers.get('user-agent')) };
    for (const [k, v] of Object.entries(details)) {
        const t = trim(v);
        if (t !== undefined) entry[k] = t;
    }
    context.log(`AUDIT ${JSON.stringify(entry)}`);
}
