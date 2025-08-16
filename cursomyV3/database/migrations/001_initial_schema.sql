-- ========================================
-- CURSOSMY V3 - MIGRACIÓN INICIAL
-- Esquema completo de base de datos
-- ========================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('student', 'instructor', 'admin')) DEFAULT 'student',
    instructor_id INTEGER,
    avatar_url TEXT,
    bio TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME,
    activo BOOLEAN DEFAULT 1,
    email_verificado BOOLEAN DEFAULT 0,
    token_verificacion TEXT,
    token_recuperacion TEXT,
    fecha_expiracion_token DATETIME,
    configuracion JSON,
    FOREIGN KEY (instructor_id) REFERENCES instructores(id) ON DELETE SET NULL
);

-- Tabla de instructores
CREATE TABLE IF NOT EXISTS instructores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER UNIQUE NOT NULL,
    especialidad TEXT,
    experiencia_anos INTEGER,
    certificaciones TEXT,
    redes_sociales JSON,
    calificacion_promedio REAL DEFAULT 0.0,
    total_estudiantes INTEGER DEFAULT 0,
    total_cursos INTEGER DEFAULT 0,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT 1,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de temáticas
CREATE TABLE IF NOT EXISTS tematicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    color TEXT DEFAULT '#3B82F6',
    icono TEXT DEFAULT 'book',
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    instructor_id INTEGER NOT NULL,
    tematica_id INTEGER,
    precio REAL DEFAULT 0.0,
    precio_original REAL DEFAULT 0.0,
    nivel TEXT CHECK (nivel IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    idioma TEXT DEFAULT 'es',
    duracion_total INTEGER DEFAULT 0, -- en segundos
    total_clases INTEGER DEFAULT 0,
    total_secciones INTEGER DEFAULT 0,
    imagen_portada TEXT,
    video_presentacion TEXT,
    requisitos TEXT,
    objetivos TEXT,
    certificado_disponible BOOLEAN DEFAULT 1,
    estado TEXT CHECK (estado IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    fecha_publicacion DATETIME,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    estadisticas JSON,
    configuracion JSON,
    FOREIGN KEY (instructor_id) REFERENCES instructores(id) ON DELETE CASCADE,
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id) ON DELETE SET NULL
);

-- Tabla de secciones
CREATE TABLE IF NOT EXISTS secciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL,
    duracion_total INTEGER DEFAULT 0, -- en segundos
    total_clases INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

-- Tabla de clases
CREATE TABLE IF NOT EXISTS clases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seccion_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT CHECK (tipo IN ('video', 'documento', 'quiz', 'tarea')) DEFAULT 'video',
    contenido TEXT, -- URL del archivo o contenido del documento
    duracion INTEGER DEFAULT 0, -- en segundos para videos
    orden INTEGER NOT NULL,
    recursos JSON, -- Array de recursos adicionales
    subtitulos TEXT, -- URL de archivo de subtítulos
    transcripcion TEXT,
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadatos JSON, -- Información del archivo (tamaño, formato, etc.)
    FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE
);

-- Tabla de recursos
CREATE TABLE IF NOT EXISTS recursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clase_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT NOT NULL, -- pdf, zip, imagen, etc.
    url TEXT NOT NULL,
    tamaño INTEGER, -- en bytes
    descargable BOOLEAN DEFAULT 1,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE
);

-- Tabla de inscripciones
CREATE TABLE IF NOT EXISTS inscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    curso_id INTEGER NOT NULL,
    fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_completado DATETIME,
    progreso REAL DEFAULT 0.0, -- Porcentaje de 0 a 100
    ultima_clase_vista INTEGER,
    activo BOOLEAN DEFAULT 1,
    UNIQUE(usuario_id, curso_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (ultima_clase_vista) REFERENCES clases(id) ON DELETE SET NULL
);

