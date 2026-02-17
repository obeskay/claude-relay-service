#!/usr/bin/env node

/**
 * Vue I18n Migration Script
 *
 * Automatically migrates hardcoded Chinese text in Vue files to use vue-i18n.
 *
 * Features:
 * - Scans all .vue files in web/admin-spa/src/
 * - Detects Chinese text in templates and scripts
 * - Generates unique i18n keys
 * - Adds translations to es-MX.json
 * - Replaces hardcoded strings with $t() or t()
 * - Supports dry-run mode
 * - Creates backups before modifying
 * - Idempotent (safe to run multiple times)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '../web/admin-spa/src'),
  localeDir: path.join(__dirname, '../web/admin-spa/src/locales/es-MX'),
  backupDir: path.join(__dirname, '../.backup-vue-i18n'),
  dryRun: false,
  verbose: true
}

// Chinese character range (CJK Unified Ideographs)
const CHINESE_REGEX =
  /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\u2f800-\u2fa1f]+/g

// Translation cache for Chinese -> Spanish
const TRANSLATIONS = {
  // Common actions
  添加: 'Agregar',
  编辑: 'Editar',
  删除: 'Eliminar',
  保存: 'Guardar',
  取消: 'Cancelar',
  确认: 'Confirmar',
  关闭: 'Cerrar',
  刷新: 'Actualizar',
  上传: 'Subir',
  下载: 'Descargar',
  导出: 'Exportar',
  导入: 'Importar',
  搜索: 'Buscar',
  筛选: 'Filtrar',
  选择: 'Seleccionar',
  提交: 'Enviar',
  返回: 'Volver',

  // Common labels
  名称: 'Nombre',
  描述: 'Descripción',
  状态: 'Estado',
  类型: 'Tipo',
  平台: 'Plataforma',
  创建时间: 'Fecha de creación',
  更新时间: 'Fecha de actualización',
  过期时间: 'Fecha de expiración',
  最后使用: 'Último uso',
  优先级: 'Prioridad',
  标签: 'Etiquetas',
  权限: 'Permisos',
  限制: 'Límite',
  使用量: 'Uso',
  成本: 'Costo',
  令牌: 'Token',
  请求: 'Solicitudes',
  操作: 'Operaciones',
  详情: 'Detalles',

  // Status
  启用: 'Habilitado',
  禁用: 'Deshabilitado',
  正常: 'Normal',
  异常: 'Anormal',
  加载中: 'Cargando',
  成功: 'Éxito',
  失败: 'Fallido',
  错误: 'Error',
  警告: 'Advertencia',
  待处理: 'Pendiente',
  已完成: 'Completado',
  已过期: 'Expirado',
  已禁用: 'Deshabilitado',

  // Account specific
  账户: 'Cuenta',
  账户管理: 'Gestión de cuentas',
  添加账户: 'Agregar cuenta',
  编辑账户: 'Editar cuenta',
  删除账户: 'Eliminar cuenta',
  账户余额: 'Saldo de la cuenta',
  账户类型: 'Tipo de cuenta',
  账户状态: 'Estado de la cuenta',

  // API Keys
  API密钥: 'API Key',
  API密钥管理: 'Gestión de API Keys',
  创建API密钥: 'Crear API Key',
  API密钥列表: 'Lista de API Keys',
  API密钥详情: 'Detalles de API Key',

  // Common phrases
  确定: 'Confirmar',
  继续: 'Continuar',
  下一步: 'Siguiente',
  上一步: 'Anterior',
  完成: 'Completar',
  重试: 'Reintentar',
  处理中: 'Procesando',
  请稍候: 'Espere un momento',

  // Platform specific
  平台: 'Plataforma',
  官方: 'Oficial',
  标准: 'Estándar',
  授权: 'Autorización',
  认证: 'Autenticación',

  // Steps and process
  步骤: 'Paso',
  基本信息: 'Información básica',
  授权认证: 'Autorización',
  配置: 'Configuración',
  设置: 'Configuración',

  // Messages
  操作成功: 'Operación exitosa',
  操作失败: 'Operación fallida',
  保存成功: 'Guardado exitosamente',
  删除成功: 'Eliminado exitosamente',
  确认删除: '¿Confirmar eliminación?',

  // Placeholders
  请输入: 'Ingrese',
  请选择: 'Seleccione',
  可选: 'Opcional'
}

/**
 * Translate Chinese to Spanish (with fallback to original)
 */
