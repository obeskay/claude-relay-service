# Resumen de Migración i18n - Claude Relay Service

## ✅ COMPLETADO

### 1. AppHeader.vue (100%)
- **Ubicación**: `/web/admin-spa/src/components/layout/AppHeader.vue`
- **Strings migrados**: ~35
- **Áreas completadas**:
  - ✅ Logo y título
  - ✅ Información de versión y actualización
  - ✅ Menú de usuario
  - ✅ Modal de cambio de contraseña (completo)
  - ✅ Todos los mensajes toast y confirm
  - ✅ Todos los labels y placeholders

### 2. Archivos de Traducción Creados/Actualizados
- ✅ `locales/es-MX/messages.json` (20+ claves nuevas)
- ✅ `locales/es-MX/forms.json` (8 claves nuevas)
- ✅ `locales/es-MX/dashboard.json` (archivo nuevo, 80+ claves)
- ✅ `src/i18n.js` actualizado para incluir dashboard.json

### 3. DashboardView.vue (Iniciado - 10%)
- ✅ Import de useI18n agregado
- ✅ Estadística "Total API Keys" migrada
- ⏳ Resto del dashboard pendiente

## 📋 ARCHIVO DE MIGRACIÓN MANUAL CREADO

He creado un script de migración automatizada en:
`/web/admin-spa/migrate-i18n.js`

**NO EJECUTAR sin revisión** - Es un punto de partida que requiere ajustes manuales.

## 🎯 RECOMENDACIONES PARA COMPLETAR LA MIGRACIÓN

### Opción 1: Migración Manual Sistemática (Recomendada)
**Tiempo estimado**: 15-20 horas

#### Fase 1: Vistas Principales (6-8 horas)
1. **DashboardView.vue** (~3 horas)
   ```bash
   # Priorizar estos textos:
   - "总API Keys" → t('dashboard.stats.total_api_keys')
   - "服务账户" → t('dashboard.stats.service_accounts')
   - "总使用量" → t('dashboard.stats.total_usage')
   - "总成本" → t('dashboard.stats.total_cost')
   - Todos los labels de gráficos
   ```

2. **ApiKeysView.vue** (~2 horas)
   ```bash
   # Crear archivo: locales/es-MX/apikeys.json
   # Migrar tabla de API Keys y filtros
   ```

3. **AccountsView.vue** (~2 horas)
   ```bash
   # Usar: accounts.json (ya existe)
   # Migrar tabla de cuentas multi-plataforma
   ```

4. **SettingsView.vue** (~1 hora)
   ```bash
   # Crear archivo: locales/es-MX/settings.json
   # Migrar configuración de sistema
   ```

#### Fase 2: Modales de API Keys (4-5 horas)
Crear archivo: `locales/es-MX/apikeys-modals.json`

Orden sugerido:
1. CreateApiKeyModal.vue (principal)
2. EditApiKeyModal.vue (principal)
3. UsageDetailModal.vue
4. NewApiKeyModal.vue
5. BatchApiKeyModal.vue
6. RenewApiKeyModal.vue
7. ExpiryEditModal.vue
8. BatchEditApiKeyModal.vue

#### Fase 3: Componentes de Cuentas (3-4 horas)
Usar: `accounts.json` (ya existe con 98 claves)

Orden sugerido:
1. AccountForm.vue (principal)
2. AccountCard.vue
3. Componentes específicos por plataforma

#### Fase 4: Componentes Comunes (3-4 horas)
1. Componentes de estadísticas (ApiStats, ModelUsage, etc.)
2. Componentes de visualización (badges, progress bars, etc.)
3. Componentes de usuario

### Opción 2: Migración Semi-Automatizada (Más Rápida)
**Tiempo estimado**: 8-12 horas + testing

1. **Revisar y ejecutar script de migración** (2 horas)
   ```bash
   cd /web/admin-spa
   # ANTES DE EJECUTAR:
   # 1. Hacer commit de cambios actuales
   # 2. Crear branch de respaldo
   git checkout -b i18n-migration-backup
   git add .
   git commit -m "backup antes de migración automática"
   git checkout -b i18n-auto-migration

   # Ejecutar script
   node migrate-i18n.js
   ```

2. **Revisión manual y correcciones** (4-6 horas)
   - Revisar cada archivo modificado
   - Corregir traducciones incorrectas
   - Agregar claves faltantes a archivos JSON

3. **Crear archivos de traducción faltantes** (2-3 horas)
   - apikeys.json
   - settings.json
   - apikeys-modals.json
   - components.json (componentes comunes)

