#!/bin/sh
set -e

echo "🚀 Claude Relay Service 启动中..."

# ========================================
# 🔐 Generación automática de claves
# ========================================

# Función para generar JWT_SECRET
generate_jwt_secret() {
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
}

# Función para generar ENCRYPTION_KEY (32 caracteres exactos)
generate_encryption_key() {
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
}

# Archivo para persistir las claves generadas
SECRETS_FILE="/app/data/.secrets"

# Crear directorio data si no existe
mkdir -p /app/data

# Si el archivo de secrets no existe, crearlo
if [ ! -f "$SECRETS_FILE" ]; then
  echo "🔑 Generando claves de seguridad automáticamente..."

  GENERATED_JWT_SECRET=$(generate_jwt_secret)
  GENERATED_ENCRYPTION_KEY=$(generate_encryption_key)

  cat > "$SECRETS_FILE" << EOF
# 🔐 Claves generadas automáticamente - NO BORRAR
# Generadas el: $(date)
JWT_SECRET=$GENERATED_JWT_SECRET
ENCRYPTION_KEY=$GENERATED_ENCRYPTION_KEY
EOF

  chmod 600 "$SECRETS_FILE"
  echo "✅ Claves generadas y guardadas en $SECRETS_FILE"
fi

# Cargar las claves del archivo si no están en el ambiente
if [ -f "$SECRETS_FILE" ]; then
  # Leer JWT_SECRET
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(grep '^JWT_SECRET=' "$SECRETS_FILE" | cut -d'=' -f2-)
    export JWT_SECRET
    echo "✅ JWT_SECRET cargado desde $SECRETS_FILE"
  fi

  # Leer ENCRYPTION_KEY
  if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' "$SECRETS_FILE" | cut -d'=' -f2-)
    export ENCRYPTION_KEY
    echo "✅ ENCRYPTION_KEY cargado desde $SECRETS_FILE"
  fi
fi

# Verificar que las claves existan
if [ -z "$JWT_SECRET" ]; then
  echo "❌ Error: JWT_SECRET no pudo ser generado ni cargado"
  exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "❌ Error: ENCRYPTION_KEY no pudo ser generado ni cargado"
  exit 1
fi

# Validar longitud de ENCRYPTION_KEY (debe ser exactamente 32 caracteres)
if [ ${#ENCRYPTION_KEY} -ne 32 ]; then
  echo "❌ Error: ENCRYPTION_KEY debe tener exactamente 32 caracteres"
  echo "   Longitud actual: ${#ENCRYPTION_KEY}"
  exit 1
fi

# ========================================
# 🔧 Configuración de archivos
# ========================================

# Verificar y copiar config.js
if [ ! -f "/app/config/config.js" ]; then
  echo "📋 Creando config.js desde plantilla..."
  if [ -f "/app/config/config.example.js" ]; then
    cp /app/config/config.example.js /app/config/config.js
    echo "✅ config.js creado"
  else
    echo "❌ Error: config.example.js no encontrado"
    exit 1
  fi
else
  echo "✅ config.js existente detectado"
fi

# ========================================
# 📋 Inicialización
# ========================================

# Mostrar información de configuración
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Configuración del Servicio            ║"
echo "╚════════════════════════════════════════╝"
echo "  🔑 JWT_SECRET: [CONFIGURADO - $(echo $JWT_SECRET | cut -c1-8)...]"
echo "  🔐 ENCRYPTION_KEY: [CONFIGURADO - ${#ENCRYPTION_KEY} caracteres]"
echo "  📊 REDIS_HOST: ${REDIS_HOST:-localhost}"
echo "  🌐 PORT: ${PORT:-3000}"
echo "  📝 LOG_LEVEL: ${LOG_LEVEL:-info}"
echo ""

# Ejecutar inicialización si es primera vez
if [ ! -f "/app/data/init.json" ]; then
  echo "📋 Primera ejecución detectada - Ejecutando setup..."

  if [ -n "$ADMIN_USERNAME" ] || [ -n "$ADMIN_PASSWORD" ]; then
    echo "📌 Usando credenciales de administrador predefinidas"
  else
    echo "📌 Se generarán credenciales de administrador aleatorias"
  fi

  node /app/scripts/setup.js

  if [ $? -eq 0 ]; then
    echo "✅ Setup completado exitosamente"
  else
    echo "❌ Error durante el setup"
    exit 1
  fi
else
  echo "✅ Sistema ya inicializado (init.json existe)"

  # Mostrar advertencia si hay credenciales en variables de entorno
  if [ -n "$ADMIN_USERNAME" ] || [ -n "$ADMIN_PASSWORD" ]; then
    echo ""
    echo "⚠️  ADVERTENCIA:"
    echo "   Variables ADMIN_USERNAME/ADMIN_PASSWORD detectadas"
    echo "   pero el sistema ya está inicializado."
    echo "   Para usar nuevas credenciales:"
    echo "   1. Detener el contenedor"
    echo "   2. Eliminar /app/data/init.json"
    echo "   3. Reiniciar el contenedor"
    echo ""
  fi
fi

# ========================================
# 🏥 Verificación de salud de Redis
# ========================================

echo "🔍 Verificando conexión a Redis..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379} 2>/dev/null; then
    echo "✅ Redis está disponible en ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Esperando Redis... intento $RETRY_COUNT/$MAX_RETRIES"
  sleep 2

  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Error: No se pudo conectar a Redis después de $MAX_RETRIES intentos"
    echo "   Asegúrate de que Redis esté ejecutándose en ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}"
    exit 1
  fi
done

# ========================================
# 🚀 Iniciar aplicación
# ========================================

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  🌐 Iniciando Claude Relay Service     ║"
echo "╚════════════════════════════════════════╝"
echo ""

exec "$@"
