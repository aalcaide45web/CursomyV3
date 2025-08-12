<?php
// Worker por tick: procesa algunos items por ejecución para evitar timeouts
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
set_time_limit(0);

require_once '../config/database.php';
require_once '../config/config.php';

header('Content-Type: application/json');

$db = getDatabase();

// Máximo de items a procesar por tick
$maxItems = isset($_GET['max']) ? max(1, (int)$_GET['max']) : 5;

try {
    $processed = processTick($db, $maxItems);
    jsonResponse(['success' => true, 'processed' => $processed]);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
}

function processTick($db, $maxItems) {
    $processedCount = 0;

    // Seleccionar un job en cola o en procesamiento
    $stmt = $db->query("SELECT * FROM jobs WHERE status IN ('queued','processing') ORDER BY created_at LIMIT 1");
    $job = $stmt->fetch();
    if (!$job) return 0;

    $jobId = (int)$job['id'];
    $cursoId = (int)$job['curso_id'];

    // Marcar job en processing si estaba queued
    if ($job['status'] === 'queued') {
        $db->prepare("UPDATE jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
           ->execute([$jobId]);
    }

    // Respetar pausa a nivel de job
    $stmt = $db->prepare("SELECT status FROM jobs WHERE id = ?");
    $stmt->execute([$jobId]);
    $statusRow = $stmt->fetch();
    if ($statusRow && $statusRow['status'] === 'paused') {
        return 0; // no procesar este job en este tick
    }

    // Obtener siguiente lote de items pendientes
    $itemsStmt = $db->prepare("SELECT * FROM job_items WHERE job_id = ? AND status IN ('uploaded','queued') ORDER BY section_order, video_order, id LIMIT ?");
    $itemsStmt->execute([$jobId, $maxItems]);
    $items = $itemsStmt->fetchAll();

    if (empty($items)) {
        // Verificar consistencia: si ya no quedan items en processing/uploaded/queued pero totales no coinciden, marcar error
        $counts = $db->prepare("SELECT 
            SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_cnt,
            COUNT(*) as total_cnt
            FROM job_items WHERE job_id = ?");
        $counts->execute([$jobId]);
        $row = $counts->fetch();
        $doneCnt = (int)$row['done_cnt'];
        $totalCnt = (int)$row['total_cnt'];
        if ($totalCnt > 0 && $doneCnt < $totalCnt) {
            // Hay discrepancia: marcar job en error parcial
            $db->prepare("UPDATE jobs SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$jobId]);
        } else {
            // Completar job
            $db->prepare("UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$jobId]);
        }
        return 0;
    }

    foreach ($items as $item) {
        $itemId = (int)$item['id'];
        if ($item['status'] === 'cancelled') continue;

        // Marcar item en processing
        $db->prepare("UPDATE job_items SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
           ->execute([$itemId]);

        try {
            processSingleItem($db, $job, $item);
            // Marcar done y actualizar job
            $db->prepare("UPDATE job_items SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$itemId]);
            $db->prepare("UPDATE jobs SET processed_items = processed_items + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$jobId]);
        } catch (Exception $e) {
            $db->prepare("UPDATE job_items SET status = 'error', message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$e->getMessage(), $itemId]);
            $db->prepare("UPDATE jobs SET error_count = error_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
               ->execute([$jobId]);
        }

        $processedCount++;
    }

    return $processedCount;
}

function processSingleItem($db, $job, $item) {
    $jobId = (int)$job['id'];
    $cursoId = (int)$job['curso_id'];
    $sectionName = $item['section_name'];
    $sectionOrder = (int)$item['section_order'];
    $videoOrder = (int)$item['video_order'];
    $tempFileName = $item['temp_path'];

    // Asegurar sección
    $stmt = $db->prepare('SELECT id FROM secciones WHERE curso_id = ? AND nombre = ?');
    $stmt->execute([$cursoId, $sectionName]);
    $seccion = $stmt->fetch();
    if (!$seccion) {
        $stmt = $db->prepare('INSERT INTO secciones (curso_id, nombre, orden) VALUES (?, ?, ?)');
        $stmt->execute([$cursoId, $sectionName, $sectionOrder > 0 ? $sectionOrder : 1]);
        $seccionId = (int)$db->lastInsertId();
    } else {
        $seccionId = (int)$seccion['id'];
    }

    // Mover archivo desde tmp a videos del curso
    $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
    $srcPath = $jobTmpDir . $tempFileName;
    if (!file_exists($srcPath)) {
        throw new Exception('Temporal no encontrado');
    }
    $videoDir = VIDEOS_DIR . $cursoId . '/';
    if (!is_dir($videoDir)) mkdir($videoDir, 0755, true);
    $targetName = generateUniqueFileName($tempFileName, $videoDir);
    $dstPath = $videoDir . $targetName;
    if (!rename($srcPath, $dstPath)) {
        // fallback copy+unlink
        if (!copy($srcPath, $dstPath)) {
            throw new Exception('No se pudo mover a videos');
        }
        @unlink($srcPath);
    }

    // Crear clase con duration=0 y orden
    $titulo = pathinfo($tempFileName, PATHINFO_FILENAME);
    $titulo = ucwords(str_replace(['_', '-'], ' ', $titulo));

    // Si no viene video_order válido, calcular siguiente
    if ($videoOrder <= 0) {
        $stmt = $db->prepare('SELECT COALESCE(MAX(orden),0)+1 as next_ord FROM clases WHERE seccion_id = ?');
        $stmt->execute([$seccionId]);
        $videoOrder = (int)$stmt->fetch()['next_ord'];
    }

    $stmt = $db->prepare('INSERT INTO clases (seccion_id, titulo, archivo_video, duracion, orden) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$seccionId, $titulo, $targetName, 0, $videoOrder]);
}

?>


