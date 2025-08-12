/**
 * Sistema de Cola de Importación v2.0
 * Gestiona múltiples importaciones de cursos de forma asíncrona
 */

class ImportQueue {
    constructor() {
        this.queue = new Map(); // id -> ImportJob
        this.isProcessing = false;
        this.isPaused = false;
        this.currentJob = null;
        this.storageKey = 'importQueue_v2';
        this.listeners = new Set();
        // Propiedad de pestaña (single-tab owner)
        this.ownerLockKey = 'importQueue_owner';
        this.ownerHeartbeatKey = 'importQueue_owner_heartbeat';
        this.ownerHeartbeatMs = 15000; // 15s de tolerancia
        this.tabId = this.getOrCreateTabId();
        this.isOwnerFlag = false;
        
        // Cargar cola persistente
        this.loadFromStorage();
        
        // Setup event listeners
        this.setupUnloadProtection();

        // Inicializar ownership y latido
        this.initializeOwnership();
        
        // Auto-iniciar procesamiento si hay trabajos pendientes
        if (this.hasActiveTasks()) {
            console.log('[QUEUE] Iniciando procesamiento automático al cargar');
            setTimeout(() => this.processQueue(), 1000);
        }

        // Mecanismo de recuperación automática cada 30 segundos
        setInterval(() => {
            if (this.hasActiveTasks() && !this.isProcessing && !this.isPaused) {
                console.log('[QUEUE] Mecanismo de recuperación: reiniciando cola atascada');
                this.processQueue();
            }
        }, 30000);
    }

    // ======== Gestión de ownership de pestaña ========
    getOrCreateTabId() {
        // Generar SIEMPRE un id nuevo por carga de pestaña para evitar clones al duplicar
        try {
            const randomPart = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now());
            const id = 'tab_' + randomPart;
            // Guardar solo para depuración dentro de la misma carga
            try { sessionStorage.setItem('importQueue_tabId', id); } catch {}
            return id;
        } catch (_) {
            return 'tab_fallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        }
    }

    initializeOwnership() {
        // Intentar reclamar si no hay dueño o está expirado
        this.refreshOwnershipState();
        if (!this.isOwnerFlag) {
            this.tryClaimOwnership();
        }
        // Heartbeat
        setInterval(() => this.heartbeat(), 5000);
        // Escuchar cambios entre pestañas
        window.addEventListener('storage', (e) => {
            if (e.key === this.ownerLockKey || e.key === this.ownerHeartbeatKey) {
                this.refreshOwnershipState();
            }
        });
        // Liberar ownership al cerrar
        window.addEventListener('beforeunload', () => {
            // Guardar estado de emergencia y liberar ownership SOLO si somos dueños
            if (this.isOwnerFlag && this.hasActiveTasks()) {
                this.saveEmergencyState();
            }
            this.releaseOwnership();
        });
    }

    getOwnerInfo() {
        try { return JSON.parse(localStorage.getItem(this.ownerLockKey) || 'null'); } catch { return null; }
    }

    isOwner() {
        return !!this.isOwnerFlag;
    }

    refreshOwnershipState() {
        const info = this.getOwnerInfo();
        const now = Date.now();
        let ownerAlive = false;
        if (info && info.tabId && typeof info.timestamp === 'number') {
            const hb = parseInt(localStorage.getItem(this.ownerHeartbeatKey) || '0', 10);
            const last = Math.max(info.timestamp, hb || 0);
            ownerAlive = (now - last) < this.ownerHeartbeatMs;
        }
        const prev = this.isOwnerFlag;
        this.isOwnerFlag = info && info.tabId === this.tabId && ownerAlive;
        if (prev !== this.isOwnerFlag) {
            this.notifyListeners('ownership_update', { isOwner: this.isOwnerFlag, owner: info });
        }
    }

