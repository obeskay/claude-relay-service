# Guía de Sincronización con Upstream (Wei-Shaw/claude-relay-service)

Este documento describe cómo mantener tu fork sincronizado con el repositorio upstream y qué archivos personalizados deben protegerse durante las actualizaciones.

---

## 📋 Resumen

- **Repositorio Upstream**: `https://github.com/Wei-Shaw/claude-relay-service`
- **Tu Fork**: Tu repositorio fork personalizado
- **Rama Principal**: `main` (o `master`)
- **Propósito**: Mantener tu fork actualizado mientras preserva tus personalizaciones

---

## 🔄 Flujo de Trabajo de Sincronización

### 1. Configurar Repositorio Upstream (Primera Vez Solo)

Si aún no has configurado el remoto upstream:

```bash
# Navegar a tu directorio del proyecto
cd /ruta/a/claude-relay-service

# Agregar remote upstream
git remote add upstream https://github.com/Wei-Shaw/claude-relay-service.git

# Verificar remotos configurados
git remote -v
```

Deberías ver:
```
origin    https://github.com/tu-usuario/claude-relay-service.git (fetch)
origin    https://github.com/tu-usuario/claude-relay-service.git (push)
upstream  https://github.com/Wei-Shaw/claude-relay-service.git (fetch)
upstream  https://github.com/Wei-Shaw/claude-relay-service.git (push)
```

---

### 2. Obtener Cambios de Upstream

```bash
# Obtener todos los cambios del upstream
git fetch upstream

# Ver qué ramas existen en upstream
git branch -r
```

---

### 3. Fusionar Cambios de Upstream

#### Opción A: Fusión Simple (Recomendado)

```bash
# Cambiar a tu rama principal
git checkout main

# Fusionar cambios de upstream/main
git merge upstream/main

# Si hay conflictos, resolverlos (ver sección abajo)
# Después de resolver conflictos:
git add .
git commit -m "Merge upstream changes"
```

#### Opción B: Rebase (Historia más Limpia)

```bash
# Asegurarte de estar en tu rama principal
git checkout main

# Hacer rebase de tus commits sobre upstream/main
git rebase upstream/main

# Si hay conflictos, resolverlos:
# 1. Editar archivos conflictivos
# 2. git add <archivos-resueltos>
# 3. git rebase --continue

# Si quieres abortar el rebase:
# git rebase --abort
```

---

### 4. Push a Tu Fork

```bash
# Subir cambios fusionados a tu fork
git push origin main
```

---

## 🚫 Archivos que NO Deben Sobrescribirse

### Archivos de Personalización Local

Estos archivos contienen tus configuraciones personalizadas y **NUCA** deben ser sobrescritos por cambios upstream:

```
# Archivos de Configuración
.env                          # Variables de entorno específicas de tu despliegue
config/config.js              # Configuración local específica
data/init.json                # Credenciales de administrador personalizadas

# Archivos de Documentación Personalizados
README_ES.md                  # Documentación en español
UPSTREAM_SYNC.md              # Este archivo
CLAUDE.md                     # Instrucciones específicas para Claude Code

# Archivos de CI/CD Personalizados
.gitlab-ci.yml                # Configuración de GitLab CI/CD (si es personalizado)
.github/workflows/*.yml       # Workflows de GitHub personalizados

# Archivos de Datos
data/*.json                   # Datos de usuarios, cuentas, etc.
logs/*                        # Logs de aplicación
redis_data/                   # Datos de Redis (si está montado localmente)

# Archivos de Build Personalizados
web/admin-spa/dist/*          # Build compilado del frontend
node_modules/                 # Dependencias instaladas localmente
```

---

## 🛡️ Protección de Archivos Personalizados

### Método 1: Usar `git update-index --assume-unchanged`

Para evitar que git sobrescriba archivos localmente modificados:

```bash
# Marcar archivo como inmodificable
git update-index --assume-unchanged .env
git update-index --assume-unchanged config/config.js
git update-index --assume-unchanged data/init.json

# Ver lista de archivos marcados
git ls-files -v | grep ^[[:lower:]]
```

