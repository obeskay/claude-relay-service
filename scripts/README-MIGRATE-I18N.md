# Vue i18n Migration Script

This directory contains automated scripts to migrate hardcoded Chinese text in Vue files to use vue-i18n for internationalization.

## Files

- **migrate-vue-i18n.js** - Main Node.js migration script
- **migrate-vue-i18n.sh** - Shell wrapper with helper functions

## Features

- Scans all `.vue` files in `web/admin-spa/src/`
- Finds Chinese text in:
  - Template sections: `{{ '中文' }}`, `label="中文"`, `placeholder="中文"`, `title="中文"`
  - Script sections: String literals containing Chinese characters
- Generates unique i18n keys (component.text format)
- Adds translations to `web/admin-spa/src/locales/es-MX/*.json`
- Replaces hardcoded strings with `$t('key')` or `t('key')`
- Skips already i18n-ized strings (those using `$t()` or `t()`)
- Idempotent (safe to run multiple times)
- Dry-run mode supported
- Creates backups in `.backup-vue-i18n/` before modifying files

## Usage

### Quick Start

```bash
# Preview what will be changed (recommended first step)
./scripts/migrate-vue-i18n.sh --dry-run

# Run the actual migration
./scripts/migrate-vue-i18n.sh

# Run with less output
./scripts/migrate-vue-i18n.sh --quiet
```

### Node.js Direct Usage

```bash
# Preview changes
node scripts/migrate-vue-i18n.js --dry-run

# Run migration
node scripts/migrate-vue-i18n.js

# Quiet mode
node scripts/migrate-vue-i18n.js --quiet

# Help
node scripts/migrate-vue-i18n.js --help
```

## Command-Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--dry-run` | `-n` | Show what would be changed without modifying files |
| `--quiet` | `-q` | Suppress detailed output (show summary only) |
| `--help` | `-h` | Show help message |

## What the Script Does

### 1. Scans Vue Files

The script recursively scans all `.vue` files in the `web/admin-spa/src/` directory (79 files found).

### 2. Detects Chinese Text

Uses regex patterns to find Chinese characters (CJK Unified Ideographs) in:

**Templates:**
- Interpolation: `{{ '中文文本' }}`
- Attributes: `label="中文文本"`, `placeholder="中文文本"`, `title="中文文本"`
- Text content: `<div>中文文本</div>`

**Scripts:**
- String literals: `const msg = '中文文本'`

### 3. Generates i18n Keys

Creates unique keys based on component name and text:
- Format: `{componentName}.{sanitizedText}`
- Example: `components.layout.app-header.管理后台`

### 4. Translates to Spanish

Uses a built-in translation dictionary for common Chinese-to-Spanish translations:
- 保存 → Guardar
- 取消 → Cancelar
- 确认 → Confirmar
- 删除 → Eliminar
- etc.

For unknown translations, keeps the original text marked for manual review: `[原始文本]`

### 5. Replaces Hardcoded Strings

**Before:**
```vue
<template>
  <button>保存</button>
  <input placeholder="请输入用户名" />
</template>

<script setup>
const message = '操作成功'
</script>
```

**After:**
```vue
<template>
  <button>{{ $t('components.my-component.保存') }}</button>
  <input :placeholder="$t('components.my-component.请输入用户名')" />
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const message = t('components.my-component.操作成功')
</script>
```

### 6. Updates Locale Files

Adds translations to the appropriate `es-MX/*.json` file:

```json
{
  "components.my-component.保存": "Guardar",
  "components.my-component.请输入用户名": "Por favor ingresa tu nombre de usuario",
  "components.my-component.操作成功": "Operación exitosa"
}
```

### 7. Creates Backups

Before modifying any file, creates a backup in `.backup-vue-i18n/` preserving the directory structure.

## Output Example

```
Vue I18n Migration Script
=========================

Loading locale files...
✓ Loaded 13 locale files

Scanning for Vue files...
✓ Found 79 Vue files

Processing: components/layout/AppHeader.vue
  → 管理后台
    Key: components.layout.app-header.管理后台
    Translation: Panel de Administración
  → 当前版本
    Key: components.layout.app-header.当前版本
    Translation: Versión actual
  → 退出登录
    Key: components.layout.app-header.退出登录
    Translation: Cerrar sesión
✓ Modified: components/layout/AppHeader.vue
✓ Updated: web/admin-spa/src/locales/es-MX/common.json

...

==================================================
MIGRATION SUMMARY
==================================================
Files processed: 79
Files with Chinese text: 45
Total Chinese strings found: 342
Total strings replaced: 342
Total translations added: 342
==================================================

✓ Migration complete!
Backups saved to: .backup-vue-i18n/
```

