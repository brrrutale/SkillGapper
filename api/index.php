<?php
/**
 * Skill Gap Tool - PHP Backend API
 *
 * Einfache REST API die JSON-Dateien als Datenspeicher nutzt.
 * Kann später durch eine Datenbank ersetzt werden.
 *
 * Endpoints:
 * GET    /api/projects              - Liste aller Projekte
 * POST   /api/projects              - Neues Projekt erstellen
 * DELETE /api/projects/{id}         - Projekt löschen
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
        mkdir(DATA_DIR, 0755, true);
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

        if (empty($name)) {
            errorResponse('Project name is required');
        }

        $id = generateId();
        $project = [
            'id' => $id,
            'name' => $name,
            'createdAt' => date('c'),
        ];

        $projectDir = getProjectDir($id);
        writeJsonFile($projectDir . '/project.json', $project);

        jsonResponse($project, 201);
    }

    // DELETE /projects/{id} - Projekt löschen
    if ($method === 'DELETE' && count($segments) === 2 && $segments[0] === 'projects') {
        $projectId = $segments[1];
        $projectDir = getProjectDir($projectId);

        if (!is_dir($projectDir)) {
            errorResponse('Project not found', 404);
        }

        // Lösche alle Dateien im Projektordner
        $files = glob($projectDir . '/*');
        foreach ($files as $file) {
            unlink($file);
        }
        rmdir($projectDir);

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
