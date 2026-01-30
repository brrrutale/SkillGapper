<?php
/**
 * Skill Gap Tool - PHP Backend API
 *
 * Einfache REST API die JSON-Dateien als Datenspeicher nutzt.
 * Kann später durch eine Datenbank ersetzt werden.
 *
 * Endpoints:
 * GET    /api/projects              - Liste aller Projekte
 * POST   /api/projects              - Neues Projekt erstellen (mit optionalem Passwort)
 * DELETE /api/projects/{id}         - Projekt löschen
 * POST   /api/projects/{id}/validate-password - Passwort validieren
 * GET    /api/projects/{id}/template    - Template laden
 * POST   /api/projects/{id}/template    - Template speichern
 * GET    /api/projects/{id}/users       - Users laden
 * POST   /api/projects/{id}/users       - Users speichern
 * GET    /api/projects/{id}/evaluations - Evaluations laden
 * POST   /api/projects/{id}/evaluations - Evaluations speichern
 */

// CORS Headers für lokale Entwicklung
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// OPTIONS Request für CORS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Pfad zum Datenverzeichnis
define('DATA_DIR', __DIR__ . '/../data/projects');

// Hilfsfunktionen
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse($message, $status = 400) {
    jsonResponse(['error' => $message], $status);
}

function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

function ensureDataDir() {
    if (!is_dir(DATA_DIR)) {
        if (!mkdir(DATA_DIR, 0755, true)) {
            errorResponse('Could not create data directory. Please ensure the server has write permissions for: ' . dirname(DATA_DIR), 500);
        }
    }
    // Check if directory is writable
    if (!is_writable(DATA_DIR)) {
        errorResponse('Data directory is not writable. Please set write permissions (chmod 755) for: ' . DATA_DIR, 500);
    }
}

function getProjectDir($projectId) {
    return DATA_DIR . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $projectId);
}

function readJsonFile($path) {
    if (!file_exists($path)) {
        return null;
    }
    $content = file_get_contents($path);
    return json_decode($content, true);
}

function writeJsonFile($path, $data) {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function generateId() {
    return bin2hex(random_bytes(8));
}

// URL-Pfad parsen
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
$path = parse_url($requestUri, PHP_URL_PATH);

// Entferne /api Prefix falls vorhanden
if (strpos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
}

$path = trim($path, '/');
$segments = $path ? explode('/', $path) : [];
$method = $_SERVER['REQUEST_METHOD'];

ensureDataDir();

// Routing
try {
    // GET /projects - Liste aller Projekte
    if ($method === 'GET' && count($segments) === 1 && $segments[0] === 'projects') {
        $projects = [];
        $dirs = glob(DATA_DIR . '/*', GLOB_ONLYDIR);
        foreach ($dirs as $dir) {
            $projectFile = $dir . '/project.json';
            if (file_exists($projectFile)) {
                $project = readJsonFile($projectFile);
                if ($project) {
                    // Don't send password to frontend, only hasPassword flag
                    $hasPassword = !empty($project['password']);
                    unset($project['password']);
                    $project['hasPassword'] = $hasPassword;
                    $projects[] = $project;
                }
            }
        }
        // Sortiere nach Erstellungsdatum (neueste zuerst)
        usort($projects, function($a, $b) {
            return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? '');
        });
        jsonResponse($projects);
    }

    // POST /projects - Neues Projekt erstellen
    if ($method === 'POST' && count($segments) === 1 && $segments[0] === 'projects') {
        $input = getJsonInput();
        $name = trim($input['name'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($name)) {
            errorResponse('Project name is required');
        }

        $id = generateId();
        $project = [
            'id' => $id,
            'name' => $name,
            'createdAt' => date('c'),
        ];

        // Store password if provided
        if (!empty($password)) {
            $project['password'] = $password;
        }

        $projectDir = getProjectDir($id);
        writeJsonFile($projectDir . '/project.json', $project);

        // Return project without password
        $responseProject = $project;
        unset($responseProject['password']);
        $responseProject['hasPassword'] = !empty($password);

        jsonResponse($responseProject, 201);
    }

    // POST /projects/{id}/validate-password - Passwort validieren
    if ($method === 'POST' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'validate-password') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $project = readJsonFile($projectDir . '/project.json');
        $input = getJsonInput();
        $password = $input['password'] ?? '';

        $storedPassword = $project['password'] ?? '';
        $valid = ($password === $storedPassword);

        jsonResponse(['valid' => $valid]);
    }

    // DELETE /projects/{id} - Projekt löschen
    if ($method === 'DELETE' && count($segments) === 2 && $segments[0] === 'projects') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        // Rekursive Funktion zum Löschen eines Verzeichnisses mit allem Inhalt
        function deleteDirectory($dir) {
            if (!is_dir($dir)) {
                return false;
            }
            // Hole alle Dateien und Verzeichnisse, inkl. versteckte (ausser . und ..)
            $items = array_diff(scandir($dir), ['.', '..']);
            foreach ($items as $item) {
                $path = $dir . '/' . $item;
                if (is_dir($path)) {
                    deleteDirectory($path);
                } else {
                    unlink($path);
                }
            }
            return rmdir($dir);
        }

        // Lösche das komplette Projektverzeichnis mit allen Daten
        deleteDirectory($projectDir);

        jsonResponse(['success' => true]);
    }

    // GET /projects/{id}/template
    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'template') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $template = readJsonFile($projectDir . '/template.json');
        jsonResponse($template ?? ['skills' => []]);
    }

    // POST /projects/{id}/template
    if ($method === 'POST' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'template') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $template = getJsonInput();
        writeJsonFile($projectDir . '/template.json', $template);

        jsonResponse(['success' => true]);
    }

    // GET /projects/{id}/users
    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'users') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $users = readJsonFile($projectDir . '/users.json');
        jsonResponse($users ?? []);
    }

    // POST /projects/{id}/users
    if ($method === 'POST' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'users') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $users = getJsonInput();
        writeJsonFile($projectDir . '/users.json', $users);

        jsonResponse(['success' => true]);
    }

    // GET /projects/{id}/evaluations
    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'evaluations') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $evaluations = readJsonFile($projectDir . '/evaluations.json');
        jsonResponse($evaluations ?? []);
    }

    // POST /projects/{id}/evaluations
    if ($method === 'POST' && count($segments) === 3 && $segments[0] === 'projects' && $segments[2] === 'evaluations') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        $evaluations = getJsonInput();
        writeJsonFile($projectDir . '/evaluations.json', $evaluations);

        jsonResponse(['success' => true]);
    }

    // Route nicht gefunden
    errorResponse('Not found', 404);

} catch (Exception $e) {
    errorResponse('Server error: ' . $e->getMessage(), 500);
}
