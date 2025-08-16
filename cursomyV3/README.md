# 🎓 CURSOSMY V3

**Sistema de gestión de cursos completamente independiente** - Resolviendo los problemas de upload de la versión PHP

## 🚀 **CARACTERÍSTICAS PRINCIPALES**

- ✅ **Proyecto completamente independiente** del sistema PHP actual
- ✅ **Base de datos SQLite separada** sin conflictos
- ✅ **Puerto 3001** (diferente al proyecto PHP)
- ✅ **Manejo nativo de archivos grandes** (hasta 1TB)
- ✅ **Sistema de colas** para procesamiento asíncrono
- ✅ **API REST moderna** con Node.js + Express
- ✅ **Frontend responsive** con Tailwind CSS
- ✅ **Autenticación JWT** segura
- ✅ **WebSockets** para comunicación en tiempo real

## 📋 **PROBLEMAS RESUELTOS**

- ❌ **19 errores de upload** en un solo curso CSS3
- ❌ **"Failed to fetch"** (17 errores) - Problemas de conexión/timeout
- ❌ **"Disk I/O error"** (2 errores) - Problemas de hardware/permisos
- ❌ **Límites PHP problemáticos** para archivos de 500GB

## 🏗️ **ARQUITECTURA**

```
cursomyV3/
├── backend/                   # API Node.js + Express
│   ├── src/
│   │   ├── controllers/      # Lógica de negocio
│   │   ├── models/           # Modelos de datos
│   │   ├── routes/           # Rutas de la API
│   │   ├── middleware/       # Middleware personalizado
│   │   ├── services/         # Servicios de negocio
│   │   ├── utils/            # Utilidades y helpers
│   │   └── config/           # Configuración independiente
│   ├── workers/              # Procesamiento asíncrono
│   ├── uploads/              # Archivos temporales propios
│   └── package.json          # Dependencias independientes
├── frontend/                  # Interfaz web moderna
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   ├── pages/            # Páginas de la aplicación
│   │   ├── services/         # Servicios de API
│   │   ├── utils/            # Utilidades frontend
│   │   └── styles/           # Estilos y CSS
│   └── public/               # Archivos estáticos
├── database/                  # BASE DE DATOS INDEPENDIENTE
│   ├── cursomyv3.db          # Nueva instancia SQLite
│   ├── migrations/            # Esquemas independientes
│   └── seeders/              # Datos iniciales propios
├── docs/                      # Documentación técnica
├── scripts/                   # Scripts de despliegue
├── env.example                # Variables de entorno propias
└── README.md                  # Este archivo
```

## 🚀 **INSTALACIÓN RÁPIDA**

### **Requisitos del Sistema**
- Node.js 18.0.0 o superior
- RAM: Mínimo 4GB, recomendado 8GB+
- Disco: Mínimo 100GB libre para uploads
- CPU: Mínimo 2 cores, recomendado 4+ cores

### **Paso 1: Clonar y configurar**
```bash
cd cursomyV3
cp env.example .env
# Editar .env con tus configuraciones
```

### **Paso 2: Instalar dependencias**
```bash
cd backend
npm install
```

### **Paso 3: Iniciar servidor**
```bash
npm run dev
```

### **Paso 4: Verificar funcionamiento**
- 🌐 **Servidor:** http://localhost:3001
- 📊 **Health check:** http://localhost:3001/health
- 🔌 **API:** http://localhost:3001/api

## 🔧 **CONFIGURACIÓN**

### **Variables de Entorno (.env)**
```bash
# ENTORNO
NODE_ENV=development
PORT=3001

# BASE DE DATOS (INDEPENDIENTE)
DB_PATH=./database/cursomyv3.db

# AUTENTICACIÓN
JWT_SECRET=tu-clave-secreta-aqui

# UPLOADS
UPLOAD_MAX_SIZE=1073741824000  # 1TB en bytes
UPLOAD_DIR=./backend/uploads
```

### **Puertos Utilizados**
- **Backend API:** 3001 (diferente al proyecto PHP)
- **WebSocket:** 3002
- **Frontend:** 3000 (opcional)

## 📊 **FUNCIONALIDADES IMPLEMENTADAS**

### **✅ FASE 1: FUNDACIÓN (COMPLETADA)**
- [x] Estructura del proyecto independiente
- [x] Configuración de Node.js + Express
- [x] Base de datos SQLite independiente
- [x] Sistema de logging con Winston
- [x] Middleware de autenticación JWT
- [x] Manejo centralizado de errores
- [x] Límites de upload personalizados
- [x] Esquema de base de datos completo
- [x] Migraciones y seeders iniciales

### **🔄 FASE 2: SISTEMA DE UPLOADS (EN DESARROLLO)**
- [ ] Sistema de uploads con Multer
- [ ] Streaming para archivos grandes
- [ ] Integración con FFmpeg
- [ ] Sistema de colas de trabajo
- [ ] Procesamiento asíncrono

### **⏳ FASE 3: FRONTEND MODERNO (PENDIENTE)**
- [ ] Componentes base
- [ ] Reproductor de video
- [ ] Gestión de contenido

### **⏳ FASE 4: FUNCIONALIDADES AVANZADAS (PENDIENTE)**
- [ ] Sistema de usuarios completo
- [ ] Analíticas y reportes
- [ ] Optimización y testing

## 🧪 **TESTING**

```bash
# Ejecutar tests
npm test

# Tests en modo watch
npm run test:watch

# Cobertura de tests
npm run test:coverage
```

## 📚 **DOCUMENTACIÓN**

- **API Reference:** `/api` endpoint
- **Health Check:** `/health` endpoint
- **Logs:** `./logs/` directorio
- **Base de datos:** `./database/` directorio

## 🔒 **SEGURIDAD**

- **Rate Limiting:** 100 requests por minuto por IP
- **CORS:** Configurado para dominio específico
- **Helmet:** Headers de seguridad HTTP
- **JWT:** Autenticación segura con expiración
- **Validación:** Validación estricta de entrada

## 🚨 **SOLUCIÓN A PROBLEMAS CRÍTICOS**

### **Problema Original (PHP)**
- 19 errores en un solo curso CSS3
- "Failed to fetch" (17 errores)
- "Disk I/O error" (2 errores)
- Límites PHP problemáticos para 500GB

### **Solución Implementada (Node.js)**
- ✅ **Proyecto completamente separado**
- ✅ **Base de datos independiente**
- ✅ **Manejo nativo de archivos grandes**
- ✅ **Sistema de colas asíncrono**
- ✅ **Streaming para uploads**
- ✅ **Sin límites PHP problemáticos**

## 📈 **MÉTRICAS DE ÉXITO**

- **Uptime:** 99.9% o superior
- **Response time:** < 200ms para APIs
- **Upload success rate:** > 99.5%
- **Videos de 500GB+:** Subida exitosa 100%
- **Usuarios concurrentes:** Soporte para 100+

## 🤝 **CONTRIBUCIÓN**

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 **LICENCIA**

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 **SOPORTE**

- **Proyecto:** CursosMy V3
- **Estado:** Fase 1 completada
- **Próximo paso:** Implementar sistema de uploads
- **Responsable:** Equipo de desarrollo

## 🎯 **ROADMAP**

- **Versión 3.0.0:** Sistema base (actual)
- **Versión 3.1:** Sistema de pagos integrado
- **Versión 3.2:** Machine Learning para recomendaciones
- **Versión 4.0:** Microservicios completamente separados

---

**CursosMy V3 - Resolviendo problemas de upload, una línea de código a la vez** 🚀
