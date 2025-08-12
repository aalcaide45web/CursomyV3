# CursosMy - Plataforma de Video-Cursos

Una aplicación web completa para publicar y gestionar video-cursos, desarrollada con PHP, SQLite y Tailwind CSS con diseño glassmorphism y modo oscuro.

## 🚀 Características

### 📊 Dashboard Principal
- Vista de tarjetas con todos los cursos
- Estadísticas generales (cursos, instructores, temáticas)
- Sistema de filtros por instructor, temática y búsqueda
- Ordenamiento por nombre, duración, etc.

### 👥 Gestión de Instructores y Temáticas
- CRUD completo para instructores (nombre, email, biografía)
- CRUD completo para temáticas (nombre, descripción)
- Validaciones y verificación de dependencias

### 📚 Gestión de Cursos
- Creación de cursos con título, temática, instructor, comentarios e imagen
- Organización por secciones
- Subida múltiple de videos MP4 (hasta 500GB cada uno)
- Edición completa de información del curso

### 🎥 Reproductor Avanzado
- Reproductor de video HTML5 con controles personalizados
- **Guardado automático de progreso** - retoma donde lo dejaste
- **Sistema de notas con timestamp** - crea notas en momentos específicos del video
- **Comentarios por clase** - agrega comentarios que se guardan permanentemente
- Navegación entre clases de la misma sección
- Atajos de teclado (Espacio, flechas, M para mute, F para fullscreen)
- Marcadores visuales de notas en la barra de progreso

### 🎨 Diseño
- **Glassmorphism** - efectos de cristal con transparencias y blur
- **Modo oscuro por defecto** - optimizado para visualización prolongada
- **Responsive** - adaptado para móviles, tablets y desktop
- **Tailwind CSS** - diseño moderno y consistente

## 📋 Requisitos

- PHP 7.4 o superior
- Extensión SQLite para PHP
- Servidor web (Apache, Nginx, o servidor de desarrollo de PHP)
- Navegador moderno con soporte para HTML5 video

## 🛠️ Instalación

1. **Clonar o descargar** el proyecto en tu servidor web:
   ```bash
   # Si usas XAMPP, coloca en htdocs/
   # Si usas WAMP, coloca en www/
   # Si usas servidor propio, coloca en tu directorio web
   ```

2. **Configurar permisos** (Linux/Mac):
   ```bash
   chmod -R 755 cloneUdemyV1/
   chmod -R 777 cloneUdemyV1/uploads/
   chmod -R 777 cloneUdemyV1/database/
   ```

3. **Acceder a la aplicación**:
   ```
   http://localhost/cloneUdemyV1/
   ```

4. **Primera ejecución**:
   - La base de datos SQLite se crea automáticamente
   - Se insertan datos de ejemplo (instructores y temáticas)
   - Los directorios de uploads se crean automáticamente

## 📁 Estructura del Proyecto

```
cloneUdemyV1/
├── config/
│   ├── database.php      # Configuración y creación de BD
│   └── config.php        # Configuración general
├── api/
│   ├── cursos.php        # API CRUD cursos
│   ├── instructores.php  # API CRUD instructores
│   ├── tematicas.php     # API CRUD temáticas
│   ├── secciones.php     # API CRUD secciones
│   ├── clases.php        # API CRUD clases
│   ├── upload-videos.php # API subida de videos
│   ├── progreso.php      # API progreso de visualización
│   ├── notas.php         # API notas con timestamp
│   └── comentarios.php   # API comentarios de clases
├── js/
│   ├── dashboard.js      # Lógica del dashboard
│   ├── instructores-tematicas.js
│   ├── curso.js          # Gestión de cursos y uploads
│   └── reproductor.js    # Reproductor avanzado
├── uploads/
│   ├── images/           # Imágenes de cursos
│   └── videos/           # Videos organizados por curso
├── database/
│   └── cursosmy.db       # Base de datos SQLite
├── index.php             # Dashboard principal
├── instructores-tematicas.php
├── curso.php             # Gestión individual de curso
├── reproductor.php       # Reproductor de videos
└── README.md
```

## 🗄️ Base de Datos

La aplicación utiliza SQLite con las siguientes tablas:

- **cursos** - Información de cursos
- **instructores** - Datos de instructores
- **tematicas** - Categorías de cursos
- **secciones** - Organización de clases
- **clases** - Videos individuales
- **progreso_clases** - Tiempo visto por clase
- **notas_clases** - Notas con timestamp
- **comentarios_clases** - Comentarios por clase

## 🎯 Uso de la Aplicación

### 1. Configuración Inicial
1. Accede a **Instructores & Temáticas**
2. Crea instructores y temáticas para tus cursos
3. Vuelve al Dashboard

### 2. Crear un Curso
1. Haz clic en **"Nuevo Curso"**
2. Completa la información (solo el título es obligatorio)
3. Sube una imagen si deseas

### 3. Agregar Contenido
1. Entra al curso creado
2. Crea secciones para organizar el contenido
3. Usa **"Subir Videos"** para agregar clases múltiples
4. Los videos se organizan automáticamente por sección

### 4. Reproducir y Estudiar
1. Haz clic en **"Ver"** en cualquier clase
2. El progreso se guarda automáticamente
3. Agrega notas en momentos específicos del video
4. Deja comentarios para futuras referencias

### 5. Funciones Avanzadas del Reproductor

#### Atajos de Teclado:
- **Espacio**: Play/Pausa
- **← →**: Retroceder/Avanzar 10 segundos
- **M**: Silenciar/Activar audio
- **F**: Pantalla completa

#### Sistema de Notas:
- Haz clic en el botón de nota durante la reproducción
- La nota se guarda con el timestamp exacto
- Haz clic en el tiempo de la nota para saltar a ese momento
- Los marcadores aparecen en la barra de progreso

#### Progreso Automático:
- Se guarda cada 5 segundos automáticamente
- Al volver al video, continúa donde lo dejaste
- Se marca como completado al ver 90% del contenido

## 🔧 Configuración Avanzada

### Límites de Archivos
Edita `config/config.php` para cambiar:
```php
define('MAX_VIDEO_SIZE', 500 * 1024 * 1024 * 1024); // 500GB
define('ALLOWED_VIDEO_TYPES', ['mp4']);
```

### Duración de Videos
Para obtener automáticamente la duración de los videos, instala FFmpeg y descomenta el código en `api/upload-videos.php`.

## 🐛 Solución de Problemas

### Error de permisos de escritura
```bash
chmod -R 777 uploads/
chmod -R 777 database/
```

### Videos no se reproducen
- Verifica que el archivo esté en formato MP4
- Comprueba que la ruta del video sea correcta
- Asegúrate de que el servidor web tenga acceso a la carpeta uploads

### Base de datos no se crea
- Verifica que PHP tenga la extensión SQLite habilitada
- Comprueba permisos de escritura en la carpeta database/

## 🚀 Características Técnicas

- **Backend**: PHP con arquitectura API REST
- **Base de datos**: SQLite (sin configuración adicional)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Subida de archivos**: Drag & Drop con validación
- **Reproductor**: HTML5 Video API personalizada
- **Diseño**: Glassmorphism responsivo
- **Almacenamiento**: Sistema de archivos local organizado

## 📝 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

---

**¡Disfruta creando y compartiendo tus video-cursos con CursosMy!** 🎓✨
