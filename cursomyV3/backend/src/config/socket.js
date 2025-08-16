/**
 * CURSOSMY V3 - CONFIGURACIÓN DE SOCKET.IO
 * Comunicación en tiempo real para uploads y notificaciones
 */

const socketIO = require('socket.io');
const logger = require('./logger');

let io = null;

/**
 * Inicializar Socket.IO
 */
function initialize(server) {
  try {
    io = socketIO(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: process.env.WS_PATH || '/socket.io',
      transports: ['websocket', 'polling']
    });

    // Configurar eventos de conexión
    io.on('connection', (socket) => {
      logger.info(`🔌 Cliente conectado: ${socket.id}`);
      
      // Autenticación del socket
      socket.on('authenticate', (token) => {
        try {
          // Aquí se validaría el token JWT
          // Por ahora solo logueamos la autenticación
          logger.info(`🔐 Socket autenticado: ${socket.id}`);
          socket.authenticated = true;
          socket.emit('authenticated', { success: true });
        } catch (error) {
          logger.error('❌ Error autenticando socket:', error);
          socket.emit('authentication_error', { error: 'Token inválido' });
        }
      });

      // Unirse a una sala específica (curso, usuario, etc.)
      socket.on('join_room', (room) => {
        if (socket.authenticated) {
          socket.join(room);
          logger.info(`🚪 Socket ${socket.id} se unió a la sala: ${room}`);
          socket.emit('room_joined', { room, success: true });
        }
      });

      // Salir de una sala
      socket.on('leave_room', (room) => {
        socket.leave(room);
        logger.info(`🚪 Socket ${socket.id} salió de la sala: ${room}`);
        socket.emit('room_left', { room, success: true });
      });

      // Evento de desconexión
      socket.on('disconnect', (reason) => {
        logger.info(`🔌 Cliente desconectado: ${socket.id}, razón: ${reason}`);
      });

      // Evento de error
      socket.on('error', (error) => {
        logger.error(`❌ Error en socket ${socket.id}:`, error);
      });
    });

    // Configurar eventos de error del servidor
    io.engine.on('connection_error', (err) => {
      logger.error('❌ Error de conexión Socket.IO:', err);
    });

    logger.info('🚀 Socket.IO inicializado exitosamente');
    logger.info(`🔌 Puerto WebSocket: ${process.env.WS_PORT || '3002'}`);
    logger.info(`📡 Path WebSocket: ${process.env.WS_PATH || '/socket.io'}`);

  } catch (error) {
    logger.error('❌ Error inicializando Socket.IO:', error);
    throw error;
  }
}

/**
 * Emitir evento a todos los clientes
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
    logger.debug(`📡 Evento emitido a todos: ${event}`);
  }
}

/**
 * Emitir evento a una sala específica
 */
function emitToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, data);
    logger.debug(`📡 Evento emitido a sala ${room}: ${event}`);
  }
}

/**
 * Emitir evento a un cliente específico
 */
function emitToClient(socketId, event, data) {
  if (io) {
    io.to(socketId).emit(event, data);
    logger.debug(`📡 Evento emitido a cliente ${socketId}: ${event}`);
  }
}

/**
 * Emitir progreso de upload
 */
function emitUploadProgress(userId, uploadId, progress) {
  const room = `user_${userId}`;
  emitToRoom(room, 'upload_progress', {
    uploadId,
    progress,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emitir notificación de upload completado
 */
function emitUploadComplete(userId, uploadId, fileInfo) {
  const room = `user_${userId}`;
  emitToRoom(room, 'upload_complete', {
    uploadId,
    fileInfo,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emitir notificación de error en upload
 */
function emitUploadError(userId, uploadId, error) {
  const room = `user_${userId}`;
  emitToRoom(room, 'upload_error', {
    uploadId,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emitir notificación general
 */
function emitNotification(userId, type, message, data = {}) {
  const room = `user_${userId}`;
  emitToRoom(room, 'notification', {
    type,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emitir actualización de progreso del curso
 */
function emitCourseProgress(userId, courseId, progress) {
  const room = `user_${userId}`;
  emitToRoom(room, 'course_progress', {
    courseId,
    progress,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emitir notificación de nueva clase disponible
 */
function emitNewClassAvailable(courseId, classInfo) {
  const room = `course_${courseId}`;
  emitToRoom(room, 'new_class_available', {
    classInfo,
    timestamp: new Date().toISOString()
  });
}

/**
 * Obtener estadísticas de conexiones
 */
function getConnectionStats() {
  if (!io) return null;
  
  const rooms = io.sockets.adapter.rooms;
  const stats = {
    totalConnections: io.engine.clientsCount,
    totalRooms: rooms.size,
    rooms: {}
  };

  // Contar clientes por sala
  rooms.forEach((clients, room) => {
    stats.rooms[room] = clients.size;
  });

  return stats;
}

/**
 * Desconectar cliente específico
 */
function disconnectClient(socketId, reason = 'Server disconnect') {
  if (io) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
      logger.info(`🔌 Cliente ${socketId} desconectado por: ${reason}`);
    }
  }
}

/**
 * Desconectar todos los clientes
 */
function disconnectAll(reason = 'Server shutdown') {
  if (io) {
    io.disconnectSockets(true);
    logger.info(`🔌 Todos los clientes desconectados por: ${reason}`);
  }
}

/**
 * Obtener instancia de Socket.IO
 */
function getIO() {
  return io;
}

module.exports = {
  initialize,
  emitToAll,
  emitToRoom,
  emitToClient,
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
  emitNotification,
  emitCourseProgress,
  emitNewClassAvailable,
  getConnectionStats,
  disconnectClient,
  disconnectAll,
  getIO
};
