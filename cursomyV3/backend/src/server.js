/**
 * CURSOSMY V3 - SERVIDOR PRINCIPAL
 * Proyecto completamente independiente
 * Puerto: 3001 (diferente al proyecto PHP)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Importar configuraciones
const logger = require('./config/logger');
const database = require('./config/database');
const socketIO = require('./config/socket');

// Importar rutas
const authRoutes = require('./routes/auth');
const cursoRoutes = require('./routes/cursos');
const seccionRoutes = require('./routes/secciones');
const claseRoutes = require('./routes/clases');
const instructorRoutes = require('./routes/instructores');
const tematicaRoutes = require('./routes/tematicas');
const uploadRoutes = require('./routes/uploads');
const progresoRoutes = require('./routes/progreso');
const notasRoutes = require('./routes/notas');
const recursosRoutes = require('./routes/recursos');

// Importar middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const uploadLimiter = require('./middleware/uploadLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================
// CONFIGURACIÓN DE SEGURIDAD
// ========================================

// Helmet para headers de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configurado para el dominio específico
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ========================================
// MIDDLEWARE BÁSICO
// ========================================

// Compresión gzip
app.use(compression({
  level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024
}));

// Logging con Morgan
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Parsing de JSON y URL encoded
app.use(express.json({ 
  limit: process.env.UPLOAD_MAX_SIZE || '1gb' 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.UPLOAD_MAX_SIZE || '1gb' 
}));

// ========================================
// RUTAS DE LA API
// ========================================

// Ruta de salud del sistema
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '3.0.0',
    database: database.isConnected() ? 'Connected' : 'Disconnected'
  });
});

// Ruta raíz de la API
app.get('/api', (req, res) => {
  res.json({
    message: 'CursosMy V3 API - Proyecto completamente independiente',
    version: '3.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      cursos: '/api/cursos',
      secciones: '/api/secciones',
      clases: '/api/clases',
      instructores: '/api/instructores',
      tematicas: '/api/tematicas',
      uploads: '/api/uploads',
      progreso: '/api/progreso',
      notas: '/api/notas',
      recursos: '/api/recursos'
    }
  });
});

// Rutas de autenticación (sin middleware de auth)
app.use('/api/auth', authRoutes);

// Rutas protegidas (con middleware de auth)
app.use('/api/cursos', authMiddleware, cursoRoutes);
app.use('/api/secciones', authMiddleware, seccionRoutes);
app.use('/api/clases', authMiddleware, claseRoutes);
app.use('/api/instructores', authMiddleware, instructorRoutes);
app.use('/api/tematicas', authMiddleware, tematicaRoutes);
app.use('/api/progreso', authMiddleware, progresoRoutes);
app.use('/api/notas', authMiddleware, notasRoutes);
app.use('/api/recursos', authMiddleware, recursosRoutes);

// Rutas de upload (con límites especiales)
app.use('/api/uploads', authMiddleware, uploadLimiter, uploadRoutes);

// ========================================
// MANEJO DE ERRORES
// ========================================

// Middleware de manejo de errores
app.use(errorHandler);

// Ruta 404 para endpoints no encontrados
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// INICIALIZACIÓN DEL SERVIDOR
// ========================================

async function startServer() {
  try {
    // Conectar a la base de datos
    await database.connect();
    logger.info('✅ Base de datos conectada exitosamente');

    // Crear directorios necesarios
    const fs = require('fs');
    const dirs = [
      process.env.UPLOAD_DIR || './uploads',
      process.env.TEMP_DIR || './temp',
      process.env.THUMBNAILS_DIR || './uploads/thumbnails',
      process.env.RESOURCES_DIR || './uploads/resources',
      './logs',
      './backups'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`📁 Directorio creado: ${dir}`);
      }
    });

    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor CursosMy V3 iniciado en puerto ${PORT}`);
      logger.info(`🌐 URL: http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔌 API: http://localhost:${PORT}/api`);
      logger.info(`📁 Entorno: ${process.env.NODE_ENV}`);
      logger.info(`💾 Base de datos: ${process.env.DB_PATH}`);
    });

    // Configurar Socket.IO
    socketIO.initialize(server);

    // Manejo de señales de terminación
    process.on('SIGTERM', () => {
      logger.info('🛑 Señal SIGTERM recibida, cerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor cerrado exitosamente');
        database.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('🛑 Señal SIGINT recibida, cerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor cerrado exitosamente');
        database.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

module.exports = app;
