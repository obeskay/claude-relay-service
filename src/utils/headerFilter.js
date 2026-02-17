/**
 * 统一的 CDN Headers FiltrarColumnaTabla
 *
 * 用于各Servicio在原有Filtrar逻辑基础上，额外Eliminación Cloudflare CDN 和Proxy相关的 headers
 * 避免触发上游 API（如 88code）的SeguridadVerificar
 */

// Cloudflare CDN headers（橙色云Proxy模式会添加这些）
const cdnHeaders = [
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-accel-buffering',
  'cf-ray',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-visitor',
  'cf-request-id',
  'cdn-loop',
  'true-client-ip'
]

/**
 * 为 OpenAI/Responses API Filtrar headers
 * 在原有 skipHeaders 基础上添加 CDN headers
 */
function filterForOpenAI(headers) {
  const skipHeaders = [
    'host',
    'content-length',
    'authorization',
    'x-api-key',
    'x-cr-api-key',
    'connection',
    'upgrade',
    'sec-websocket-key',
    'sec-websocket-version',
    'sec-websocket-extensions',
    ...cdnHeaders // 添加 CDN headers
  ]

  const filtered = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      filtered[key] = value
    }
  }
  return filtered
}

/**
 * 为 Claude/Anthropic API Filtrar headers
 * 使用白名单模式，只允许指定的 headers 通过
 */
function filterForClaude(headers) {
  // 白名单模式：只允许以下 headers
  const allowedHeaders = [
    'accept',
    'x-stainless-retry-count',
    'x-stainless-timeout',
    'x-stainless-lang',
    'x-stainless-package-version',
    'x-stainless-os',
    'x-stainless-arch',
    'x-stainless-runtime',
    'x-stainless-runtime-version',
    'x-stainless-helper-method',
    'anthropic-dangerous-direct-browser-access',
    'anthropic-version',
    'x-app',
    'anthropic-beta',
    'accept-language',
    'sec-fetch-mode',
    'accept-encoding',
    'user-agent',
    'content-type',
    'connection'
  ]

  const filtered = {}
  Object.keys(headers || {}).forEach((key) => {
    const lowerKey = key.toLowerCase()
    if (allowedHeaders.includes(lowerKey)) {
      filtered[key] = headers[key]
    }
  })

  return filtered
}

/**
 * 为 Gemini API Filtrar headers（如果需要转发Cliente headers 时使用）
 * 目前 Gemini Servicio不转发Cliente headers，仅提供此Método备用
 */
function filterForGemini(headers) {
  const skipHeaders = [
    'host',
    'content-length',
    'authorization',
    'x-api-key',
    'connection',
    ...cdnHeaders // 添加 CDN headers
  ]

  const filtered = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      filtered[key] = value
    }
  }
  return filtered
}

module.exports = {
  cdnHeaders,
  filterForOpenAI,
  filterForClaude,
  filterForGemini
}