-- Tabla de progreso
CREATE TABLE IF NOT EXISTS progreso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    clase_id INTEGER NOT NULL,
    curso_id INTEGER NOT NULL,
    completado BOOLEAN DEFAULT 0,
    tiempo_visto INTEGER DEFAULT 0, -- en segundos
    ultima_posicion INTEGER DEFAULT 0, -- en segundos para videos
    fecha_ultimo_acceso DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_completado DATETIME,
    UNIQUE(usuario_id, clase_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

-- Tabla de notas
CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    clase_id INTEGER NOT NULL,
    contenido TEXT NOT NULL,
    tiempo_marca INTEGER, -- en segundos para videos
    tipo TEXT CHECK (tipo IN ('nota', 'marcador', 'pregunta')) DEFAULT 'nota',
    color TEXT DEFAULT '#FFD700',
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE
);

-- Tabla de comentarios
CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    clase_id INTEGER NOT NULL,
    contenido TEXT NOT NULL,
    comentario_padre_id INTEGER,
    tiempo_marca INTEGER, -- en segundos para videos
    activo BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
    FOREIGN KEY (comentario_padre_id) REFERENCES comentarios(id) ON DELETE CASCADE
);

-- Tabla de uploads
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    nombre_archivo TEXT NOT NULL,
    nombre_original TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    tamaño INTEGER NOT NULL, -- en bytes
    ruta_archivo TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    progreso REAL DEFAULT 0.0,
    metadatos JSON,
    error_mensaje TEXT,
    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_completado DATETIME,
    fecha_expiracion DATETIME,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de colas de trabajo
