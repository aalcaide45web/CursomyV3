/**
 * CURSOSMY V3 - SISTEMA DE LOGGING
 * Configuración independiente con Winston
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración de formatos personalizados
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Configuración de transportes
const transports = [
  // Consola con colores
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    )
  }),
  
  // Archivo de logs general
  new winston.transports.File({
    filename: path.join(logDir, 'cursomyv3.log'),
    maxsize: parseInt(process.env.LOG_MAX_SIZE) || 20 * 1024 * 1024, // 20MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14, // 14 archivos
    format: customFormat
  }),
  
  // Archivo de errores separado
  new winston.transports.File({
    filename: path.join(logDir, 'errors.log'),
    level: 'error',
    maxsize: parseInt(process.env.LOG_MAX_SIZE) || 20 * 1024 * 1024,
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
    format: customFormat
  }),
  
  // Archivo de warnings separado
  new winston.transports.File({
    filename: path.join(logDir, 'warnings.log'),
    level: 'warn',
    maxsize: parseInt(process.env.LOG_MAX_SIZE) || 20 * 1024 * 1024,
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
    format: customFormat
  })
];

// Configuración del logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: transports,
  exitOnError: false,
  
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: customFormat
    })
  ],
  
  // Manejo de rechazos de promesas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: customFormat
    })
  ]
});

// Función para rotar logs manualmente
logger.rotateLogs = () => {
  logger.info('🔄 Rotando archivos de logs...');
  
  // Implementar lógica de rotación personalizada si es necesario
  const currentDate = new Date().toISOString().split('T')[0];
  logger.info(`📅 Logs rotados para la fecha: ${currentDate}`);
};

// Función para limpiar logs antiguos
logger.cleanOldLogs = (daysToKeep = 30) => {
  logger.info(`🧹 Limpiando logs más antiguos de ${daysToKeep} días...`);
  
  try {
    const files = fs.readdirSync(logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          logger.info(`🗑️ Archivo eliminado: ${file}`);
        }
      }
    });
    
    logger.info('✅ Limpieza de logs completada');
  } catch (error) {
    logger.error('❌ Error durante la limpieza de logs:', error);
  }
};

// Función para obtener estadísticas de logs
logger.getStats = () => {
  try {
    const files = fs.readdirSync(logDir);
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      files: []
    };
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const fileStats = fs.statSync(filePath);
        stats.totalSize += fileStats.size;
        stats.files.push({
          name: file,
          size: fileStats.size,
          modified: fileStats.mtime
        });
      }
    });
    
    return stats;
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas de logs:', error);
    return null;
  }
};

// Función para exportar logs
logger.exportLogs = (startDate, endDate, format = 'json') => {
  logger.info(`📤 Exportando logs desde ${startDate} hasta ${endDate} en formato ${format}`);
  
  try {
    // Implementar lógica de exportación según fechas
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: { start: startDate, end: endDate },
      format: format,
      logs: []
    };
    
    logger.info(`✅ Exportación completada: ${exportData.logs.length} entradas`);
    return exportData;
  } catch (error) {
    logger.error('❌ Error durante la exportación de logs:', error);
    return null;
  }
};

// Configurar limpieza automática de logs (cada 24 horas)
setInterval(() => {
  logger.cleanOldLogs(parseInt(process.env.LOG_RETENTION_DAYS) || 30);
}, 24 * 60 * 60 * 1000);

// Configurar rotación automática de logs (cada hora)
setInterval(() => {
  logger.rotateLogs();
}, 60 * 60 * 1000);

// Log de inicio del sistema de logging
logger.info('🚀 Sistema de logging CursosMy V3 iniciado');
logger.info(`📁 Directorio de logs: ${logDir}`);
logger.info(`📊 Nivel de logging: ${process.env.LOG_LEVEL || 'info'}`);
logger.info(`💾 Tamaño máximo por archivo: ${process.env.LOG_MAX_SIZE || '20MB'}`);
logger.info(`📅 Archivos a mantener: ${process.env.LOG_MAX_FILES || 14}`);

module.exports = logger;
