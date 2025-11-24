#!/usr/bin/env node

/**
 * Script de migración i18n para componentes Vue
 * Reemplaza textos en chino con claves de traducción
 */

const fs = require('fs');
const path = require('path');

// Mapeo de textos chinos a claves de traducción
const translationMap = {
  // Acciones comunes
  '创建': 'action.create',
  '编辑': 'action.edit',
  '删除': 'action.delete',
  '保存': 'action.save',
  '取消': 'action.cancel',
  '确定': 'action.confirm',
  '关闭': 'action.close',
  '刷新': 'action.refresh',
  '更新': 'action.refresh',
  '上传': 'action.upload',
  '下载': 'action.download',
  '导出': 'action.export',
  '导入': 'action.import',
  '搜索': 'action.search',
  '筛选': 'action.filter',
  '排序': 'action.sort',
  '选择': 'action.select',
  '激活': 'action.activate',
  '禁用': 'action.disable',
  '复制': 'action.copy',
  '测试': 'action.test',
  '续期': 'action.renew',
  '重置': 'action.reset',
  '返回': 'action.back',
  '下一步': 'action.next',
  '上一步': 'action.previous',
  '提交': 'action.submit',

  // Estados
  '活跃': 'status.active',
  '激活': 'status.active',
  '正常': 'status.normal',
  '异常': 'status.abnormal',
  '加载中': 'status.loading',
  '成功': 'status.success',
  '失败': 'status.failed',
  '错误': 'status.error',
  '警告': 'status.warning',
  '待处理': 'status.pending',
  '已完成': 'status.completed',
  '已过期': 'status.expired',
  '已禁用': 'status.disabled',
  '已启用': 'status.enabled',

  // Labels
  '名称': 'label.name',
  '描述': 'label.description',
  '状态': 'label.status',
  '类型': 'label.type',
  '平台': 'label.platform',
  '创建时间': 'label.created_at',
  '更新时间': 'label.updated_at',
  '过期时间': 'label.expires_at',
  '最后使用': 'label.last_used',
  '优先级': 'label.priority',
  '标签': 'label.tags',
  '权限': 'label.permissions',
  '限制': 'label.limit',
  '使用量': 'label.usage',
  '成本': 'label.cost',
  '令牌': 'label.token',
  '请求': 'label.requests',
  '操作': 'label.operations',
  '详情': 'label.details',

  // Nav
  '管理后台': 'nav.page.title.dashboard',
  '面板': 'nav.page.title.dashboard',
  '控制面板': 'nav.page.title.dashboard',
  'API密钥管理': 'nav.page.title.api_keys',
  'API Keys': 'nav.page.title.api_keys',
  '账号管理': 'nav.page.title.accounts',
  '账户管理': 'nav.page.title.accounts',
  '系统设置': 'nav.page.title.settings',
  '用户管理': 'nav.page.title.user_management',
  '统计数据': 'nav.page.title.api_stats',
  'Webhook配置': 'nav.page.title.webhooks',
  '系统日志': 'nav.page.title.logs',

  // Time
  '分钟': 'time.minute',
  '小时': 'time.hour',
  '天': 'time.day',
  '周': 'time.week',
  '月': 'time.month',
  '年': 'time.year',
  '从未': 'time.never',
  '刚刚': 'time.just_now',

  // Messages
  '加载中...': 'info.loading',
  '保存中...': 'info.saving',
  '处理中...': 'info.processing',
  '无数据': 'info.no_data',
  '暂无数据': 'info.no_data',
  '没有数据': 'info.no_data',
  '未找到结果': 'info.no_results',
  '列表为空': 'info.empty_list',
  '请选择': 'info.select_item',

  // Confirmations
  '确定要删除吗？': 'confirm.delete',
  '确定删除？': 'confirm.delete',
  '确定要撤销吗？': 'confirm.revoke',
  '确定要禁用吗？': 'confirm.disable',
  '确定要重置吗？': 'confirm.reset',
  '确定退出登录吗？': 'confirm.logout',
  '确定要退出登录吗？': 'confirm.logout',
  '有未保存的更改': 'warning.unsaved_changes',

  // Success messages
  '创建成功': 'success.created',
  '更新成功': 'success.updated',
  '删除成功': 'success.deleted',
  '保存成功': 'success.saved',
  '已复制': 'success.copied',
  '已复制到剪贴板': 'success.copied',
  '生成成功': 'success.generated',
  '刷新成功': 'success.refreshed',
  '撤销成功': 'success.revoked',
  '启用成功': 'success.enabled',
  '禁用成功': 'success.disabled',
  '测试成功': 'success.tested',

  // Error messages
  '发生错误': 'error.generic',
  '操作失败': 'error.generic',
  '网络错误': 'error.network',
  '未授权': 'error.unauthorized',
  '访问被拒绝': 'error.forbidden',
  '未找到': 'error.not_found',
  '服务器错误': 'error.server',
  '超时': 'error.timeout',
  '无效的数据': 'error.invalid_data',
  '数据无效': 'error.invalid_data',
  '创建失败': 'error.create_failed',
  '更新失败': 'error.update_failed',
  '删除失败': 'error.delete_failed',
  '保存失败': 'error.save_failed',
  '加载失败': 'error.load_failed',
  '测试失败': 'error.test_failed'
};

