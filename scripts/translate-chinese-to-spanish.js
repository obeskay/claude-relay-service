#!/usr/bin/env node
/**
 * Translate Chinese comments and strings to Spanish (es-MX)
 *
 * This script finds all Chinese text in JS files and replaces with Spanish translations.
 */

const fs = require('fs')
const path = require('path')

// Simple recursive directory walker
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir)

  files.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (file !== 'node_modules' && !file.startsWith('.')) {
        walkDir(filePath, callback)
      }
    } else if (file.endsWith('.js')) {
      callback(filePath)
    }
  })
}

// Translation mappings from Chinese to Spanish (es-MX)
const translations = {
  // Common technical terms
  需要的字段: 'Campos requeridos',
  带并发限制的并行执行: 'Ejecución paralela con límite de concurrencia',
  '使用 SCAN 获取匹配的 keys（带去重）':
    'Obtiene keys coincidentes usando SCAN (con deduplicación)',
  '初始化所有API Key的费用数据': 'Inicializa los datos de costos para todas las API Keys',
  扫描历史使用记录并计算费用: 'Escanea registros de uso históricos y calcula costos',
  '用 scanApiKeyIds 获取 ID，然后过滤已删除的':
    'Obtiene IDs con scanApiKeyIds, luego filtra los eliminados',
  '批量检查 isDeleted 状态，过滤已删除的 key':
    'Verifica estado isDeleted en lote, filtra keys eliminadas',
  '优化6: 并行处理 + 并发限制': 'Optimización 6: procesamiento paralelo + límite de concurrencia',
  并发数: 'Nivel de concurrencia',
  '初始化单个API Key的费用数据': 'Inicializa datos de costos para una API Key individual',
  '优化4: 使用 SCAN 获取 keys（带去重）':
    'Optimización 4: usa SCAN para obtener keys (con deduplicación)',
  '优化5: 使用 Pipeline + HMGET 批量获取数据':
    'Optimización 5: usa Pipeline + HMGET para obtención masiva de datos',
  将数组转换为对象: 'Convierte array a objeto',
  按日期分组统计: 'Agrupa estadísticas por fecha',
  '使用 SET NX EX 只补缺失的键，不覆盖已存在的':
    'Usa SET NX EX solo para completar keys faltantes, no sobrescribe existentes',
  '写入每日费用（只补缺失）': 'Escribe costos diarios (solo completa faltantes)',
  '写入每月费用（只补缺失）': 'Escribe costos mensuales (solo completa faltantes)',
  '写入每小时费用（只补缺失）': 'Escribe costos por hora (solo completa faltantes)',
  计算总费用: 'Calcula costo total',
  '写入总费用（只补缺失）': 'Escribe costo total (solo completa faltantes)',
  检查是否需要初始化费用数据: 'Verifica si se necesita inicializar datos de costos',
  '使用 SCAN 代替 KEYS，正确处理 cursor': 'Usa SCAN en lugar de KEYS, maneja cursor correctamente',
  '正确循环 SCAN 检查是否有任何费用数据':
    'Ciclo SCAN correcto para verificar si hay datos de costos',
  抽样检查使用数据是否有对应的费用数据:
    'Verifica por muestreo si los datos de uso tienen datos de costos correspondientes',

  // App.js specific
  连接Redis: 'Conectando a Redis',
  '检查数据迁移（版本 > 1.1.250 时执行）':
    'Verificando migración de datos (ejecuta cuando versión > 1.1.250)',
  检测到新版本: 'Nueva versión detectada',
  '检查数据迁移...': 'verificando migración de datos...',
  '数据迁移出错，但不影响启动:': 'Error en migración de datos, pero no afecta inicio:',
  '数据迁移完成，版本:': 'Migración de datos completada, versión:',
  '后台检查月份索引完整性（不阻塞启动）':
    'Verifica integridad del índice mensual en segundo plano (no bloquea inicio)',
  '月份索引检查失败:': 'Verificación de índice mensual falló:',
  '后台异步迁移 usage 索引（不阻塞启动）':
    'Migración asíncrona de índice de uso en segundo plano (no bloquea inicio)',
  '迁移 alltime 模型统计（阻塞式，确保数据完整）':
    'Migra estadísticas de modelo alltime (bloqueante, asegura integridad de datos)',
  '初始化账户余额查询服务（Provider 注册）':
    'Inicializa servicio de consulta de saldo de cuenta (registro de Provider)',
  账户余额查询服务已初始化: 'Servicio de consulta de saldo de cuenta inicializado',
  '账户余额查询服务初始化失败:': 'Inicialización del servicio de consulta de saldo falló:',
  初始化价格服务: 'Inicializando servicio de precios',
  初始化模型服务: 'Inicializando servicio de modelos',
  初始化缓存监控: 'Inicializando monitoreo de caché',
  初始化管理员凭据: 'Inicializando credenciales de administrador',
  '安全启动：清理无效/伪造的管理员会话':
    'Inicio seguro: limpiando sesiones de administrador inválidas/falsas',
  初始化费用数据: 'Verificando inicialización de datos de costos',
  '启动回填：本周 Claude 周费用（用于 API Key 维度周限额）':
    'Iniciando relleno: costo semanal de Claude de esta semana (para límite semanal a nivel de API Key)',
  初始化Claude账户会话窗口: 'Inicializando ventanas de sesión de cuenta Claude',
  初始化费用排序索引服务: 'Inicializando servicio de índice de clasificación de costos',
  '初始化 API Key 索引服务（用于分页查询优化）':
    'Inicializando servicio de índice de API Key (para optimización de consultas paginadas)',
  '确保账户分组反向索引存在（后台执行，不阻塞启动）':
    'Asegura existencia de índice inverso de grupo de cuentas (ejecución en segundo plano, no bloquea inicio)',

  '超早期拦截 /admin-next/ 请求 - 在所有中间件之前':
    'Intercepta solicitudes /admin-next/ muy temprano - antes de todo middleware',
  安全中间件: 'Middleware de seguridad',
  允许内联样式和脚本: 'Permite estilos y scripts inline',
  '兜底中间件：处理Chrome插件兼容性（必须在认证之前）':
    'Middleware de respaldo: maneja compatibilidad con extensiones Chrome (debe estar antes de autenticación)',
  '压缩 - 排除流式响应（SSE）': 'Compresión - excluye respuestas de transmisión (SSE)',
  '不压缩 Server-Sent Events': 'No comprime Server-Sent Events',
  使用默认的压缩判断: 'Usa evaluación de compresión predeterminada',
  '全局速率限制（仅在生产环境启用）': 'Límite de tasa global (solo habilitado en producción)',
  请求大小限制: 'Límite de tamaño de solicitud',
  '请求日志（使用自定义logger而不是morgan）':
    'Registro de solicitudes (usa logger personalizado en lugar de morgan)',
  'HTTP调试拦截器（仅在启用调试时生效）':
    'Interceptor de depuración HTTP (solo activo cuando depuración está habilitada)',
  'HTTP调试拦截器已启用 - 日志输出到 logs/http-debug-*.log':
    'Interceptor de depuración HTTP habilitado - salida de logs a logs/http-debug-*.log',
  '无法加载HTTP调试拦截器:': 'No se puede cargar interceptor de depuración HTTP:',
  基础中间件: 'Middleware básico',
  验证JSON格式: 'Valida formato JSON',
  信任代理: 'Confía en proxy',
  '全局路径规范化中间件：处理重复的 /v1/v1 路径':
    'Middleware de normalización de ruta global: maneja rutas duplicadas /v1/v1',
  '调试中间件 - 拦截所有 /admin-next 请求':
    'Middleware de depuración - intercepta todas las solicitudes /admin-next',
  '新版管理界面静态文件服务（必须在其他路由之前）':
    'Servicio de archivos estáticos de nueva interfaz de administración (debe estar antes de otras rutas)',
  '处理不带斜杠的路径，重定向到带斜杠的路径':
    'Maneja rutas sin barra diagonal, redirige a rutas con barra diagonal',
  '使用 all 方法确保捕获所有 HTTP 方法':
    'Usa método all para asegurar captura de todos los métodos HTTP',

  // WebhookConfigService specific
  返回默认配置: 'Retorna configuración predeterminada',
  '合并默认通知类型，确保新增类型有默认值':
    'Combina tipos de notificación predeterminados, asegura valores predeterminados para nuevos tipos',
  添加更新时间: 'Agrega tiempo de actualización',
  验证平台配置: 'Valida configuración de plataforma',
  Bark和SMTP平台不使用标准URL: 'Plataformas Bark y SMTP no usan URL estándar',
  验证平台特定的配置: 'Valida configuración específica de plataforma',
  企业微信不需要额外配置: 'WeChat Enterprise no requiere configuración adicional',
  钉钉可能需要secret用于签名: 'DingTalk puede necesitar secret para firma',
  飞书可能需要签名: 'Feishu puede necesitar firma',
  'Slack webhook URL通常包含token': 'URL de webhook de Slack generalmente contiene token',
  'Discord webhook URL格式可能不正确': 'Formato de URL de webhook de Discord puede ser incorrecto',
  '自定义webhook，用户自行负责格式': 'Webhook personalizado, usuario es responsable del formato',
  验证设备密钥: 'Valida clave de dispositivo',
  '验证设备密钥格式（通常是22-24位字符）':
    'Valida formato de clave de dispositivo (generalmente 22-24 caracteres)',
  '验证服务器URL（如果提供）': 'Valida URL del servidor (si se proporciona)',
  '验证声音参数（如果提供）': 'Valida parámetro de sonido (si se proporciona)',
  验证级别参数: 'Valida parámetro de nivel',
  '验证图标URL（如果提供）': 'Valida URL de ícono (si se proporciona)',
  '验证点击跳转URL（如果提供）': 'Valida URL de redirección al hacer clic (si se proporciona)',
  验证SMTP必需配置: 'Valida configuración requerida de SMTP',
  验证端口: 'Valida puerto',
  验证邮箱格式: 'Valida formato de correo electrónico',
  '支持两种格式：1. 纯邮箱 user@domain.com  2. 带名称 Name <user@domain.com>':
    'Soporta dos formatos: 1. Correo simple user@domain.com  2. Con nombre Name <user@domain.com>',
  验证接收邮箱: 'Valida correo de recepción',
  '提取实际邮箱地址（如果是 Name <email> 格式）':
    'Extrae dirección de correo real (si es formato Name <email>)',
  '验证发送邮箱（支持 Name <email> 格式）': 'Valida correo de envío (soporta formato Name <email>)',
  生成唯一ID: 'Genera ID único',
  合并更新: 'Combina actualización',
  验证更新后的配置: 'Valida configuración actualizada',

  // ModelHelper specific
  '仅保留原仓库既有的模型前缀：CCR 路由':
    'Solo mantiene prefijos de modelo existentes del repositorio original: enrutamiento CCR',
  'Gemini/Antigravity 采用"路径分流"，避免在 model 字段里混入 vendor 前缀造成混乱':
    'Gemini/Antigravity adopta "enrutamiento por ruta", evita confusión al mezclar prefijos de vendor en el campo model',
  '判断是否为 Opus 模型（任意版本）': 'Determina si es un modelo Opus (cualquier versión)',
  '匹配所有包含 "opus" 关键词的 Claude 模型':
    'Coincide con todos los modelos Claude que contienen la palabra clave "opus"',
  '判断某个 model 名称是否属于 Anthropic Claude 系列模型。':
    'Determina si un nombre de modelo pertenece a la serie de modelos Anthropic Claude.',
  '用于 API Key 维度的限额/统计（Claude 周费用）。这里刻意覆盖以下命名：':
    'Usado para límites/estadísticas a nivel de API Key (costo semanal de Claude). Cubre intencionalmente los siguientes nombres:',
  '标准 Anthropic 模型：claude-*，包括 claude-3-opus、claude-sonnet-*、claude-haiku-* 等':
    'Modelos Anthropic estándar: claude-*, incluyendo claude-3-opus, claude-sonnet-*, claude-haiku-*, etc.',
  'Bedrock 模型：{region}.anthropic.claude-... / anthropic.claude-...':
    'Modelos Bedrock: {region}.anthropic.claude-... / anthropic.claude-...',
  '少数情况下 model 字段可能只包含家族关键词（sonnet/haiku/opus），也视为 Claude 系列':
    'En casos raros, el campo model puede contener solo palabras clave de familia (sonnet/haiku/opus), también se considera serie Claude',
  '注意：会先去掉支持的 vendor 前缀（例如 "ccr,"）。':
    'Nota: primero eliminará prefijos de vendor soportados (ejemplo "ccr,").',
  'Bedrock 模型格式': 'Formato de modelo Bedrock',
  '标准 Anthropic 模型 ID': 'ID de modelo Anthropic estándar',
  '兜底：某些下游链路里 model 字段可能不带 "claude-" 前缀，但仍包含家族关键词。':
    'Respaldo: en algunas cadenas descendentes el campo model puede no tener el prefijo "claude-", pero aún contiene palabras clave de familia.',

  // Logger specific
  '安全的 JSON 序列化函数，处理循环引用和特殊字符':
    'Función segura de serialización JSON, maneja referencias circulares y caracteres especiales',
  '处理字符串值，清理可能导致JSON解析错误的特殊字符':
    'Procesa valores de cadena, limpia caracteres especiales que podrían causar errores de análisis JSON',
  移除或转义可能导致JSON解析错误的字符:
    'Elimina o escapa caracteres que podrían causar errores de análisis JSON',
  移除控制字符: 'Elimina caracteres de control',
  移除孤立的代理对字符: 'Elimina caracteres de pares sustitutos aislados',
  移除NUL字节: 'Elimina bytes NUL',
  过滤掉常见的循环引用对象: 'Filtra objetos comunes con referencias circulares',
  递归处理对象属性: 'Procesa propiedades de objeto recursivamente',
  确保键名也是安全的: 'Asegura que los nombres de clave también sean seguros',
  '体积保护: 超过 50KB 时对大字段做截断，保留顶层结构':
    'Protección de tamaño: trunca campos grandes cuando excede 50KB, conserva estructura de nivel superior',
  '第一轮: 截断单个大字段': 'Primera ronda: trunca campos grandes individuales',
  '第二轮: 如果总长度仍超 50KB，逐字段缩减到 2KB':
    'Segunda ronda: si longitud total aún excede 50KB, reduce cada campo a 2KB',
  '如果JSON.stringify仍然失败，使用更保守的方法':
    'Si JSON.stringify aún falla, usa método más conservador',
  '控制台不显示的 metadata 字段（已在 message 中或低价值）':
    'Campos de metadata no mostrados en consola (ya en message o de bajo valor)',
  '控制台格式: 树形展示 metadata': 'Formato de consola: muestra metadata en árbol',
  时间戳只取时分秒: 'Timestamp solo toma hora:minuto:segundo',
  '收集要显示的 metadata': 'Recopila metadata a mostrar',
  '文件格式: NDJSON（完整结构化数据）':
    'Formato de archivo: NDJSON (datos estructurados completos)',
  '合并所有 metadata': 'Combina toda la metadata',
  确保日志目录存在并设置权限: 'Asegura que el directorio de logs exista y establece permisos',
  增强的日志轮转配置: 'Configuración mejorada de rotación de logs',
  '监听轮转事件（测试环境关闭以避免 Jest 退出后输出）':
    'Escucha eventos de rotación (deshabilitado en entorno de prueba para evitar salida después de salir de Jest)',
  创建专门的安全日志记录器: 'Crea logger de seguridad dedicado',
  '创建专门的认证详细日志记录器（记录完整的认证响应）':
    'Crea logger detallado de autenticación dedicado (registra respuestas de autenticación completas)',
  使用更深的深度和格式化的JSON输出: 'Usa mayor profundidad y salida JSON formateada',
  '增强的 Winston logger': 'Logger Winston mejorado',
  文件输出: 'Salida de archivo',
  控制台输出: 'Salida de consola',
  异常处理: 'Manejo de excepciones',
  未捕获异常处理: 'Manejo de excepciones no capturadas',
  防止进程退出: 'Previene salida de proceso',
  增强的自定义方法: 'Métodos personalizados mejorados',
  性能监控方法: 'Métodos de monitoreo de rendimiento',
  日志统计: 'Estadísticas de logs',
  重写原始方法以统计: 'Sobrescribe métodos originales para estadísticas',
  检查是否是请求类型的日志: 'Verifica si es un log de tipo solicitud',
  获取日志统计: 'Obtiene estadísticas de logs',
  清理统计: 'Limpia estadísticas',
  健康检查: 'Verificación de salud',
  记录认证详细信息的方法: 'Método para registrar detalles de autenticación',
  '记录到主日志（简化版）': 'Registra en log principal (versión simplificada)',
  '记录到专门的认证详细日志文件（完整数据）':
    'Registra en archivo de log detallado de autenticación dedicado (datos completos)',
  启动日志记录系统: 'Inicia sistema de registro de logs',

  // Generic common phrases
  错误: 'Error',
  警告: 'Advertencia',
  信息: 'Información',
  成功: 'Éxito',
  失败: 'Falló',
  开始: 'Iniciando',
  完成: 'Completado',
  正在: 'En progreso',
  检查: 'Verificar',
  验证: 'Validar',
  更新: 'Actualizar',
  删除: 'Eliminar',
  创建: 'Crear',
  读取: 'Leer',
  写入: 'Escribir',
  初始化: 'Inicializar',
  清理: 'Limpiar',
  处理: 'Procesar',
  获取: 'Obtener',
  设置: 'Establecer',
  返回: 'Retornar',
  参数: 'Parámetro',
  配置: 'Configuración',
  数据: 'Datos',
  服务: 'Servicio',
  用户: 'Usuario',
  请求: 'Solicitud',
  响应: 'Respuesta',
  方法: 'Método',
  函数: 'Función',
  模块: 'Módulo',
  文件: 'Archivo',
  路径: 'Ruta',
  目录: 'Directorio',
  连接: 'Conexión',
  会话: 'Sesión',
  缓存: 'Caché',
  数据库: 'Base de datos',
  账户: 'Cuenta',
  密钥: 'Clave',
  令牌: 'Token',
  日志: 'Registro',
  错误信息: 'Mensaje de error',
  操作: 'Operación',
  执行: 'Ejecutar',
  生成: 'Generar',
  解析: 'Analizar',
  转换: 'Convertir',
  格式: 'Formato',
  类型: 'Tipo',
  版本: 'Versión',
  时间: 'Tiempo',
  日期: 'Fecha',
  名称: 'Nombre',
  值: 'Valor',
  字段: 'Campo',
  属性: 'Propiedad',
  对象: 'Objeto',
  数组: 'Arreglo',
  字符串: 'Cadena',
  数字: 'Número',
  布尔值: 'Valor booleano',
  空值: 'Valor nulo',
  默认: 'Predeterminado',
  可选: 'Opcional',
  必需: 'Requerido',
  启用: 'Habilitar',
  禁用: 'Deshabilitar',
  支持: 'Soportar',
  包含: 'Incluir',
  排除: 'Excluir',
  过滤: 'Filtrar',
  排序: 'Ordenar',
  分组: 'Agrupar',
  计算: 'Calcular',
  统计: 'Estadística',
  分析: 'Analizar',
  监控: 'Monitorear',
  调试: 'Depurar',
  测试: 'Probar',
  部署: 'Desplegar',
  构建: 'Construir',
  安装: 'Instalar',
  配置文件: 'Archivo de configuración',
  环境变量: 'Variable de entorno',
  端点: 'Endpoint',
  路由: 'Ruta',
  中间件: 'Middleware',
  处理器: 'Controlador',
  验证器: 'Validador',
  序列化: 'Serialización',
  反序列化: 'Deserialización',
  编码: 'Codificación',
  解码: 'Decodificación',
  加密: 'Cifrado',
  解密: 'Descifrado',
  签名: 'Firma',
  令牌刷新: 'Actualización de token',
  访问控制: 'Control de acceso',
  权限: 'Permiso',
  角色: 'Rol',
  策略: 'Política',
  规则: 'Regla',
  限制: 'Límite',
  配额: 'Cuota',
  并发: 'Concurrencia',
  异步: 'Asíncrono',
  同步: 'Síncrono',
  阻塞: 'Bloqueante',
  非阻塞: 'No bloqueante',
  超时: 'Tiempo de espera agotado',
  重试: 'Reintentar',
  回退: 'Retirada',
  降级: 'Degradación',
  熔断: 'Corte de circuito',
  负载均衡: 'Balanceo de carga',
  健康检查: 'Verificación de salud',
  心跳: 'Latido',
  指标: 'Métrica',
  追踪: 'Rastreo',
  日志记录: 'Registro de logs',
  审计: 'Auditoría',
  安全: 'Seguridad',
  性能: 'Rendimiento',
  优化: 'Optimización',
  修复: 'Corrección',
  改进: 'Mejora',
  新增: 'Nueva característica',
  移除: 'Eliminación',
  替换: 'Reemplazo',
  重构: 'Refactorización',
  迁移: 'Migración',
  备份: 'Respaldo',
  恢复: 'Restauración',
  同步: 'Sincronización',
  异步任务: 'Tarea asíncrona',
  定时任务: 'Tarea programada',
  后台任务: 'Tarea en segundo plano',
  队列: 'Cola',
  作业: 'Trabajo',
  进程: 'Proceso',
  线程: 'Hilo',
  协程: 'Corutina',
  事件: 'Evento',
  监听器: 'Escucha',
  发射器: 'Emisor',
  订阅者: 'Suscriptor',
  发布者: 'Editor',
  代理: 'Proxy',
  网关: 'Pasarela',
  客户端: 'Cliente',
  服务端: 'Servidor',
  浏览器: 'Navegador',
  移动端: 'Móvil',
  桌面端: 'Escritorio',
  接口: 'Interfaz',
  协议: 'Protocolo',
  格式: 'Formato',
  编码: 'Codificación',
  字符集: 'Conjunto de caracteres',
  时区: 'Zona horaria',
  语言: 'Idioma',
  地区: 'Región',
  货币: 'Moneda',
  数字格式: 'Formato numérico',
  日期格式: 'Formato de fecha',
  时间格式: 'Formato de hora',
  时时间戳: 'Marca de tiempo',
  唯一标识符: 'Identificador único',
  主键: 'Clave primaria',
  外键: 'Clave foránea',
  索引: 'Índice',
  约束: 'Restricción',
  触发器: 'Disparador',
  存储过程: 'Procedimiento almacenado',
  视图: 'Vista',
  表: 'Tabla',
  列: 'Columna',
  行: 'Fila',
  记录: 'Registro',
  字段: 'Campo',
  查询: 'Consulta',
  语句: 'Declaración',
  表达式: 'Expresión',
  条件: 'Condición',
  循环: 'Bucle',
  分支: 'Rama',
  函数: 'Función',
  类: 'Clase',
  对象: 'Objeto',
  实例: 'Instancia',
  继承: 'Herencia',
  封装: 'Encapsulamiento',
  多态: 'Polimorfismo',
  接口: 'Interfaz',
  抽象: 'Abstracción',
  模块化: 'Modularización',
  组件化: 'Basado en componentes',
  插件: 'Complemento',
  扩展: 'Extensión',
  主题: 'Tema',
  样式: 'Estilo',
  模板: 'Plantilla',
  布局: 'Diseño',
  页面: 'Página',
  组件: 'Componente',
  指令: 'Directiva',
  过滤器: 'Filtro',
  管道: 'Tubería',
  服务: 'Servicio',
  提供者: 'Proveedor',
  注入器: 'Inyector',
  模块: 'Módulo',
  路由: 'Ruta',
  守卫: 'Guardia',
  拦截器: 'Interceptor',
  解析器: 'Analizador',
  格式化器: 'Formateador',
  验证器: 'Validador',
  转换器: 'Convertidor'
}

function translateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false
    let translationCount = 0

    // Replace each Chinese phrase with Spanish
    for (const [chinese, spanish] of Object.entries(translations)) {
      if (content.includes(chinese)) {
        const count = (
          content.match(new RegExp(chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []
        ).length
        content = content.replaceAll(chinese, spanish)
        modified = true
        translationCount += count
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      const relativePath = path.relative(process.cwd(), filePath)
      console.log(`✓ ${relativePath} (${translationCount} translations)`)
      return { file: relativePath, count: translationCount }
    }

    return null
  } catch (error) {
    console.error(`✗ Error translating ${filePath}:`, error.message)
    return null
  }
}

// Main execution
const srcDir = path.join(__dirname, '..', 'src')

console.log('\n🌐 Chinese to Spanish Translation Tool')
console.log('=====================================\n')
console.log(`Scanning directory: ${srcDir}\n`)

const results = []
let totalTranslations = 0

walkDir(srcDir, (filePath) => {
  const result = translateFile(filePath)
  if (result) {
    results.push(result)
    totalTranslations += result.count
  }
})

console.log(`\n✓ Translation complete!`)
console.log(`  Files modified: ${results.length}`)
console.log(`  Total translations: ${totalTranslations}`)
