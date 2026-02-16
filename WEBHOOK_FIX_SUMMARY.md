# Webhook GitHub → Coolify - Resumen Ejecutivo

## Fecha: 2026-02-16

---

## ✅ LO QUE HE HECHO

### 1. Investigación Completa
- Revisé las instrucciones en `~/INSTRUCCIONES_WEBHOOK.md`
- Verifiqué el estado de webhooks vía GitHub API
- Confirmé que **no existía ningún webhook configurado**

### 2. Configuración del Webhook
- **Creado exitosamente** el webhook en GitHub
- **ID**: 596477789
- **URL**: https://admin.cloud.obeskay.com/api/v1/webhooks/coolify/ssgs4gw4wck4kc8g48o8kc4c-220616712098
- **Evento**: `push` (se activa en cada push al repo)
- **Estado**: Activo ✅

### 3. Pruebas y Verificación
- Envié un test event desde GitHub
- Verifiqué que GitHub está enviando los eventos correctamente
- Confirmé que el endpoint de Coolify está retornando **HTTP 404**

### 4. Documentación Creada
- `WEBHOOK_SETUP_REPORT.md` - Reporte detallado
- `check-webhook.sh` - Script de verificación
- `INSTRUCCIONES_WEBHOOK.md` - Actualizado con estado actual

---

## ❌ PROBLEMA IDENTIFICADO

### El Webhook de GitHub está funcionando, pero Coolify responde 404

**Esto significa:**
1. ✅ GitHub está enviando los eventos correctamente
2. ❌ La URL del webhook en Coolify está desactualizada o incorrecta
3. ❌ El servicio podría haber sido recreado con un nuevo ID

---

## 🔧 PASOS SIGUIENTES (TU ACCIÓN REQUERIDA)

### Opción 1: Verificar en Coolify (RECOMENDADO)

1. **Acceder al panel de Coolify**
   - URL: https://admin.cloud.obeskay.com
   - Iniciar sesión

2. **Buscar el servicio**
   - Encontrar "claude-relay-service"
   - Ir a Settings → Webhooks
   - **COPIAR la URL actual del webhook**

3. **Comparar URLs**
   - Si es diferente a la configurada en GitHub, actualizarla

4. **Actualizar el webhook en GitHub** (si es necesario)
   ```bash
   gh api --method PATCH \
     repos/obeskay/claude-relay-service/hooks/596477789 \
     -f config[url]="NUEVA_URL_DE_COOLIFY"
   ```

### Opción 2: Usar GitHub Actions (ALTERNATIVA RECOMENDADA)

El proyecto ya tiene **GitHub Actions configurado** para auto-deploy:

- **Workflow**: `.github/workflows/deploy-to-protec.yml`
- **Trigger**: Automático en push a `main` o `main-v2`
- **Ventajas**: Más confiable, independiente de Coolify

**Verificar que esté funcionando:**
1. Ir a: https://github.com/obeskay/claude-relay-service/actions
2. Buscar "Deploy to Protec"
3. Verificar que se ejecute automáticamente en cada push

---

## 📊 ESTADO ACTUAL

| Componente | Estado | Notas |
|------------|--------|-------|
| GitHub Webhook | ✅ Configurado | ID: 596477789 |
| Evento Push | ✅ Activo | Se envía en cada push |
| Entrega a Coolify | ❌ Fallando | HTTP 404 |
| GitHub Actions | ✅ Disponible | Workflow alternativo listo |

---

## 🛠️ COMANDOS ÚTILES

### Verificar estado del webhook
```bash
./check-webhook.sh
```

### Ver información del webhook
```bash
gh api repos/obeskay/claude-relay-service/hooks/596477789
```

### Ver entregas recientes
```bash
gh api "repos/obeskay/claude-relay-service/hooks/596477789/deliveries?per_page=10"
```

### Re-testear el webhook
```bash
gh api --method POST \
  repos/obeskay/claude-relay-service/hooks/596477789/test
```

### Actualizar URL del webhook
```bash
gh api --method PATCH \
  repos/obeskay/claude-relay-service/hooks/596477789 \
  -f config[url]="NUEVA_URL"
```

### Eliminar webhook (si es necesario)
```bash
gh api --method DELETE \
  repos/obeskay/claude-relay-service/hooks/596477789
```

---

## 📝 ARCHIVOS CREADOS/MODIFICADOS

1. **WEBHOOK_SETUP_REPORT.md** - Reporte detallado del problema y solución
2. **check-webhook.sh** - Script para verificar el estado del webhook
3. **INSTRUCCIONES_WEBHOOK.md** - Actualizado con estado actual y pasos a seguir
4. **WEBHOOK_FIX_SUMMARY.md** - Este archivo

---

## 🎯 CONCLUSIÓN

**El problema raíz ha sido identificado y parcialmente resuelto:**

✅ **RESUELTO**: Webhook de GitHub ahora está configurado correctamente
❌ **PENDIENTE**: Verificar la URL correcta en Coolify

**Recomendación**: Usar GitHub Actions como método principal de auto-deploy mientras se resuelve el problema con el endpoint de Coolify.

---

## 📞 ¿Necesitas Ayuda?

Si el problema persiste después de verificar la URL en Coolify:

1. **Verificar logs del servidor Coolify**
   ```bash
   ssh admin.cloud.obeskay.com
   docker logs coolify --tail 100 | grep -i webhook
   ```

2. **Verificar que el servicio existe en Coolify**
   - Buscar el proyecto en el panel de Coolify
   - Verificar que esté activo

3. **Considerar recrear el webhook en Coolify**
   - Eliminar el servicio
   - Crearlo nuevamente
   - Copiar la nueva URL del webhook
   - Actualizar el webhook en GitHub