// Función para procesar un archivo Vue
function processVueFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;
  let changeCount = 0;

  // 1. Agregar import de useI18n si no existe
  if (!modified.includes('useI18n') && !modified.includes('vue-i18n')) {
    const scriptSetupMatch = modified.match(/<script setup>/);
    if (scriptSetupMatch) {
      const insertPos = scriptSetupMatch.index + scriptSetupMatch[0].length;
      const imports = modified.substring(0, insertPos);
      const rest = modified.substring(insertPos);

      // Insertar import después de otros imports
      const lastImportMatch = rest.match(/\nimport .+\n/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const lastImportPos = rest.lastIndexOf(lastImport) + lastImport.length;
        modified = imports + rest.substring(0, lastImportPos) +
                  "import { useI18n } from 'vue-i18n'\n" +
                  rest.substring(lastImportPos);
      } else {
        modified = imports + "\nimport { useI18n } from 'vue-i18n'\n" + rest;
      }

      // Agregar const { t } = useI18n()
      const constMatch = modified.match(/<script setup>[\s\S]*?\n\n/);
      if (constMatch) {
        const insertConstPos = constMatch.index + constMatch[0].length;
        const before = modified.substring(0, insertConstPos);
        const after = modified.substring(insertConstPos);
        modified = before + "const { t } = useI18n()\n" + after;
      }

      changeCount++;
    }
  }

  // 2. Reemplazar textos en chino en template
  for (const [chinese, key] of Object.entries(translationMap)) {
    // Reemplazar en texto plano (ej: >texto<)
    const regex1 = new RegExp(`>\\s*${chinese}\\s*<`, 'g');
    if (regex1.test(modified)) {
      modified = modified.replace(regex1, `>{{ t('${key}') }}<`);
      changeCount++;
    }

    // Reemplazar en strings entre comillas
    const regex2 = new RegExp(`(['"])${chinese}\\1`, 'g');
    if (regex2.test(modified)) {
      modified = modified.replace(regex2, (match, quote) => `${quote}{{ t('${key}') }}${quote}`);
      changeCount++;
    }

    // Reemplazar en atributos de placeholder
    const regex3 = new RegExp(`placeholder="[^"]*${chinese}[^"]*"`, 'g');
    if (regex3.test(modified)) {
      modified = modified.replace(regex3, (match) => {
        return match.replace(chinese, `" :placeholder="t('${key}')`);
      });
      changeCount++;
    }
  }

  // 3. Reemplazar showToast con textos en chino
  const toastRegex = /showToast\(\s*['"]([^'"]+)['"]\s*,\s*['"](\w+)['"]\s*\)/g;
  modified = modified.replace(toastRegex, (match, message, type) => {
    // Buscar si el mensaje está en nuestro mapa
    for (const [chinese, key] of Object.entries(translationMap)) {
      if (message.includes(chinese)) {
        changeCount++;
        return `showToast(t('${key}'), '${type}')`;
      }
    }
    return match;
  });

  // 4. Reemplazar confirm() con textos en chino
  const confirmRegex = /confirm\(\s*['"]([^'"]+)['"]\s*\)/g;
  modified = modified.replace(confirmRegex, (match, message) => {
    for (const [chinese, key] of Object.entries(translationMap)) {
      if (message.includes(chinese)) {
        changeCount++;
        return `confirm(t('${key}'))`;
      }
    }
    return match;
  });

  // Solo escribir si hubo cambios
  if (changeCount > 0 && modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf-8');
    return changeCount;
  }

  return 0;
}

// Función para procesar un directorio recursivamente
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let totalChanges = 0;
  const processedFiles = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const { total, files } = processDirectory(fullPath);
      totalChanges += total;
      processedFiles.push(...files);
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      const changes = processVueFile(fullPath);
      if (changes > 0) {
        totalChanges += changes;
        processedFiles.push({ file: fullPath, changes });
        console.log(`✅ ${fullPath}: ${changes} cambios`);
      }
    }
  }

  return { total: totalChanges, files: processedFiles };
}

// Ejecutar
const srcDir = path.join(__dirname, 'src');
console.log('🚀 Iniciando migración i18n...\n');
const { total, files } = processDirectory(srcDir);
console.log(`\n✨ Migración completada:`);
console.log(`   📁 Archivos procesados: ${files.length}`);
console.log(`   📝 Total de cambios: ${total}`);
console.log(`\n📋 Archivos modificados:`);
files.forEach(({ file, changes }) => {
  console.log(`   - ${path.relative(srcDir, file)}: ${changes} cambios`);
});