function translateChinese(text) {
  // Trim whitespace
  const trimmed = text.trim()

  // Check exact match
  if (TRANSLATIONS[trimmed]) {
    return TRANSLATIONS[trimmed]
  }

  // Try to translate phrase by word (simple heuristic)
  const words = trimmed.split(/([^\u4e00-\u9fff]+)/)
  const translated = words
    .map((word) => {
      if (CHINESE_REGEX.test(word)) {
        return TRANSLATIONS[word] || word
      }
      return word
    })
    .join('')

  // If no translation found, keep original (for manual review)
  if (translated === trimmed) {
    return `[${trimmed}]` // Mark for manual review
  }

  return translated
}

/**
 * Generate a unique i18n key from component name and text
 */
function generateI18nKey(componentName, chineseText, counter) {
  // Remove special characters and spaces
  const sanitized = chineseText
    .replace(/[^\u4e00-\u9fff\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  // Use hash for long text
  if (sanitized.length > 30) {
    const hash = Buffer.from(chineseText).toString('base64').substring(0, 8)
    return `${componentName}.text_${hash}`
  }

  const suffix = counter > 0 ? `_${counter}` : ''
  return `${componentName}.${sanitized}${suffix}`
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath, srcDir) {
  const relativePath = path.relative(srcDir, filePath)
  const parts = relativePath.split(path.sep)

  // Remove .vue extension
  const filename = parts[parts.length - 1].replace(/\.vue$/, '')

  // Convert to kebab-case
  const kebabName = filename
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

  // Create namespace from path (e.g., accounts.AccountForm)
  const namespace = parts.slice(0, -1).join('.')

  return namespace ? `${namespace}.${kebabName}` : kebabName
}

/**
 * Parse Vue SFC into sections
 */
function parseVueSFC(content) {
  const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/)
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)

  return {
    template: templateMatch ? templateMatch[1] : null,
    script: scriptMatch ? scriptMatch[1] : null,
    hasTemplate: !!templateMatch,
    hasScript: !!scriptMatch
  }
}

/**
 * Find Chinese strings in template
 */
