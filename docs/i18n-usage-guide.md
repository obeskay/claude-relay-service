# Guía de Uso de i18n en Claude Relay Service

## Resumen

El sistema de internacionalización (i18n) está completamente configurado y listo para usar en el backend de Claude Relay Service. Soporta **inglés (en)** y **español mexicano (es-MX)**.

## Configuración Completada

### Archivos Creados

1. **`/src/services/i18nService.js`** - Servicio principal de i18next
2. **`/src/utils/i18nHelper.js`** - Funciones helper para traducciones
3. **`/scripts/test-i18n.js`** - Script de verificación de configuración

### Integración en app.js

El middleware de i18n fue integrado correctamente en `/src/app.js` en la línea **176-178**, justo después del `securityMiddleware` y antes de las rutas.

```javascript
// 🌐 i18n middleware - Internacionalización
const { middleware: i18nMiddleware, i18next } = require('./services/i18nService')
this.app.use(i18nMiddleware.handle(i18next))
logger.info('🌐 i18n middleware initialized - Supporting: en, es-MX')
```

### Estructura de Locales

```
src/locales/
├── en/
│   ├── common.json   (54 claves)
│   ├── errors.json   (59 claves)
│   └── api.json      (37 claves)
└── es-MX/
    ├── common.json   (54 claves)
    ├── errors.json   (59 claves)
    └── api.json      (37 claves)
```

## Cómo Usar i18n en tus Rutas/Servicios

### Método 1: Usando getTranslator() (Recomendado)

Obtiene una función de traducción que automáticamente usa el idioma de la solicitud:

```javascript
const { getTranslator } = require('../utils/i18nHelper')

router.get('/example', (req, res) => {
  const t = getTranslator(req)

  res.json({
    message: t('common.success'),
    status: t('status.active'),
    action: t('common.save')
  })
})
```

### Método 2: Traducciones de Errores

```javascript
const { translateError } = require('../utils/i18nHelper')

router.post('/create', (req, res) => {
  try {
    // ... lógica de creación
    res.json({ success: true })
  } catch (error) {
    const errorMsg = translateError(req, 'validation.invalid_input', {
      field: 'email'
    })
    res.status(400).json({ error: errorMsg })
  }
})
```

### Método 3: Traducciones de API

```javascript
const { translateApi } = require('../utils/i18nHelper')

router.get('/status', (req, res) => {
  const message = translateApi(req, 'status.service_healthy')

  res.json({
    status: 'ok',
    message: message
  })
})
```

### Método 4: Traducción Directa (sin request)

```javascript
const { translate } = require('../utils/i18nHelper')

// Especificar idioma manualmente
const enMessage = translate('common.success', 'en')
const esMessage = translate('common.success', 'es-MX')

console.log(enMessage) // "Success"
console.log(esMessage) // "Éxito"
```

## Detección de Idioma

El idioma se detecta automáticamente en este orden:

1. **Header `Accept-Language`** (preferido)
2. **Query string**: `?lng=es-MX`
3. **Cookie**: `i18next=es-MX`

Si ninguno está presente, se usa el idioma por defecto: **inglés (en)**.

## Ejemplos de Uso en Respuestas de API

### Ejemplo 1: Respuesta de Éxito

```javascript
const { getTranslator } = require('../utils/i18nHelper')

router.post('/api-keys', async (req, res) => {
  const t = getTranslator(req)

  try {
    // ... crear API key
    res.status(201).json({
      success: true,
      message: t('api.key_created_successfully'),
      data: apiKey
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: t('errors.internal_server_error')
    })
  }
})
```

### Ejemplo 2: Validación con Interpolación

```javascript
const { translateError } = require('../utils/i18nHelper')

router.put('/accounts/:id', async (req, res) => {
  if (!req.body.name) {
    const errorMsg = translateError(req, 'validation.field_required', {
      field: 'name'
    })
    return res.status(400).json({ error: errorMsg })
  }

  // ... resto de la lógica
})
```

### Ejemplo 3: Mensajes de Estado del Sistema

```javascript
const { translateApi } = require('../utils/i18nHelper')

router.get('/health', async (req, res) => {
  const systemStatus = await checkSystemHealth()
  const t = getTranslator(req)

  res.json({
    status: systemStatus.healthy ? t('status.online') : t('status.offline'),
    message: systemStatus.healthy
      ? translateApi(req, 'system.all_services_operational')
      : translateApi(req, 'system.degraded_performance'),
    timestamp: new Date().toISOString()
  })
})
```

## Agregar Nuevas Traducciones

Para agregar nuevas claves de traducción, edita los archivos JSON correspondientes:

1. **Traducciones comunes**: `src/locales/{lng}/common.json`
2. **Mensajes de error**: `src/locales/{lng}/errors.json`
3. **Mensajes de API**: `src/locales/{lng}/api.json`

Ejemplo de nueva traducción en `api.json`:

```json
{
  "user.created": "User created successfully",
  "user.updated": "User updated successfully",
  "user.deleted": "User deleted successfully"
}
```

Y en español (`es-MX/api.json`):

```json
{
  "user.created": "Usuario creado exitosamente",
  "user.updated": "Usuario actualizado exitosamente",
  "user.deleted": "Usuario eliminado exitosamente"
}
```

## Verificar la Configuración

Para verificar que todo esté funcionando correctamente, ejecuta:

```bash
node scripts/test-i18n.js
```

Deberías ver:

```
✅ Configuración de i18n completada exitosamente
```

## Variables de Entorno Opcionales

Se agregó la variable `DEFAULT_LANGUAGE` a `.env.example`:

```bash
# Idioma predeterminado del backend (en, es-MX)
DEFAULT_LANGUAGE=en
```

Esta variable es **opcional**. Si no se define, el sistema usará inglés por defecto.

## Buenas Prácticas

1. **Siempre usa claves descriptivas**: `user.login.success` en lugar de `msg1`
2. **Organiza por namespace**: Usa `common.*`, `errors.*`, `api.*` apropiadamente
3. **Proporciona contexto**: Usa interpolación cuando el mensaje necesite datos dinámicos
4. **Mantén consistencia**: Traduce TODAS las claves en todos los idiomas soportados
5. **Prueba ambos idiomas**: Verifica que las traducciones sean correctas en español e inglés

## Archivos Modificados

- ✅ **Creado**: `/src/services/i18nService.js`
- ✅ **Creado**: `/src/utils/i18nHelper.js`
- ✅ **Creado**: `/scripts/test-i18n.js`
- ✅ **Modificado**: `/src/app.js` (líneas 175-178)
- ✅ **Modificado**: `.env.example` (líneas 79-81)

## Soporte

Si encuentras algún problema o necesitas agregar más idiomas, consulta la [documentación oficial de i18next](https://www.i18next.com/).
