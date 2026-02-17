const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')

const config = require('../config/config')
const logger = require('./utils/logger')
const redis = require('./models/redis')
const pricingService = require('./services/pricingService')
const cacheMonitor = require('./utils/cacheMonitor')
const { getSafeMessage } = require('./utils/errorSanitizer')

// Import routes
const apiRoutes = require('./routes/api')
const unifiedRoutes = require('./routes/unified')
const adminRoutes = require('./routes/admin')
const webRoutes = require('./routes/web')
const apiStatsRoutes = require('./routes/apiStats')
const geminiRoutes = require('./routes/geminiRoutes')
const openaiGeminiRoutes = require('./routes/openaiGeminiRoutes')
const standardGeminiRoutes = require('./routes/standardGeminiRoutes')
const openaiClaudeRoutes = require('./routes/openaiClaudeRoutes')
const openaiRoutes = require('./routes/openaiRoutes')
const droidRoutes = require('./routes/droidRoutes')
const userRoutes = require('./routes/userRoutes')
const azureOpenaiRoutes = require('./routes/azureOpenaiRoutes')
const webhookRoutes = require('./routes/webhook')

// Import middleware
const {
  corsMiddleware,
  requestLogger,
  securityMiddleware,
  errorHandler,
  globalRateLimit,
  requestSizeLimit
} = require('./middleware/auth')
const { browserFallbackMiddleware } = require('./middleware/browserFallback')

class Application {
  constructor() {
    this.app = express()
    this.server = null
  }