function findChineseInTemplate(template) {
  const results = []

  // Match text in {{ }} interpolation
  const interpRegex = /\{\{(['"`])([\s\S]*?)\1\}\}/g
  let match
  while ((match = interpRegex.exec(template)) !== null) {
    const text = match[2].trim()
    if (CHINESE_REGEX.test(text) && !text.includes('$t(') && !text.includes('t(')) {
      results.push({
        type: 'interpolation',
        text,
        fullMatch: match[0],
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }

  // Match text in HTML attributes (label, placeholder, title, etc.)
  const attrRegex = /(label|placeholder|title|alt|content)\s*=\s*(['"`])([\s\S]*?)\2/g
  while ((match = attrRegex.exec(template)) !== null) {
    const text = match[3].trim()
    if (CHINESE_REGEX.test(text) && !text.includes('$t(') && !text.includes('t(')) {
      results.push({
        type: 'attribute',
        attrName: match[1],
        text,
        fullMatch: match[0],
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }

  // Match plain text content (between tags, not in attributes)
  const textContentRegex = />([\s\S]*?)</g
  while ((match = textContentRegex.exec(template)) !== null) {
    const text = match[1].trim()
    // Only consider standalone text (not mixed with HTML)
    if (
      CHINESE_REGEX.test(text) &&
      !text.includes('<') &&
      !text.includes('>') &&
      !text.includes('$t(') &&
      !text.includes('t(') &&
      text.length > 0
    ) {
      results.push({
        type: 'textContent',
        text,
        fullMatch: match[1],
        start: match.index + 1, // +1 for the '>'
        end: match.index + 1 + match[1].length
      })
    }
  }

  return results
}

/**
 * Find Chinese strings in script section
 */
function findChineseInScript(script) {
  const results = []

  // Match string literals containing Chinese
  const stringRegex = /(['"`])([^'"`\n]*[\u4e00-\u9fff][^'"`\n]*)\1/g
  let match
  while ((match = stringRegex.exec(script)) !== null) {
    const text = match[2].trim()
    if (CHINESE_REGEX.test(text) && !text.includes('$t(') && !text.includes('t(')) {
      // Skip if it looks like a comment or already translated
      if (!text.startsWith('//') && !text.startsWith('*')) {
        results.push({
          type: 'stringLiteral',
          text,
          quote: match[1],
          fullMatch: match[0],
          start: match.index,
          end: match.index + match[0].length
        })
      }
    }
  }

  return results
}

/**
 * Replace Chinese string with i18n call
 */
function replaceChineseString(match, i18nKey, inScript) {
  const tFunction = inScript ? 't' : '$t'

  switch (match.type) {
    case 'interpolation':
      return `{{ ${tFunction}('${i18nKey}') }}`

    case 'attribute':
      return `${match.attrName}="${tFunction}('${i18nKey}')"`

    case 'textContent':
      // For text content, wrap in interpolation
      return `{{ ${tFunction}('${i18nKey}') }}`

    case 'stringLiteral':
      return `${match.quote}${tFunction}('${i18nKey}')${match.quote}`

    default:
      return match.fullMatch
  }
}

/**
 * Load all locale files
 */
function loadLocaleFiles() {
  const localeFiles = {}

  if (!fs.existsSync(CONFIG.localeDir)) {
    console.error(`Locale directory not found: ${CONFIG.localeDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(CONFIG.localeDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const filePath = path.join(CONFIG.localeDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    localeFiles[file] = JSON.parse(content)
  }

  return localeFiles
}

/**
 * Save locale file
 */
function saveLocaleFile(filename, data) {
  const filePath = path.join(CONFIG.localeDir, filename)
  const content = `${JSON.stringify(data, null, 2)}\n`

  if (CONFIG.dryRun) {
    console.log(`[DRY RUN] Would write: ${filePath}`)
    return
  }

  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`✓ Updated: ${filePath}`)
}

/**
 * Create backup of file
 */
function createBackup(filePath) {
  if (CONFIG.dryRun) {
    return
  }

  const { backupDir } = CONFIG
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const relativePath = path.relative(CONFIG.srcDir, filePath)
  const backupPath = path.join(backupDir, relativePath)

  const backupDirPath = path.dirname(backupPath)
  if (!fs.existsSync(backupDirPath)) {
    fs.mkdirSync(backupDirPath, { recursive: true })
  }

  fs.copyFileSync(filePath, backupPath)
  console.log(`✓ Backed up: ${relativePath}`)
}

/**
 * Process a single Vue file
 */
function processVueFile(filePath, localeFiles) {
  if (CONFIG.verbose) {
    console.log(`\nProcessing: ${path.relative(CONFIG.srcDir, filePath)}`)
  }

  const componentName = getComponentName(filePath, CONFIG.srcDir)
  const content = fs.readFileSync(filePath, 'utf-8')

  // Parse Vue SFC
  const parsed = parseVueSFC(content)

  // Find Chinese strings
  const templateMatches = parsed.hasTemplate ? findChineseInTemplate(parsed.template) : []
  const scriptMatches = parsed.hasScript ? findChineseInScript(parsed.script) : []

  const allMatches = [
    ...templateMatches.map((m) => ({ ...m, inScript: false })),
    ...scriptMatches.map((m) => ({ ...m, inScript: true }))
  ]

  if (allMatches.length === 0) {
    if (CONFIG.verbose) {
      console.log(`  No Chinese text found`)
    }
    return { found: 0, replaced: 0, added: 0 }
  }

  // Create backup
  createBackup(filePath)

  // Determine which locale file to use
  // Use a heuristic to pick the most relevant locale file
  let localeFilename = 'common.json' // default
  const localeBasename = path.basename(filePath, '.vue')

  // Check if there's a matching locale file
  const potentialFiles = Object.keys(localeFiles).filter((f) => {
    const base = f.replace('.json', '')
    return localeBasename.includes(base) || base.includes(localeBasename)
  })

  if (potentialFiles.length > 0) {
    localeFilename = potentialFiles[0]
  } else {
    // Try to match based on directory
    const dirName = path.dirname(path.relative(CONFIG.srcDir, filePath)).split(path.sep)[0]
    const dirMatch = Object.keys(localeFiles).find((f) => f.includes(dirName))
    if (dirMatch) {
      localeFilename = dirMatch
    }
  }

  const localeData = localeFiles[localeFilename]
  let newContent = content
  let replaceOffset = 0
  const stats = { found: allMatches.length, replaced: 0, added: 0 }

  // Track used keys per component to avoid duplicates
  const usedKeys = new Map()

  // Process matches in reverse order to maintain positions
  const sortedMatches = [...allMatches].sort((a, b) => b.start - a.start)

  for (const match of sortedMatches) {
    // Generate unique key
    let counter = 0
    let i18nKey
    do {
      i18nKey = generateI18nKey(componentName, match.text, counter)
      counter++
    } while (usedKeys.has(i18nKey) || localeData[i18nKey])

    usedKeys.set(i18nKey, true)

    // Add translation
    const translation = translateChinese(match.text)
    localeData[i18nKey] = translation
    stats.added++

    // Replace in content
    const replacement = replaceChineseString(match, i18nKey, match.inScript)
    const before = newContent.substring(0, match.start + replaceOffset)
    const after = newContent.substring(match.end + replaceOffset)
    newContent = before + replacement + after

    // Adjust offset for next replacement
    replaceOffset += replacement.length - match.fullMatch.length
    stats.replaced++

    if (CONFIG.verbose) {
      console.log(`  → ${match.text.substring(0, 30)}${match.text.length > 30 ? '...' : ''}`)
      console.log(`    Key: ${i18nKey}`)
      console.log(`    Translation: ${translation}`)
    }
  }

  // Write updated file
  if (!CONFIG.dryRun) {
    fs.writeFileSync(filePath, newContent, 'utf-8')
    console.log(`✓ Modified: ${path.relative(CONFIG.srcDir, filePath)}`)
  }

  // Update locale data
  localeFiles[localeFilename] = localeData

  // Save locale file
  saveLocaleFile(localeFilename, localeData)

  return stats
}

/**
 * Main execution
 */
async function main() {
  console.log('Vue I18n Migration Script')
  console.log('=========================\n')

  // Parse command line arguments
  const args = process.argv.slice(2)
  if (args.includes('--dry-run') || args.includes('-n')) {
    CONFIG.dryRun = true
    console.log('⚠ DRY RUN MODE - No files will be modified\n')
  }
  if (args.includes('--quiet') || args.includes('-q')) {
    CONFIG.verbose = false
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node migrate-vue-i18n.js [options]')
    console.log('')
    console.log('Options:')
    console.log('  --dry-run, -n    Show what would be changed without modifying files')
    console.log('  --quiet, -q      Suppress detailed output')
    console.log('  --help, -h       Show this help message')
    process.exit(0)
  }

  // Validate directories
  if (!fs.existsSync(CONFIG.srcDir)) {
    console.error(`Source directory not found: ${CONFIG.srcDir}`)
    process.exit(1)
  }

  // Load locale files
  console.log('Loading locale files...')
  const localeFiles = loadLocaleFiles()
  console.log(`✓ Loaded ${Object.keys(localeFiles).length} locale files\n`)

  // Find all Vue files
  console.log('Scanning for Vue files...')
  const vueFiles = []
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.vue')) {
        vueFiles.push(fullPath)
      }
    }
  }
  scanDir(CONFIG.srcDir)
  console.log(`✓ Found ${vueFiles.length} Vue files\n`)

  // Process each file
  const totalStats = { found: 0, replaced: 0, added: 0, files: 0 }
  const report = []

  for (const filePath of vueFiles) {
    try {
      const stats = processVueFile(filePath, localeFiles)
      if (stats.found > 0) {
        totalStats.found += stats.found
        totalStats.replaced += stats.replaced
        totalStats.added += stats.added
        totalStats.files++
        report.push({
          file: path.relative(CONFIG.srcDir, filePath),
          ...stats
        })
      }
    } catch (error) {
      console.error(`✗ Error processing ${filePath}:`)
      console.error(`  ${error.message}`)
      if (CONFIG.verbose) {
        console.error(error.stack)
      }
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(50))
  console.log(`Files processed: ${vueFiles.length}`)
  console.log(`Files with Chinese text: ${totalStats.files}`)
  console.log(`Total Chinese strings found: ${totalStats.found}`)
  console.log(`Total strings replaced: ${totalStats.replaced}`)
  console.log(`Total translations added: ${totalStats.added}`)
  console.log('='.repeat(50))

  if (report.length > 0) {
    console.log('\nFILES MODIFIED:')
    report.slice(0, 20).forEach((r) => {
      console.log(`  ${r.file}`)
      console.log(`    Found: ${r.found}, Replaced: ${r.replaced}, Added: ${r.added}`)
    })
    if (report.length > 20) {
      console.log(`  ... and ${report.length - 20} more files`)
    }
  }

  if (CONFIG.dryRun) {
    console.log('\n⚠ DRY RUN COMPLETE - No files were modified')
    console.log('Run without --dry-run to apply changes')
  } else {
    console.log('\n✓ Migration complete!')
    console.log(`Backups saved to: ${CONFIG.backupDir}`)
  }

  console.log('\nNEXT STEPS:')
  console.log('1. Review the changes, especially translations marked with [original]')
  console.log('2. Test the application to ensure i18n keys work correctly')
  console.log('3. Manually review and improve automated translations')
  console.log('4. Commit the changes')
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