Para revertir esto más tarde:
```bash
git update-index --no-assume-unchanged .env
```

### Método 2: Usar `.gitignore`

Asegúrate de que estos archivos estén en `.gitignore`:

```gitignore
# Configuraciones locales
.env
config/config.js
data/init.json

# Datos y logs
data/*.json
logs/
redis_data/
```

### Método 3: Crear Script de Respaldo Automático

Crea `scripts/sync-prep.sh`:

```bash
#!/bin/bash
# Respaldar archivos personalizados antes de sincronizar

BACKUP_DIR=".backup-before-sync-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creando respaldo en $BACKUP_DIR..."

# Respaldar configuraciones
cp .env "$BACKUP_DIR/.env.backup" 2>/dev/null || echo "⚠️  .env no encontrado"
cp config/config.js "$BACKUP_DIR/config.js.backup" 2>/dev/null || echo "⚠️  config.js no encontrado"
cp data/init.json "$BACKUP_DIR/init.json.backup" 2>/dev/null || echo "⚠️  init.json no encontrado"

# Respaldar documentación personalizada
cp README_ES.md "$BACKUP_DIR/README_ES.md.backup" 2>/dev/null
cp UPSTREAM_SYNC.md "$BACKUP_DIR/UPSTREAM_SYNC.md.backup" 2>/dev/null

echo "✅ Respaldo completado. Si algo sale mal, restaura desde: $BACKUP_DIR"
echo ""
echo "Para continuar con sincronización:"
echo "  git fetch upstream"
echo "  git merge upstream/main"
```

Hazlo ejecutable:
```bash
chmod +x scripts/sync-prep.sh
```

Úsalo antes de cada sincronización:
```bash
./scripts/sync-prep.sh
```

---

## ⚔️ Resolución de Conflictos

### Pasos para Resolver Conflictos

1. **Identificar Archivos Conflictivos**

```bash
# Después de git merge o git rebase, ver conflictos:
git status
```

2. **Analizar el Conflicto**

Abre cada archivo conflictivo y busca marcadores:
```
<<<<<<< HEAD
Tu código local
=======
Código upstream
>>>>>>> upstream/main
```

3. **Decidir qué Mantener**

Para archivos personalizados (.env, config.js, init.json):
- **MANTENER SIEMPRE** tus cambios locales
- Elimina el código upstream y conserva el tuyo

Para código de aplicación (src/, scripts/, etc.):
- Evalúa cuidadosamente ambos lados
- A menudo necesitas combinar ambos cambios
- Preserva tus personalizaciones mientras integras nuevas funcionalidades upstream

4. **Marcar como Resuelto**

```bash
# Agregar archivos resueltos
git add <archivo-resuelto>

# Continuar con rebase (si usaste rebase)
git rebase --continue

# O completar el merge (si usaste merge)
git commit -m "Resuelto conflicto de merge con upstream"
```

### Conflictos Comunes y Soluciones

#### Conflicto en `.env`

```bash
# SOLUCIÓN: Mantener siempre tu .env local
git checkout --ours .env
git add .env
```

#### Conflicto en `package.json`

```bash
# SOLUCIÓN: Fusionar manualmente
# Abrir package.json y comparar:
# - Nuevas dependencias upstream
# - Tus scripts personalizados
# Preservar ambos
```

#### Conflicto en `src/` archivos

```bash
# SOLUCIÓN: Revisión manual cuidadosa
# 1. Entender qué cambió upstream
# 2. Identificar tus personalizaciones
# 3. Fusionar inteligentemente
```

---

## 🚀 Flujo de Trabajo Recomendado

### Proceso Completo de Sincronización

