# Reporte de Migración i18n - Claude Relay Service Admin SPA

## Fecha
2025-11-24

## Estado General
✅ **Fase 1 Completada**: Configuración inicial y componente principal de navegación

## Archivos Migrados

### 1. ✅ AppHeader.vue (COMPLETO)
**Ubicación**: `/web/admin-spa/src/components/layout/AppHeader.vue`

**Strings migrados**: ~35 strings
**Cambios realizados**:
- ✅ Importación de `useI18n` agregada
- ✅ Subtitle del logo: "管理后台" → `t('nav.page.title.dashboard')`
- ✅ Información de versión (actualización, verificar, etc.)
- ✅ Modal de cambio de contraseña completo
- ✅ Botones de usuario (modificar cuenta, cerrar sesión)
- ✅ Mensajes de toast y confirm
- ✅ Labels de formulario
- ✅ Placeholders
- ✅ Textos de ayuda

**Claves de traducción usadas**:
- `nav.page.title.dashboard`
- `info.new_version_available`, `info.current_version`, `info.latest_version`
- `info.checking_updates`, `info.up_to_date`
- `info.view_update`, `info.check_updates`
- `confirm.change_account`, `confirm.current_username`, `confirm.new_username`
- `confirm.current_password`, `confirm.new_password`, `confirm.confirm_password`
- `confirm.password_mismatch`, `confirm.password_min_length`
- `confirm.account_updated`, `confirm.password_updated`, `confirm.update_failed`
- `confirm.logout`
- `nav.menu.logout`
- `action.refresh`, `action.cancel`, `action.save`
- `status.loading`
- `success.logout`
- `placeholder.current_password`, `placeholder.new_password`, `placeholder.confirm_new_password`
- `placeholder.enter_new_username`, `placeholder.new_username_optional`
- `help.username_optional`, `help.password_length`

### 2. ✅ Archivos de Traducción Actualizados

#### messages.json (es-MX)
**Nuevas claves agregadas**: 20+
- Información de versión (7 claves)
- Confirmación de cambios de cuenta (8 claves)
- Mensaje de logout (1 clave)

#### forms.json (es-MX)
**Nuevas claves agregadas**: 8
- Placeholders de contraseña (3 claves)
- Placeholders de username (2 claves)
- Ayuda de formulario (2 claves)

## Pendientes de Migración

### Prioridad Alta (Vistas Principales)
- ⏳ **DashboardView.vue** (1619 líneas) - Estadísticas y gráficos
- ⏳ **ApiKeysView.vue** - Gestión de API Keys
- ⏳ **AccountsView.vue** - Gestión de cuentas multi-plataforma
- ⏳ **SettingsView.vue** - Configuración del sistema

### Prioridad Media (Componentes de API Keys)
- ⏳ **EditApiKeyModal.vue**
- ⏳ **CreateApiKeyModal.vue**
- ⏳ **UsageDetailModal.vue**
- ⏳ **NewApiKeyModal.vue**
- ⏳ **BatchApiKeyModal.vue**
- ⏳ **RenewApiKeyModal.vue**
- ⏳ **ExpiryEditModal.vue**
- ⏳ **BatchEditApiKeyModal.vue**
- ⏳ **LimitBadge.vue**
- ⏳ **LimitProgressBar.vue**
- ⏳ **WindowLimitBar.vue**
- ⏳ **WindowCountdown.vue**

### Prioridad Media (Componentes de Accounts)
- ⏳ **AccountForm.vue**
- ⏳ **AccountCard.vue**
- ⏳ Componentes específicos por plataforma (Claude, Gemini, OpenAI, Bedrock, Azure, Droid, CCR)

### Prioridad Baja (Componentes Comunes)
- ⏳ **LogoTitle.vue**
- ⏳ **ThemeToggle.vue** (ya tiene LanguageSelector, puede necesitar actualizaciones menores)
- ⏳ Componentes de estadísticas (ModelUsageStats, AggregatedStatsCard, etc.)
- ⏳ Componentes de usuario (UserApiKeysManager, UserUsageStats, etc.)
- ⏳ Componentes de dashboard (UsageTrend, ModelDistribution, etc.)

## Estrategia Recomendada

### Fase 2: Vistas Principales (Próximo paso)
1. **DashboardView.vue**: Migrar estadísticas principales y labels
   - Total API Keys, Servicio Cuentas, Uso Total, Costo Total
   - Estados de plataforma (Claude, Gemini, Bedrock, OpenAI, etc.)
   - Gráficos y tendencias

2. **ApiKeysView.vue**: Migrar gestión de claves
   - Tabla de API Keys
   - Filtros y búsqueda
   - Botones de acción

3. **AccountsView.vue**: Migrar gestión de cuentas
   - Tabla de cuentas multi-plataforma
   - Estados y acciones

