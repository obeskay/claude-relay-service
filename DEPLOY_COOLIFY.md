# 🚀 Despliegue en Coolify - Guía Completa

## ✅ Configuración Completamente Automática

Este proyecto está **100% configurado para deployment automático** en Coolify. No necesitas configurar variables de entorno manualmente.

## 🎯 Características de Deployment Automático

✅ **Generación automática de claves de seguridad** (JWT_SECRET y ENCRYPTION_KEY)  
✅ **Redis incluido y configurado automáticamente**  
✅ **Persistencia de datos garantizada**  
✅ **Healthchecks configurados**  
✅ **Generación automática de credenciales de administrador**  
✅ **Zero-config deployment**

---

## 📋 Pasos de Deployment en Coolify

### 1️⃣ Conectar Repositorio

1. Inicia sesión en tu instancia de Coolify
2. Ve a **"Projects"** → **"New Resource"** → **"Application"**
3. Selecciona **"Git Repository"**
4. Conecta con GitHub y selecciona: `obeskay/claude-relay-service`
5. Branch: `main`

### 2️⃣ Configurar Build

- **Build Type**: `Docker Compose`
- **Docker Compose File**: `docker-compose.yml`
- **Port**: `3011` (automático)

### 3️⃣ Deploy

Simplemente haz clic en **"Deploy"** 🚀

¡Eso es todo! No necesitas configurar nada más.

---

## 🔐 Credenciales de Administrador

Después del primer deployment:

1. **Revisa los logs del contenedor** para ver las credenciales generadas:
   ```bash
   # En Coolify, ve a: Application → Logs
   # Busca líneas como:
   
   ✅ Credenciales de administrador:
   📌 Usuario: cr_admin_XXXXX
   📌 Contraseña: YYYYYYYY
   ```

2. **Guarda estas credenciales** en un lugar seguro

3. Las credenciales se guardan en `/app/data/init.json` dentro del contenedor

---

## 📁 Estructura de Datos Persistentes

El deployment crea automáticamente los siguientes directorios:

```
📂 Volúmenes persistentes:
├── ./data/          # Configuración y datos de la app
│   ├── .secrets     # Claves generadas automáticamente
│   └── init.json    # Credenciales de administrador
├── ./logs/          # Logs de la aplicación
└── ./redis_data/    # Datos de Redis
```

---

## 🌐 Acceder a la Aplicación

Después del deployment exitoso:

1. **Panel de Administración**:
   ```
   https://tu-dominio.com/admin-next/
   ```

2. **API Endpoint**:
   ```
   https://tu-dominio.com/api/v1/messages
   ```

3. **Health Check**:
   ```
   https://tu-dominio.com/health
   ```

---

## 🔧 Variables de Entorno Opcionales

Aunque **no son necesarias**, puedes personalizar el comportamiento:

### Variables Opcionales en Coolify

```bash
# 🔐 Credenciales personalizadas de admin (opcional)
ADMIN_USERNAME=mi_admin_custom
ADMIN_PASSWORD=mi_password_seguro_123

# 📊 Redis (ya configurado automáticamente)
REDIS_PASSWORD=                          # Opcional: contraseña para Redis

# 🎨 Personalización de la interfaz
WEB_TITLE=Mi Servicio Claude Relay
WEB_DESCRIPTION=Servicio personalizado

# 📈 Límites y configuración
DEFAULT_TOKEN_LIMIT=5000000              # Límite de tokens por API key
METRICS_WINDOW=10                        # Ventana de métricas (minutos)

# 🔧 Timeouts
REQUEST_TIMEOUT=900000                   # Timeout de requests (ms)
STICKY_SESSION_TTL_HOURS=2               # TTL de sesiones pegajosas

# 👥 Gestión de usuarios (deshabilitado por defecto)
USER_MANAGEMENT_ENABLED=true             # Habilitar gestión de usuarios
MAX_API_KEYS_PER_USER=5                  # Máx API keys por usuario

# 📝 Logs
LOG_LEVEL=debug                          # Nivel de log: debug, info, warn, error
DEBUG_HTTP_TRAFFIC=true                  # Debug de tráfico HTTP
```

---

## 🔄 Actualización del Servicio

Para actualizar a la última versión:

1. En Coolify, ve a tu aplicación
2. Haz clic en **"Redeploy"**
3. Coolify descargará automáticamente la última versión de `main`

**Nota**: Los datos persistentes (credenciales, configuración, logs) se mantienen entre deployments.

---

## 🐛 Troubleshooting

### Problema: Contenedor no inicia

1. **Revisa los logs en Coolify**:
   - Ve a: `Application → Logs`
   - Busca mensajes de error

