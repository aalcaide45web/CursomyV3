/**
 * CURSOSMY V3 - MIDDLEWARE DE LÍMITES DE UPLOAD
 * Control de límites personalizados para subida de archivos
 */

const logger = require('../config/logger');

/**
 * Middleware de límites de upload
 */
const uploadLimiter = (req, res, next) => {
  try {
    // Verificar si el usuario está autenticado
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'AUTH_USER_NOT_AUTHENTICATED'
      });
    }

    // Obtener límites según el rol del usuario
    const limits = getUploadLimits(req.user.role);
    
    // Verificar límites de tamaño total
    const contentLength = parseInt(req.headers['content-length']) || 0;
    if (contentLength > limits.maxTotalSize) {
      logger.warn(`🚫 Límite de tamaño excedido para usuario ${req.user.email}: ${contentLength} bytes`);
      return res.status(413).json({
        error: `El tamaño total excede el límite permitido (${formatBytes(limits.maxTotalSize)})`,
        code: 'UPLOAD_SIZE_LIMIT_EXCEEDED',
        limit: limits.maxTotalSize,
        requested: contentLength
      });
    }

    // Verificar límites de archivos simultáneos
    const currentUploads = getCurrentUserUploads(req.user.id);
    if (currentUploads.length >= limits.maxConcurrentUploads) {
      logger.warn(`🚫 Límite de uploads simultáneos excedido para usuario ${req.user.email}`);
      return res.status(429).json({
        error: `Máximo ${limits.maxConcurrentUploads} uploads simultáneos permitidos`,
        code: 'UPLOAD_CONCURRENT_LIMIT_EXCEEDED',
        limit: limits.maxConcurrentUploads,
        current: currentUploads.length
      });
    }

    // Verificar límites de ancho de banda
    const userBandwidth = getUserBandwidthUsage(req.user.id);
    if (userBandwidth.current > limits.maxBandwidthPerHour) {
      logger.warn(`🚫 Límite de ancho de banda excedido para usuario ${req.user.email}`);
      return res.status(429).json({
        error: 'Límite de ancho de banda por hora excedido',
        code: 'UPLOAD_BANDWIDTH_LIMIT_EXCEEDED',
        limit: formatBytes(limits.maxBandwidthPerHour),
        current: formatBytes(userBandwidth.current)
      });
    }

    // Agregar límites al request para uso posterior
    req.uploadLimits = limits;
    
    // Log de verificación exitosa
    logger.debug(`✅ Límites de upload verificados para usuario ${req.user.email}`);

    next();

  } catch (error) {
    logger.error('❌ Error en middleware de límites de upload:', error);
    return res.status(500).json({
      error: 'Error interno verificando límites de upload',
      code: 'UPLOAD_LIMITS_CHECK_ERROR'
    });
  }
};

/**
 * Obtener límites según el rol del usuario
 */
function getUploadLimits(userRole) {
  const baseLimits = {
    student: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxTotalSize: 500 * 1024 * 1024, // 500MB
      maxConcurrentUploads: 3,
      maxBandwidthPerHour: 1024 * 1024 * 1024, // 1GB/hora
      allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'mov']
    },
    instructor: {
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      maxTotalSize: 10 * 1024 * 1024 * 1024, // 10GB
      maxConcurrentUploads: 10,
      maxBandwidthPerHour: 10 * 1024 * 1024 * 1024, // 10GB/hora
      allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'mov', 'mkv', 'webm', 'zip', 'rar']
    },
    admin: {
      maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
      maxTotalSize: 100 * 1024 * 1024 * 1024, // 100GB
      maxConcurrentUploads: 20,
      maxBandwidthPerHour: 100 * 1024 * 1024 * 1024, // 100GB/hora
      allowedFileTypes: ['*'] // Todos los tipos
    }
  };

  return baseLimits[userRole] || baseLimits.student;
}

/**
 * Obtener uploads actuales del usuario
 */
function getCurrentUserUploads(userId) {
  // Esta función se implementará con el sistema de colas
  // Por ahora retornamos un array vacío
  return [];
}

/**
 * Obtener uso de ancho de banda del usuario
 */
function getUserBandwidthUsage(userId) {
  // Esta función se implementará con el sistema de monitoreo
  // Por ahora retornamos valores por defecto
  return {
    current: 0,
    hourly: 0,
    daily: 0
  };
}

/**
 * Formatear bytes en formato legible
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Middleware para verificar tipo de archivo
 */
const fileTypeValidator = (req, res, next) => {
  try {
    if (!req.uploadLimits) {
      return next();
    }

    const allowedTypes = req.uploadLimits.allowedFileTypes;
    
    // Si se permiten todos los tipos
    if (allowedTypes.includes('*')) {
      return next();
    }

    // Verificar tipo de archivo (se implementará con Multer)
    // Por ahora solo logueamos
    logger.debug(`📁 Validación de tipo de archivo para usuario ${req.user.email}`);

    next();

  } catch (error) {
    logger.error('❌ Error validando tipo de archivo:', error);
    next();
  }
};

/**
 * Middleware para verificar límites de velocidad
 */
const speedLimiter = (req, res, next) => {
  try {
    if (!req.uploadLimits) {
      return next();
    }

    const userId = req.user.id;
    const currentSpeed = getCurrentUploadSpeed(userId);
    const maxSpeed = req.uploadLimits.maxBandwidthPerHour / 3600; // bytes por segundo

    if (currentSpeed > maxSpeed) {
      logger.warn(`🚫 Velocidad de upload excedida para usuario ${req.user.email}`);
      return res.status(429).json({
        error: 'Velocidad de upload excedida',
        code: 'UPLOAD_SPEED_LIMIT_EXCEEDED',
        limit: formatBytes(maxSpeed) + '/s',
        current: formatBytes(currentSpeed) + '/s'
      });
    }

    next();

  } catch (error) {
    logger.error('❌ Error en limitador de velocidad:', error);
    next();
  }
};

/**
 * Obtener velocidad actual de upload del usuario
 */
function getCurrentUploadSpeed(userId) {
  // Esta función se implementará con el sistema de monitoreo
  // Por ahora retornamos un valor por defecto
  return 1024 * 1024; // 1MB/s
}

/**
 * Middleware para verificar límites de tiempo
 */
const timeLimiter = (req, res, next) => {
  try {
    if (!req.uploadLimits) {
      return next();
    }

    const userId = req.user.id;
    const uploadStartTime = getUploadStartTime(userId);
    const maxUploadTime = 3600000; // 1 hora en ms

    if (uploadStartTime && (Date.now() - uploadStartTime) > maxUploadTime) {
      logger.warn(`🚫 Tiempo de upload excedido para usuario ${req.user.email}`);
      return res.status(408).json({
        error: 'Tiempo máximo de upload excedido',
        code: 'UPLOAD_TIME_LIMIT_EXCEEDED',
        limit: '1 hora'
      });
    }

    next();

  } catch (error) {
    logger.error('❌ Error en limitador de tiempo:', error);
    next();
  }
};

/**
 * Obtener tiempo de inicio del upload
 */
function getUploadStartTime(userId) {
  // Esta función se implementará con el sistema de monitoreo
  // Por ahora retornamos null
  return null;
}

module.exports = {
  uploadLimiter,
  fileTypeValidator,
  speedLimiter,
  timeLimiter
};
