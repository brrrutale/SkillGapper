/**
 * validate.js
 *
 * Eingabe-Validierung fuer die Projekt-Endpoints.
 *
 * Zwei Aufgaben:
 *   1. Groessenlimits — ohne die kann ein Aufrufer beliebig grosse Bodies
 *      schicken; Cosmos lehnt zwar >2MB ab, aber erst nachdem die Function
 *      das JSON geparst hat.
 *   2. Schutz vor versehentlichem Leeren — die alte PUT-Merge-Logik hat
 *      `body.users != null ? body.users : existing.users` benutzt. Ein
 *      `{"users": []}` ist non-null und hat damit still und mit HTTP 200
 *      alle Personen ueberschrieben. Das ist der wahrscheinlichste Weg,
 *      auf dem hier echte Daten verloren gehen.
 */

export const LIMITS = {
    bodyBytes: 256 * 1024,
    name: 200,
    password: 128,
    skills: 200,
    users: 500,
    evaluations: 100000
};

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

/** Liest den Body und lehnt zu grosse Payloads ab, bevor sie geparst werden. */
export async function readJsonBody(request) {
    const raw = await request.text();
    if (raw.length > LIMITS.bodyBytes) {
        throw new ValidationError(`body too large (max ${LIMITS.bodyBytes} bytes)`);
    }
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        throw new ValidationError('invalid JSON body');
    }
}

function checkString(value, field, max) {
    if (value == null) return;
    if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
    if (value.length > max) throw new ValidationError(`${field} too long (max ${max})`);
}

function checkArray(value, field, max) {
    if (value == null) return;
    if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
    if (value.length > max) throw new ValidationError(`${field} too many entries (max ${max})`);
}

/** Gemeinsame Feldpruefung fuer POST und PUT. */
export function validateProjectFields(body) {
    checkString(body.name, 'name', LIMITS.name);
    checkString(body.password, 'password', LIMITS.password);
    checkArray(body.users, 'users', LIMITS.users);
    checkArray(body.evaluations, 'evaluations', LIMITS.evaluations);

    if (body.template != null) {
        if (typeof body.template !== 'object' || Array.isArray(body.template)) {
            throw new ValidationError('template must be an object');
        }
        checkArray(body.template.skills, 'template.skills', LIMITS.skills);
    }
}

/**
 * Verhindert, dass ein bestehendes nicht-leeres Feld durch einen leeren
 * Container ersetzt wird. Wer wirklich alles loeschen will, schickt
 * `allowEmpty: true` mit — dann ist es eine bewusste Entscheidung.
 */
export function guardAgainstWipe(body, existing) {
    if (body.allowEmpty === true) return;

    const checks = [
        ['users', body.users, existing.users],
        ['evaluations', body.evaluations, existing.evaluations]
    ];
    for (const [field, incoming, current] of checks) {
        if (Array.isArray(incoming) && incoming.length === 0
            && Array.isArray(current) && current.length > 0) {
            throw new ValidationError(
                `refusing to replace ${current.length} existing ${field} with an empty array — ` +
                `send allowEmpty:true if this is intentional`
            );
        }
    }

    const incomingSkills = body.template && body.template.skills;
    const currentSkills = existing.template && existing.template.skills;
    if (Array.isArray(incomingSkills) && incomingSkills.length === 0
        && Array.isArray(currentSkills) && currentSkills.length > 0) {
        throw new ValidationError(
            `refusing to replace ${currentSkills.length} existing skills with an empty array — ` +
            `send allowEmpty:true if this is intentional`
        );
    }
}
