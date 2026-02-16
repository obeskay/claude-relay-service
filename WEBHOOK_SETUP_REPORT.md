# GitHub Webhook Configuration Report

## Status: WEBHOOK CREADO EXITOSAMENTE ✅

**Fecha**: 2026-02-16
**Repositorio**: https://github.com/obeskay/claude-relay-service

---

## Resultado de la Investigación

### Problema Identificado
El deploy automático **nunca ha funcionado** porque el webhook de GitHub no estaba configurado.

### Verificación Inicial
- **GitHub API Check**: No existía ningún webhook configurado
- **Resultado**: Array vacío `[]` al listar webhooks

---

## Configuración Realizada

### Webhook Creado Exitosamente

**ID del Webhook**: 596477789
**URL**: https://admin.cloud.obeskay.com/api/v1/webhooks/coolify/ssgs4gw4wck4kc8g48o8kc4c-220616712098
**Estado**: Activo ✅
**Eventos Configurados**: `push`
**Content Type**: `application/json`
**SSL**: Verificado (insecure_ssl: 0)

### Configuración Completa

```json
{
  "type": "Repository",
  "id": 596477789,
  "name": "web",
  "active": true,
  "events": ["push"],
  "config": {
    "content_type": "json",
    "insecure_ssl": "0",
    "url": "https://admin.cloud.obeskay.com/api/v1/webhooks/coolify/ssgs4gw4wck4kc8g48o8kc4c-220616712098"
  },
  "created_at": "2026-02-16T06:24:25Z",
  "updated_at": "2026-02-16T06:24:25Z"
}
```

---

## Prueba Realizada

### Test Event Enviado
- **Fecha**: 2026-02-16T06:24:33Z
- **Event**: `push` (test event)
- **Duración**: 0.37 segundos
- **Status Code**: 404
- **Status**: "Invalid HTTP Response: 404"

### Análisis del Resultado 404

El webhook está configurado correctamente y funcionando, pero el endpoint de Coolify está retornando **404 Not Found**.

**Posibles Causas:**

1. **URL Incorrecta o Desactualizada**
   - El ID del servicio en Coolify podría haber cambiado
   - La estructura de URLs de webhooks de Coolify pudo cambiar

2. **Servicio No Configurado en Coolify**
   - El proyecto podría no estar configurado para recibir webhooks
   - El servicio podría haber sido eliminado o recreado con nuevo ID

3. **Firewall o Restricciones de Red**
   - Coolify podría estar bloqueando requests desde GitHub IPs
   - El firewall del servidor podría estar filtrando las requests

4. **Coolify Webhook Desactivado**
   - La configuración de webhooks podría estar desactivada en Coolify
   - El endpoint podría necesitar autenticación adicional

---

## Pasos Siguientes Recomendados

### Opción A: Verificar Configuración en Coolify (RECOMENDADO)

1. **Acceder al Panel de Coolify**
   ```
   URL: https://admin.cloud.obeskay.com
   ```

2. **Verificar el Proyecto**
   - Buscar el servicio "claude-relay-service"
   - Ir a Settings → Webhooks
   - Verificar que el webhook esté activo
   - Copiar la URL correcta si es diferente

3. **Regenerar Webhook si es Necesario**
   - Si el servicio fue recreado, generar nuevo webhook
   - Actualizar el webhook en GitHub con la nueva URL

### Opción B: Verificar Logs del Servidor

```bash
# Ver logs de Coolify para ver si está recibiendo los webhooks
ssh admin.cloud.obeskay.com
docker logs coolify --tail 100 | grep -i webhook
```

### Opción C: Probar Manualmente el Endpoint

```bash
# Enviar un test manual al endpoint de Coolify
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  https://admin.cloud.obeskay.com/api/v1/webhooks/coolify/ssgs4gw4wck4kc8g48o8kc4c-220616712098
```

---

## Solución Alternativa: GitHub Actions Auto-Deploy

El proyecto ya tiene configurado GitHub Actions para deploy automático a Protec:

**Workflow**: `.github/workflows/deploy-to-protec.yml`
**Trigger**: Push a branches `main` o `main-v2`
**Action**: Build Docker image → Push to GHCR → SSH to Protec → Deploy

Este workflow funciona independientemente de Coolify y podría ser la solución principal para auto-deploy.

---

## Comandos Útiles

### Ver Webhook en GitHub
```bash
gh api repos/obeskay/claude-relay-service/hooks/596477789
```

### Ver Entregas del Webhook
```bash
gh api "repos/obeskay/claude-relay-service/hooks/596477789/deliveries?per_page=10"
```

### Re-testear el Webhook
```bash
gh api --method POST \
  repos/obeskay/claude-relay-service/hooks/596477789/test
```

### Eliminar el Webhook (si es necesario)
```bash
gh api --method DELETE \
  repos/obeskay/claude-relay-service/hooks/596477789
```

---

## Conclusión

✅ **Webhook de GitHub configurado correctamente**
❌ **Endpoint de Coolify retornando 404**

**Acción Requerida**: Verificar la configuración en Coolify o usar GitHub Actions como alternativa principal para auto-deploy.

---

## Archivos de Referencia

- `/Users/obedvargasvillarreal/INSTRUCCIONES_WEBHOOK.md` - Instrucciones originales
- `.github/workflows/deploy-to-protec.yml` - Workflow de GitHub Actions
- `docker-compose.yml` - Configuración de Docker para Coolify