  async initialize() {
    try {
      // 🔗 Conectando a Redis
      logger.info('🔄 Connecting to Redis...')
      await redis.connect()
      logger.success('Redis connected successfully')

      // 📊 Verificando migración de datos (ejecuta cuando versión > 1.1.250)
      const { getAppVersion, versionGt } = require('./utils/commonHelper')
      const currentVersion = getAppVersion()
      const migratedVersion = await redis.getMigratedVersion()
      if (versionGt(currentVersion, '1.1.250') && versionGt(currentVersion, migratedVersion)) {
        logger.info(
          `🔄 Nueva versión detectada ${currentVersion}，verificando migración de datos...`
        )
        try {
          if (await redis.needsGlobalStatsMigration()) {
            await redis.migrateGlobalStats()
          }
          await redis.cleanupSystemMetrics() // Limpiar过期的系统分钟Estadística
        } catch (err) {
          logger.error('⚠️ Error en migración de datos, pero no afecta inicio:', err.message)
        }
        await redis.setMigratedVersion(currentVersion)
        logger.success(`✅ Migración de datos completada, versión: ${currentVersion}`)
      }

      // 📅 Verifica integridad del índice mensual en segundo plano (no bloquea inicio)
      redis.ensureMonthlyMonthsIndex().catch((err) => {
        logger.error('📅 Verificación de índice mensual falló:', err.message)
      })

      // 📊 Migración asíncrona de índice de uso en segundo plano (no bloquea inicio)
      redis.migrateUsageIndex().catch((err) => {
        logger.error('📊 Background usage index migration failed:', err)
      })

      // 📊 Migra estadísticas de modelo alltime (bloqueante, asegura integridad de datos)
      await redis.migrateAlltimeModelStats()

      // 💳 Inicializa servicio de consulta de saldo de cuenta (registro de Provider)
      try {
        const accountBalanceService = require('./services/account/accountBalanceService')
        const { registerAllProviders } = require('./services/balanceProviders')
        registerAllProviders(accountBalanceService)
        logger.info('✅ Servicio de consulta de saldo de cuenta inicializado')
      } catch (error) {
        logger.warn('⚠️ Inicialización del servicio de consulta de saldo falló:', error.message)
      }

      // 💰 Inicializando servicio de precios
      logger.info('🔄 Initializing pricing service...')
      await pricingService.initialize()

      // 📋 Inicializando servicio de modelos
      logger.info('🔄 Initializing model service...')
      const modelService = require('./services/modelService')
      await modelService.initialize()

      // 📊 Inicializando monitoreo de caché
      await this.initializeCacheMonitoring()

      // 🔧 Inicializando credenciales de administrador
      logger.info('🔄 Initializing admin credentials...')
      await this.initializeAdmin()

      // 🔒 Inicio seguro: limpiando sesiones de administrador inválidas/falsas
      logger.info('🔒 Cleaning up invalid admin sessions...')
      await this.cleanupInvalidSessions()

      // 💰 Verificando inicialización de datos de costos
      logger.info('💰 Checking cost data initialization...')
      const costInitService = require('./services/costInitService')
      const needsInit = await costInitService.needsInitialization()
      if (needsInit) {
        logger.info('💰 Initializing cost data for all API Keys...')
        const result = await costInitService.initializeAllCosts()
        logger.info(
          `💰 Cost initialization completed: ${result.processed} processed, ${result.errors} errors`
        )
      }

      // 💰 Iniciando relleno: costo semanal de Claude de esta semana (para límite semanal a nivel de API Key)
      try {
        logger.info('💰 Backfilling current-week Claude weekly cost...')
        const weeklyClaudeCostInitService = require('./services/weeklyClaudeCostInitService')
        await weeklyClaudeCostInitService.backfillCurrentWeekClaudeCosts()
      } catch (error) {
        logger.warn('⚠️ Weekly Claude cost backfill failed (startup continues):', error.message)
      }

      // 🕐 Inicializando ventanas de sesión de cuenta Claude
      logger.info('🕐 Initializing Claude account session windows...')
      const claudeAccountService = require('./services/account/claudeAccountService')
      await claudeAccountService.initializeSessionWindows()

      // 📊 Inicializando servicio de índice de clasificación de costos
      logger.info('📊 Initializing cost rank service...')
      const costRankService = require('./services/costRankService')
      await costRankService.initialize()

      // 🔍 Inicializando servicio de índice de API Key (para optimización de consultas paginadas)
      logger.info('🔍 Initializing API Key index service...')
      const apiKeyIndexService = require('./services/apiKeyIndexService')
      apiKeyIndexService.init(redis)
      await apiKeyIndexService.checkAndRebuild()

      // 📁 Asegura existencia de índice inverso de grupo de cuentas (ejecución en segundo plano, no bloquea inicio)
      const accountGroupService = require('./services/accountGroupService')
      accountGroupService.ensureReverseIndexes().catch((err) => {
        logger.error('📁 Account group reverse index migration failed:', err)
      })

      // Intercepta solicitudes /admin-next/ muy temprano - antes de todo middleware
      this.app.use((req, res, next) => {
        if (req.path === '/admin-next/' && req.method === 'GET') {
          logger.warn('🚨 INTERCEPTING /admin-next/ request at the very beginning!')
          const adminSpaPath = path.join(__dirname, '..', 'web', 'admin-spa', 'dist')
          const indexPath = path.join(adminSpaPath, 'index.html')

          if (fs.existsSync(indexPath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            return res.sendFile(indexPath)
          } else {
            logger.error('❌ index.html not found at:', indexPath)
            return res.status(404).send('index.html not found')
          }
        }
        next()
      })

      // 🛡️ Middleware de seguridad
      this.app.use(
        helmet({
          contentSecurityPolicy: false, // Permite estilos y scripts inline
          crossOriginEmbedderPolicy: false
        })
      )

      // 🌐 CORS
      if (config.web.enableCors) {
        this.app.use(cors())
      } else {
        this.app.use(corsMiddleware)
      }

      // 🆕 Middleware de respaldo: maneja compatibilidad con extensiones Chrome (debe estar antes de autenticación)
      this.app.use(browserFallbackMiddleware)

      // 📦 Compresión - excluye respuestas de transmisión (SSE)
      this.app.use(
        compression({
          filter: (req, res) => {
            // No comprime Server-Sent Events
            if (res.getHeader('Content-Type') === 'text/event-stream') {
              return false
            }
            // Usa evaluación de compresión predeterminada
            return compression.filter(req, res)
          }
        })
      )

      // 🚦 Límite de tasa global (solo habilitado en producción)
      if (process.env.NODE_ENV === 'production') {
        this.app.use(globalRateLimit)
      }

      // 📏 Límite de tamaño de solicitud
      this.app.use(requestSizeLimit)

      // 📝 Registro de solicitudes (usa logger personalizado en lugar de morgan)
      this.app.use(requestLogger)

      // 🐛 Interceptor de depuración HTTP (solo activo cuando depuración está habilitada)
      if (process.env.DEBUG_HTTP_TRAFFIC === 'true') {
        try {
          const { debugInterceptor } = require('./middleware/debugInterceptor')
          this.app.use(debugInterceptor)
          logger.info(
            '🐛 Interceptor de depuración HTTP habilitado - salida de logs a logs/http-debug-*.log'
          )
        } catch (error) {
          logger.warn('⚠️ No se puede cargar interceptor de depuración HTTP:', error.message)
        }
      }

      // 🔧 Middleware básico
      this.app.use(
        express.json({
          limit: '100mb',
          verify: (req, res, buf, encoding) => {
            // Valida formato JSON
            if (buf && buf.length && !buf.toString(encoding || 'utf8').trim()) {
              throw new Error('Invalid JSON: empty body')
            }
          }
        })
      )
      this.app.use(express.urlencoded({ extended: true, limit: '100mb' }))
      this.app.use(securityMiddleware)

      // 🎯 Confía en proxy
      if (config.server.trustProxy) {
        this.app.set('trust proxy', 1)
      }

      // 🆕 Middleware de normalización de ruta global: maneja rutas duplicadas /v1/v1
      this.app.use((req, res, next) => {
        if (req.url.includes('/v1/v1/')) {
          const oldUrl = req.url
          req.url = req.url.replace('/v1/v1/', '/v1/')
          logger.api(`🔧 Global path normalized (v1 duplication): ${oldUrl} -> ${req.url}`)
        }
        next()
      })

      // Middleware de depuración - intercepta todas las solicitudes /admin-next
      this.app.use((req, res, next) => {
        if (req.path.startsWith('/admin-next')) {
          logger.info(
            `🔍 DEBUG: Incoming request - method: ${req.method}, path: ${req.path}, originalUrl: ${req.originalUrl}`
          )
        }
        next()
      })

      // 🎨 Servicio de archivos estáticos de nueva interfaz de administración (debe estar antes de otras rutas)
      const adminSpaPath = path.join(__dirname, '..', 'web', 'admin-spa', 'dist')
      if (fs.existsSync(adminSpaPath)) {
        // Maneja rutas sin barra diagonal, redirige a rutas con barra diagonal
        this.app.get('/admin-next', (req, res) => {
          res.redirect(301, '/admin-next/')
        })

        // Usa método all para asegurar captura de todos los métodos HTTP
        this.app.all('/admin-next/', (req, res) => {
          logger.info('🎯 HIT: /admin-next/ route handler triggered!')
          logger.info(`Method: ${req.method}, Path: ${req.path}, URL: ${req.url}`)

          if (req.method !== 'GET' && req.method !== 'HEAD') {
            return res.status(405).send('Method Not Allowed')
          }

          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.sendFile(path.join(adminSpaPath, 'index.html'))
        })

        // Procesar所有其他 /admin-next/* Ruta（但Excluir根Ruta）
        this.app.get('/admin-next/*', (req, res) => {
          // 如果是根Ruta，跳过（应该由上面的RutaProcesar）
          if (req.path === '/admin-next/') {
            logger.error('❌ ERROR: /admin-next/ should not reach here!')
            return res.status(500).send('Route configuration error')
          }

          const requestPath = req.path.replace('/admin-next/', '')

          // SeguridadVerificar
          if (
            requestPath.includes('..') ||
            requestPath.includes('//') ||
            requestPath.includes('\\')
          ) {
            return res.status(400).json({ error: 'Invalid path' })
          }

          // Verificar是否为静态资源
          const filePath = path.join(adminSpaPath, requestPath)

          // 如果Archivo存在且是静态资源
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            // EstablecerCaché头
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            } else if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            }
            return res.sendFile(filePath)
          }

          // 如果是静态资源但Archivo不存在
          if (requestPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i)) {
            return res.status(404).send('Not found')
          }

          // 其他所有RutaRetornar index.html（SPA Ruta）
          res.sendFile(path.join(adminSpaPath, 'index.html'))
        })

