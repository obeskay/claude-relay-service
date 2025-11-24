#!/usr/bin/env node

/**
 * Script de prueba para verificar la configuración de i18next
 */

const path = require('path')
const fs = require('fs')

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

console.log(`${colors.blue}🌐 Probando configuración de i18next...${colors.reset}\n`)

// Verificar que existan los archivos de locales
const localesPath = path.join(__dirname, '../src/locales')
const requiredLocales = ['en', 'es-MX']
const requiredNamespaces = ['common', 'errors', 'api']

let hasErrors = false

console.log(`${colors.blue}1. Verificando estructura de directorios de locales...${colors.reset}`)
requiredLocales.forEach((locale) => {
  const localePath = path.join(localesPath, locale)
  if (fs.existsSync(localePath)) {
    console.log(`${colors.green}   ✓ ${locale}${colors.reset}`)

    // Verificar namespaces
    requiredNamespaces.forEach((ns) => {
      const nsPath = path.join(localePath, `${ns}.json`)
      if (fs.existsSync(nsPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(nsPath, 'utf8'))
          const keys = Object.keys(content)
          console.log(`${colors.green}     ✓ ${ns}.json (${keys.length} claves)${colors.reset}`)
        } catch (err) {
          console.log(
            `${colors.red}     ✗ ${ns}.json - Error de JSON: ${err.message}${colors.reset}`
          )
          hasErrors = true
        }
      } else {
        console.log(`${colors.red}     ✗ ${ns}.json no encontrado${colors.reset}`)
        hasErrors = true
      }
    })
  } else {
    console.log(`${colors.red}   ✗ ${locale} - Directorio no encontrado${colors.reset}`)
    hasErrors = true
  }
})

console.log(`\n${colors.blue}2. Verificando archivos de servicio i18n...${colors.reset}`)
const i18nServicePath = path.join(__dirname, '../src/services/i18nService.js')
const i18nHelperPath = path.join(__dirname, '../src/utils/i18nHelper.js')

if (fs.existsSync(i18nServicePath)) {
  console.log(`${colors.green}   ✓ i18nService.js existe${colors.reset}`)
} else {
  console.log(`${colors.red}   ✗ i18nService.js no encontrado${colors.reset}`)
  hasErrors = true
}

if (fs.existsSync(i18nHelperPath)) {
  console.log(`${colors.green}   ✓ i18nHelper.js existe${colors.reset}`)
} else {
  console.log(`${colors.red}   ✗ i18nHelper.js no encontrado${colors.reset}`)
  hasErrors = true
}

console.log(`\n${colors.blue}3. Verificando integración en app.js...${colors.reset}`)
const appPath = path.join(__dirname, '../src/app.js')
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8')
  if (appContent.includes('i18nService') && appContent.includes('i18nMiddleware')) {
    console.log(`${colors.green}   ✓ Middleware i18n integrado en app.js${colors.reset}`)
  } else {
    console.log(`${colors.red}   ✗ Middleware i18n NO encontrado en app.js${colors.reset}`)
    hasErrors = true
  }
} else {
  console.log(`${colors.red}   ✗ app.js no encontrado${colors.reset}`)
  hasErrors = true
}

console.log(`\n${colors.blue}4. Verificando contenido de traducciones...${colors.reset}`)
try {
  // Verificar que las claves de prueba existan en los archivos
  const testKeys = [
    { key: 'common.yes', en: 'Yes', es: 'Sí' },
    { key: 'common.save', en: 'Save', es: 'Guardar' },
    { key: 'status.active', en: 'Active', es: 'Activo' }
  ]

  testKeys.forEach(({ key, en: expectedEn, es: expectedEs }) => {
    const enPath = path.join(localesPath, 'en', 'common.json')
    const esPath = path.join(localesPath, 'es-MX', 'common.json')

    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    const esContent = JSON.parse(fs.readFileSync(esPath, 'utf8'))

    const enValue = enContent[key]
    const esValue = esContent[key]

    if (enValue === expectedEn && esValue === expectedEs) {
      console.log(
        `${colors.green}   ✓ ${key}: "${enValue}" / "${esValue}"${colors.reset}`
      )
    } else {
      console.log(
        `${colors.red}   ✗ ${key}: esperado "${expectedEn}" / "${expectedEs}", obtenido "${enValue}" / "${esValue}"${colors.reset}`
      )
      hasErrors = true
    }
  })
  console.log(
    `${colors.green}   ✓ Contenido de traducciones verificado${colors.reset}`
  )
} catch (err) {
  console.log(
    `${colors.red}   ✗ Error al verificar traducciones: ${err.message}${colors.reset}`
  )
  hasErrors = true
}

// Resultado final
console.log(`\n${'='.repeat(60)}`)
if (hasErrors) {
  console.log(
    `${colors.red}❌ Configuración de i18n tiene errores - Revisar mensajes arriba${colors.reset}`
  )
  process.exit(1)
} else {
  console.log(`${colors.green}✅ Configuración de i18n completada exitosamente${colors.reset}`)
  console.log(
    `${colors.blue}\nPara usar en tus rutas/servicios:${colors.reset}
  const { getTranslator, translateError, translateApi } = require('./utils/i18nHelper');

  app.get('/example', (req, res) => {
    const t = getTranslator(req);
    res.json({ message: t('common.success') });
  });
`
  )
}