4. **Testing completo** (2-3 horas)
   - Probar en español (es-MX)
   - Probar en inglés (en) - crear traducciones en inglés
   - Verificar que no queden strings en chino

## 📝 PATRÓN DE TRABAJO PARA CADA COMPONENTE

```vue
<!-- 1. Agregar import -->
<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

<!-- 2. Reemplazar en template -->
<!-- ANTES -->
<span>创建</span>
<input placeholder="请输入密码" />

<!-- DESPUÉS -->
<span>{{ t('action.create') }}</span>
<input :placeholder="t('placeholder.password')" />

<!-- 3. Reemplazar en script -->
// ANTES
showToast('保存成功', 'success')
confirm('确定要删除吗？')

// DESPUÉS
showToast(t('success.saved'), 'success')
confirm(t('confirm.delete'))
</script>
```

## 🗂️ ESTRUCTURA DE ARCHIVOS DE TRADUCCIÓN

```
locales/
├── en/
│   ├── common.json          (acciones, estados, labels comunes)
│   ├── nav.json            (navegación, menús, breadcrumbs)
│   ├── forms.json          (formularios, validaciones, placeholders)
│   ├── messages.json       (success, error, info, confirm)
│   ├── accounts.json       (cuentas multi-plataforma) ✅
│   ├── dashboard.json      (PENDIENTE - copiar de es-MX y traducir)
│   ├── apikeys.json        (PENDIENTE - crear)
│   ├── settings.json       (PENDIENTE - crear)
│   └── components.json     (PENDIENTE - crear)
│
└── es-MX/
    ├── common.json          ✅
    ├── nav.json            ✅
    ├── forms.json          ✅ (actualizado)
    ├── messages.json       ✅ (actualizado)
    ├── accounts.json       ✅
    ├── dashboard.json      ✅ (NUEVO)
    ├── apikeys.json        ⏳ (CREAR)
    ├── settings.json       ⏳ (CREAR)
    └── components.json     ⏳ (CREAR)
```

## 🔍 VERIFICACIÓN FINAL

Antes de considerar completa la migración:

```bash
# 1. Buscar strings en chino restantes
grep -r "[\u4e00-\u9fa5]" src --include="*.vue" --include="*.js"

# 2. Verificar imports de i18n
grep -L "useI18n\|vue-i18n" src/**/*.vue

# 3. Contar componentes migrados vs total
find src -name "*.vue" | wc -l
grep -l "useI18n" src/**/*.vue | wc -l

# 4. Probar build
npm run build

# 5. Probar en dev con ambos idiomas
npm run dev
# Cambiar idioma en UI y verificar
```

## 📊 MÉTRICAS ACTUALES

- ✅ **Componentes completados**: 1 / ~60 (1.7%)
- ⏳ **Componentes iniciados**: 1 (DashboardView - 10%)
- 📝 **Strings migrados**: ~40 / ~500+ (8%)
- 📁 **Archivos de traducción**: 6 / ~9 (67%)
- 🆕 **Claves de traducción nuevas**: 108 (dashboard: 80, messages: 20, forms: 8)

## ⚠️ NOTAS IMPORTANTES

1. **NO eliminar textos en chino hasta verificar funcionamiento**
2. **Crear branch de respaldo antes de cambios masivos**
3. **Probar en ambos idiomas después de cada fase**
4. **Mantener copia de archivos JSON originales**
5. **Documentar claves de traducción personalizadas**

## 🚀 COMANDO RÁPIDO PARA CONTINUAR

```bash
cd /Users/obed.woow/Documents/claude-relay-service/web/admin-spa

# Opción 1: Continuar manualmente
# Abrir DashboardView.vue y seguir el patrón de AppHeader.vue

# Opción 2: Ejecutar script (CON PRECAUCIÓN)
git checkout -b i18n-migration-backup
git add . && git commit -m "backup pre-migration"
git checkout -b i18n-auto-migration
node migrate-i18n.js
# Luego revisar cambios con: git diff
```

## 📚 RECURSOS

- Documentación vue-i18n: https://vue-i18n.intlify.dev/
- Reporte completo: `claudedocs/i18n-migration-report.md`
- Script de migración: `web/admin-spa/migrate-i18n.js`
- AppHeader.vue (referencia completa): `web/admin-spa/src/components/layout/AppHeader.vue`

---

**Estado**: En progreso (Fase 1 - 1/4 completada)
**Última actualización**: 2025-11-24
**Próximo paso recomendado**: Completar DashboardView.vue manualmente
