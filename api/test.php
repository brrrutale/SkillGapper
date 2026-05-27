<?php
// Einfacher Debug-Test
header('Content-Type: text/plain');

echo "=== PHP Test ===\n\n";

echo "PHP Version: " . phpversion() . "\n\n";

echo "=== Pfade ===\n";
echo "Aktuelles Verzeichnis: " . __DIR__ . "\n";
echo "Data Verzeichnis: " . __DIR__ . '/../data/projects' . "\n";
echo "Realpath Data: " . realpath(__DIR__ . '/../data') . "\n\n";

echo "=== Ordner-Check ===\n";
$dataDir = __DIR__ . '/../data';
$projectsDir = __DIR__ . '/../data/projects';

echo "data/ existiert: " . (is_dir($dataDir) ? "JA" : "NEIN") . "\n";
echo "data/projects/ existiert: " . (is_dir($projectsDir) ? "JA" : "NEIN") . "\n";

if (is_dir($dataDir)) {
    echo "data/ schreibbar: " . (is_writable($dataDir) ? "JA" : "NEIN") . "\n";
}

if (is_dir($projectsDir)) {
    echo "data/projects/ schreibbar: " . (is_writable($projectsDir) ? "JA" : "NEIN") . "\n";

    echo "\n=== Inhalt von data/projects/ ===\n";
    $files = scandir($projectsDir);
    foreach ($files as $file) {
        echo "  - $file\n";
    }
}

echo "\n=== Test Datei schreiben ===\n";
$testFile = $projectsDir . '/test_write.txt';
$result = @file_put_contents($testFile, 'Test ' . date('Y-m-d H:i:s'));
if ($result !== false) {
    echo "Schreiben erfolgreich!\n";
    @unlink($testFile); // Testdatei löschen
} else {
    echo "Schreiben FEHLGESCHLAGEN!\n";
    echo "Fehler: " . error_get_last()['message'] . "\n";
}

echo "\n=== Ende ===\n";
