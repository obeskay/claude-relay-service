# Servicio Claude Relay

> [!ADVERTENCIA]
> **Notificación de Seguridad**: Las versiones v1.1.248 y anteriores tienen una vulnerabilidad grave de omisión de autenticación de administrador que permite acceso no autorizado al panel de administración.
>
> **Actualice inmediatamente a la versión v1.1.249+** o migre al nuevo proyecto **[CRS 2.0 (sub2api)](https://github.com/Wei-Shaw/sub2api)**

<div align="center">

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-6+-red.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Listo-blue.svg)](https://www.docker.com/)
[![Docker Build](https://github.com/Wei-Shaw/claude-relay-service/actions/workflows/auto-release-pipeline.yml/badge.svg)](https://github.com/Wei-Shaw/claude-relay-service/actions/workflows/auto-release-pipeline.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/weishaw/claude-relay-service)](https://hub.docker.com/r/weishaw/claude-relay-service)

**🔐 Despliega tu propio servicio de relay de API de Claude con soporte para múltiples cuentas**

[English](README.md) • [Español](README_ES.md)

</div>

---

## ⚠️ Aviso Importante

**Antes de usar este proyecto, lea atentamente:**

🚨 **Riesgo de Términos de Servicio**: El uso de este proyecto puede violar los términos de servicio de Anthropic. Lea atentamente el acuerdo de usuario de Anthropic antes de usar este proyecto. Todo el riesgo es responsabilidad del usuario.

📖 **Descargo de Responsabilidad**: Este proyecto es solo para aprendizaje e investigación técnica. El autor no es responsable de prohibiciones de cuentas, interrupciones de servicio u otras pérdidas causadas por el uso de este proyecto.

---

## 🤔 ¿Este proyecto es para ti?

- 🌍 **Restricción Regional**: ¿No puedes acceder al servicio Claude Code directamente desde tu región?
- 🔒 **Preocupaciones de Privacidad**: ¿Te preocupa que servicios espejo de terceros registren o filtren el contenido de tus conversaciones?
- 👥 **Costos Compartidos**: ¿Quieres compartir los costos de suscripción Claude Code Max con amigos?
- ⚡ **Estabilidad**: ¿Los servicios espejo de terceros fallan con frecuencia, afectando tu productividad?

Si te identificas con lo anterior, este proyecto puede ser adecuado para ti.

### Escenarios Apropiados

✅ **Compartir con Amigos**: 3-5 amigos compartiendo la suscripción Claude Code Max
✅ **Privacidad Sensible**: No quieres que servicios espejo vean tus conversaciones
✅ **Técnico**: Tienes conocimientos técnicos básicos y estás dispuesto a configurar y mantener
✅ **Necesidad de Estabilidad**: Necesitas acceso a Claude a largo plazo sin depender de servicios espejo
✅ **Región Restringida**: No puedes acceder directamente al servicio oficial de Claude

---

## 💭 ¿Por qué desplegarlo tú mismo?

### Posibles Problemas con Servicios Espejo Existentes

- 🕵️ **Riesgo de Privacidad**: El contenido de tus conversaciones es completamente visible para ellos, sin confidencialidad posible
- 🐌 **Rendimiento Inestable**: Se vuelve lento cuando hay muchos usuarios, a menudo se bloquea en horas pico
- 💰 **Precios Opacos**: No conoces el costo real

### Beneficios de Auto-Despliegue

- 🔐 **Seguridad de Datos**: Todas las solicitudes de API pasan solo por tu servidor, conexión directa a Anthropic API
- ⚡ **Rendimiento Controlable**: Solo ustedes usan el servicio, el plan Max de $200基本上 puede usar Opus cómodamente
- 💰 **Costos Transparentes**: Cuántos tokens usaste es claro, los costos específicos se convierten según precios oficiales
- 📊 **Monitoreo Completo**: Uso, análisis de costos, monitoreo de rendimiento, todo incluido

---

## 🚀 Características Principales

### Funciones Básicas

- ✅ **Gestión Multi-Cuenta**: Puedes agregar múltiples cuentas Claude para rotación automática
- ✅ **API Key Personalizada**: Asigna claves independientes a cada persona
- ✅ **Estadísticas de Uso**: Registra detalladamente cuántos tokens usó cada persona

### Funciones Avanzadas

- 🔄 **Conmutación Inteligente**: Cambia automáticamente a la siguiente cuenta si una falla
- 🚀 **Optimización de Rendimiento**: Pool de conexiones, caché, reduce latencia
- 📊 **Panel de Monitoreo**: Interfaz web para ver todos los datos
- 🛡️ **Control de Seguridad**: Límites de acceso, control de tasa, limitación de clientes
- 🌐 **Soporte de Proxy**: Soporta proxy HTTP/SOCKS5

---

## 📋 Requisitos Previos

### Requisitos del Sistema

- **Node.js**: >= 18.0.0
- **Redis**: >= 6.0
- **npm** o **yarn** o **pnpm**
- **Docker** (opcional, para despliegue con contenedor)
- **Git** (para clonar el repositorio)

### Recomendaciones de Hardware

- **CPU**: 2 núcleos o más
- **RAM**: 2GB mínimo, 4GB recomendado
- **Almacenamiento**: 20GB mínimo para logs y datos
- **Red**: Conexión estable a internet (se requiere proxy para acceso a Claude en ciertas regiones)

---

## 📦 Instalación

### Método 1: Instalación con Docker (Recomendado)

1. **Clonar el Repositorio**

```bash
git clone https://github.com/tu-usuario/claude-relay-service.git
cd claude-relay-service
```

2. **Configurar Variables de Entorno**

```bash
cp .env.example .env
# Editar .env con tu configuración
nano .env
```

Variables obligatorias:
```bash
JWT_SECRET=tu-clave-secreta-jwt-aqui-minimo-32-caracteres
ENCRYPTION_KEY=tu-clave-de-encriptacion-aqui-exactamente-32-car
REDIS_HOST=redis
REDIS_PORT=6379
# Redis sin contraseña por defecto en docker-compose
```

3. **Iniciar con Docker Compose**

```bash
docker-compose up -d
```

El servicio estará disponible en `http://localhost:3000`

4. **Verificar Estado**

```bash
docker-compose logs -f
```

### Método 2: Instalación Manual

1. **Instalar Dependencias**

```bash
npm install
```

2. **Instalar Dependencias del Frontend**

```bash
npm run install:web
```

3. **Ejecutar Script de Configuración**

```bash
npm run setup
```

Este script te guiará en la configuración de:
- Credenciales de administrador
- Configuración de Redis
- Configuración básica del sistema

4. **Configurar Variables de Entorno**

```bash
cp .env.example .env
nano .env
```

Asegúrate de configurar:
- `JWT_SECRET`: Clave secreta para JWT (mínimo 32 caracteres)
- `ENCRYPTION_KEY`: Clave de encriptación AES (exactamente 32 caracteres)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Configuración de Redis

5. **Construir Frontend**

```bash
npm run build:web
```

6. **Iniciar el Servicio**

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

---

## ⚙️ Configuración

### Configuración Básica

El archivo `.env` contiene toda la configuración necesaria:

#### 🔐 Configuración de Seguridad

```bash
JWT_SECRET=tu-clave-secreta-jwt-muy-segura-aqui
ENCRYPTION_KEY=tu-clave-de-encriptacion-aqui-32-caracteres
ADMIN_SESSION_TIMEOUT=86400000
API_KEY_PREFIX=cr_
```

#### 📊 Configuración de Redis

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=tu_password_redis
REDIS_DB=0
```

#### 🌐 Configuración del Servidor

```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

### Configuración de Proxy

Si necesitas usar proxy para acceder a Claude API:

```bash
# Configuración global de proxy
DEFAULT_PROXY_TIMEOUT=600000
MAX_PROXY_RETRIES=3
PROXY_USE_IPV4=true
```

Para configurar proxy por cuenta, usa la interfaz web o CLI:
```bash
npm run cli account add
```

### Configuración de Límites

```bash
DEFAULT_TOKEN_LIMIT=1000000
REQUEST_TIMEOUT=600000
CLEANUP_INTERVAL=3600000
```

---

## 🚀 Despliegue con Docker

### Construcción de Imagen

```bash
docker build -t claude-relay-service:latest .
```

### Uso de Docker Compose

El proyecto incluye `docker-compose.yml` para despliegue simplificado:

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down

# Reiniciar servicios
docker-compose restart
```

### Variables de Entorno Docker

Puedes pasar variables de entorno en `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
```

---

## 🔄 GitLab CI/CD

### Configuración de Pipeline

El proyecto incluye configuración para GitLab CI/CD en `.gitlab-ci.yml`.

#### Características del Pipeline

- **Build**: Construye imagen Docker automáticamente
- **Test**: Ejecuta suite de pruebas
- **Deploy**: Despliega a servidor de producción
- **Security Scan**: Análisis de vulnerabilidades

#### Estructura del Pipeline

```yaml
stages:
  - build
  - test
  - deploy
```

### Variables de GitLab CI/CD

Configura estas variables en GitLab (`Settings > CI/CD > Variables`):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DOCKER_REGISTRY` | Registro Docker | `registry.gitlab.com` |
| `DOCKER_IMAGE_NAME` | Nombre de imagen | `claude-relay-service` |
| `DEPLOY_SERVER` | Servidor de producción | `user@server.com` |
| `DEPLOY_PATH` | Ruta de despliegue | `/opt/claude-relay` |
| `SSH_PRIVATE_KEY` | Clave SSH para despliegue | `-----BEGIN...` |

### Ejecutar Pipeline Manualmente

1. Ve a **CI/CD > Pipelines**
2. Click en **Run Pipeline**
3. Selecciona rama y variables
4. Click en **Run Pipeline**

### Webhooks GitLab

Configura webhooks para despliegue automático:

1. **Settings > Webhooks**
2. URL: `https://tu-servidor.com/webhook/gitlab`
3. Selecciona eventos: **Push events**
4. Click en **Add webhook**

---

## 📊 Panel de Administración

### Acceder al Panel

```
URL: http://tu-servidor:3000/admin-next/login
```

### Credenciales por Defecto

Ejecuta `npm run setup` para generar credenciales únicas, o verifica `data/init.json`.

### Funciones del Panel

- **Gestión de Cuentas**: Agregar/eliminar cuentas Claude
- **Gestión de API Keys**: Crear/revocar claves de API
- **Monitoreo en Tiempo Real**: Ver uso actual, solicitudes activas
- **Estadísticas**: Análisis de costos, uso de tokens
- **Configuración**: Ajustar límites, proxy, políticas

---

## 🔧 Uso de CLI

### Comandos Disponibles

```bash
# Ver estado del sistema
npm run cli status

# Agregar cuenta Claude
npm run cli account add

# Listar cuentas
npm run cli account list

# Crear API Key
npm run cli key create

# Ver estadísticas
npm run cli stats
```

### Gestión de Servicio

```bash
# Iniciar como servicio (daemon)
npm run service:start:daemon

# Detener servicio
npm run service:stop

# Reiniciar servicio
npm run service:restart

# Ver logs
npm run service:logs:follow
```

---

## 🐛 Solución de Problemas

### Problemas Comunes

#### 1. Error de Conexión a Redis

**Síntoma**: `Error: Redis connection failed`

**Solución**:
```bash
# Verificar que Redis esté corriendo
redis-cli ping

# Verificar configuración en .env
cat .env | grep REDIS

# Reiniciar Redis
sudo systemctl restart redis
```

#### 2. Error de Autenticación

**Síntoma**: `JWT_SECRET not configured`

**Solución**:
```bash
# Generar secreto JWT seguro
openssl rand -base64 32

# Agregar a .env
echo "JWT_SECRET=tu-secreto-generado" >> .env
```

#### 3. Error de Build del Frontend

**Síntoma**: Error durante `npm run build:web`

**Solución**:
```bash
# Limpiar caché y reinstalar
cd web/admin-spa
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. Error de Proxy

**Síntoma**: `Timeout connecting to Claude API`

**Solución**:
- Verificar configuración de proxy en `.env`
- Probar proxy desde línea de comandos
- Verificar que proxy permita conexiones a `api.anthropic.com`

### Verificación de Logs

Los logs se almacenan en el directorio `logs/`:

```bash
# Ver todos los logs
ls -la logs/

# Ver log principal
tail -f logs/app.log

# Ver log de errores
tail -f logs/error.log

# Ver log de autenticación
tail -f logs/auth.log
```

---

## 📖 Documentación Adicional

- [Guía de Migración](MIGRATION_README.md)
- [Guía de Despliegue Manual](MANUAL_DEPLOYMENT_GUIDE.md)
- [Configuración de Secretos GitHub](GITHUB_SECRETS.md)
- [Guía de Traducción](TRANSLATION_GUIDE.md)

---

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Por favor:

1. Haz Fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

---

## 🙏 Agradecimientos

- Proyecto original basado en [Wei-Shaw/claude-relay-service](https://github.com/Wei-Shaw/claude-relay-service)
- Gracias a todos los contribuyentes y usuarios de la comunidad

---

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/tu-usuario/claude-relay-service/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/tu-usuario/claude-relay-service/discussions)
- **Telegram**: [Canal de Anuncios](https://t.me/claude_relay_service)

---

<div align="center">

**⭐ Si este proyecto te ayuda, considera darle una estrella en GitHub ⭐**

</div>