    tryClaimOwnership() {
        const info = this.getOwnerInfo();
        const now = Date.now();
        let canClaim = true;
        if (info && info.tabId) {
            const hb = parseInt(localStorage.getItem(this.ownerHeartbeatKey) || '0', 10);
            const last = Math.max(info.timestamp || 0, hb || 0);
            canClaim = (now - last) >= this.ownerHeartbeatMs; // dueño ausente
        }
        if (canClaim) {
            const newInfo = { tabId: this.tabId, timestamp: now };
            try { localStorage.setItem(this.ownerLockKey, JSON.stringify(newInfo)); } catch {}
            this.isOwnerFlag = true;
            this.notifyListeners('ownership_update', { isOwner: true, owner: newInfo });
        } else {
            this.isOwnerFlag = false;
        }
    }

    heartbeat() {
        if (this.isOwnerFlag) {
            try {
                localStorage.setItem(this.ownerHeartbeatKey, String(Date.now()));
                // refrescar lock timestamp periódicamente
                const current = this.getOwnerInfo() || { tabId: this.tabId };
                localStorage.setItem(this.ownerLockKey, JSON.stringify({ tabId: current.tabId, timestamp: Date.now() }));
            } catch {}
        } else {
            // comprobar si podemos reclamar (dueño cayó)
            this.refreshOwnershipState();
        }
    }

    releaseOwnership() {
        if (this.isOwnerFlag) {
            try {
                const info = this.getOwnerInfo();
                if (info && info.tabId === this.tabId) {
                    localStorage.removeItem(this.ownerLockKey);
                    localStorage.removeItem(this.ownerHeartbeatKey);
                }
            } catch {}
        }
        this.isOwnerFlag = false;
    }

    /**
     * Crear un nuevo trabajo de importación
     */
    createJob(config) {
        const job = new ImportJob({
            id: 'import_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            courseTitle: config.courseTitle,
            courseMode: config.courseMode, // 'new' | 'existing'
            courseId: config.courseId, // null para nuevos, ID para existentes
            sections: config.sections, // Map de secciones y archivos
            createdAt: Date.now(),
            originTabId: this.tabId
        });
        
        this.queue.set(job.id, job);
        this.saveToStorage();
        this.notifyListeners('job_added', job);
        
        // Auto-iniciar procesamiento
        if (!this.isProcessing) {
            setTimeout(() => this.processQueue(), 100);
        }
        
        return job;
    }

    /**
     * Procesar cola de trabajos
     */
    async processQueue() {
        // Permitir procesamiento de subidas locales desde cualquier pestaña
        if (this.isProcessing || this.isPaused) {
            console.log('[QUEUE] ProcessQueue bloqueado:', { isProcessing: this.isProcessing, isPaused: this.isPaused });
            return;
        }
        
        const pendingJobs = Array.from(this.queue.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => a.createdAt - b.createdAt);
        
        console.log('[QUEUE] Trabajos pendientes encontrados:', pendingJobs.length);
        
        if (pendingJobs.length === 0) {
            this.isProcessing = false;
            this.currentJob = null;
            this.notifyListeners('queue_completed');
            console.log('[QUEUE] Cola completada - no hay trabajos pendientes');
            return;
        }
        
        this.isProcessing = true;
        this.currentJob = pendingJobs[0];
        console.log('[QUEUE] Iniciando procesamiento del trabajo:', this.currentJob.courseTitle);
        
        try {
            await this.processJob(this.currentJob);
        } catch (error) {
            console.error('[QUEUE] Error procesando trabajo:', error);
            this.currentJob.setStatus('error', 'Error inesperado: ' + error.message);
        }
        
        this.saveToStorage();
        
        // IMPORTANTE: Continuar procesamiento independientemente del estado de pausa
        // La pausa solo afecta al inicio de nuevos trabajos, no a la continuidad de la cola
        setTimeout(() => {
            this.isProcessing = false;
            this.currentJob = null;
            if (!this.isPaused) {
                this.processQueue();
            }
        }, 500);
    }

