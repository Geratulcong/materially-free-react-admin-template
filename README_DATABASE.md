# 🗄️ Sistema de Base de Datos Históricos - Guía de Instalación

## 📋 Requisitos Previos
- XAMPP instalado con Apache y MySQL
- Node.js y npm
- Arduino IDE con bibliotecas BLE
- Raspberry Pi con Python 3

## 🚀 Paso 1: Configurar XAMPP

### 1.1 Instalar XAMPP
1. Descargar XAMPP desde: https://www.apachefriends.org/
2. Instalar siguiendo las instrucciones del instalador
3. Iniciar **Apache** y **MySQL** desde el Panel de Control de XAMPP

### 1.2 Crear Base de Datos
1. Abrir phpMyAdmin: http://localhost/phpmyadmin
2. Crear nueva base de datos llamada `fall_detection_system`
3. Importar el archivo `database/fall_detection_schema.sql`

```sql
-- O ejecutar este comando en phpMyAdmin:
SOURCE C:/path/to/fall_detection_schema.sql;
```

## 🔧 Paso 2: Configurar API PHP

### 2.1 Copiar archivos API
Copiar la carpeta `api/` al directorio web de XAMPP:
```
C:/xampp/htdocs/api/
```

### 2.2 Verificar configuración
Probar la API en el navegador:
- http://localhost/api/users
- http://localhost/api/devices
- http://localhost/api/stats

### 2.3 Configurar permisos
Asegurar que Apache tenga permisos de lectura/escritura en la carpeta `api/`

## 📡 Paso 3: Actualizar WebSocket Server

### 3.1 Instalar dependencias
```bash
cd /path/to/materially-free-react-admin-template
npm install node-fetch
```

### 3.2 Configurar URL de API
Editar `websocket-server.js` línea 4:
```javascript
const API_BASE_URL = 'http://localhost/api'; // Cambiar si XAMPP usa otro puerto
```

### 3.3 Iniciar WebSocket Server
```bash
node websocket-server.js
```

## 🏠 Paso 4: Configurar Dashboard Histórico

### 4.1 Copiar dashboard
Copiar `dashboard/index.html` a:
```
C:/xampp/htdocs/dashboard/index.html
```

### 4.2 Abrir dashboard
Navegar a: http://localhost/dashboard/

## 🔗 Paso 5: Configurar Raspberry Pi

### 5.1 Actualizar script Python
Editar `raspberry_fall_detection.py`:
```python
WS_URL = "ws://TU_IP_WINDOWS:8080"  # Cambiar por IP de tu PC
```

### 5.2 Instalar dependencias
```bash
pip install bleak websocket-client requests
```

## ⚡ Paso 6: Probar Sistema Completo

### 6.1 Verificar servicios
- ✅ XAMPP: Apache y MySQL funcionando
- ✅ phpMyAdmin: Base de datos creada
- ✅ API: http://localhost/api/stats responde
- ✅ WebSocket: Servidor en puerto 8080
- ✅ Dashboard: http://localhost/dashboard/ funciona

### 6.2 Flujo de datos
```
Arduino → Raspberry Pi → WebSocket Server → API PHP → MySQL
                      → React Dashboard
                      → Dashboard Histórico
```

### 6.3 Verificar almacenamiento
1. Conectar Arduino al Raspberry Pi
2. Verificar que aparezcan datos en el WebSocket
3. Comprobar en phpMyAdmin que se guardan datos en:
   - Tabla `sensor_data`
   - Tabla `fall_alerts`
4. Ver estadísticas en http://localhost/dashboard/

## 📊 Endpoints de la API

### GET Endpoints
- `/api/history?hours=24&limit=100` - Datos históricos
- `/api/stats?days=7` - Estadísticas
- `/api/recent-alerts?limit=10` - Alertas recientes
- `/api/devices` - Lista de dispositivos
- `/api/users` - Lista de usuarios

### POST Endpoints
- `/api/sensor-data` - Guardar datos de sensores
- `/api/fall-alert` - Guardar alerta de caída

## 🔍 Estructura de Base de Datos

### Tablas Principales
- **users** - Información de usuarios/clientes
- **devices** - Dispositivos Arduino registrados
- **sensor_data** - Datos históricos de sensores
- **fall_alerts** - Alertas de caídas detectadas
- **daily_stats** - Estadísticas agregadas diarias
- **system_config** - Configuración del sistema

### Vistas
- **recent_alerts** - Alertas recientes con info de usuario
- **monthly_summary** - Resumen mensual por usuario

## 🎛️ Configuración Avanzada

### Personalizar umbrales
Editar tabla `system_config`:
```sql
UPDATE system_config 
SET config_value = '2.0' 
WHERE config_key = 'fall_threshold';
```

### Configurar notificaciones
```sql
UPDATE system_config 
SET config_value = '+123456789' 
WHERE config_key = 'emergency_phone';
```

### Retención de datos
```sql
UPDATE system_config 
SET config_value = '90' 
WHERE config_key = 'data_retention_days';
```

## 🔧 Solución de Problemas

### Error: "No se puede conectar a MySQL"
- Verificar que MySQL esté iniciado en XAMPP
- Comprobar credenciales en `api/index.php`

### Error: "CORS blocked"
- Verificar que `.htaccess` esté en la carpeta `api/`
- Habilitar mod_rewrite en Apache

### Error: "API no responde"
- Verificar permisos de archivo PHP
- Comprobar logs de Apache en XAMPP

### Dashboard no muestra datos
- Verificar URL de API en dashboard HTML
- Comprobar que la API devuelva datos válidos
- Verificar consola del navegador para errores

## 📈 Monitoreo y Mantenimiento

### Logs importantes
- Apache: `C:/xampp/apache/logs/error.log`
- MySQL: `C:/xampp/mysql/data/*.err`
- WebSocket: Consola de Node.js
- Raspberry Pi: `/var/log/syslog`

### Backup de base de datos
```bash
mysqldump -u root fall_detection_system > backup_$(date +%Y%m%d).sql
```

### Limpiar datos antiguos
```sql
DELETE FROM sensor_data 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 365 DAY);
```

## 🚀 Escalabilidad

### Para múltiples usuarios
- Implementar autenticación
- Agregar índices adicionales
- Considerar particionado de tablas

### Para alto volumen
- Configurar MySQL para performance
- Implementar cache (Redis)
- Usar load balancer para API

## 📞 Soporte

Para problemas o mejoras:
1. Verificar logs de cada componente
2. Comprobar configuración de red
3. Validar estructura de base de datos
4. Revisar permisos de archivos

¡Sistema completo de almacenamiento histórico configurado! 🎉