<?php
// API de gestión de trabajos (cola en servidor)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../config/database.php';
require_once '../config/config.php';

header('Content-Type: application/json');

$db = getDatabase();

$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');
if ($action === '') {
    jsonResponse(['success' => false, 'message' => 'Parámetro action requerido'], 400);
}

try {
    switch ($action) {
        case 'create':
            createJob($db);
            break;
        case 'add_item':
            addItem($db);
            break;
        case 'finalize_uploads':
            finalizeUploads($db);
            break;
        case 'status':
            getStatus($db);
            break;
        case 'cancel':
            cancelJob($db);
            break;
        case 'cleanup':
            cleanupJob($db);
            break;
        case 'pause':
            pauseJob($db);
            break;
        case 'resume':
            resumeJob($db);
            break;
        case 'retry_failed':
            retryFailed($db);
            break;
        default:
            jsonResponse(['success' => false, 'message' => 'Acción no soportada'], 400);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
}

function createJob($db) {
    $mode = isset($_POST['mode']) ? $_POST['mode'] : '';
    $courseId = isset($_POST['curso_id']) ? (int)$_POST['curso_id'] : 0;
    $courseTitle = isset($_POST['titulo']) ? trim($_POST['titulo']) : '';
    if ($mode !== 'new' && $mode !== 'existing') {
        jsonResponse(['success' => false, 'message' => 'mode inválido'], 400);
    }

    if ($mode === 'existing' && $courseId <= 0) {
        jsonResponse(['success' => false, 'message' => 'curso_id requerido'], 400);
    }

    if ($mode === 'new') {
        if ($courseTitle === '') {
            jsonResponse(['success' => false, 'message' => 'titulo requerido para modo new'], 400);
        }
        // Crear curso inmediatamente para tener ID
        $stmt = $db->prepare('INSERT INTO cursos (titulo) VALUES (?)');
        $stmt->execute([$courseTitle]);
        $courseId = (int)$db->lastInsertId();
    }

    $uploadToken = bin2hex(random_bytes(16));

    $stmt = $db->prepare('INSERT INTO jobs (upload_token, curso_id, mode, course_title, status, total_items, processed_items, error_count) VALUES (?, ?, ?, ?, ?, 0, 0, 0)');
    $stmt->execute([$uploadToken, $courseId, $mode, $courseTitle, 'uploading']);
    $jobId = (int)$db->lastInsertId();

    // Crear directorio temporal del job
    $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
    if (!is_dir($jobTmpDir)) mkdir($jobTmpDir, 0755, true);

    jsonResponse(['success' => true, 'data' => [
        'job_id' => $jobId,
        'upload_token' => $uploadToken,
        'curso_id' => $courseId
    ]]);
}

function addItem($db) {
    // multipart/form-data: job_id, upload_token, section_name, section_order, video_order, file
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    $token = isset($_POST['upload_token']) ? $_POST['upload_token'] : '';
    $sectionName = isset($_POST['section_name']) ? trim($_POST['section_name']) : '';
    $sectionOrder = isset($_POST['section_order']) ? (int)$_POST['section_order'] : 1;
    $videoOrder = isset($_POST['video_order']) ? (int)$_POST['video_order'] : 1;

    if ($jobId <= 0 || $token === '' || $sectionName === '' || !isset($_FILES['file'])) {
        jsonResponse(['success' => false, 'message' => 'Parámetros requeridos: job_id, upload_token, section_name, file'], 400);
    }

    // Validar job y token
    $stmt = $db->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job || $job['upload_token'] !== $token) {
        jsonResponse(['success' => false, 'message' => 'Job no encontrado o token inválido'], 404);
    }

    if (!in_array($job['status'], ['uploading', 'queued', 'processing', 'paused'])) {
        jsonResponse(['success' => false, 'message' => 'Job en estado incompatible: ' . $job['status']], 400);
    }

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'Error al recibir el archivo: ' . $file['error']], 400);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_VIDEO_TYPES, true)) {
        jsonResponse(['success' => false, 'message' => 'Tipo de archivo no soportado'], 400);
    }

    $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
    if (!is_dir($jobTmpDir)) mkdir($jobTmpDir, 0755, true);

    // Guardar en carpeta temporal preservando nombre
    $safeName = generateUniqueFileName($file['name'], $jobTmpDir);
    $targetPath = $jobTmpDir . $safeName;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonResponse(['success' => false, 'message' => 'No se pudo guardar el archivo temporal'], 500);
    }

    $stmt = $db->prepare('INSERT INTO job_items (job_id, section_name, section_order, video_order, original_name, temp_path, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$jobId, $sectionName, $sectionOrder, $videoOrder, $file['name'], $safeName, 'uploaded']);

    // Incrementar total_items
    $db->prepare('UPDATE jobs SET total_items = total_items + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$jobId]);

    jsonResponse(['success' => true]);
}

function finalizeUploads($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    $token = isset($_POST['upload_token']) ? $_POST['upload_token'] : '';
    if ($jobId <= 0 || $token === '') {
        jsonResponse(['success' => false, 'message' => 'job_id y upload_token requeridos'], 400);
    }
    $stmt = $db->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job || $job['upload_token'] !== $token) {
        jsonResponse(['success' => false, 'message' => 'Job no encontrado o token inválido'], 404);
    }
    // Marcar en cola para procesamiento
    $db->prepare("UPDATE jobs SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
    jsonResponse(['success' => true]);
}

function getStatus($db) {
    if (isset($_GET['job_id'])) {
        $jobId = (int)$_GET['job_id'];
        $stmt = $db->prepare('SELECT * FROM jobs WHERE id = ?');
        $stmt->execute([$jobId]);
        $job = $stmt->fetch();
        if (!$job) jsonResponse(['success' => false, 'message' => 'Job no encontrado'], 404);
        // Obtener items agrupados por estado (opcional)
        $itemsStmt = $db->prepare('SELECT status, COUNT(*) as cnt FROM job_items WHERE job_id = ? GROUP BY status');
        $itemsStmt->execute([$jobId]);
        $byStatus = [];
        foreach ($itemsStmt->fetchAll() as $row) { $byStatus[$row['status']] = (int)$row['cnt']; }
        jsonResponse(['success' => true, 'data' => [
            'job' => $job,
            'items_by_status' => $byStatus
        ]]);
    } else {
        // Listar últimos jobs
        $stmt = $db->query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50');
        $jobs = $stmt->fetchAll();
        jsonResponse(['success' => true, 'data' => $jobs]);
    }
}

function cancelJob($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    if ($jobId <= 0) jsonResponse(['success' => false, 'message' => 'job_id requerido'], 400);

    $stmt = $db->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) jsonResponse(['success' => false, 'message' => 'Job no encontrado'], 404);

    $db->beginTransaction();
    try {
        // Marcar job e items como cancelados si no están terminados
        $db->prepare("UPDATE jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
        $db->prepare("UPDATE job_items SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND status IN ('uploaded','queued','processing')")->execute([$jobId]);

        // Eliminar archivos temporales
        $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
        if (is_dir($jobTmpDir)) {
            $files = scandir($jobTmpDir);
            foreach ($files as $f) {
                if ($f === '.' || $f === '..') continue;
                $p = $jobTmpDir . $f;
                if (is_file($p)) @unlink($p);
            }
            @rmdir($jobTmpDir);
        }

        $db->commit();
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

function cleanupJob($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    if ($jobId <= 0) jsonResponse(['success' => false, 'message' => 'job_id requerido'], 400);

    $stmt = $db->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) jsonResponse(['success' => false, 'message' => 'Job no encontrado'], 404);

    // No permitir limpiar si está activamente en processing (por seguridad)
    if ($job['status'] === 'processing') {
        jsonResponse(['success' => false, 'message' => 'Detén o cancela el trabajo antes de limpiarlo'], 400);
    }

    $db->beginTransaction();
    try {
        // Borrar items
        $db->prepare('DELETE FROM job_items WHERE job_id = ?')->execute([$jobId]);
        // Borrar job
        $db->prepare('DELETE FROM jobs WHERE id = ?')->execute([$jobId]);

        // Eliminar archivos temporales
        $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
        if (is_dir($jobTmpDir)) {
            $files = scandir($jobTmpDir);
            foreach ($files as $f) {
                if ($f === '.' || $f === '..') continue;
                $p = $jobTmpDir . $f;
                if (is_file($p)) @unlink($p);
            }
            @rmdir($jobTmpDir);
        }

        $db->commit();
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

function pauseJob($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    if ($jobId <= 0) jsonResponse(['success' => false, 'message' => 'job_id requerido'], 400);

    // Solo pausar si no está completado/cancelado
    $stmt = $db->prepare('SELECT status FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) jsonResponse(['success' => false, 'message' => 'Job no encontrado'], 404);
    if (in_array($job['status'], ['completed','cancelled','error'])) {
        jsonResponse(['success' => false, 'message' => 'El trabajo está en estado terminal'], 400);
    }

    $db->prepare("UPDATE jobs SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
    jsonResponse(['success' => true]);
}

function resumeJob($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    if ($jobId <= 0) jsonResponse(['success' => false, 'message' => 'job_id requerido'], 400);

    $stmt = $db->prepare('SELECT status FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) jsonResponse(['success' => false, 'message' => 'Job no encontrado'], 404);
    if ($job['status'] === 'completed') jsonResponse(['success' => true]);

    $db->prepare("UPDATE jobs SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
    jsonResponse(['success' => true]);
}

function retryFailed($db) {
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    if ($jobId <= 0) jsonResponse(['success' => false, 'message' => 'job_id requerido'], 400);

    // Re-colocar en 'uploaded' los items con error cuyos temporales existan todavía
    $jobTmpDir = TMP_UPLOADS_DIR . $jobId . '/';
    $stmt = $db->prepare("SELECT id, temp_path FROM job_items WHERE job_id = ? AND status = 'error'");
    $stmt->execute([$jobId]);
    $items = $stmt->fetchAll();
    $requeued = 0; $skipped = 0;
    foreach ($items as $it) {
        $p = $jobTmpDir . $it['temp_path'];
        if (is_file($p)) {
            $db->prepare("UPDATE job_items SET status = 'uploaded', message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$it['id']]);
            $requeued++;
        } else {
            $skipped++;
        }
    }
    // Recalcular contadores y poner job en cola
    recomputeJobCounters($db, $jobId);
    $db->prepare("UPDATE jobs SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
    jsonResponse(['success' => true, 'data' => ['requeued' => $requeued, 'skipped' => $skipped]]);
}

function recomputeJobCounters($db, $jobId) {
    // processed_items = items done
    $stmt = $db->prepare("SELECT 
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_cnt,
        SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as err_cnt,
        COUNT(*) as total_cnt
        FROM job_items WHERE job_id = ?");
    $stmt->execute([$jobId]);
    $row = $stmt->fetch();
    $done = (int)$row['done_cnt'];
    $err = (int)$row['err_cnt'];
    $total = (int)$row['total_cnt'];
    $upd = $db->prepare('UPDATE jobs SET processed_items = ?, error_count = ?, total_items = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $upd->execute([$done, $err, $total, $jobId]);
}

?>


