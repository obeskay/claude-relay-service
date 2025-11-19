#!/bin/bash

# 🔍 Script de Validación de Deployment
# Valida que el deployment esté configurado correctamente

set -e

echo "╔════════════════════════════════════════╗"
echo "║  🔍 Validación de Deployment           ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

# Función para verificar archivo
check_file() {
  local file=$1
  local required=$2

  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} Archivo encontrado: $file"
    PASSED=$((PASSED + 1))
    return 0
  else
    if [ "$required" = "required" ]; then
      echo -e "${RED}❌${NC} Archivo FALTANTE (requerido): $file"
      FAILED=$((FAILED + 1))
    else
      echo -e "${YELLOW}⚠️${NC}  Archivo faltante (opcional): $file"
      WARNINGS=$((WARNINGS + 1))
    fi
    return 1
  fi
}

# Función para verificar directorio
check_directory() {
  local dir=$1

  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} Directorio encontrado: $dir"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${YELLOW}⚠️${NC}  Directorio faltante (se creará): $dir"
    WARNINGS=$((WARNINGS + 1))
    return 1
  fi
}

echo "📋 Verificando archivos de configuración..."
echo ""

# Archivos requeridos
check_file "Dockerfile" "required"
check_file "docker-compose.yml" "required"
check_file "docker-entrypoint.sh" "required"
check_file "package.json" "required"
check_file "src/app.js" "required"

echo ""
echo "📦 Verificando configuración..."
echo ""

check_file "config/config.example.js" "required"
check_file ".dockerignore" "optional"
check_file "DEPLOY_COOLIFY.md" "optional"
check_file ".coolify" "optional"

echo ""
echo "📁 Verificando estructura de directorios..."
echo ""

check_directory "src"
check_directory "config"
check_directory "web/admin-spa"
check_directory "scripts"

echo ""
echo "🔧 Verificando permisos de scripts..."
echo ""

# Verificar permisos de ejecución
if [ -x "docker-entrypoint.sh" ]; then
  echo -e "${GREEN}✅${NC} docker-entrypoint.sh tiene permisos de ejecución"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️${NC}  docker-entrypoint.sh necesita permisos de ejecución"
  echo "   Ejecuta: chmod +x docker-entrypoint.sh"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🐳 Verificando sintaxis de Docker Compose..."
echo ""

if command -v docker-compose &> /dev/null; then
  if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} docker-compose.yml es válido"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}❌${NC} docker-compose.yml tiene errores de sintaxis"
    docker-compose config
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠️${NC}  docker-compose no está instalado (no se puede validar)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "📝 Verificando archivos .env..."
echo ""

if [ -f ".env" ]; then
  echo -e "${YELLOW}⚠️${NC}  Archivo .env encontrado"
  echo "   NOTA: Las variables de entorno deben configurarse en Coolify,"
  echo "   no en el archivo .env (se ignora en deployment)"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅${NC} No hay archivo .env (correcto para Coolify)"
  PASSED=$((PASSED + 1))
fi

echo ""
echo "🔐 Verificando archivos sensibles..."
echo ""

SENSITIVE_FILES=(
  "data/init.json"
  "data/.secrets"
  ".env.local"
  ".env.production"
)

for file in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${YELLOW}⚠️${NC}  Archivo sensible detectado: $file"
    echo "   NOTA: Este archivo NO debe subirse a Git"
    WARNINGS=$((WARNINGS + 1))
  fi
done

if [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅${NC} No se encontraron archivos sensibles"
  PASSED=$((PASSED + 1))
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  📊 Resumen de Validación              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Pasadas:${NC}      $PASSED"
echo -e "${YELLOW}⚠️  Advertencias:${NC} $WARNINGS"
echo -e "${RED}❌ Fallas:${NC}       $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ VALIDACIÓN FALLIDA                   ║${NC}"
  echo -e "${RED}║  Corrige los errores antes de deployar  ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}╔══════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  ⚠️  VALIDACIÓN CON ADVERTENCIAS         ║${NC}"
  echo -e "${YELLOW}║  Revisa las advertencias pero puedes    ║${NC}"
  echo -e "${YELLOW}║  proceder con el deployment              ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ VALIDACIÓN EXITOSA                   ║${NC}"
  echo -e "${GREEN}║  El proyecto está listo para deployment ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "🚀 Siguiente paso: Push a GitHub y deploy en Coolify"
  exit 0
fi