    /**
     * Procesar un trabajo individual
     */
    async processJob(job) {
        job.setStatus('processing', 'Iniciando procesamiento...');
        job.startedAt = Date.now();
        this.notifyListeners('job_started', job);
        
        try {
            // Asegurar job en servidor (crea curso si aplica)
            await this.ensureServerJob(job);

            // Subir todos los archivos al área temporal del servidor
            job.statusMessage = 'Subiendo archivos al servidor...';
            this.notifyListeners('progress_updated', job);
            await this.processJobSections(job);

            // Finalizar fase de subida y encolar para procesamiento en servidor
            await this.finalizeServerUploads(job);

            // Iniciar sondeo del estado en servidor hasta completar
            job.statusMessage = 'Procesando en servidor...';
            job.phase = 'processing';
            await this.pollServerStatus(job);
            
        } catch (error) {
            job.setStatus('error', error.message);
            job.completedAt = Date.now();
            this.notifyListeners('job_error', job);
            throw error;
        }
    }

    /**
     * Crear curso nuevo
     */
    async createCourse(job) {
        job.updateProgress('Creando curso nuevo...', 0, job.getTotalFiles());
        
        const formData = new FormData();
        formData.append('titulo', job.courseTitle);
        
        const response = await fetch('api/cursos.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error('Error creando curso: ' + (result.message || 'Error desconocido'));
        }
        
        job.courseId = result.data.id;
        job.updateProgress('Curso creado exitosamente', 0, job.getTotalFiles());
        // Notificar a la UI para insertar placeholder en index
        this.notifyListeners('job_course_created', job);
    }

