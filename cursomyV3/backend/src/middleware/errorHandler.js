/**
 * CURSOSMY V3 - MIDDLEWARE DE MANEJO DE ERRORES
 * Manejo centralizado de errores y respuestas de error
 */

const logger = require('../config/logger');

/**
 * Middleware de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error('❌ Error no manejado:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous'
  });

  // Determinar el tipo de error
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Error interno del servidor';

  // Errores de validación
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Error de validación de datos';
  }

  // Errores de base de datos
  if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 400;
    errorCode = 'DATABASE_CONSTRAINT_ERROR';
    message = 'Error de restricción de base de datos';
  }

  if (err.code === 'SQLITE_BUSY') {
    statusCode = 503;
    errorCode = 'DATABASE_BUSY';
    message = 'Base de datos ocupada, inténtalo de nuevo';
  }

  // Errores de archivo
  if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'FILE_NOT_FOUND';
    message = 'Archivo no encontrado';
  }

  if (err.code === 'EACCES') {
    statusCode = 403;
    errorCode = 'FILE_ACCESS_DENIED';
    message = 'Acceso denegado al archivo';
  }

  // Errores de upload
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'El archivo es demasiado grande';
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 413;
    errorCode = 'TOO_MANY_FILES';
    message = 'Demasiados archivos';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorCode = 'UNEXPECTED_FILE_FIELD';
    message = 'Campo de archivo inesperado';
  }

  // Errores de autenticación
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Token inválido';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Token expirado';
  }

  // Errores de permisos
  if (err.code === 'PERMISSION_DENIED') {
    statusCode = 403;
    errorCode = 'PERMISSION_DENIED';
    message = 'Permisos insuficientes';
  }

  // Errores de recursos no encontrados
  if (err.code === 'RESOURCE_NOT_FOUND') {
    statusCode = 404;
    errorCode = 'RESOURCE_NOT_FOUND';
    message = 'Recurso no encontrado';
  }

  // Errores de conflicto
  if (err.code === 'RESOURCE_CONFLICT') {
    statusCode = 409;
    errorCode = 'RESOURCE_CONFLICT';
    message = 'Conflicto con el recurso';
  }

  // Errores de rate limiting
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Demasiadas solicitudes';
  }

  // Errores de timeout
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    message = 'Tiempo de espera agotado';
  }

  // Errores de conexión
  if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Servicio no disponible';
  }

  // Errores de memoria
  if (err.code === 'ENOMEM') {
    statusCode = 507;
    errorCode = 'INSUFFICIENT_STORAGE';
    message = 'Almacenamiento insuficiente';
  }

  // Errores de disco
  if (err.code === 'ENOSPC') {
    statusCode = 507;
    errorCode = 'DISK_FULL';
    message = 'Disco lleno';
  }

  // Errores de FFmpeg
  if (err.message && err.message.includes('FFmpeg')) {
    statusCode = 500;
    errorCode = 'FFMPEG_ERROR';
    message = 'Error procesando video';
  }

  // Errores de Sharp (imágenes)
  if (err.message && err.message.includes('Sharp')) {
    statusCode = 500;
    errorCode = 'IMAGE_PROCESSING_ERROR';
    message = 'Error procesando imagen';
  }

  // Respuesta de error
  const errorResponse = {
    error: {
      message: message,
      code: errorCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  };

  // En desarrollo, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = err.message;
  }

  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para capturar errores asíncronos
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para manejar errores de Multer
 */
const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    logger.error('❌ Error de Multer:', {
      error: err.message,
      code: err.code,
      field: err.field,
      url: req.originalUrl,
      userId: req.user?.id || 'anonymous'
    });

    let statusCode = 400;
    let errorCode = 'UPLOAD_ERROR';
    let message = 'Error en la subida del archivo';

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        statusCode = 413;
        errorCode = 'FILE_TOO_LARGE';
        message = `El archivo excede el tamaño máximo permitido (${process.env.UPLOAD_MAX_SIZE || '1GB'})`;
        break;
      case 'LIMIT_FILE_COUNT':
        statusCode = 413;
        errorCode = 'TOO_MANY_FILES';
        message = 'Demasiados archivos en una sola subida';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        statusCode = 400;
        errorCode = 'UNEXPECTED_FILE_FIELD';
        message = 'Campo de archivo inesperado';
        break;
      case 'LIMIT_PART_COUNT':
        statusCode = 413;
        errorCode = 'TOO_MANY_PARTS';
        message = 'Demasiadas partes en la subida';
        break;
      case 'LIMIT_PART_SIZE':
        statusCode = 413;
        errorCode = 'PART_TOO_LARGE';
        message = 'Parte del archivo demasiado grande';
        break;
      case 'LIMIT_FIELD_KEY':
        statusCode = 400;
        errorCode = 'FIELD_KEY_TOO_LONG';
        message = 'Nombre del campo demasiado largo';
        break;
      case 'LIMIT_FIELD_VALUE':
        statusCode = 400;
        errorCode = 'FIELD_VALUE_TOO_LONG';
        message = 'Valor del campo demasiado largo';
        break;
      case 'LIMIT_FIELD_COUNT':
        statusCode = 413;
        errorCode = 'TOO_MANY_FIELDS';
        message = 'Demasiados campos en el formulario';
        break;
      default:
        statusCode = 500;
        errorCode = 'UPLOAD_UNKNOWN_ERROR';
        message = 'Error desconocido en la subida';
    }

    return res.status(statusCode).json({
      error: {
        message: message,
        code: errorCode,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
      }
    });
  }
  next();
};

/**
 * Middleware para manejar errores de validación
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err && err.isJoi) {
    logger.warn('⚠️ Error de validación Joi:', {
      error: err.message,
      details: err.details,
      url: req.originalUrl,
      userId: req.user?.id || 'anonymous'
    });

    const validationErrors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));

    return res.status(400).json({
      error: {
        message: 'Error de validación de datos',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method,
        details: validationErrors
      }
    });
  }
  next();
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  multerErrorHandler,
  validationErrorHandler
};