```bash
#!/bin/bash
# sync-with-upstream.sh - Script de sincronización completo

set -e  # Detener en errores

echo "🔄 Iniciando sincronización con upstream..."

# 1. Crear respaldo
./scripts/sync-prep.sh

# 2. Obtener cambios upstream
echo "📥 Obteniendo cambios de upstream..."
git fetch upstream

# 3. Ver tu rama actual
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Rama actual: $CURRENT_BRANCH"

# 4. Asegurarte de estar en main
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔀 Cambiando a rama main..."
    git checkout main
fi

# 5. Hacer pull de cambios remotos locales
echo "📥 Obteniendo cambios de origin..."
git pull origin main

# 6. Fusionar upstream
echo "🔀 Fusionando cambios de upstream/main..."
git merge upstream/main -m "Merge upstream changes $(date +%Y-%m-%d)"

# 7. Verificar conflictos
if [ -n "$(git ls-files -u)" ]; then
    echo "⚠️  Conflictos detectados. Resuélvelos manualmente."
    echo "Archivos conflictivos:"
    git diff --name-only --diff-filter=U
    exit 1
fi

# 8. Restaurar archivos personalizados
echo "🔧 Restaurando archivos personalizados..."
if [ -f .env ]; then
    git update-index --assume-unchanged .env
fi

if [ -f config/config.js ]; then
    git update-index --assume-unchanged config/config.js
fi

if [ -f data/init.json ]; then
    git update-index --assume-unchanged data/init.json
fi

# 9. Push a tu fork
echo "📤 Subiendo cambios a origin..."
git push origin main

echo "✅ Sincronización completada exitosamente!"
```

Hazlo ejecutable y úsalo:
```bash
chmod +x sync-with-upstream.sh
./sync-with-upstream.sh
```

---

## 📅 Frecuencia de Sincronización

### Recomendaciones

- **Semanal**: Si el proyecto upstream está activo
- **Antes de cambios grandes**: Antes de hacer personalizaciones mayores
- **Después de releases upstream**: Cuando se anuncian nuevas versiones

### Automatización con GitLab CI/CD

Puedes automatizar sincronizaciones en GitLab:

```yaml
# .gitlab-ci.yml
sync-with-upstream:
  image: bitnami/git:latest
  stage: sync
  script:
    - git remote add upstream https://github.com/Wei-Shaw/claude-relay-service.git
    - git fetch upstream
    - git merge upstream/main
    - git push origin $CI_COMMIT_REF_NAME
  only:
    - schedules
```

Configura un schedule en GitLab: `CI/CD > Schedules`

---

## 🎯 Mejores Prácticas

### ✅ Hacer

1. **Respaldar siempre** antes de sincronizar
2. **Leer los changelogs** de releases upstream
3. **Probar en una rama** antes de merge a main
4. **Mantener commits atómicos** para facilitar conflictos
5. **Documentar personalizaciones** en este archivo

### ❌ No Hacer

1. **NUCA fuerce push** a main sin respaldo
2. **NUCA sobrescribas** `.env` o `data/init.json`
3. **Evita fusiones masivas** si hay muchos cambios pendientes
4. **No ignores conflictos** sin entenderlos

---

## 📝 Registro de Cambios

Mantén un registro de sincronizaciones importantes:

| Fecha | Versión Upstream | Cambios Importantes | Conflictos Resueltos |
|-------|------------------|---------------------|----------------------|
| 2025-02-16 | v1.1.249 | Actualización de seguridad | Ninguno |
| | | | |

---

## 🔗 Recursos Adicionales

- [Documentación Git - Fusión](https://git-scm.com/docs/git-merge)
- [GitHub - Sincronizar Fork](https://docs.github.com/es/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
- [Git - Resolución de Conflictos](https://git-scm.com/docs/git-merge#_resolving_conflicts)

---

## 🆘 Ayuda

Si encuentras problemas:

1. **Revisa conflictos**: `git status`
2. **Restaura desde respaldo**: `.backup-before-sync-*`
3. **Aborta y reinicia**: `git merge --abort` o `git rebase --abort`
4. **Pide ayuda**: Abre un issue en tu repositorio

---

<div align="center">

**⚡ Mantén tu fork actualizado, pero protege tus personalizaciones ⚡**

</div>