CREATE TABLE IF NOT EXISTS colas_trabajo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, -- 'video_processing', 'image_processing', 'document_conversion'
    datos JSON NOT NULL,
    prioridad INTEGER DEFAULT 0,
    estado TEXT CHECK (estado IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    intentos INTEGER DEFAULT 0,
    max_intentos INTEGER DEFAULT 3,
    worker_id TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio DATETIME,
    fecha_completado DATETIME,
    error_mensaje TEXT,
    resultado JSON
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    tipo TEXT CHECK (tipo IN ('access', 'refresh')) DEFAULT 'access',
    expira_en DATETIME NOT NULL,
    activo BOOLEAN DEFAULT 1,
    ip_address TEXT,
    user_agent TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_ultimo_uso DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    tabla TEXT,
    registro_id INTEGER,
    datos_anteriores JSON,
    datos_nuevos JSON,
    ip_address TEXT,
    user_agent TEXT,
    fecha_accion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS configuraciones_sistema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
    descripcion TEXT,
    editable BOOLEAN DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================================

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- Índices para cursos
CREATE INDEX IF NOT EXISTS idx_cursos_instructor ON cursos(instructor_id);
CREATE INDEX IF NOT EXISTS idx_cursos_tematica ON cursos(tematica_id);
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_fecha_publicacion ON cursos(fecha_publicacion);

-- Índices para secciones
CREATE INDEX IF NOT EXISTS idx_secciones_curso ON secciones(curso_id);
CREATE INDEX IF NOT EXISTS idx_secciones_orden ON secciones(curso_id, orden);

-- Índices para clases
CREATE INDEX IF NOT EXISTS idx_clases_seccion ON clases(seccion_id);
CREATE INDEX IF NOT EXISTS idx_clases_orden ON clases(seccion_id, orden);
CREATE INDEX IF NOT EXISTS idx_clases_tipo ON clases(tipo);

-- Índices para inscripciones
CREATE INDEX IF NOT EXISTS idx_inscripciones_usuario ON inscripciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_curso ON inscripciones(curso_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_activo ON inscripciones(activo);

-- Índices para progreso
CREATE INDEX IF NOT EXISTS idx_progreso_usuario ON progreso(usuario_id);
CREATE INDEX IF NOT EXISTS idx_progreso_clase ON progreso(clase_id);
CREATE INDEX IF NOT EXISTS idx_progreso_curso ON progreso(curso_id);

-- Índices para uploads
CREATE INDEX IF NOT EXISTS idx_uploads_usuario ON uploads(usuario_id);
CREATE INDEX IF NOT EXISTS idx_uploads_estado ON uploads(estado);
CREATE INDEX IF NOT EXISTS idx_uploads_fecha_inicio ON uploads(fecha_inicio);

-- Índices para colas de trabajo
CREATE INDEX IF NOT EXISTS idx_colas_tipo ON colas_trabajo(tipo);
CREATE INDEX IF NOT EXISTS idx_colas_estado ON colas_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_colas_prioridad ON colas_trabajo(prioridad);

-- Índices para sesiones
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_activo ON sesiones(activo);

-- ========================================
-- TRIGGERS PARA MANTENER INTEGRIDAD
-- ========================================

-- Trigger para actualizar fecha_actualizacion en cursos
CREATE TRIGGER IF NOT EXISTS trigger_cursos_actualizacion
    AFTER UPDATE ON cursos
    BEGIN
        UPDATE cursos SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para actualizar fecha_actualizacion en secciones
CREATE TRIGGER IF NOT EXISTS trigger_secciones_actualizacion
    AFTER UPDATE ON secciones
    BEGIN
        UPDATE secciones SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para actualizar fecha_actualizacion en clases
CREATE TRIGGER IF NOT EXISTS trigger_clases_actualizacion
    AFTER UPDATE ON clases
    BEGIN
        UPDATE clases SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para actualizar fecha_actualizacion en notas
CREATE TRIGGER IF NOT EXISTS trigger_notas_actualizacion
    AFTER UPDATE ON notas
    BEGIN
        UPDATE notas SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para actualizar fecha_actualizacion en comentarios
CREATE TRIGGER IF NOT EXISTS trigger_comentarios_actualizacion
    AFTER UPDATE ON comentarios
    BEGIN
        UPDATE comentarios SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para actualizar fecha_actualizacion en configuraciones_sistema
CREATE TRIGGER IF NOT EXISTS trigger_configuraciones_actualizacion
    AFTER UPDATE ON configuraciones_sistema
    BEGIN
        UPDATE configuraciones_sistema SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista de cursos con información del instructor
CREATE VIEW IF NOT EXISTS vista_cursos_completos AS
SELECT 
    c.*,
    u.nombre as instructor_nombre,
    u.apellido as instructor_apellido,
    u.email as instructor_email,
    t.nombre as tematica_nombre,
    t.color as tematica_color
FROM cursos c
JOIN instructores i ON c.instructor_id = i.id
JOIN usuarios u ON i.usuario_id = u.id
LEFT JOIN tematicas t ON c.tematica_id = t.id
WHERE c.activo = 1;

-- Vista de progreso del usuario por curso
CREATE VIEW IF NOT EXISTS vista_progreso_usuario AS
SELECT 
    p.usuario_id,
    p.curso_id,
    c.titulo as curso_titulo,
    COUNT(p.clase_id) as total_clases,
    SUM(CASE WHEN p.completado = 1 THEN 1 ELSE 0 END) as clases_completadas,
    ROUND((SUM(CASE WHEN p.completado = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(p.clase_id)), 2) as porcentaje_completado
FROM progreso p
JOIN clases cl ON p.clase_id = cl.id
JOIN secciones s ON cl.seccion_id = s.id
JOIN cursos c ON s.curso_id = c.id
GROUP BY p.usuario_id, p.curso_id;

-- Vista de estadísticas de instructores
CREATE VIEW IF NOT EXISTS vista_estadisticas_instructores AS
SELECT 
    i.id,
    u.nombre,
    u.apellido,
    u.email,
    i.especialidad,
    i.calificacion_promedio,
    i.total_estudiantes,
    i.total_cursos,
    COUNT(DISTINCT ins.usuario_id) as estudiantes_activos,
    AVG(ins.progreso) as progreso_promedio_estudiantes
FROM instructores i
JOIN usuarios u ON i.usuario_id = u.id
LEFT JOIN cursos c ON i.id = c.instructor_id
LEFT JOIN inscripciones ins ON c.id = ins.curso_id
WHERE i.activo = 1
GROUP BY i.id;
