#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const srcDir = path.join(__dirname, 'src');
const localesDir = path.join(srcDir, 'locales');

// Recursively find all .vue files
function findVueFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findVueFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      files.push(fullPath);
    }
  });

  return files;
}

// Extract all i18n keys from components
function extractKeysFromFiles() {
  const allKeys = new Set();
  const vueFiles = findVueFiles(srcDir);

  // Match t('key') or t("key") - NOT template literals
  const keyRegex = /t\(['"]([^'"]+)['"]\)/g;
  // Valid key pattern: starts with letter/underscore, contains only alphanumeric, dots, hyphens, underscores
  const validKeyPattern = /^[a-zA-Z_][a-zA-Z0-9._-]*$/;

  vueFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    keyRegex.lastIndex = 0; // Reset regex state
    while ((match = keyRegex.exec(content)) !== null) {
      const key = match[1];
      // Only add valid keys (not Chinese, not paths, not interpolations)
      if (validKeyPattern.test(key) && !key.includes('${')) {
        allKeys.add(key);
      }
    }
  });

  return Array.from(allKeys).sort();
}

// Get existing keys in JSONs
function getExistingKeys(locale) {
  const localeDir = path.join(localesDir, locale);
  const keys = {};

  if (!fs.existsSync(localeDir)) {
    return keys;
  }

  const files = fs.readdirSync(localeDir);
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
      keys[file] = content;
    }
  });

  return keys;
}

// Find missing keys
function findMissingKeys(allUsedKeys, existingKeys) {
  const missing = {};

  allUsedKeys.forEach(key => {
    let found = false;

    Object.entries(existingKeys).forEach(([file, content]) => {
      if (hasNestedKey(content, key)) {
        found = true;
      }
    });

    if (!found) {
      const [namespace, ...rest] = key.split('.');
      if (!missing[namespace]) {
        missing[namespace] = [];
      }
      missing[namespace].push(rest.join('.'));
    }
  });

  return missing;
}

// Check if a key exists in nested object
function hasNestedKey(obj, key) {
  const parts = key.split('.');
  let current = obj;

  for (const part of parts) {
    if (current[part] !== undefined) {
      current = current[part];
    } else {
      return false;
    }
  }

  return true;
}

// Set nested key value
function setNestedKey(obj, key, value) {
  const parts = key.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
}

// Add missing keys to JSONs
function addMissingKeys(missing) {
  ['en', 'es-MX'].forEach(locale => {
    const localeDir = path.join(localesDir, locale);

    // Create locale directory if it doesn't exist
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }

    Object.entries(missing).forEach(([namespace, keys]) => {
      const filePath = path.join(localeDir, `${namespace}.json`);

      let content = {};
      if (fs.existsSync(filePath)) {
        content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      keys.forEach(key => {
        setNestedKey(content, key, `[${namespace}.${key}]`);
      });

      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✓ ${locale}/${namespace}.json: +${keys.length} claves`);
    });
  });
}

// Execute
console.log('🔍 Extrayendo claves i18n...');
const allKeys = extractKeysFromFiles();
console.log(`✓ Encontradas ${allKeys.length} claves usadas\n`);

console.log('📋 Analizando claves existentes...');
const existingKeys = getExistingKeys('en');
console.log(`✓ Analizadas ${Object.keys(existingKeys).length} archivos de traducción\n`);

console.log('🔎 Identificando claves faltantes...');
const missing = findMissingKeys(allKeys, existingKeys);
const totalMissing = Object.values(missing).reduce((sum, arr) => sum + arr.length, 0);
console.log(`✓ Encontradas ${totalMissing} claves faltantes\n`);

console.log('Desglose por namespace:');
Object.entries(missing).forEach(([ns, keys]) => {
  console.log(`  ${ns}: ${keys.length} claves`);
});

console.log('\n✨ Agregando claves faltantes...');
addMissingKeys(missing);
console.log('\n✅ ¡Listo! Las claves han sido agregadas a los archivos JSON');