2. **Verificar Redis**:
   ```bash
   # El entrypoint verifica automáticamente Redis
   # Si Redis no está disponible, verás:
   ❌ Error: No se pudo conectar a Redis...
   ```

3. **Regenerar claves**:
   ```bash
   # Si necesitas regenerar las claves de seguridad:
   # 1. Detén el contenedor
   # 2. Elimina el archivo: ./data/.secrets
   # 3. Redeploy
   ```

### Problema: Olvidé las credenciales de administrador

**Opción 1**: Revisar logs del primer deployment

**Opción 2**: Acceder al archivo init.json
```bash
# En Coolify, abre una terminal en el contenedor:
cat /app/data/init.json
```

**Opción 3**: Regenerar credenciales
```bash
# 1. Detén el contenedor
# 2. Elimina: ./data/init.json
# 3. Redeploy
# 4. Revisa los logs para las nuevas credenciales
```

### Problema: Redis no conecta

El deployment incluye Redis automáticamente. Si hay problemas:

1. Verifica que ambos contenedores estén en la misma red
2. Revisa los healthchecks de Redis en Coolify
3. El entrypoint esperará hasta 60 segundos a que Redis esté disponible

---

## 📊 Monitoreo

### Health Check Endpoint

```bash
curl https://tu-dominio.com/health

# Respuesta esperada:
{
  "status": "ok",
  "redis": "connected",
  "uptime": 123456,
  "version": "1.0.0"
}
```

### Métricas del Sistema

```bash
curl https://tu-dominio.com/metrics

# Incluye:
# - Uso de memoria
# - Estadísticas de Redis
# - Tokens procesados
# - Cuentas activas
```

---

## 🔒 Seguridad

### Claves Generadas Automáticamente

El sistema genera automáticamente:

1. **JWT_SECRET**: 64 caracteres aleatorios en base64
2. **ENCRYPTION_KEY**: 32 caracteres hexadecimales

Estas claves se guardan en `/app/data/.secrets` y son **persistentes entre deployments**.

### Recomendaciones de Seguridad

✅ **Habilitar HTTPS** en Coolify (automático con Let's Encrypt)  
✅ **Configurar firewall** para limitar acceso  
✅ **Cambiar contraseña de admin** después del primer login  
✅ **Hacer backups regulares** de `/app/data/`  
✅ **Rotar API Keys** periódicamente  

---

## 📦 Backup y Restauración

### Hacer Backup

```bash
# Backup de datos críticos:
# En Coolify, descarga los volúmenes:
- ./data/         # Configuración y credenciales
- ./redis_data/   # Datos de Redis
```

### Restaurar Backup

```bash
# 1. Detén el servicio en Coolify
# 2. Sube los archivos de backup a los volúmenes
# 3. Redeploy
```

---

## 🎓 Primeros Pasos después del Deployment

### 1. Acceder al Panel de Administración

```
https://tu-dominio.com/admin-next/
```

**Login**: Usa las credenciales generadas (revisa logs)

### 2. Crear tu Primera API Key

1. Ve a **"API Keys"** en el panel
2. Haz clic en **"Create API Key"**
3. Configura límites y permisos
4. Copia el API Key generado (formato: `cr_XXXXXXXXXXXX`)

### 3. Agregar una Cuenta de Claude

1. Ve a **"Accounts"** → **"Add Account"**
2. Selecciona tipo: **Claude Official** o **Claude Console**
3. Para **Claude Official** (OAuth):
   - Configura proxy (opcional)
   - Genera URL de autorización
   - Completa el flujo OAuth
4. Para **Claude Console**:
   - Pega tu Session Key
   - Configura proxy (opcional)

### 4. Probar la API

```bash
curl -X POST https://tu-dominio.com/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: cr_XXXXXXXXXXXX" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "¡Hola! ¿Funciona el relay?"}
    ]
  }'
```

---

## 🆘 Soporte

- **Issues**: [GitHub Issues](https://github.com/obeskay/claude-relay-service/issues)
- **Documentación completa**: Ver `README.md`
- **CLAUDE.md**: Guía técnica detallada

---

## ✨ Características Adicionales

### OAuth Flow Integrado
- Flujo OAuth completo para Claude Official
- Refresh automático de tokens
- Soporte para proxies

### Multi-Cuenta
- Soporta múltiples cuentas Claude Official, Console, Bedrock, Gemini, etc.
- Balanceo de carga automático
- Fallback en caso de fallo

### Gestión Avanzada
- Sistema de grupos de cuentas
- Sticky sessions (sesiones pegajosas)
- Rate limiting por API Key
- Estadísticas detalladas de uso

### Interfaz Web Moderna
- Dashboard en tiempo real
- Gestión visual de cuentas y API Keys
- Logs en tiempo real
- Modo oscuro/claro

---

**¡Disfruta de tu Claude Relay Service! 🚀**