### Fase 3: Modales y Formularios
- Modales de creación/edición de API Keys
- Formularios de cuenta por plataforma
- Modales de uso y estadísticas

### Fase 4: Componentes Comunes Restantes
- Componentes de visualización
- Widgets de estadísticas
- Componentes de usuario

## Claves de Traducción por Categoría

### Acciones (common.json - action.*)
- create, edit, delete, save, cancel, confirm, close, refresh, upload, download
- export, import, search, filter, sort, select, activate, disable, copy, test
- renew, reset, back, next, previous, submit

### Estados (common.json - status.*)
- active, inactive, enabled, disabled, normal, abnormal, loading, success
- error, warning, pending, completed, failed, expired, blocked, unauthorized

### Labels (common.json - label.*)
- name, description, status, type, platform, created_at, updated_at, expires_at
- last_used, priority, tags, permissions, limit, usage, cost, token, requests
- operations, details

### Navegación (nav.json)
- menu.* - Elementos del menú
- page.title.* - Títulos de página
- page.subtitle.* - Subtítulos de página
- tab.* - Pestañas
- filter.* - Filtros
- sort.* - Ordenamiento

### Mensajes (messages.json)
- success.* - Mensajes de éxito
- error.* - Mensajes de error
- warning.* - Advertencias
- info.* - Información
- confirm.* - Confirmaciones
- time.* - Tiempos relativos
- pagination.* - Paginación

### Formularios (forms.json)
- label.* - Labels de formulario
- validation.* - Mensajes de validación
- placeholder.* - Placeholders
- help.* - Textos de ayuda
- button.* - Botones

### Cuentas (accounts.json)
- type.* - Tipos de cuenta
- status.* - Estados de cuenta
- field.* - Campos de cuenta
- action.* - Acciones de cuenta
- oauth.* - Configuración OAuth
- proxy.* - Configuración Proxy
- stats.* - Estadísticas de cuenta
- message.* - Mensajes de cuenta
- help.* - Ayuda de cuenta

## Notas Técnicas

### Patrón de Migración
```vue
<!-- ANTES -->
<p>管理后台</p>
<span>创建</span>
<input placeholder="请输入密码" />
showToast('保存成功', 'success')
confirm('确定要删除吗？')

<!-- DESPUÉS -->
<p>{{ t('nav.page.title.dashboard') }}</p>
<span>{{ t('action.create') }}</span>
<input :placeholder="t('placeholder.password')" />
showToast(t('success.saved'), 'success')
confirm(t('confirm.delete'))
```

### Script Setup Pattern
```javascript
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
```

## Consideraciones Especiales

1. **Textos Dinámicos**: Usar interpolación
   ```javascript
   t('time.ago', { time: '5 minutos' })
   t('pagination.showing', { from: 1, to: 10, total: 100 })
   ```

2. **Pluralización**: Ya soportada por vue-i18n
   ```javascript
   t('time.minutes', 5) // "5 minutos"
   ```

3. **Formatos de Número y Moneda**: Usar helpers de i18n
   ```javascript
   n(1234.56, 'currency') // "$1,234.56"
   ```

4. **Fechas Relativas**: Usar day.js con locale
   ```javascript
   dayjs(date).locale(locale.value).fromNow()
   ```

## Herramientas Creadas

1. **migrate-i18n.js**: Script de migración automatizada (no ejecutado aún por precaución)
   - Ubicación: `/web/admin-spa/migrate-i18n.js`
   - Función: Reemplazo automatizado de strings chinos
   - Estado: Preparado pero requiere revisión manual

## Próximos Pasos Inmediatos

1. ✅ Completar AppHeader.vue (HECHO)
2. ⏳ Migrar estadísticas principales en DashboardView
3. ⏳ Migrar tabla de API Keys en ApiKeysView
4. ⏳ Migrar AccountsView
5. ⏳ Migrar modales críticos (Create/Edit API Key, Account Form)
6. ⏳ Ejecutar y validar script de migración automatizada en componentes restantes
7. ⏳ Pruebas completas en ambos idiomas (es-MX y en)

## Métricas de Progreso

- **Componentes completados**: 1 / ~60 (~1.7%)
- **Vistas principales**: 0 / 4 (0%)
- **Strings migrados**: ~35 / ~500+ (estimado 7%)
- **Archivos de traducción actualizados**: 2 (messages.json, forms.json)
- **Claves de traducción agregadas**: ~28

## Tiempo Estimado Restante

- Vistas principales: 4-6 horas
- Modales de API Keys: 3-4 horas
- Componentes de Accounts: 2-3 horas
- Componentes comunes: 2-3 horas
- Pruebas y ajustes: 2-3 horas

**Total estimado**: 13-19 horas de trabajo

---

**Última actualización**: 2025-11-24
**Responsable**: Claude Code
**Estado**: En progreso - Fase 1 completada