    /**
     * Procesar secciones y archivos del trabajo
     */
    async processJobSections(job) {
        const sections = Array.from(job.sections.entries());
        let globalFileIndex = 0;
        const totalFiles = job.getTotalFiles();
        
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const [sectionName, files] = sections[sectionIndex];
            
            // Verificar si la sección fue cancelada
            if (job.cancelledSections.has(sectionName)) {
                job.updateProgress(`Sección "${sectionName}" cancelada`, globalFileIndex, totalFiles);
                continue;
            }
            
            job.updateProgress(`Procesando sección: ${sectionName}`, globalFileIndex, totalFiles);
            
            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                const file = files[fileIndex];
                const fileKey = `${sectionName}:${file.name}`;
                
                // Verificar si el archivo fue cancelado
                if (job.cancelledFiles.has(fileKey)) {
                    globalFileIndex++;
                    continue;
                }
                
                // Verificar si el trabajo está pausado
                while (this.isPaused && job.status === 'processing') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Verificar si el trabajo fue cancelado completamente
                if (job.status === 'cancelled') {
                    throw new Error('Trabajo cancelado por el usuario');
                }
                
                try {
                    // Subir item al job del servidor
                    await this.uploadFile(job, file, sectionName, sectionIndex + 1, fileIndex + 1);
                    // Progreso de fase 'uploading'
                    job.completedFiles++;
                    globalFileIndex++;
                    if (job.phase !== 'processing') {
                        job.updateProgress(`✅ ${sectionName} / ${file.name}`, globalFileIndex, totalFiles);
                    }
                    // Guardar progreso periódicamente
                    this.saveToStorage();
                    
                } catch (error) {
                    job.errors.push({
                        section: sectionName,
                        file: file.name,
                        error: error.message,
                        timestamp: Date.now()
                    });
                    globalFileIndex++;
                    if (job.phase !== 'processing') {
                        job.updateProgress(`Error: ${file.name}`, globalFileIndex, totalFiles);
                    }
                }
            }
        }
    }

    /**
     * Subir un archivo individual
     */
    async uploadFile(job, file, sectionName, sectionOrder, videoOrder) {
        // Subir archivo como item del job al servidor (fase temporal)
        const formData = new FormData();
        formData.append('action', 'add_item');
        formData.append('job_id', job.serverJobId);
        formData.append('upload_token', job.uploadToken);
        formData.append('section_name', sectionName);
        formData.append('section_order', sectionOrder);
        formData.append('video_order', videoOrder);
        formData.append('file', file);

        const resp = await fetch('api/jobs.php?action=add_item', { method: 'POST', body: formData });
        const text = await resp.text();
        let data = {};
        try { data = JSON.parse(text); } catch (_) { throw new Error('Respuesta del servidor inválida'); }
        if (!data.success) throw new Error(data.message || 'Error en la subida');
        return data;
    }

    async ensureServerJob(job) {
        if (job.serverJobId && job.uploadToken) return;
        if (job.courseMode === 'new' && !job.courseTitle) throw new Error('Título de curso requerido');

        const formData = new FormData();
        formData.append('action', 'create');
        formData.append('mode', job.courseMode);
        if (job.courseMode === 'existing') {
            formData.append('curso_id', job.courseId);
        } else {
            formData.append('titulo', job.courseTitle);
        }

        const resp = await fetch('api/jobs.php?action=create', { method: 'POST', body: formData });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'No se pudo crear el job en servidor');
        job.serverJobId = data.data.job_id;
        job.uploadToken = data.data.upload_token;
        if (data.data.curso_id) {
            job.courseId = data.data.curso_id;
            // Notificar creación para placeholder en index
            this.notifyListeners('job_course_created', job);
        }
    }

    async finalizeServerUploads(job) {
        const formData = new FormData();
        formData.append('action', 'finalize_uploads');
        formData.append('job_id', job.serverJobId);
        formData.append('upload_token', job.uploadToken);
        const resp = await fetch('api/jobs.php?action=finalize_uploads', { method: 'POST', body: formData });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'No se pudo finalizar la subida');
    }

    async serverWorkerTick(max = 5) {
        try {
            await fetch(`api/jobs-worker.php?max=${max}`);
        } catch (_) {}
    }

    async pollServerStatus(job) {
        // Bucle hasta estado terminal
        const pollOnce = async () => {
            await this.serverWorkerTick(5);
            const resp = await fetch(`api/jobs.php?action=status&job_id=${encodeURIComponent(job.serverJobId)}`);
            const data = await resp.json();
            if (!data.success) return false;
            const j = data.data.job;
            const total = parseInt(j.total_items || 0, 10);
            const processed = parseInt(j.processed_items || 0, 10);
            job.updateProgress('Procesando en servidor...', processed, total);
            // Mapear estado servidor → cliente
            const status = j.status;
            if (status === 'completed') {
                job.setStatus('completed', 'Importación completada');
                job.completedAt = Date.now();
                this.notifyListeners('job_completed', job);
                this.showCompletionNotification(job);
                return true;
            }
            if (status === 'cancelled') {
                job.setStatus('cancelled', 'Cancelado');
                this.notifyListeners('job_cancelled', job);
                return true;
            }
            if (status === 'error') {
                job.setStatus('error', 'Error en procesamiento');
                this.notifyListeners('job_error', job);
                return true;
            }
            // Continuar
            return false;
        };

        // Hacer varios ciclos hasta terminar
        for (;;) {
            const done = await pollOnce();
            if (done) break;
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    /**
     * Controles de cola
     */
    pauseQueue() {
        this.isPaused = true;
        this.notifyListeners('queue_paused');
    }

    resumeQueue() {
        this.isPaused = false;
        this.notifyListeners('queue_resumed');
        
        // Forzar reinicio de procesamiento
        console.log('[QUEUE] Reanudando cola, estado:', { isProcessing: this.isProcessing, pendingJobs: this.getStats().pending });
        if (!this.isProcessing) {
            setTimeout(() => this.processQueue(), 100);
        }
    }

    cancelJob(jobId) {
        const job = this.queue.get(jobId);
        if (!job) return false;
        
        job.setStatus('cancelled', 'Cancelado por el usuario');
        
        // Limpiar archivos temporales si el trabajo estaba en progreso
        this.cleanupJobFiles(job);
        
        this.notifyListeners('job_cancelled', job);
        this.saveToStorage();
        return true;
    }

    cancelSection(jobId, sectionName) {
        const job = this.queue.get(jobId);
        if (!job) return false;
        
        job.cancelledSections.add(sectionName);
        
        // Limpiar archivos temporales de la sección cancelada
        this.cleanupSection(jobId, sectionName);
        
        this.notifyListeners('section_cancelled', { job, sectionName });
        this.saveToStorage();
        return true;
    }

    cancelFile(jobId, sectionName, fileName) {
        const job = this.queue.get(jobId);
        if (!job) return false;
        
        const fileKey = `${sectionName}:${fileName}`;
        job.cancelledFiles.add(fileKey);
        
        // Limpiar archivo temporal específico
        this.cleanupFile(jobId, sectionName, fileName);
        
        this.notifyListeners('file_cancelled', { job, sectionName, fileName });
        this.saveToStorage();
        return true;
    }

    cancelAll() {
        const jobsToCancel = Array.from(this.queue.values())
            .filter(job => job.status === 'pending' || job.status === 'processing');
        
        jobsToCancel.forEach(job => {
            job.setStatus('cancelled', 'Cancelado en lote');
            this.cleanupJobFiles(job);
        });
        
        this.isPaused = false;
        this.isProcessing = false;
        this.currentJob = null;
        this.notifyListeners('all_cancelled');
        this.saveToStorage();
    }

    /**
     * Gestión de estado y persistencia
     */
    hasActiveTasks() {
        return Array.from(this.queue.values()).some(job => 
            job.status === 'pending' || job.status === 'processing'
        );
    }

    getStats() {
        const jobs = Array.from(this.queue.values());
        return {
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            processing: jobs.filter(j => j.status === 'processing').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            cancelled: jobs.filter(j => j.status === 'cancelled').length,
            error: jobs.filter(j => j.status === 'error').length
        };
    }

    saveToStorage() {
        const data = {
            queue: Array.from(this.queue.entries()).map(([id, job]) => [id, job.serialize()]),
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            currentJobId: this.currentJob ? this.currentJob.id : null,
            lastSaved: Date.now()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            if (data.queue) {
                this.queue = new Map(data.queue.map(([id, jobData]) => 
                    [id, ImportJob.deserialize(jobData)]
                ));
                this.isPaused = data.isPaused || false;
                // Reset processing state on reload
                this.isProcessing = false;
                this.currentJob = null;
            }
        } catch (error) {
            console.warn('[QUEUE] Error cargando desde storage:', error);
            this.queue = new Map();
        }
    }

    setupUnloadProtection() {
        // Protección contra cierre/recarga de ventana
        window.addEventListener('beforeunload', (event) => {
            // Solo advertir si esta pestaña tiene trabajos activos originados aquí
            const hasLocalActive = Array.from(this.queue.values()).some(job => 
                job.originTabId === this.tabId && (job.status === 'pending' || job.status === 'processing')
            );
            if (hasLocalActive) {
                const stats = this.getStats();
                const activeCount = stats.pending + stats.processing;
                const message = `⚠️ IMPORTACIONES EN PROGRESO\n\n` +
                    `• ${activeCount} curso(s) en cola\n` +
                    `• Los archivos ya subidos se mantendrán\n` +
                    `• El progreso se perderá si sales ahora\n\n` +
                    `¿Estás seguro de que quieres salir?`;
                
                event.preventDefault();
                event.returnValue = message;
                return message;
            }
        });

        // Protección adicional contra navegación
        window.addEventListener('pagehide', () => {
            if (this.isOwnerFlag && this.hasActiveTasks()) {
                // Guardar estado de emergencia solo desde la pestaña dueña
                this.saveEmergencyState();
            }
        });

        // Detección de reactivación de la pestaña
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refreshOwnershipState();
                if (this.isOwnerFlag && this.hasActiveTasks()) {
                    // Verificar si hay trabajos perdidos y restaurar si es necesario
                    this.checkAndRestoreState();
                }
            }
        });

        // Protección contra F5 y Ctrl+R
        document.addEventListener('keydown', (event) => {
            if (this.hasActiveTasks() && 
                (event.key === 'F5' || (event.ctrlKey && event.key === 'r'))) {
                event.preventDefault();
                
                const stats = this.getStats();
                const message = `⚠️ RECARGA BLOQUEADA\n\n` +
                    `Hay ${stats.pending + stats.processing} importaciones en progreso.\n` +
                    `Usa el botón de "Progreso" en la navegación para ver el estado.\n\n` +
                    `¿Quieres forzar la recarga de todas formas?`;
                
                if (confirm(message)) {
                    this.saveEmergencyState();
                    window.location.reload();
                }
            }
        });

        // Mostrar banner de advertencia cuando hay tareas activas
        this.addEventListener((event) => {
            this.updateUnloadWarningBanner();
        });
    }

    saveEmergencyState() {
        const emergencyData = {
            queue: Array.from(this.queue.entries()).map(([id, job]) => [id, job.serialize()]),
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        localStorage.setItem(this.storageKey + '_emergency', JSON.stringify(emergencyData));
        console.warn('[QUEUE] Estado de emergencia guardado');
    }

    checkAndRestoreState() {
        try {
            const emergencyData = localStorage.getItem(this.storageKey + '_emergency');
            if (emergencyData) {
                const data = JSON.parse(emergencyData);
                const timeDiff = Date.now() - data.timestamp;
                
                // Si la emergencia fue hace menos de 5 minutos, preguntar si restaurar
                if (timeDiff < 5 * 60 * 1000) {
                    const message = `🔄 ESTADO DE EMERGENCIA DETECTADO\n\n` +
                        `Se detectó una sesión interrumpida hace ${Math.round(timeDiff / 1000)} segundos.\n` +
                        `¿Quieres restaurar las importaciones en progreso?`;
                    
                    if (confirm(message)) {
                        this.queue = new Map(data.queue.map(([id, jobData]) => 
                            [id, ImportJob.deserialize(jobData)]
                        ));
                        this.saveToStorage();
                        this.notifyListeners('queue_restored');
                        
                        // Reiniciar procesamiento si había trabajos pendientes
                        if (this.hasActiveTasks()) {
                            this.processQueue();
                        }
                    }
                }
                
                // Limpiar estado de emergencia
                localStorage.removeItem(this.storageKey + '_emergency');
            }
        } catch (error) {
            console.error('[QUEUE] Error restaurando estado de emergencia:', error);
        }
    }

    updateUnloadWarningBanner() {
        // Mostrar banner SOLO si esta pestaña tiene trabajos activos que ella misma inició
        const activeTasks = Array.from(this.queue.values()).some(job => 
            job.originTabId === this.tabId && (job.status === 'pending' || job.status === 'processing')
        );
        let banner = document.getElementById('unloadWarningBanner');
        
        if (activeTasks && !banner) {
            // Crear banner de advertencia
            banner = document.createElement('div');
            banner.id = 'unloadWarningBanner';
            banner.className = 'fixed top-0 left-0 right-0 bg-yellow-600 text-white text-center py-2 text-sm font-medium z-40 shadow-lg';
            banner.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Importaciones en progreso - No cierres esta ventana</span>
                    <button onclick="openQueueProgressModal()" class="bg-yellow-700 hover:bg-yellow-800 px-2 py-1 rounded text-xs ml-2">
                        Ver Progreso
                    </button>
                </div>
            `;
            document.body.appendChild(banner);
            
            // Ajustar el padding del body para compensar el banner
            document.body.style.paddingTop = '40px';
            
        } else if (!activeTasks && banner) {
            // Remover banner cuando no hay tareas activas
            banner.remove();
            document.body.style.paddingTop = '0px';
        }
    }

    /**
     * Sistema de eventos
     */
    addEventListener(callback) {
        this.listeners.add(callback);
    }

    removeEventListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(event, data = null) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data, this);
            } catch (error) {
                console.error('[QUEUE] Error en listener:', error);
            }
        });
    }

    /**
     * Cleanup y utilidades
     */
    clearCompleted() {
        const completedJobs = Array.from(this.queue.values())
            .filter(job => job.status === 'completed' || job.status === 'cancelled' || job.status === 'error');
        
        // Limpiar archivos temporales de trabajos cancelados
        completedJobs
            .filter(job => job.status === 'cancelled')
            .forEach(job => this.cleanupJobFiles(job));
        
        const completedIds = completedJobs.map(job => job.id);
        completedIds.forEach(id => this.queue.delete(id));
        this.saveToStorage();
        this.notifyListeners('queue_cleaned');
    }

    /**
     * Limpiar archivos temporales de un trabajo
     */
    cleanupJobFiles(job) {
        // En este sistema, los archivos están en memoria (File objects)
        // No hay archivos temporales en disco que limpiar directamente
        // Pero podemos revocar URLs de object si los hubiera
        
        console.log(`[QUEUE] Limpiando recursos del trabajo: ${job.courseTitle}`);
        
        // Si el trabajo tenía archivos con URLs temporales, revocarlos
        job.sections.forEach((files, sectionName) => {
            files.forEach(file => {
                // Revocar object URLs si existen
                if (file._tempURL) {
                    URL.revokeObjectURL(file._tempURL);
                    delete file._tempURL;
                }
            });
        });
        
        // Marcar archivos como liberados
        job._filesCleanedUp = true;
        
        // Notificar limpieza
        this.notifyListeners('job_cleanup', job);
    }

    /**
     * Limpiar archivos específicos de una sección o archivo
     */
    cleanupSection(jobId, sectionName) {
        const job = this.queue.get(jobId);
        if (!job) return;
        
        const files = job.sections.get(sectionName);
        if (files) {
            files.forEach(file => {
                if (file._tempURL) {
                    URL.revokeObjectURL(file._tempURL);
                    delete file._tempURL;
                }
            });
        }
        
        console.log(`[QUEUE] Sección "${sectionName}" limpiada`);
    }

    cleanupFile(jobId, sectionName, fileName) {
        const job = this.queue.get(jobId);
        if (!job) return;
        
        const files = job.sections.get(sectionName);
        if (files) {
            const file = files.find(f => f.name === fileName);
            if (file && file._tempURL) {
                URL.revokeObjectURL(file._tempURL);
                delete file._tempURL;
            }
        }
        
        console.log(`[QUEUE] Archivo "${fileName}" limpiado`);
    }

    getErrorReport() {
        const errorJobs = Array.from(this.queue.values())
            .filter(job => job.status === 'error' || job.errors.length > 0);
        
        return {
            totalJobs: errorJobs.length,
            totalErrors: errorJobs.reduce((sum, job) => sum + job.errors.length, 0),
            jobs: errorJobs.map(job => ({
                id: job.id,
                courseTitle: job.courseTitle,
                status: job.status,
                errors: job.errors,
                createdAt: job.createdAt,
                completedAt: job.completedAt
            }))
        };
    }
}

/**
 * Clase para un trabajo de importación individual
 */
class ImportJob {
    constructor(config) {
        this.id = config.id;
        this.courseTitle = config.courseTitle;
        this.courseMode = config.courseMode;
        this.courseId = config.courseId;
        this.sections = config.sections; // Map
        this.status = 'pending'; // pending, processing, completed, cancelled, error
        this.progress = {
            current: '',
            completed: 0,
            total: this.getTotalFiles()
        };
        this.errors = [];
        this.cancelledSections = new Set();
        this.cancelledFiles = new Set();
        this.completedFiles = 0;
        this.createdAt = config.createdAt;
        this.startedAt = null;
        this.completedAt = null;
        this.statusMessage = 'En cola';
        // Integración con cola en servidor
        this.serverJobId = config.serverJobId || null;
        this.uploadToken = config.uploadToken || null;
        this.phase = config.phase || 'uploading'; // uploading | processing
        // Identificador de pestaña que creó este trabajo
        this.originTabId = config.originTabId || null;
    }

    getTotalFiles() {
        let total = 0;
        this.sections.forEach(files => {
            total += files.length;
        });
        return total;
    }

    setStatus(status, message = '') {
        this.status = status;
        this.statusMessage = message;
        
        if (status === 'processing' && !this.startedAt) {
            this.startedAt = Date.now();
        }
        if ((status === 'completed' || status === 'error' || status === 'cancelled') && !this.completedAt) {
            this.completedAt = Date.now();
        }
    }

    updateProgress(current, completed, total) {
        this.progress = { current, completed, total };
        
        // Notificar cambio de progreso para actualizar UI en tiempo real
        if (window.importQueue) {
            window.importQueue.notifyListeners('progress_updated', this);
        }
    }

    getProgressPercentage() {
        if (this.progress.total === 0) return 0;
        return Math.round((this.progress.completed / this.progress.total) * 100);
    }

    getDuration() {
        if (!this.startedAt) return 0;
        const endTime = this.completedAt || Date.now();
        return endTime - this.startedAt;
    }

    serialize() {
        return {
            id: this.id,
            courseTitle: this.courseTitle,
            courseMode: this.courseMode,
            courseId: this.courseId,
            sections: Array.from(this.sections.entries()),
            status: this.status,
            progress: this.progress,
            errors: this.errors,
            cancelledSections: Array.from(this.cancelledSections),
            cancelledFiles: Array.from(this.cancelledFiles),
            completedFiles: this.completedFiles,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            statusMessage: this.statusMessage,
            serverJobId: this.serverJobId,
            uploadToken: this.uploadToken,
            phase: this.phase,
            originTabId: this.originTabId
        };
    }

    static deserialize(data) {
        const job = new ImportJob({
            id: data.id,
            courseTitle: data.courseTitle,
            courseMode: data.courseMode,
            courseId: data.courseId,
            sections: new Map(data.sections || []),
            createdAt: data.createdAt,
            serverJobId: data.serverJobId || null,
            uploadToken: data.uploadToken || null,
            phase: data.phase || 'uploading',
            originTabId: data.originTabId || null
        });
        
        job.status = data.status;
        job.progress = data.progress;
        job.errors = data.errors || [];
        job.cancelledSections = new Set(data.cancelledSections || []);
        job.cancelledFiles = new Set(data.cancelledFiles || []);
        job.completedFiles = data.completedFiles || 0;
        job.startedAt = data.startedAt;
        job.completedAt = data.completedAt;
        job.statusMessage = data.statusMessage || 'En cola';
        
        return job;
    }
}

// Instancia global
window.importQueue = new ImportQueue();

/**
 * Funciones de utilidad para UI
 */
window.ImportQueueUI = {
    formatTime(ms) {
        if (!ms) return '0s';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    },

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getStatusIcon(status) {
        const icons = {
            pending: 'fas fa-clock text-yellow-400',
            processing: 'fas fa-spinner fa-spin text-blue-400',
            completed: 'fas fa-check-circle text-green-400',
            cancelled: 'fas fa-ban text-gray-400',
            error: 'fas fa-exclamation-circle text-red-400'
        };
        return icons[status] || 'fas fa-question-circle text-gray-400';
    },

    getStatusText(status) {
        const texts = {
            pending: 'En cola',
            processing: 'Procesando',
            completed: 'Completado',
            cancelled: 'Cancelado',
            error: 'Error'
        };
        return texts[status] || 'Desconocido';
    }
};

// Agregar al ImportQueue las notificaciones de finalización
ImportQueue.prototype.showCompletionNotification = function(job) {
    const duration = this.formatDuration(job.getDuration());
    const hasErrors = job.errors.length > 0;
    
    const message = hasErrors ?
        `⚠️ Curso "${job.courseTitle}" completado con ${job.errors.length} error(es) en ${duration}` :
        `✅ Curso "${job.courseTitle}" importado exitosamente en ${duration}`;
    
    const type = hasErrors ? 'warning' : 'success';
    
    // Notificación temporal
    if (window.showNotification) {
        window.showNotification(message, type);
    }
    
    // Si hay errores, sugerir ver el informe
    if (hasErrors && confirm(message + '\n\n¿Quieres ver el informe de errores?')) {
        if (window.showErrorReport) {
            window.showErrorReport(job);
        }
    }
};

ImportQueue.prototype.formatDuration = function(ms) {
    if (!ms || ms < 1000) return '< 1s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};
