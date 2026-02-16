#!/bin/bash

# Script para verificar el estado del webhook de GitHub → Coolify

echo "🔍 Verificando webhook de GitHub..."
echo ""

# Verificar si gh CLI está instalado
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI no está instalado"
    echo "Instalar con: brew install gh"
    exit 1
fi

# Verificar autenticación
if ! gh auth status &> /dev/null; then
    echo "❌ No autenticado en GitHub"
    echo "Ejecutar: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI disponible y autenticado"
echo ""

# Obtener información del webhook
echo "📊 Información del Webhook:"
echo "----------------------------"
gh api repos/obeskay/claude-relay-service/hooks/596477789 --jq '{
  id: .id,
  active: .active,
  events: .events,
  url: .config.url,
  created_at: .created_at
}'

echo ""
echo ""

# Verificar entregas recientes
echo "📦 Últimas 5 entregas del webhook:"
echo "-----------------------------------"
gh api "repos/obeskay/claude-relay-service/hooks/596477789/deliveries?per_page=5" --jq '.[] | {
  id: .id,
  event: .event,
  status: .status,
  code: .status_code,
  delivered_at: .delivered_at
}'

echo ""
echo ""

# Probar endpoint de Coolify manualmente
echo "🧪 Probando endpoint de Coolify..."
echo "-----------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"name":"claude-relay-service"}}' \
  https://admin.cloud.obeskay.com/api/v1/webhooks/coolify/ssgs4gw4wck4kc8g48o8kc4c-220616712098)

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Endpoint de Coolify respondió correctamente (HTTP $RESPONSE)"
elif [ "$RESPONSE" = "404" ]; then
    echo "❌ Endpoint de Coolify retornó HTTP 404 (Not Found)"
    echo "   La URL podría estar incorrecta o el servicio no existe en Coolify"
elif [ "$RESPONSE" = "000" ]; then
    echo "⚠️  No se pudo conectar al endpoint de Coolify"
    echo "   Verificar conexión de red o firewall"
else
    echo "⚠️  Endpoint de Coolify respondió con HTTP $RESPONSE"
fi

echo ""
echo ""

# Resumen
echo "📋 Resumen:"
echo "-----------"
echo "✅ Webhook configurado en GitHub: S��"
echo "❌ Endpoint de Coolify funcionando: NO (HTTP $RESPONSE)"
echo ""
echo "🔧 Acciones recomendadas:"
echo "   1. Verificar la URL del webhook en el panel de Coolify"
echo "   2. Si cambió, actualizar el webhook en GitHub"
echo "   3. Considerar usar GitHub Actions como alternativa"
echo ""
echo "📖 Reporte completo: WEBHOOK_SETUP_REPORT.md"
