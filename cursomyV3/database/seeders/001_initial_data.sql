-- CURSOSMY V3 - SEEDER INICIAL
-- Datos básicos para comenzar

-- Insertar temáticas
INSERT OR IGNORE INTO tematicas (nombre, descripcion, color, icono) VALUES
('Desarrollo Web', 'Cursos de programación web y tecnologías frontend/backend', '#3B82F6', 'code'),
('Diseño', 'Cursos de diseño gráfico, UI/UX y herramientas creativas', '#EF4444', 'palette'),
('Marketing Digital', 'Estrategias de marketing online y redes sociales', '#10B981', 'trending-up'),
('Negocios', 'Emprendimiento, gestión empresarial y finanzas', '#F59E0B', 'briefcase');

-- Insertar usuario administrador
INSERT OR IGNORE INTO usuarios (email, password_hash, nombre, apellido, rol, activo, email_verificado) VALUES
('admin@cursomy.com', '$2b$10$rQZ8K9mN2pL1vX3cR5tY7wA4sB6nM8qE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8bC9dE0fG1hI2jK3kL4mN5oP6qR7sT8uV9wW0xX1yY2zZ', 'Admin', 'Sistema', 'admin', 1, 1);

-- Insertar configuraciones del sistema
INSERT OR IGNORE INTO configuraciones_sistema (clave, valor, tipo, descripcion) VALUES
('app_name', 'CursosMy V3', 'string', 'Nombre de la aplicación'),
('app_version', '3.0.0', 'string', 'Versión actual'),
('max_upload_size', '1073741824000', 'number', 'Tamaño máximo de upload en bytes'),
('allowed_file_types', '["pdf","doc","docx","txt","jpg","jpeg","png","gif","mp4","avi","mov","mkv","webm","zip","rar"]', 'json', 'Tipos de archivo permitidos'),
('maintenance_mode', 'false', 'boolean', 'Modo mantenimiento activado');