        logger.info('✅ Admin SPA (next) static files mounted at /admin-next/')
      } else {
        logger.warn('⚠️ Admin SPA dist directory not found, skipping /admin-next route')
      }

      // 🛣️ Ruta
      this.app.use('/api/api', apiRoutes) // Procesar重复的 /api/api Ruta
      this.app.use('/api', apiRoutes)
      this.app.use('/api', unifiedRoutes) // 统一智能Ruta（Soportar /v1/chat/completions 等）
      this.app.use('/claude', apiRoutes) // /claude Ruta别名，与 /api 功能相同
      // Anthropic (Claude Code) Ruta：按Ruta强制分流到 Gemini OAuth Cuenta
      // - /antigravity/api/v1/messages -> Antigravity OAuth
      // - /gemini-cli/api/v1/messages -> Gemini CLI OAuth
      this.app.use(
        '/antigravity/api',
        (req, res, next) => {
          req._anthropicVendor = 'antigravity'
          next()
        },
        apiRoutes
      )
      this.app.use(
        '/gemini-cli/api',
        (req, res, next) => {
          req._anthropicVendor = 'gemini-cli'
          next()
        },
        apiRoutes
      )
      this.app.use('/admin', adminRoutes)
      this.app.use('/users', userRoutes)
      // 使用 web Ruta（Incluir auth 和Página重定向）
      this.app.use('/web', webRoutes)
      this.app.use('/apiStats', apiStatsRoutes)
      // Gemini Ruta：同时Soportar标准Formato和原有Formato
      this.app.use('/gemini', standardGeminiRoutes) // 标准 Gemini API FormatoRuta
      this.app.use('/gemini', geminiRoutes) // 保留原有Ruta以保持向后兼容
      this.app.use('/openai/gemini', openaiGeminiRoutes)
      this.app.use('/openai/claude', openaiClaudeRoutes)
      this.app.use('/openai', unifiedRoutes) // 复用统一智能Ruta，Soportar /openai/v1/chat/completions
      this.app.use('/openai', openaiRoutes) // Codex API Ruta（/openai/responses, /openai/v1/responses）
      // Droid Ruta：Soportar多种 Factory.ai Endpoint
      this.app.use('/droid', droidRoutes) // Droid (Factory.ai) API 转发
      this.app.use('/azure', azureOpenaiRoutes)
      this.app.use('/admin/webhook', webhookRoutes)

      // 🏠 根Ruta重定向到新版管理界面
      this.app.get('/', (req, res) => {
        res.redirect('/admin-next/api-stats')
      })

      // 🏥 增强的Verificación de saludEndpoint
      this.app.get('/health', async (req, res) => {
        try {
          const timer = logger.timer('health-check')

          // Verificar各个Componente健康状态
          const [redisHealth, loggerHealth] = await Promise.all([
            this.checkRedisHealth(),
            this.checkLoggerHealth()
          ])

          const memory = process.memoryUsage()

          // ObtenerVersión号：优先使用Variable de entorno，其次VERSIONArchivo，再次package.json，最后使用PredeterminadoValor
          let version = process.env.APP_VERSION || process.env.VERSION
          if (!version) {
            try {
              const versionFile = path.join(__dirname, '..', 'VERSION')
              if (fs.existsSync(versionFile)) {
                version = fs.readFileSync(versionFile, 'utf8').trim()
              }
            } catch (error) {
              // 忽略Error，继续尝试其他方式
            }
          }
          if (!version) {
            try {
              const { version: pkgVersion } = require('../package.json')
              version = pkgVersion
            } catch (error) {
              version = '1.0.0'
            }
          }

          const health = {
            status: 'healthy',
            service: 'claude-relay-service',
            version,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
              used: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
              total: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
              external: `${Math.round(memory.external / 1024 / 1024)}MB`
            },
            components: {
              redis: redisHealth,
              logger: loggerHealth
            },
            stats: logger.getStats()
          }

          timer.end('completed')
          res.json(health)
        } catch (error) {
          logger.error('❌ Health check failed:', { error: error.message, stack: error.stack })
          res.status(503).json({
            status: 'unhealthy',
            error: getSafeMessage(error),
            timestamp: new Date().toISOString()
          })
        }
      })

      // 📊 MétricaEndpoint
      this.app.get('/metrics', async (req, res) => {
        try {
          const stats = await redis.getSystemStats()
          const metrics = {
            ...stats,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
          }

          res.json(metrics)
        } catch (error) {
          logger.error('❌ Metrics collection failed:', error)
          res.status(500).json({ error: 'Failed to collect metrics' })
        }
      })

      // 🚫 404 Procesar
      this.app.use('*', (req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.originalUrl} not found`,
          timestamp: new Date().toISOString()
        })
      })

      // 🚨 ErrorProcesar
      this.app.use(errorHandler)

      logger.success('Application initialized successfully')
    } catch (error) {
      logger.error('💥 Application initialization failed:', error)
      throw error
    }
  }

  // 🔧 Inicializando credenciales de administrador（总是从 init.json 加载，确保Datos一致性）
  async initializeAdmin() {
    try {
      const initFilePath = path.join(__dirname, '..', 'data', 'init.json')

      if (!fs.existsSync(initFilePath)) {
        logger.warn('⚠️ No admin credentials found. Please run npm run setup first.')
        return
      }

      // 从 init.json Leer管理员凭据（作为唯一真实Datos源）
      const initData = JSON.parse(fs.readFileSync(initFilePath, 'utf8'))

      // 将明文密码哈希化
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(initData.adminPassword, saltRounds)

      // 存储到Redis（每次启动都覆盖，确保与 init.json Sincronización）
      const adminCredentials = {
        username: initData.adminUsername,
        passwordHash,
        createdAt: initData.initializedAt || new Date().toISOString(),
        lastLogin: null,
        updatedAt: initData.updatedAt || null
      }

      await redis.setSession('admin_credentials', adminCredentials)

      logger.success('Admin credentials loaded from init.json (single source of truth)')
      logger.info(`📋 Admin username: ${adminCredentials.username}`)
    } catch (error) {
      logger.error('❌ Failed to initialize admin credentials:', {
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  // 🔒 Limpiar无效/伪造的管理员Sesión（Seguridad启动Verificar）
  async cleanupInvalidSessions() {
    try {
      const client = redis.getClient()

      // Obtener所有 session:* 键
      const sessionKeys = await redis.scanKeys('session:*')
      const dataList = await redis.batchHgetallChunked(sessionKeys)

      let validCount = 0
      let invalidCount = 0

      for (let i = 0; i < sessionKeys.length; i++) {
        const key = sessionKeys[i]
        // 跳过 admin_credentials（系统凭据）
        if (key === 'session:admin_credentials') {
          continue
        }

        const sessionData = dataList[i]

        // VerificarSesión完整性：必须有 username 和 loginTime
        const hasUsername = !!sessionData?.username
        const hasLoginTime = !!sessionData?.loginTime

        if (!hasUsername || !hasLoginTime) {
          // 无效Sesión - 可能是漏洞利用Crear的伪造Sesión
          invalidCount++
          logger.security(
            `🔒 Removing invalid session: ${key} (username: ${hasUsername}, loginTime: ${hasLoginTime})`
          )
          await client.del(key)
        } else {
          validCount++
        }
      }

      if (invalidCount > 0) {
        logger.security(`Startup security check: Removed ${invalidCount} invalid sessions`)
      }

      logger.success(
        `Session cleanup completed: ${validCount} valid, ${invalidCount} invalid removed`
      )
    } catch (error) {
      // LimpiarFalló不应阻止Servicio启动
      logger.error('❌ Failed to cleanup invalid sessions:', error.message)
    }
  }

  // 🔍 RedisVerificación de salud
  async checkRedisHealth() {
    try {
      const start = Date.now()
      await redis.getClient().ping()
      const latency = Date.now() - start

      return {
        status: 'healthy',
        connected: redis.isConnected,
        latency: `${latency}ms`
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      }
    }
  }

  // 📝 LoggerVerificación de salud
  async checkLoggerHealth() {
    try {
      const health = logger.healthCheck()
      return {
        status: health.healthy ? 'healthy' : 'unhealthy',
        ...health
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }

  async start() {
    try {
      await this.initialize()

      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.start(`Claude Relay Service started on ${config.server.host}:${config.server.port}`)
        logger.info(
          `🌐 Web interface: http://${config.server.host}:${config.server.port}/admin-next/api-stats`
        )
        logger.info(
          `🔗 API endpoint: http://${config.server.host}:${config.server.port}/api/v1/messages`
        )
        logger.info(`⚙️  Admin API: http://${config.server.host}:${config.server.port}/admin`)
        logger.info(`🏥 Health check: http://${config.server.host}:${config.server.port}/health`)
        logger.info(`📊 Metrics: http://${config.server.host}:${config.server.port}/metrics`)
      })

      const serverTimeout = 600000 // Predeterminado10分钟
      this.server.timeout = serverTimeout
      this.server.keepAliveTimeout = serverTimeout + 5000 // keepAlive 稍长一点
      logger.info(`⏱️  Server timeout set to ${serverTimeout}ms (${serverTimeout / 1000}s)`)

      // 🔄 定期Limpiar任务
      this.startCleanupTasks()

      // 🛑 优雅关闭
      this.setupGracefulShutdown()
    } catch (error) {
      logger.error('💥 Failed to start server:', error)
      process.exit(1)
    }
  }

  // 📊 Inicializando monitoreo de caché
  async initializeCacheMonitoring() {
    try {
      logger.info('🔄 Initializing cache monitoring...')

      // 注册各个Servicio的CachéInstancia
      const services = [
        { name: 'claudeAccount', service: require('./services/account/claudeAccountService') },
        {
          name: 'claudeConsole',
          service: require('./services/account/claudeConsoleAccountService')
        },
        { name: 'bedrockAccount', service: require('./services/account/bedrockAccountService') }
      ]

      // 注册已加载的ServicioCaché
      for (const { name, service } of services) {
        if (service && (service._decryptCache || service.decryptCache)) {
          const cache = service._decryptCache || service.decryptCache
          cacheMonitor.registerCache(`${name}_decrypt`, cache)
          logger.info(`✅ Registered ${name} decrypt cache for monitoring`)
        }
      }

      // Inicializar时打印一次Estadística
      setTimeout(() => {
        const stats = cacheMonitor.getGlobalStats()
        logger.info(`📊 Cache System - Registered: ${stats.cacheCount} caches`)
      }, 5000)

      logger.success('Cache monitoring initialized')
    } catch (error) {
      logger.error('❌ Failed to initialize cache monitoring:', error)
      // 不阻止应用启动
    }
  }

  startCleanupTasks() {
    // 🧹 每小时Limpiar一次过期Datos
    setInterval(async () => {
      try {
        logger.info('🧹 Starting scheduled cleanup...')

        const apiKeyService = require('./services/apiKeyService')
        const claudeAccountService = require('./services/account/claudeAccountService')

        const [expiredKeys, errorAccounts] = await Promise.all([
          apiKeyService.cleanupExpiredKeys(),
          claudeAccountService.cleanupErrorAccounts(),
          claudeAccountService.cleanupTempErrorAccounts() // Nueva característica：Limpiar临时ErrorCuenta
        ])

        await redis.cleanup()

        logger.success(
          `🧹 Cleanup completed: ${expiredKeys} expired keys, ${errorAccounts} error accounts reset`
        )
      } catch (error) {
        logger.error('❌ Cleanup task failed:', error)
      }
    }, config.system.cleanupInterval)

    logger.info(
      `🔄 Cleanup tasks scheduled every ${config.system.cleanupInterval / 1000 / 60} minutes`
    )

    // 🚨 启动限流状态自动LimpiarServicio
    // 每5分钟Verificar一次过期的限流状态，确保账号能及时Restauración调度
    const rateLimitCleanupService = require('./services/rateLimitCleanupService')
    const cleanupIntervalMinutes = config.system.rateLimitCleanupInterval || 5 // Predeterminado5分钟
    rateLimitCleanupService.start(cleanupIntervalMinutes)
    logger.info(
      `🚨 Rate limit cleanup service started (checking every ${cleanupIntervalMinutes} minutes)`
    )

    // 🔢 启动Concurrencia计数自动Limpiar任务（Phase 1 Corrección：解决Concurrencia泄漏问题）
    // 每分钟主动Limpiar所有过期的Concurrencia项，不依赖Solicitud触发
    setInterval(async () => {
      try {
        const keys = await redis.scanKeys('concurrency:*')
        if (keys.length === 0) {
          return
        }

        const now = Date.now()
        let totalCleaned = 0
        let legacyCleaned = 0

        // 使用 Lua 脚本批量Limpiar所有过期项
        for (const key of keys) {
          // 跳过已知非 Sorted Set Tipo的键（这些键有各自的Limpiar逻辑）
          // - concurrency:queue:stats:* 是 Hash Tipo
          // - concurrency:queue:wait_times:* 是 List Tipo
          // - concurrency:queue:* (不含stats/wait_times) 是 String Tipo
          if (
            key.startsWith('concurrency:queue:stats:') ||
            key.startsWith('concurrency:queue:wait_times:') ||
            (key.startsWith('concurrency:queue:') &&
              !key.includes(':stats:') &&
              !key.includes(':wait_times:'))
          ) {
            continue
          }

          try {
            // 使用原子 Lua 脚本：先VerificarTipo，再EjecutarLimpiar
            // RetornarValor：0 = 正常Limpiar无Eliminar，1 = Limpiar后Eliminar空键，-1 = 遗留键已Eliminar
            const result = await redis.client.eval(
              `
              local key = KEYS[1]
              local now = tonumber(ARGV[1])

              -- 先Verificar键Tipo，只对 Sorted Set EjecutarLimpiar
              local keyType = redis.call('TYPE', key)
              if keyType.ok ~= 'zset' then
                -- 非 ZSET Tipo的遗留键，直接Eliminar
                redis.call('DEL', key)
                return -1
              end

              -- Limpiar过期项
              redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

              -- Obtener剩余计数
              local count = redis.call('ZCARD', key)

              -- 如果计数为0，Eliminar键
              if count <= 0 then
                redis.call('DEL', key)
                return 1
              end

              return 0
            `,
              1,
              key,
              now
            )
            if (result === 1) {
              totalCleaned++
            } else if (result === -1) {
              legacyCleaned++
            }
          } catch (error) {
            logger.error(`❌ Failed to clean concurrency key ${key}:`, error)
          }
        }

        if (totalCleaned > 0) {
          logger.info(`🔢 Concurrency cleanup: cleaned ${totalCleaned} expired keys`)
        }
        if (legacyCleaned > 0) {
          logger.warn(`🧹 Concurrency cleanup: removed ${legacyCleaned} legacy keys (wrong type)`)
        }
      } catch (error) {
        logger.error('❌ Concurrency cleanup task failed:', error)
      }
    }, 60000) // 每分钟Ejecutar一次

    logger.info('🔢 Concurrency cleanup task started (running every 1 minute)')

    // 📬 启动Usuario消息ColaServicio
    const userMessageQueueService = require('./services/userMessageQueueService')
    // 先LimpiarServicio重启后残留的锁，防止旧锁Bloqueante新Solicitud
    userMessageQueueService.cleanupStaleLocks().then(() => {
      // 然后启动定时Limpiar任务
      userMessageQueueService.startCleanupTask()
    })

    // 🚦 LimpiarServicio重启后残留的Concurrencia排队计数器
    // 多InstanciaDesplegar时建议关闭此开关，避免新Instancia启动时清空其他Instancia的Cola计数
    // 可通过 DELETE /admin/concurrency/queue Interfaz手动Limpiar
    const clearQueuesOnStartup = process.env.CLEAR_CONCURRENCY_QUEUES_ON_STARTUP !== 'false'
    if (clearQueuesOnStartup) {
      redis.clearAllConcurrencyQueues().catch((error) => {
        logger.error('❌ Error clearing concurrency queues on startup:', error)
      })
    } else {
      logger.info(
        '🚦 Skipping concurrency queue cleanup on startup (CLEAR_CONCURRENCY_QUEUES_ON_STARTUP=false)'
      )
    }

    // 🧪 启动Cuenta定时Probar调度器
    // 根据Configuración定期ProbarCuenta连通性并保存Probar历史
    const accountTestSchedulerEnabled =
      process.env.ACCOUNT_TEST_SCHEDULER_ENABLED !== 'false' &&
      config.accountTestScheduler?.enabled !== false
    if (accountTestSchedulerEnabled) {
      const accountTestSchedulerService = require('./services/accountTestSchedulerService')
      accountTestSchedulerService.start()
      logger.info('🧪 Account test scheduler service started')
    } else {
      logger.info('🧪 Account test scheduler service disabled')
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, starting graceful shutdown...`)

      if (this.server) {
        this.server.close(async () => {
          logger.info('🚪 HTTP server closed')

          // Limpiar pricing service 的ArchivoEscucha
          try {
            pricingService.cleanup()
            logger.info('💰 Pricing service cleaned up')
          } catch (error) {
            logger.error('❌ Error cleaning up pricing service:', error)
          }

          // Limpiar model service 的ArchivoEscucha
          try {
            const modelService = require('./services/modelService')
            modelService.cleanup()
            logger.info('📋 Model service cleaned up')
          } catch (error) {
            logger.error('❌ Error cleaning up model service:', error)
          }

          // 停止限流LimpiarServicio
          try {
            const rateLimitCleanupService = require('./services/rateLimitCleanupService')
            rateLimitCleanupService.stop()
            logger.info('🚨 Rate limit cleanup service stopped')
          } catch (error) {
            logger.error('❌ Error stopping rate limit cleanup service:', error)
          }

          // 停止Usuario消息ColaLimpiarServicio
          try {
            const userMessageQueueService = require('./services/userMessageQueueService')
            userMessageQueueService.stopCleanupTask()
            logger.info('📬 User message queue service stopped')
          } catch (error) {
            logger.error('❌ Error stopping user message queue service:', error)
          }

          // 停止费用OrdenarÍndiceServicio
          try {
            const costRankService = require('./services/costRankService')
            costRankService.shutdown()
            logger.info('📊 Cost rank service stopped')
          } catch (error) {
            logger.error('❌ Error stopping cost rank service:', error)
          }

          // 停止Cuenta定时Probar调度器
          try {
            const accountTestSchedulerService = require('./services/accountTestSchedulerService')
            accountTestSchedulerService.stop()
            logger.info('🧪 Account test scheduler service stopped')
          } catch (error) {
            logger.error('❌ Error stopping account test scheduler service:', error)
          }

          // 🔢 Limpiar所有Concurrencia计数（Phase 1 Corrección：防止重启泄漏）
          try {
            logger.info('🔢 Cleaning up all concurrency counters...')
            const keys = await redis.scanKeys('concurrency:*')
            if (keys.length > 0) {
              await redis.batchDelChunked(keys)
              logger.info(`✅ Cleaned ${keys.length} concurrency keys`)
            } else {
              logger.info('✅ No concurrency keys to clean')
            }
          } catch (error) {
            logger.error('❌ Error cleaning up concurrency counters:', error)
            // 不阻止退出流程
          }

          try {
            await redis.disconnect()
            logger.info('👋 Redis disconnected')
          } catch (error) {
            logger.error('❌ Error disconnecting Redis:', error)
          }

          logger.success('Graceful shutdown completed')
          process.exit(0)
        })

        // 强制关闭Tiempo de espera agotado
        setTimeout(() => {
          logger.warn('⚠️ Forced shutdown due to timeout')
          process.exit(1)
        }, 10000)
      } else {
        process.exit(0)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    // Procesar未捕获异常
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught exception:', error)
      shutdown('uncaughtException')
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason)
      shutdown('unhandledRejection')
    })
  }
}

// 启动应用
if (require.main === module) {
  const app = new Application()
  app.start().catch((error) => {
    logger.error('💥 Application startup failed:', error)
    process.exit(1)
  })
}

module.exports = Application