## Post-Migration Steps

1. **Review Changes**
   - Check modified Vue files in your editor
   - Review translations in `web/admin-spa/src/locales/es-MX/*.json`
   - Look for entries marked with `[original]` that need manual translation

2. **Fix Import Statements**

   The script replaces string literals with `t('key')` but doesn't automatically add the import. You may need to manually add:

   ```javascript
   import { useI18n } from 'vue-i18n'
   const { t } = useI18n()
   ```

   To components that use `t()` in the script section.

3. **Test the Application**

   ```bash
   cd web/admin-spa
   npm run dev
   ```

   Verify that:
   - All text displays correctly in Spanish
   - No missing translation warnings in console
   - UI looks and functions as expected

4. **Format Code**

   ```bash
   npm run format
   # or
   npx prettier --write web/admin-spa/src/**/*.vue
   ```

5. **Run Linter**

   ```bash
   npm run lint
   ```

6. **Fix Any Issues**

   - Address manual translations marked with `[original]`
   - Fix any linting errors
   - Add missing `useI18n()` imports

7. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: migrate hardcoded Chinese text to vue-i18n"
   ```

8. **Clean Up Backups** (optional)

   Once you're satisfied with the migration:

   ```bash
   rm -rf .backup-vue-i18n/
   ```

## Translation Dictionary

The script includes a built-in dictionary with 100+ common Chinese-to-Span translations. See the `TRANSLATIONS` constant in `migrate-vue-i18n.js` for the full list.

To add more translations, edit the dictionary:

```javascript
const TRANSLATIONS = {
  // ... existing translations

  // Add your own
  '新的中文文本': 'Nuevo texto en español',
  '另一个文本': 'Otro texto'
}
```

## Manual Translation Review

After migration, search for entries needing manual review:

```bash
cd web/admin-spa/src/locales/es-MX
grep -r '\[.*\]' *.json
```

These are entries where the script couldn't find a translation and kept the original Chinese text. You'll need to manually translate these.

## Troubleshooting

### Script hangs or takes too long

- The script processes 79 Vue files which can take several minutes
- Use `--dry-run` first to preview without modifying files
- Check CPU usage - if stuck, kill and restart

### Missing i18n import error

After migration, you may see errors like:

```
ReferenceError: t is not defined
```

**Solution:** Add the import to affected components:

```javascript
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
```

### Translation not showing in UI

1. Check the i18n key exists in the locale file
2. Verify the key format matches: `$t('key.name')`
3. Check browser console for missing translation warnings
4. Ensure locale file is valid JSON (no trailing commas)

### Duplicate keys detected

The script automatically handles duplicates by adding a suffix: `text_1`, `text_2`, etc.

## Technical Details

### Chinese Character Detection

Uses Unicode range for CJK Unified Ideographs:
- `\u4e00-\u9fff` - Basic CJK Unified Ideographs
- Extended ranges for rare characters

### Key Generation Algorithm

1. Sanitize text: Remove special chars, replace with underscores
2. If too long (>30 chars), use base64 hash
3. Add counter suffix for duplicates
4. Prefix with component name

### Locale File Selection

Heuristics to choose the right locale file:
1. Check for matching filename (e.g., `AccountList.vue` → `accounts.json`)
2. Check for matching directory name (e.g., `components/accounts/` → `accounts.json`)
3. Default to `common.json`

### Edge Cases Handled

- Mixed Chinese/English text
- Text with Vue interpolation syntax
- Multiline strings
- Escaped quotes
- Already translated strings (skipped)
- Comments (skipped)

## Script Architecture

```
migrate-vue-i18n.js
├── parseVueSFC()           - Split Vue SFC into template/script
├── findChineseInTemplate()  - Find Chinese in template
├── findChineseInScript()    - Find Chinese in script
├── generateI18nKey()        - Create unique i18n key
├── translateChinese()       - Chinese to Spanish translation
├── replaceChineseString()   - Replace with $t() or t()
├── loadLocaleFiles()        - Load all locale JSON files
├── saveLocaleFile()         - Write updated locale file
├── createBackup()           - Create file backup
└── processVueFile()         - Main file processing logic
```

## Contributing

To improve the script:

1. Add more translations to the dictionary
2. Improve detection patterns for edge cases
3. Add support for Vue 3 `<script setup>` syntax
4. Auto-add `useI18n()` imports to components
5. Generate translation report markdown file

## See Also

- [Vue I18n Documentation](https://vue-i18n.intlify.dev/)
- [Project CLAUDE.md](../CLAUDE.md) - Project overview
- [TRANSLATION_GUIDE.md](../TRANSLATION_GUIDE.md) - Translation guidelines
