/**
 * CURSOSMY V3 - CONFIGURACIÓN DE BASE DE DATOS
 * Base de datos SQLite completamente independiente
 * Archivo: ./database/cursomyv3.db
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class Database {
  constructor() {
    this.db = null;
    this.isConnectedFlag = false;
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database', 'cursomyv3.db');
    this.migrationsPath = process.env.DB_MIGRATIONS_PATH || path.join(process.cwd(), 'database', 'migrations');
    this.seedersPath = process.env.DB_SEEDERS_PATH || path.join(process.cwd(), 'database', 'seeders');
  }

  /**
   * Conectar a la base de datos
   */
  async connect() {
    try {
      // Crear directorio de base de datos si no existe
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info(`📁 Directorio de base de datos creado: ${dbDir}`);
      }

      // Conectar a SQLite
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('❌ Error conectando a la base de datos:', err);
          throw err;
        }
        
        this.isConnectedFlag = true;
        logger.info(`✅ Base de datos conectada: ${this.dbPath}`);
        
        // Configurar la base de datos
        this.configureDatabase();
      });

      // Configurar eventos de la base de datos
      this.db.on('error', (err) => {
        logger.error('❌ Error en la base de datos:', err);
        this.isConnectedFlag = false;
      });

      this.db.on('close', () => {
        logger.info('🔌 Conexión a la base de datos cerrada');
        this.isConnectedFlag = false;
      });

      // Ejecutar migraciones iniciales
      await this.runMigrations();
      
      // Ejecutar seeders iniciales
      await this.runSeeders();

    } catch (error) {
      logger.error('❌ Error durante la conexión a la base de datos:', error);
      throw error;
    }
  }

  /**
   * Configurar la base de datos
   */
  configureDatabase() {
    // Habilitar foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
    
    // Configurar modo WAL para mejor concurrencia
    this.db.run('PRAGMA journal_mode = WAL');
    
    // Configurar cache size
    this.db.run('PRAGMA cache_size = 10000');
    
    // Configurar temp store
    this.db.run('PRAGMA temp_store = MEMORY');
    
    // Configurar synchronous
    this.db.run('PRAGMA synchronous = NORMAL');
    
    logger.info('⚙️ Configuración de base de datos aplicada');
  }

  /**
   * Ejecutar migraciones
   */
  async runMigrations() {
    try {
      logger.info('🔄 Ejecutando migraciones de base de datos...');
      
      // Crear tabla de migraciones si no existe
      await this.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Obtener migraciones ejecutadas
      const executedMigrations = await this.all('SELECT name FROM migrations');
      const executedNames = executedMigrations.map(m => m.name);

      // Leer archivos de migración
      if (fs.existsSync(this.migrationsPath)) {
        const migrationFiles = fs.readdirSync(this.migrationsPath)
          .filter(file => file.endsWith('.sql'))
          .sort();

        for (const file of migrationFiles) {
          const migrationName = path.basename(file, '.sql');
          
          if (!executedNames.includes(migrationName)) {
            logger.info(`📝 Ejecutando migración: ${migrationName}`);
            
            const migrationPath = path.join(this.migrationsPath, file);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            await this.run(migrationSQL);
            await this.run('INSERT INTO migrations (name) VALUES (?)', [migrationName]);
            
            logger.info(`✅ Migración completada: ${migrationName}`);
          }
        }
      }

      logger.info('✅ Todas las migraciones ejecutadas');
    } catch (error) {
      logger.error('❌ Error ejecutando migraciones:', error);
      throw error;
    }
  }

  /**
   * Ejecutar seeders
   */
  async runSeeders() {
    try {
      logger.info('🌱 Ejecutando seeders de base de datos...');
      
      // Crear tabla de seeders si no existe
      await this.run(`
        CREATE TABLE IF NOT EXISTS seeders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Obtener seeders ejecutados
      const executedSeeders = await this.all('SELECT name FROM seeders');
      const executedNames = executedSeeders.map(s => s.name);

      // Leer archivos de seeder
      if (fs.existsSync(this.seedersPath)) {
        const seederFiles = fs.readdirSync(this.seedersPath)
          .filter(file => file.endsWith('.sql'))
          .sort();

        for (const file of seederFiles) {
          const seederName = path.basename(file, '.sql');
          
          if (!executedNames.includes(seederName)) {
            logger.info(`🌱 Ejecutando seeder: ${seederName}`);
            
            const seederPath = path.join(this.seedersPath, file);
            const seederSQL = fs.readFileSync(seederPath, 'utf8');
            
            await this.run(seederSQL);
            await this.run('INSERT INTO seeders (name) VALUES (?)', [seederName]);
            
            logger.info(`✅ Seeder completado: ${seederName}`);
          }
        }
      }

      logger.info('✅ Todos los seeders ejecutados');
    } catch (error) {
      logger.error('❌ Error ejecutando seeders:', error);
      throw error;
    }
  }

  /**
   * Ejecutar query simple
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('❌ Error ejecutando query:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Obtener una fila
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('❌ Error obteniendo fila:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Obtener múltiples filas
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('❌ Error obteniendo filas:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Ejecutar transacción
   */
  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.isConnectedFlag;
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  async getStats() {
    try {
      const stats = await this.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"');
      const size = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0;
      
      return {
        tables: stats.count,
        size: size,
        path: this.dbPath,
        connected: this.isConnectedFlag
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de BD:', error);
      return null;
    }
  }

  /**
   * Crear backup de la base de datos
   */
  async createBackup(backupPath) {
    try {
      logger.info(`💾 Creando backup de la base de datos: ${backupPath}`);
      
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Crear backup usando SQLite
      await this.run('VACUUM INTO ?', [backupPath]);
      
      logger.info(`✅ Backup creado exitosamente: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('❌ Error creando backup:', error);
      throw error;
    }
  }

  /**
   * Cerrar conexión
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('❌ Error cerrando base de datos:', err);
        } else {
          logger.info('🔌 Conexión a base de datos cerrada');
          this.isConnectedFlag = false;
        }
      });
    }
  }
}

// Crear instancia singleton
const database = new Database();

module.exports = database;
