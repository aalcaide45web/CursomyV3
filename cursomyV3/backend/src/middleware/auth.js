/**
 * CURSOSMY V3 - MIDDLEWARE DE AUTENTICACIÓN
 * Validación de tokens JWT para rutas protegidas
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Middleware de autenticación
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token de autenticación requerido',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    // Verificar formato del token (Bearer <token>)
    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Formato de token inválido',
        code: 'AUTH_TOKEN_FORMAT_INVALID'
      });
    }

    const token = tokenParts[1];

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Agregar información del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      instructorId: decoded.instructorId
    };

    // Log de autenticación exitosa
    logger.info(`🔐 Usuario autenticado: ${req.user.email} (ID: ${req.user.id})`);
    
    next();

  } catch (error) {
    logger.error('❌ Error de autenticación:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        code: 'AUTH_TOKEN_INVALID'
      });
    }
    
    return res.status(500).json({
      error: 'Error interno de autenticación',
      code: 'AUTH_INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware de autorización por roles
 */
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'AUTH_USER_NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`🚫 Acceso denegado para usuario ${req.user.email} (rol: ${req.user.role})`);
      return res.status(403).json({
        error: 'Acceso denegado: permisos insuficientes',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware para instructores
 */
const instructorOnly = authorizeRole(['instructor', 'admin']);

/**
 * Middleware para administradores
 */
const adminOnly = authorizeRole(['admin']);

/**
 * Middleware para estudiantes
 */
const studentOnly = authorizeRole(['student', 'instructor', 'admin']);

/**
 * Middleware para verificar propiedad del recurso
 */
const checkResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'AUTH_USER_NOT_AUTHENTICATED'
        });
      }

      // Los administradores pueden acceder a todo
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params.id || req.params.courseId || req.params.seccionId || req.params.claseId;
      
      if (!resourceId) {
        return res.status(400).json({
          error: 'ID del recurso requerido',
          code: 'RESOURCE_ID_MISSING'
        });
      }

      // Aquí se implementaría la lógica para verificar la propiedad
      // Por ahora, permitimos el acceso a instructores para sus propios recursos
      if (req.user.role === 'instructor' && req.user.instructorId) {
        // Verificar si el recurso pertenece al instructor
        // Esta lógica se implementará en los controladores específicos
        return next();
      }

      // Para estudiantes, verificar si tienen acceso al curso
      if (req.user.role === 'student') {
        // Verificar si el estudiante está inscrito en el curso
        // Esta lógica se implementará en los controladores específicos
        return next();
      }

      next();

    } catch (error) {
      logger.error('❌ Error verificando propiedad del recurso:', error);
      return res.status(500).json({
        error: 'Error interno verificando permisos',
        code: 'AUTH_OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar acceso al curso
 */
const checkCourseAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'AUTH_USER_NOT_AUTHENTICATED'
      });
    }

    const courseId = req.params.courseId || req.params.id;
    
    if (!courseId) {
      return res.status(400).json({
        error: 'ID del curso requerido',
        code: 'COURSE_ID_MISSING'
      });
    }

    // Los administradores pueden acceder a todo
    if (req.user.role === 'admin') {
      return next();
    }

    // Los instructores pueden acceder a sus propios cursos
    if (req.user.role === 'instructor' && req.user.instructorId) {
      // Verificar si el curso pertenece al instructor
      // Esta lógica se implementará en el controlador de cursos
      return next();
    }

    // Para estudiantes, verificar si están inscritos en el curso
    if (req.user.role === 'student') {
      // Verificar inscripción en el curso
      // Esta lógica se implementará en el controlador de cursos
      return next();
    }

    next();

  } catch (error) {
    logger.error('❌ Error verificando acceso al curso:', error);
    return res.status(500).json({
      error: 'Error interno verificando acceso al curso',
      code: 'AUTH_COURSE_ACCESS_CHECK_ERROR'
    });
  }
};

/**
 * Middleware para verificar límites de rate limiting personalizados
 */
const customRateLimit = (maxRequests, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Limpiar requests antiguos
    if (requests.has(userId)) {
      requests.set(userId, requests.get(userId).filter(time => time > windowStart));
    } else {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    if (userRequests.length >= maxRequests) {
      logger.warn(`🚫 Rate limit excedido para usuario ${userId}`);
      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    next();
  };
};

module.exports = {
  authMiddleware,
  authorizeRole,
  instructorOnly,
  adminOnly,
  studentOnly,
  checkResourceOwnership,
  checkCourseAccess,
  customRateLimit
};
