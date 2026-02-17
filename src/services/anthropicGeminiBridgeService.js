/**
 * ============================================================================
 * Anthropic → Gemini/Antigravity 桥接Servicio
 * ============================================================================
 *
 * 【Módulo功能】
 * 本Módulo负责将 Anthropic Claude API Formato的SolicitudConvertir为 Gemini/Antigravity Formato，
 * 并将RespuestaConvertir回 Anthropic FormatoRetornar给Cliente（如 Claude Code）。
 *
 * 【Soportar的后端 (vendor)】
 * - gemini-cli: 原生 Google Gemini API
 * - antigravity: Claude Proxy层 (CLIProxyAPI)，使用 Gemini Formato但有额外Restricción
 *
 * 【核心Procesar流程】
 * 1. 接收 Anthropic FormatoSolicitud (/v1/messages)
 * 2. 标准化消息 (normalizeAnthropicMessages) - Procesar thinking blocks、tool_result 等
 * 3. Convertir工具定义 (convertAnthropicToolsToGeminiTools) - 压缩描述、清洗 schema
 * 4. Convertir消息内容 (convertAnthropicMessagesToGeminiContents)
 * 5. Construir Gemini Solicitud (buildGeminiRequestFromAnthropic)
 * 6. 发送Solicitud并Procesar SSE 流式Respuesta
 * 7. 将 Gemini RespuestaConvertir回 Anthropic FormatoRetornar
 *
 * 【Antigravity 特殊Procesar】
 * - 工具描述压缩：Límite 400 字符，避免 prompt 超长
 * - Schema description 压缩：Límite 200 字符，保留关键RestricciónInformación
 * - Thinking signature 校验：防止FormatoError导致 400
 * - Tool result 截断：Límite 20 万字符
 * - 缺失 tool_result 自动补全：避免 tool_use concurrency Error
 */

const util = require('util')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const logger = require('../utils/logger')
const { getProjectRoot } = require('../utils/projectPaths')
const geminiAccountService = require('./account/geminiAccountService')
const unifiedGeminiScheduler = require('./scheduler/unifiedGeminiScheduler')
const sessionHelper = require('../utils/sessionHelper')
const signatureCache = require('../utils/signatureCache')
const apiKeyService = require('./apiKeyService')
const { updateRateLimitCounters } = require('../utils/rateLimitHelper')
const { parseSSELine } = require('../utils/sseParser')
const { sanitizeUpstreamError } = require('../utils/errorSanitizer')
const { cleanJsonSchemaForGemini } = require('../utils/geminiSchemaCleaner')
const {
  dumpAnthropicNonStreamResponse,
  dumpAnthropicStreamSummary
} = require('../utils/anthropicResponseDump')
const {
  dumpAntigravityStreamEvent,
  dumpAntigravityStreamSummary
} = require('../utils/antigravityUpstreamResponseDump')

// ============================================================================
// 常量定义
// ============================================================================

// PredeterminadoFirma
const THOUGHT_SIGNATURE_FALLBACK = 'skip_thought_signature_validator'

// Soportar的后端Tipo
const SUPPORTED_VENDORS = new Set(['gemini-cli', 'antigravity'])
// 需要跳过的系统提醒前缀（Claude 内部消息，不应转发给上游）
const SYSTEM_REMINDER_PREFIX = '<system-reminder>'
// Depurar：工具定义 dump 相关
const TOOLS_DUMP_ENV = 'ANTHROPIC_DEBUG_TOOLS_DUMP'
const TOOLS_DUMP_FILENAME = 'anthropic-tools-dump.jsonl'
// Variable de entorno：工具调用Falló时是否Retirada到文本输出
const TEXT_TOOL_FALLBACK_ENV = 'ANTHROPIC_TEXT_TOOL_FALLBACK'
// Variable de entorno：工具报错时是否继续Ejecutar（而非中断）
const TOOL_ERROR_CONTINUE_ENV = 'ANTHROPIC_TOOL_ERROR_CONTINUE'
// Antigravity 工具顶级描述的最大字符数（防止 prompt 超长）
const MAX_ANTIGRAVITY_TOOL_DESCRIPTION_CHARS = 400
// Antigravity Parámetro schema description 的最大字符数（保留关键RestricciónInformación）
const MAX_ANTIGRAVITY_SCHEMA_DESCRIPTION_CHARS = 200
// Antigravity：当已经决定要走工具时，避免“只宣布步骤就结束”
const ANTIGRAVITY_TOOL_FOLLOW_THROUGH_PROMPT =
  'When a step requires calling a tool, call the tool immediately in the same turn. Do not stop after announcing the step. Updating todos alone (e.g., TodoWrite) is not enough; you must actually invoke the target MCP tool (browser_*, etc.) before ending the turn.'
// 工具报错时注入的 system prompt，提示模型不要中断
const TOOL_ERROR_CONTINUE_PROMPT =
  'Tool calls may fail (e.g., missing prerequisites). When a tool result indicates an error, do not stop: briefly explain the cause and continue with an alternative approach or the remaining steps.'
// Antigravity 账号前置注入的系统提示词
const ANTIGRAVITY_SYSTEM_INSTRUCTION_PREFIX = `<identity>
You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding.
You are pair programming with a USER to solve their coding task. The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.
The USER will send you requests, which you must always prioritize addressing. Along with each USER request, we will attach additional metadata about their current state, such as what files they have open and where their cursor is.
This information may or may not be relevant to the coding task, it is up for you to decide.
</identity>
<communication_style>
- **Proactiveness**. As an agent, you are allowed to be proactive, but only in the course of completing the user's task. For example, if the user asks you to add a new component, you can edit the code, verify build and test statuses, and take any other obvious follow-up actions, such as performing additional research. However, avoid surprising the user. For example, if the user asks HOW to approach something, you should answer their question and instead of jumping into editing a file.</communication_style>`

// ============================================================================
// 辅助Función：基础工具
// ============================================================================

/**
 * 确保 Antigravity Solicitud有有效的 projectId
 * 如果Cuenta没有Configuración projectId，则Generar一个临时 ID
 */
function ensureAntigravityProjectId(account) {
  if (account.projectId) {
    return account.projectId
  }
  if (account.tempProjectId) {
    return account.tempProjectId
  }
  return `ag-${crypto.randomBytes(8).toString('hex')}`
}

/**
 * 从 Anthropic 消息内容中提取纯文本
 * SoportarCadena和 content blocks Arreglo两种Formato
 * @param {string|Array} content - Anthropic 消息内容
 * @returns {string} 提取的文本
 */
function extractAnthropicText(content) {
  if (content === null || content === undefined) {
    return ''
  }
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .filter((part) => part && part.type === 'text')
    .map((part) => part.text || '')
    .join('')
}

/**
 * Verificar文本是否应该跳过（不转发给上游）
 * 主要Filtrar Claude 内部的 system-reminder 消息
 */
function shouldSkipText(text) {
  if (!text || typeof text !== 'string') {
    return true
  }
  return text.trimStart().startsWith(SYSTEM_REMINDER_PREFIX)
}

/**
 * Construir Gemini Formato的 system parts
 * 将 Anthropic 的 system prompt Convertir为 Gemini 的 parts Arreglo
 * @param {string|Array} system - Anthropic 的 system prompt
 * @returns {Array} Gemini Formato的 parts
 */
function buildSystemParts(system) {
  const parts = []
  if (!system) {
    return parts
  }
  if (Array.isArray(system)) {
    for (const part of system) {
      if (!part || part.type !== 'text') {
        continue
      }
      const text = extractAnthropicText(part.text || '')
      if (text && !shouldSkipText(text)) {
        parts.push({ text })
      }
    }
    return parts
  }
  const text = extractAnthropicText(system)
  if (text && !shouldSkipText(text)) {
    parts.push({ text })
  }
  return parts
}

/**
 * Construir tool_use ID 到工具Nombre的映射
 * 用于在Procesar tool_result 时查找对应的工具名
 * @param {Array} messages - 消息ColumnaTabla
 * @returns {Map} tool_use_id -> tool_name 的映射
 */
function buildToolUseIdToNameMap(messages) {
  const toolUseIdToName = new Map()

  for (const message of messages || []) {
    if (message?.role !== 'assistant') {
      continue
    }
    const content = message?.content
    if (!Array.isArray(content)) {
      continue
    }
    for (const part of content) {
      if (!part || part.type !== 'tool_use') {
        continue
      }
      if (part.id && part.name) {
        toolUseIdToName.set(part.id, part.name)
      }
    }
  }

  return toolUseIdToName
}

/**
 * 标准化工具调用的输入Parámetro
 * 确保输入始终是ObjetoFormato
 */
function normalizeToolUseInput(input) {
  if (input === null || input === undefined) {
    return {}
  }
  if (typeof input === 'object') {
    return input
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      return {}
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch (_) {
      return {}
    }
  }
  return {}
}

// Antigravity 工具结果的最大字符数（约 20 万，防止 prompt 超长）
const MAX_ANTIGRAVITY_TOOL_RESULT_CHARS = 200000

// ============================================================================
// 辅助Función：Antigravity 体积压缩
// 这些Función用于压缩工具描述、schema 等，避免 prompt 超过 Antigravity 的上限
// ============================================================================

/**
 * 截断文本并添加截断提示（带换Fila）
 * @param {string} text - 原始文本
 * @param {number} maxChars - 最大字符数
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxChars) {
  if (!text || typeof text !== 'string') {
    return ''
  }
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`
}

/**
 * 截断文本并添加截断提示（内联模式，不带换Fila）
 */
function truncateInlineText(text, maxChars) {
  if (!text || typeof text !== 'string') {
    return ''
  }
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}...[truncated ${text.length - maxChars} chars]`
}

/**
 * 压缩工具顶级描述
 * 取前 6 Fila，合并为单Fila，截断到 400 字符
 * 这样可以在保留关键Información的同时大幅减少体积
 * @param {string} description - 原始工具描述
 * @returns {string} 压缩后的描述
 */
function compactToolDescriptionForAntigravity(description) {
  if (!description || typeof description !== 'string') {
    return ''
  }
  const normalized = description.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return ''
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return ''
  }

  const compacted = lines.slice(0, 6).join(' ')
  return truncateInlineText(compacted, MAX_ANTIGRAVITY_TOOL_DESCRIPTION_CHARS)
}

/**
 * 压缩 JSON Schema Propiedad描述
 * 压缩多余空白，截断到 200 字符
 * 这是为了保留关键ParámetroRestricción（如 ji 工具的 action 只能是 "记忆"/"回忆"）
 * @param {string} description - 原始描述
 * @returns {string} 压缩后的描述
 */
function compactSchemaDescriptionForAntigravity(description) {
  if (!description || typeof description !== 'string') {
    return ''
  }
  const normalized = description.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ''
  }
  return truncateInlineText(normalized, MAX_ANTIGRAVITY_SCHEMA_DESCRIPTION_CHARS)
}

/**
 * 递归压缩 JSON Schema 中所有层级的 description Campo
 * 保留并压缩 description（而不是Eliminar），确保关键ParámetroRestricciónInformación不丢失
 * @param {Object} schema - JSON Schema Objeto
 * @returns {Object} 压缩后的 schema
 */
function compactJsonSchemaDescriptionsForAntigravity(schema) {
  if (schema === null || schema === undefined) {
    return schema
  }
  if (typeof schema !== 'object') {
    return schema
  }
  if (Array.isArray(schema)) {
    return schema.map((item) => compactJsonSchemaDescriptionsForAntigravity(item))
  }

  const cleaned = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'description') {
      const compacted = compactSchemaDescriptionForAntigravity(value)
      if (compacted) {
        cleaned.description = compacted
      }
      continue
    }
    cleaned[key] = compactJsonSchemaDescriptionsForAntigravity(value)
  }
  return cleaned
}

/**
 * 清洗 thinking block 的 signature
 * VerificarFormato是否合法（Base64-like token），不合法则Retornar空串
 * 这是为了避免 "Invalid signature in thinking block" 400 Error
 * @param {string} signature - 原始 signature
 * @returns {string} 清洗后的 signature（不合法则为空串）
 */
function sanitizeThoughtSignatureForAntigravity(signature) {
  if (!signature || typeof signature !== 'string') {
    return ''
  }
  const trimmed = signature.trim()
  if (!trimmed) {
    return ''
  }

  const compacted = trimmed.replace(/\s+/g, '')
  if (compacted.length > 65536) {
    return ''
  }

  const looksLikeToken = /^[A-Za-z0-9+/_=-]+$/.test(compacted)
  if (!looksLikeToken) {
    return ''
  }

  if (compacted.length < 8) {
    return ''
  }

  return compacted
}

/**
 * 检测是否是 Antigravity 的 INVALID_ARGUMENT (400) Error
 * 用于在Registro中特殊标记这ClaseError，方便Depurar
 *
 * @param {Object} sanitized - sanitizeUpstreamError Procesar后的ErrorObjeto
 * @returns {boolean} 是否是Parámetro无效Error
 */
function isInvalidAntigravityArgumentError(sanitized) {
  if (!sanitized || typeof sanitized !== 'object') {
    return false
  }
  const upstreamType = String(sanitized.upstreamType || '').toUpperCase()
  if (upstreamType === 'INVALID_ARGUMENT') {
    return true
  }
  const message = String(sanitized.upstreamMessage || sanitized.message || '')
  return /invalid argument/i.test(message)
}

/**
 * 汇总 Antigravity SolicitudInformación用于Depurar
 * 当发生 400 Error时，输出Solicitud的关键EstadísticaInformación，帮助定位问题
 *
 * @param {Object} requestData - 发送给 Antigravity 的SolicitudDatos
 * @returns {Object} Solicitud摘要Información
 */
function summarizeAntigravityRequestForDebug(requestData) {
  const request = requestData?.request || {}
  const contents = Array.isArray(request.contents) ? request.contents : []
  const partStats = { text: 0, thought: 0, functionCall: 0, functionResponse: 0, other: 0 }
  let functionResponseIds = 0
  let fallbackSignatureCount = 0

  for (const message of contents) {
    const parts = Array.isArray(message?.parts) ? message.parts : []
    for (const part of parts) {
      if (!part || typeof part !== 'object') {
        continue
      }
      if (part.thoughtSignature === THOUGHT_SIGNATURE_FALLBACK) {
        fallbackSignatureCount += 1
      }
      if (part.thought) {
        partStats.thought += 1
        continue
      }
      if (part.functionCall) {
        partStats.functionCall += 1
        continue
      }
      if (part.functionResponse) {
        partStats.functionResponse += 1
        if (part.functionResponse.id) {
          functionResponseIds += 1
        }
        continue
      }
      if (typeof part.text === 'string') {
        partStats.text += 1
        continue
      }
      partStats.other += 1
    }
  }

  return {
    model: requestData?.model,
    toolCount: Array.isArray(request.tools) ? request.tools.length : 0,
    toolConfigMode: request.toolConfig?.functionCallingConfig?.mode,
    thinkingConfig: request.generationConfig?.thinkingConfig,
    maxOutputTokens: request.generationConfig?.maxOutputTokens,
    contentsCount: contents.length,
    partStats,
    functionResponseIds,
    fallbackSignatureCount
  }
}

/**
 * 清洗工具结果的 content blocks
 * - Eliminación base64 图片（避免体积过大）
 * - 截断文本内容到 20 万字符
 * @param {Array} blocks - content blocks Arreglo
 * @returns {Array} 清洗后的 blocks
 */
function sanitizeToolResultBlocksForAntigravity(blocks) {
  const cleaned = []
  let usedChars = 0
  let removedImage = false

  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue
    }

    if (
      block.type === 'image' &&
      block.source?.type === 'base64' &&
      typeof block.source?.data === 'string'
    ) {
      removedImage = true
      continue
    }

    if (block.type === 'text' && typeof block.text === 'string') {
      const remaining = MAX_ANTIGRAVITY_TOOL_RESULT_CHARS - usedChars
      if (remaining <= 0) {
        break
      }
      const text = truncateText(block.text, remaining)
      cleaned.push({ ...block, text })
      usedChars += text.length
      continue
    }

    cleaned.push(block)
    usedChars += 100
    if (usedChars >= MAX_ANTIGRAVITY_TOOL_RESULT_CHARS) {
      break
    }
  }

  if (removedImage) {
    cleaned.push({
      type: 'text',
      text: '[image omitted to fit Antigravity prompt limits; use the file path in the previous text block]'
    })
  }

  return cleaned
}

// ============================================================================
// 核心Función：消息标准化和Convertir
// ============================================================================

/**
 * 标准化工具结果内容
 * SoportarCadena和 content blocks Arreglo两种Formato
 * 对 Antigravity 会进Fila截断和图片EliminaciónProcesar
 */
function normalizeToolResultContent(content, { vendor = null } = {}) {
  if (content === null || content === undefined) {
    return ''
  }
  if (typeof content === 'string') {
    if (vendor === 'antigravity') {
      return truncateText(content, MAX_ANTIGRAVITY_TOOL_RESULT_CHARS)
    }
    return content
  }
  // Claude Code 的 tool_result.content 通常是 content blocks Arreglo（例如 [{type:"text",text:"..."}]）。
  // 为对齐 CLIProxyAPI/Antigravity 的Fila为，这里优先保留原始 JSON 结构（Arreglo/Objeto），
  // 避免上游将其视为“无效 tool_result”从而触发 tool_use concurrency 400。
  if (Array.isArray(content) || (content && typeof content === 'object')) {
    if (vendor === 'antigravity' && Array.isArray(content)) {
      return sanitizeToolResultBlocksForAntigravity(content)
    }
    return content
  }
  return ''
}

/**
 * 标准化 Anthropic 消息ColumnaTabla
 * 这是关键的预ProcesarFunción，Procesar以下问题：
 *
 * 1. Antigravity thinking block 顺序调整
 *    - Antigravity 要求 thinking blocks 必须在 assistant 消息的最前面
 *    - Eliminación thinking block 中的 cache_control Campo（上游不接受）
 *
 * 2. tool_use 后的冗余内容剥离
 *    - Eliminación tool_use 后的空文本、"(no content)" 等冗余 part
 *
 * 3. 缺失 tool_result 补全（Antigravity 专用）
 *    - 检测消息历史中是否有 tool_use 没有对应的 tool_result
 *    - 自动插入合成的 tool_result（is_error: true）
 *    - 避免 "tool_use concurrency" 400 Error
 *
 * 4. tool_result 和 user 文本拆分
 *    - Claude Code 可能把 tool_result 和Usuario文本混在一个 user message 中
 *    - 拆分为两个 message 以符合 Anthropic 规范
 *
 * @param {Array} messages - 原始消息ColumnaTabla
 * @param {Object} options - 选项，Incluir vendor
 * @returns {Array} 标准化后的消息ColumnaTabla
 */
function normalizeAnthropicMessages(messages, { vendor = null } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages
  }

  const pendingToolUseIds = []
  const isIgnorableTrailingText = (part) => {
    if (!part || part.type !== 'text') {
      return false
    }
    if (typeof part.text !== 'string') {
      return false
    }
    const trimmed = part.text.trim()
    if (trimmed === '' || trimmed === '(no content)') {
      return true
    }
    if (part.cache_control?.type === 'ephemeral' && trimmed === '(no content)') {
      return true
    }
    return false
  }

  const normalizeAssistantThinkingOrderForVendor = (parts) => {
    if (vendor !== 'antigravity') {
      return parts
    }
    const thinkingBlocks = []
    const otherBlocks = []
    for (const part of parts) {
      if (!part) {
        continue
      }
      if (part.type === 'thinking' || part.type === 'redacted_thinking') {
        // Eliminación cache_control Campo，上游 API 不接受 thinking block 中Incluir此Campo
        // ErrorInformación: "thinking.cache_control: Extra inputs are not permitted"
        const { cache_control: _cache_control, ...cleanedPart } = part
        thinkingBlocks.push(cleanedPart)
        continue
      }
      if (isIgnorableTrailingText(part)) {
        continue
      }
      otherBlocks.push(part)
    }
    if (thinkingBlocks.length === 0) {
      return otherBlocks
    }
    return [...thinkingBlocks, ...otherBlocks]
  }

  const stripNonToolPartsAfterToolUse = (parts) => {
    let seenToolUse = false
    const cleaned = []
    for (const part of parts) {
      if (!part) {
        continue
      }
      if (part.type === 'tool_use') {
        seenToolUse = true
        cleaned.push(part)
        continue
      }
      if (!seenToolUse) {
        cleaned.push(part)
        continue
      }
      if (isIgnorableTrailingText(part)) {
        continue
      }
    }
    return cleaned
  }

  const normalized = []

  for (const message of messages) {
    if (!message || !Array.isArray(message.content)) {
      normalized.push(message)
      continue
    }

    let parts = message.content.filter(Boolean)
    if (message.role === 'assistant') {
      parts = normalizeAssistantThinkingOrderForVendor(parts)
    }

    if (vendor === 'antigravity' && message.role === 'assistant') {
      if (pendingToolUseIds.length > 0) {
        normalized.push({
          role: 'user',
          content: pendingToolUseIds.map((toolUseId) => ({
            type: 'tool_result',
            tool_use_id: toolUseId,
            is_error: true,
            content: [
              {
                type: 'text',
                text: '[tool_result missing; tool execution interrupted]'
              }
            ]
          }))
        })
        pendingToolUseIds.length = 0
      }

      const stripped = stripNonToolPartsAfterToolUse(parts)
      const toolUseIds = stripped
        .filter((part) => part?.type === 'tool_use' && typeof part.id === 'string')
        .map((part) => part.id)
      if (toolUseIds.length > 0) {
        pendingToolUseIds.push(...toolUseIds)
      }

      normalized.push({ ...message, content: stripped })
      continue
    }

    if (vendor === 'antigravity' && message.role === 'user' && pendingToolUseIds.length > 0) {
      const toolResults = parts.filter((p) => p.type === 'tool_result')
      const toolResultIds = new Set(
        toolResults.map((p) => p.tool_use_id).filter((id) => typeof id === 'string')
      )
      const missing = pendingToolUseIds.filter((id) => !toolResultIds.has(id))
      if (missing.length > 0) {
        const synthetic = missing.map((toolUseId) => ({
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: true,
          content: [
            {
              type: 'text',
              text: '[tool_result missing; tool execution interrupted]'
            }
          ]
        }))
        parts = [...toolResults, ...synthetic, ...parts.filter((p) => p.type !== 'tool_result')]
      }
      pendingToolUseIds.length = 0
    }

    if (message.role !== 'user') {
      normalized.push({ ...message, content: parts })
      continue
    }

    const toolResults = parts.filter((p) => p.type === 'tool_result')
    if (toolResults.length === 0) {
      normalized.push({ ...message, content: parts })
      continue
    }

    const nonToolResults = parts.filter((p) => p.type !== 'tool_result')
    if (nonToolResults.length === 0) {
      normalized.push({ ...message, content: toolResults })
      continue
    }

    // Claude Code 可能把 tool_result 和下一条Usuario文本合并在同一个 user message 中。
    // 但上游（Antigravity/Claude）会按 Anthropic Regla校验：tool_use 后的下一条 message
    // 必须只Incluir tool_result blocks。这里做兼容拆分，避免 400 tool-use concurrency。
    normalized.push({ ...message, content: toolResults })
    normalized.push({ ...message, content: nonToolResults })
  }

  if (vendor === 'antigravity' && pendingToolUseIds.length > 0) {
    normalized.push({
      role: 'user',
      content: pendingToolUseIds.map((toolUseId) => ({
        type: 'tool_result',
        tool_use_id: toolUseId,
        is_error: true,
        content: [
          {
            type: 'text',
            text: '[tool_result missing; tool execution interrupted]'
          }
        ]
      }))
    })
    pendingToolUseIds.length = 0
  }

  return normalized
}

// ============================================================================
// 核心Función：工具定义Convertir
// ============================================================================

/**
 * 将 Anthropic 工具定义Convertir为 Gemini/Antigravity Formato
 *
 * 主要工作：
 * 1. 工具描述压缩（Antigravity: 400 字符上限）
 * 2. JSON Schema 清洗（Eliminación不Soportar的Campo如 $schema, format 等）
 * 3. Schema description 压缩（Antigravity: 200 字符上限，保留关键Restricción）
 * 4. 输出Formato差异：
 *    - Antigravity: 使用 parametersJsonSchema
 *    - Gemini: 使用 parameters
 *
 * @param {Array} tools - Anthropic Formato的工具定义Arreglo
 * @param {Object} options - 选项，Incluir vendor
 * @returns {Array|null} Gemini Formato的工具定义，或 null
 */
function convertAnthropicToolsToGeminiTools(tools, { vendor = null } = {}) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return null
  }

  // 说明：Gemini / Antigravity 对工具 schema 的接受程度不同；这里做“尽可能兼容”的最小清洗，降低 400 概率。
  const sanitizeSchemaForFunctionDeclarations = (schema) => {
    const allowedKeys = new Set([
      'type',
      'properties',
      'required',
      'description',
      'enum',
      'items',
      'anyOf',
      'oneOf',
      'allOf',
      'additionalProperties',
      'minimum',
      'maximum',
      'minItems',
      'maxItems',
      'minLength',
      'maxLength'
    ])

    if (schema === null || schema === undefined) {
      return null
    }

    // primitives: keep as-is (e.g. type/description/nullable/minimum...)
    if (typeof schema !== 'object') {
      return schema
    }

    if (Array.isArray(schema)) {
      return schema
        .map((item) => sanitizeSchemaForFunctionDeclarations(item))
        .filter((item) => item !== null && item !== undefined)
    }

    const sanitized = {}
    for (const [key, value] of Object.entries(schema)) {
      // Antigravity/Cloud Code 的 function_declarations.parameters 不接受 $schema / $id 等元Campo
      if (key === '$schema' || key === '$id') {
        continue
      }
      // 去除常见的非必要Campo，减少上游 schema 校验Falló概率
      if (key === 'title' || key === 'default' || key === 'examples' || key === 'example') {
        continue
      }
      // 上游对 JSON Schema "format" Soportar不稳定（特别是 format=uri），直接Eliminación以降低 400 概率
      if (key === 'format') {
        continue
      }
      if (!allowedKeys.has(key)) {
        continue
      }

      if (key === 'properties') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const props = {}
          for (const [propName, propSchema] of Object.entries(value)) {
            const sanitizedProp = sanitizeSchemaForFunctionDeclarations(propSchema)
            if (sanitizedProp && typeof sanitizedProp === 'object') {
              props[propName] = sanitizedProp
            }
          }
          sanitized.properties = props
        }
        continue
      }

      if (key === 'required') {
        if (Array.isArray(value)) {
          const req = value.filter((item) => typeof item === 'string')
          if (req.length > 0) {
            sanitized.required = req
          }
        }
        continue
      }

      if (key === 'enum') {
        if (Array.isArray(value)) {
          const en = value.filter(
            (item) =>
              typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
          )
          if (en.length > 0) {
            sanitized.enum = en
          }
        }
        continue
      }

      if (key === 'additionalProperties') {
        if (typeof value === 'boolean') {
          sanitized.additionalProperties = value
        } else if (value && typeof value === 'object') {
          const ap = sanitizeSchemaForFunctionDeclarations(value)
          if (ap && typeof ap === 'object') {
            sanitized.additionalProperties = ap
          }
        }
        continue
      }

      const sanitizedValue = sanitizeSchemaForFunctionDeclarations(value)
      if (sanitizedValue === null || sanitizedValue === undefined) {
        continue
      }
      sanitized[key] = sanitizedValue
    }

    // 兜底：确保 schema 至少是一个 object schema
    if (!sanitized.type) {
      if (sanitized.items) {
        sanitized.type = 'array'
      } else if (sanitized.properties || sanitized.required || sanitized.additionalProperties) {
        sanitized.type = 'object'
      } else if (sanitized.enum) {
        sanitized.type = 'string'
      } else {
        sanitized.type = 'object'
        sanitized.properties = {}
      }
    }

    if (sanitized.type === 'object' && !sanitized.properties) {
      sanitized.properties = {}
    }

    return sanitized
  }

  const functionDeclarations = tools
    .map((tool) => {
      const toolDef = tool?.custom && typeof tool.custom === 'object' ? tool.custom : tool
      if (!toolDef || !toolDef.name) {
        return null
      }

      const toolDescription =
        vendor === 'antigravity'
          ? compactToolDescriptionForAntigravity(toolDef.description || '')
          : toolDef.description || ''

      const schema =
        vendor === 'antigravity'
          ? compactJsonSchemaDescriptionsForAntigravity(
              cleanJsonSchemaForGemini(toolDef.input_schema)
            )
          : sanitizeSchemaForFunctionDeclarations(toolDef.input_schema) || {
              type: 'object',
              properties: {}
            }

      const baseDecl = {
        name: toolDef.name,
        description: toolDescription
      }

      // CLIProxyAPI/Antigravity 侧使用 parametersJsonSchema（而不是 parameters）。
      if (vendor === 'antigravity') {
        return { ...baseDecl, parametersJsonSchema: schema }
      }
      return { ...baseDecl, parameters: schema }
    })
    .filter(Boolean)

  if (functionDeclarations.length === 0) {
    return null
  }

  return [
    {
      functionDeclarations
    }
  ]
}

/**
 * 将 Anthropic 的 tool_choice Convertir为 Gemini 的 toolConfig
 * 映射关系：
 *   auto → AUTO（模型自决定是否调用工具）
 *   any  → ANY（必须调用某个工具）
 *   tool → ANY + allowedFunctionNames（指定工具）
 *   none → NONE（禁止调用工具）
 */
function convertAnthropicToolChoiceToGeminiToolConfig(toolChoice) {
  if (!toolChoice || typeof toolChoice !== 'object') {
    return null
  }

  const { type } = toolChoice
  if (!type) {
    return null
  }

  if (type === 'auto') {
    return { functionCallingConfig: { mode: 'AUTO' } }
  }

  if (type === 'any') {
    return { functionCallingConfig: { mode: 'ANY' } }
  }

  if (type === 'tool') {
    const { name } = toolChoice
    if (!name) {
      return { functionCallingConfig: { mode: 'ANY' } }
    }
    return {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [name]
      }
    }
  }

  if (type === 'none') {
    return { functionCallingConfig: { mode: 'NONE' } }
  }

  return null
}

// ============================================================================
// 核心Función：消息内容Convertir
// ============================================================================

/**
 * 将 Anthropic 消息Convertir为 Gemini contents Formato
 *
 * Procesar的内容Tipo：
 * - text: 纯文本内容
 * - thinking: 思考过程（Convertir为 Gemini 的 thought part）
 * - image: 图片（Convertir为 inlineData）
 * - tool_use: 工具调用（Convertir为 functionCall）
 * - tool_result: 工具结果（Convertir为 functionResponse）
 *
 * Antigravity 特殊Procesar：
 * - thinking block Convertir为 { thought: true, text, thoughtSignature }
 * - signature 清洗和校验（不伪造Firma）
 * - 空 thinking block 跳过（避免 400 Error）
 * - stripThinking 模式：完全剔除 thinking blocks
 *
 * @param {Array} messages - 标准化后的消息ColumnaTabla
 * @param {Map} toolUseIdToName - tool_use ID 到工具名的映射
 * @param {Object} options - 选项，Incluir vendor、stripThinking
 * @returns {Array} Gemini Formato的 contents
 */
function convertAnthropicMessagesToGeminiContents(
  messages,
  toolUseIdToName,
  { vendor = null, stripThinking = false, sessionId = null } = {}
) {
  const contents = []
  for (const message of messages || []) {
    const role = message?.role === 'assistant' ? 'model' : 'user'

    const content = message?.content
    const parts = []
    let lastAntigravityThoughtSignature = ''

    if (typeof content === 'string') {
      const text = extractAnthropicText(content)
      if (text && !shouldSkipText(text)) {
        parts.push({ text })
      }
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || !part.type) {
          continue
        }

        if (part.type === 'text') {
          const text = extractAnthropicText(part.text || '')
          if (text && !shouldSkipText(text)) {
            parts.push({ text })
          }
          continue
        }

        if (part.type === 'thinking' || part.type === 'redacted_thinking') {
          // 当 thinking 未Habilitar时，跳过所有 thinking blocks，避免 Antigravity 400 Error：
          // "When thinking is disabled, an assistant message cannot contain thinking"
          if (stripThinking) {
            continue
          }

          const thinkingText = extractAnthropicText(part.thinking || part.text || '')
          if (vendor === 'antigravity') {
            const hasThinkingText = thinkingText && !shouldSkipText(thinkingText)
            // 先尝试使用Solicitud中的Firma，如果没有则尝试从CachéRestauración
            let signature = sanitizeThoughtSignatureForAntigravity(part.signature)
            if (!signature && sessionId && hasThinkingText) {
              const cachedSig = signatureCache.getCachedSignature(sessionId, thinkingText)
              if (cachedSig) {
                signature = cachedSig
                logger.debug('[SignatureCache] Restored signature from cache for thinking block')
              }
            }
            const hasSignature = Boolean(signature)

            // Claude Code 有时会发送空的 thinking block（无 thinking / 无 signature）。
            // 传给 Antigravity 会变成仅含 thoughtSignature 的 part，容易触发 INVALID_ARGUMENT。
            if (!hasThinkingText && !hasSignature) {
              continue
            }

            // Antigravity 会校验 thoughtSignature；缺失/不合法时无法伪造，只能丢弃该块避免 400。
            if (!hasSignature) {
              continue
            }

            lastAntigravityThoughtSignature = signature
            const thoughtPart = { thought: true, thoughtSignature: signature }
            if (hasThinkingText) {
              thoughtPart.text = thinkingText
            }
            parts.push(thoughtPart)
          } else if (thinkingText && !shouldSkipText(thinkingText)) {
            parts.push({ text: thinkingText })
          }
          continue
        }

        if (part.type === 'image') {
          const source = part.source || {}
          if (source.type === 'base64' && source.data) {
            const mediaType = source.media_type || source.mediaType || 'application/octet-stream'
            const inlineData =
              vendor === 'antigravity'
                ? { mime_type: mediaType, data: source.data }
                : { mimeType: mediaType, data: source.data }
            parts.push({ inlineData })
          }
          continue
        }

        if (part.type === 'tool_use') {
          if (part.name) {
            const toolCallId = typeof part.id === 'string' && part.id ? part.id : undefined
            const args = normalizeToolUseInput(part.input)
            const functionCall = {
              ...(vendor === 'antigravity' && toolCallId ? { id: toolCallId } : {}),
              name: part.name,
              args
            }

            // Antigravity 对历史工具调用的 functionCall 会校验 thoughtSignature；
            // Claude Code 侧的Firma存放在 thinking block（part.signature），这里需要回填到 functionCall part 上。
            // [大东的绝杀补丁] 再次尝试！
            if (vendor === 'antigravity') {
              // 如果没有真Firma，就用“免检金牌”
              const effectiveSignature =
                lastAntigravityThoughtSignature || THOUGHT_SIGNATURE_FALLBACK

              // 必须把这个塞进去
              // Antigravity 要求：每个Incluir thoughtSignature 的 part 都必须有 thought: true
              parts.push({
                thought: true,
                thoughtSignature: effectiveSignature,
                functionCall
              })
            } else {
              parts.push({ functionCall })
            }
          }
          continue
        }

        if (part.type === 'tool_result') {
          const toolUseId = part.tool_use_id
          const toolName = toolUseId ? toolUseIdToName.get(toolUseId) : null
          if (!toolName) {
            continue
          }

          const raw = normalizeToolResultContent(part.content, { vendor })

          let parsedResponse = null
          if (raw && typeof raw === 'string') {
            try {
              parsedResponse = JSON.parse(raw)
            } catch (_) {
              parsedResponse = null
            }
          }

          if (vendor === 'antigravity') {
            const toolCallId = typeof toolUseId === 'string' && toolUseId ? toolUseId : undefined
            const result = parsedResponse !== null ? parsedResponse : raw || ''
            const response = part.is_error === true ? { result, is_error: true } : { result }

            parts.push({
              functionResponse: {
                ...(toolCallId ? { id: toolCallId } : {}),
                name: toolName,
                response
              }
            })
          } else {
            const response =
              parsedResponse !== null
                ? parsedResponse
                : {
                    content: raw || '',
                    is_error: part.is_error === true
                  }

            parts.push({
              functionResponse: {
                name: toolName,
                response
              }
            })
          }
        }
      }
    }

    if (parts.length === 0) {
      continue
    }

    contents.push({
      role,
      parts
    })
  }
  return contents
}

/**
 * Verificar是否可以为 Antigravity Habilitar thinking 功能
 *
 * Regla：查找最后一个 assistant 消息，Verificar其 thinking block 是否有效
 * - 如果有 thinking 文本或 signature，则可以Habilitar
 * - 如果是空 thinking block（无文本且无 signature），则不能Habilitar
 *
 * 这是为了避免 "When thinking is disabled, an assistant message cannot contain thinking" Error
 *
 * @param {Array} messages - 消息ColumnaTabla
 * @returns {boolean} 是否可以Habilitar thinking
 */
function canEnableAntigravityThinking(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return true
  }

  // Antigravity 会校验历史 thinking blocks 的 signature；缺失/不合法时必须Deshabilitar thinking，避免 400。
  for (const message of messages) {
    if (!message || message.role !== 'assistant') {
      continue
    }
    const { content } = message
    if (!Array.isArray(content) || content.length === 0) {
      continue
    }
    for (const part of content) {
      if (!part || (part.type !== 'thinking' && part.type !== 'redacted_thinking')) {
        continue
      }
      const signature = sanitizeThoughtSignatureForAntigravity(part.signature)
      if (!signature) {
        return false
      }
    }
  }

  let lastAssistant = null
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message && message.role === 'assistant') {
      lastAssistant = message
      break
    }
  }
  if (
    !lastAssistant ||
    !Array.isArray(lastAssistant.content) ||
    lastAssistant.content.length === 0
  ) {
    return true
  }

  const parts = lastAssistant.content.filter(Boolean)
  const hasToolBlocks = parts.some(
    (part) => part?.type === 'tool_use' || part?.type === 'tool_result'
  )
  if (!hasToolBlocks) {
    return true
  }

  const first = parts[0]
  if (!first || (first.type !== 'thinking' && first.type !== 'redacted_thinking')) {
    return false
  }

  return true
}

// ============================================================================
// 核心Función：Construir最终Solicitud
// ============================================================================

/**
 * Construir Gemini/Antigravity Solicitud体
 * 这是整个Convertir流程的主Función，串联所有Convertir步骤：
 *
 * 1. normalizeAnthropicMessages - 消息标准化
 * 2. buildToolUseIdToNameMap - Construir tool_use ID 映射
 * 3. canEnableAntigravityThinking - Verificar thinking 是否可Habilitar
 * 4. convertAnthropicMessagesToGeminiContents - Convertir消息内容
 * 5. buildSystemParts - Construir system prompt
 * 6. convertAnthropicToolsToGeminiTools - Convertir工具定义
 * 7. convertAnthropicToolChoiceToGeminiToolConfig - Convertir工具选择
 * 8. Construir generationConfig（温度、maxTokens、thinking 等）
 *
 * @param {Object} body - Anthropic Solicitud体
 * @param {string} baseModel - 基础模型名
 * @param {Object} options - 选项，Incluir vendor
 * @returns {Object} { model, request } Gemini SolicitudObjeto
 */
function buildGeminiRequestFromAnthropic(
  body,
  baseModel,
  { vendor = null, sessionId = null } = {}
) {
  const normalizedMessages = normalizeAnthropicMessages(body.messages || [], { vendor })
  const toolUseIdToName = buildToolUseIdToNameMap(normalizedMessages || [])

  // 提前判断是否可以Habilitar thinking，以便决定是否需要剥离 thinking blocks
  let canEnableThinking = false
  if (vendor === 'antigravity' && body?.thinking?.type === 'enabled') {
    const budgetRaw = Number(body.thinking.budget_tokens)
    if (Number.isFinite(budgetRaw)) {
      canEnableThinking = canEnableAntigravityThinking(normalizedMessages)
    }
  }

  const contents = convertAnthropicMessagesToGeminiContents(
    normalizedMessages || [],
    toolUseIdToName,
    {
      vendor,
      // 当 Antigravity 无法Habilitar thinking 时，剥离所有 thinking blocks
      stripThinking: vendor === 'antigravity' && !canEnableThinking,
      sessionId
    }
  )
  const systemParts = buildSystemParts(body.system)

  if (vendor === 'antigravity' && isEnvEnabled(process.env[TOOL_ERROR_CONTINUE_ENV])) {
    systemParts.push({ text: TOOL_ERROR_CONTINUE_PROMPT })
  }
  if (vendor === 'antigravity') {
    systemParts.push({ text: ANTIGRAVITY_TOOL_FOLLOW_THROUGH_PROMPT })
  }

  const temperature = typeof body.temperature === 'number' ? body.temperature : 1
  const maxTokens = Number.isFinite(body.max_tokens) ? body.max_tokens : 4096

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
    candidateCount: 1
  }

  if (typeof body.top_p === 'number') {
    generationConfig.topP = body.top_p
  }
  if (typeof body.top_k === 'number') {
    generationConfig.topK = body.top_k
  }

  // 使用前面已经Calcular好的 canEnableThinking 结果
  if (vendor === 'antigravity' && body?.thinking?.type === 'enabled') {
    const budgetRaw = Number(body.thinking.budget_tokens)
    if (Number.isFinite(budgetRaw)) {
      if (canEnableThinking) {
        generationConfig.thinkingConfig = {
          thinkingBudget: Math.trunc(budgetRaw),
          include_thoughts: true
        }
      } else {
        logger.warn(
          '⚠️ Antigravity thinking request dropped: last assistant message lacks usable thinking block',
          { model: baseModel }
        )
      }
    }
  }

  const geminiRequestBody = {
    contents,
    generationConfig
  }

  // antigravity: 前置注入系统提示词
  if (vendor === 'antigravity') {
    const allParts = [{ text: ANTIGRAVITY_SYSTEM_INSTRUCTION_PREFIX }, ...systemParts]
    geminiRequestBody.systemInstruction = { role: 'user', parts: allParts }
  } else if (systemParts.length > 0) {
    geminiRequestBody.systemInstruction = { parts: systemParts }
  }

  const geminiTools = convertAnthropicToolsToGeminiTools(body.tools, { vendor })
  if (geminiTools) {
    geminiRequestBody.tools = geminiTools
  }

  const toolConfig = convertAnthropicToolChoiceToGeminiToolConfig(body.tool_choice)
  if (toolConfig) {
    geminiRequestBody.toolConfig = toolConfig
  } else if (geminiTools) {
    // Anthropic 的Predeterminado语义是 tools 存在且未Establecer tool_choice 时为 auto。
    // Gemini/Antigravity 的 function calling Predeterminado可能不会Habilitar，因此显式Establecer为 AUTO，避免“永远不产出 tool_use”。
    geminiRequestBody.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }
  }

  return { model: baseModel, request: geminiRequestBody }
}

// ============================================================================
// 辅助Función：Gemini RespuestaAnalizar
// ============================================================================

/**
 * 从 Gemini Respuesta中提取文本内容
 * @param {Object} payload - Gemini Respuesta payload
 * @param {boolean} includeThought - 是否Incluir thinking 文本
 * @returns {string} 提取的文本
 */
function extractGeminiText(payload, { includeThought = false } = {}) {
  const candidate = payload?.candidates?.[0]
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }
  return parts
    .filter(
      (part) => typeof part?.text === 'string' && part.text && (includeThought || !part.thought)
    )
    .map((part) => part.text)
    .filter(Boolean)
    .join('')
}

/**
 * 从 Gemini Respuesta中提取 thinking 文本内容
 */
function extractGeminiThoughtText(payload) {
  const candidate = payload?.candidates?.[0]
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }
  return parts
    .filter((part) => part?.thought && typeof part?.text === 'string' && part.text)
    .map((part) => part.text)
    .filter(Boolean)
    .join('')
}

/**
 * 从 Gemini Respuesta中提取 thinking signature
 * 用于在下一轮对话中传回给 Antigravity
 */
function extractGeminiThoughtSignature(payload) {
  const candidate = payload?.candidates?.[0]
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }

  const resolveSignature = (part) => {
    if (!part) {
      return ''
    }
    return part.thoughtSignature || part.thought_signature || part.signature || ''
  }

  // 优先：functionCall part 上的 signature（上游可能把Firma挂在工具调用 part 上）
  for (const part of parts) {
    if (!part?.functionCall?.name) {
      continue
    }
    const signature = resolveSignature(part)
    if (signature) {
      return signature
    }
  }

  // Retirada：thought part 上的 signature
  for (const part of parts) {
    if (!part?.thought) {
      continue
    }
    const signature = resolveSignature(part)
    if (signature) {
      return signature
    }
  }
  return ''
}

/**
 * Analizar Gemini Respuesta的 token 使用情况
 * Calcular输出 token 数（包括 candidate + thought tokens）
 */
function resolveUsageOutputTokens(usageMetadata) {
  if (!usageMetadata || typeof usageMetadata !== 'object') {
    return 0
  }
  const promptTokens = usageMetadata.promptTokenCount || 0
  const candidateTokens = usageMetadata.candidatesTokenCount || 0
  const thoughtTokens = usageMetadata.thoughtsTokenCount || 0
  const totalTokens = usageMetadata.totalTokenCount || 0

  let outputTokens = candidateTokens + thoughtTokens
  if (outputTokens === 0 && totalTokens > 0) {
    outputTokens = totalTokens - promptTokens
    if (outputTokens < 0) {
      outputTokens = 0
    }
  }
  return outputTokens
}

/**
 * VerificarVariable de entorno是否Habilitar
 * Soportar true/1/yes/on 等Valor
 */
function isEnvEnabled(value) {
  if (!value) {
    return false
  }
  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

/**
 * 从文本中提取 Write 工具调用
 * Procesar模型在文本中输出 "Write: <path>" Formato的情况
 * 这是一个兜底机制，用于Procesar function calling Falló的情况
 */
function tryExtractWriteToolFromText(text, fallbackCwd) {
  if (!text || typeof text !== 'string') {
    return null
  }

  const lines = text.split(/\r?\n/)
  const index = lines.findIndex((line) => /^\s*Write\s*:\s*/i.test(line))
  if (index < 0) {
    return null
  }

  const header = lines[index]
  const rawPath = header.replace(/^\s*Write\s*:\s*/i, '').trim()
  if (!rawPath) {
    return null
  }

  const content = lines.slice(index + 1).join('\n')
  const prefixText = lines.slice(0, index).join('\n').trim()

  // Claude Code 的 Write 工具要求绝对Ruta。若模型给的是相对Ruta，仅在本地运FilaProxy时可用；
  // 这里提供一个OpcionalRetirada：使用Servicio端 cwd Analizar。
  let filePath = rawPath
  if (!path.isAbsolute(filePath) && fallbackCwd) {
    filePath = path.resolve(fallbackCwd, filePath)
  }

  return {
    prefixText: prefixText || '',
    tool: {
      name: 'Write',
      input: {
        file_path: filePath,
        content: content || ''
      }
    }
  }
}

function mapGeminiFinishReasonToAnthropicStopReason(finishReason) {
  const normalized = (finishReason || '').toString().toUpperCase()
  if (normalized === 'MAX_TOKENS') {
    return 'max_tokens'
  }
  return 'end_turn'
}

/**
 * Generar工具调用 ID
 * 使用 toolu_ 前缀 + 随机Cadena
 */
function buildToolUseId() {
  return `toolu_${crypto.randomBytes(10).toString('hex')}`
}

/**
 * 稳定的 JSON Serialización（键按字母顺序排Columna）
 * 用于Generar可比较的 JSON Cadena
 */
function stableJsonStringify(value) {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    return `{${pairs.join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * 从 Gemini Respuesta中提取 parts Arreglo
 */
function extractGeminiParts(payload) {
  const candidate = payload?.candidates?.[0]
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts)) {
    return []
  }
  return parts
}

// ============================================================================
// 核心Función：Gemini RespuestaConvertir为 Anthropic Formato
// ============================================================================

/**
 * 将 Gemini RespuestaConvertir为 Anthropic content blocks
 *
 * Procesar的内容Tipo：
 * - text: 纯文本 → { type: "text", text }
 * - thought: 思考过程 → { type: "thinking", thinking, signature }
 * - functionCall: 工具调用 → { type: "tool_use", id, name, input }
 *
 * 注意：thinking blocks 会被调整到Arreglo最前面（符合 Anthropic 规范）
 */
function convertGeminiPayloadToAnthropicContent(payload) {
  const parts = extractGeminiParts(payload)
  const content = []
  let currentText = ''

  const flushText = () => {
    if (!currentText) {
      return
    }
    content.push({ type: 'text', text: currentText })
    currentText = ''
  }

  const pushThinkingBlock = (thinkingText, signature) => {
    const normalizedThinking = typeof thinkingText === 'string' ? thinkingText : ''
    const normalizedSignature = typeof signature === 'string' ? signature : ''
    if (!normalizedThinking && !normalizedSignature) {
      return
    }
    const block = { type: 'thinking', thinking: normalizedThinking }
    if (normalizedSignature) {
      block.signature = normalizedSignature
    }
    content.push(block)
  }

  const resolveSignature = (part) => {
    if (!part) {
      return ''
    }
    return part.thoughtSignature || part.thought_signature || part.signature || ''
  }

  for (const part of parts) {
    const isThought = part?.thought === true
    if (isThought) {
      flushText()
      pushThinkingBlock(typeof part?.text === 'string' ? part.text : '', resolveSignature(part))
      continue
    }

    if (typeof part?.text === 'string' && part.text) {
      currentText += part.text
      continue
    }

    const functionCall = part?.functionCall
    if (functionCall?.name) {
      flushText()

      // 上游可能把 thought signature 挂在 functionCall part 上：需要原样传回给Cliente，
      // 以便下一轮对话能携带 signature。
      const functionCallSignature = resolveSignature(part)
      if (functionCallSignature) {
        pushThinkingBlock('', functionCallSignature)
      }

      const toolUseId =
        typeof functionCall.id === 'string' && functionCall.id ? functionCall.id : buildToolUseId()
      content.push({
        type: 'tool_use',
        id: toolUseId,
        name: functionCall.name,
        input: functionCall.args || {}
      })
    }
  }

  flushText()
  const thinkingBlocks = content.filter(
    (b) => b && (b.type === 'thinking' || b.type === 'redacted_thinking')
  )
  if (thinkingBlocks.length > 0) {
    const firstType = content?.[0]?.type
    if (firstType !== 'thinking' && firstType !== 'redacted_thinking') {
      const others = content.filter(
        (b) => b && b.type !== 'thinking' && b.type !== 'redacted_thinking'
      )
      return [...thinkingBlocks, ...others]
    }
  }
  return content
}

/**
 * Construir Anthropic Formato的ErrorRespuesta
 */
function buildAnthropicError(message) {
  return {
    type: 'error',
    error: {
      type: 'api_error',
      message: message || 'Upstream error'
    }
  }
}

/**
 * 判断是否应该在无工具模式下Reintentar
 * 当上游报告 JSON Schema 或工具相关Error时，Eliminación工具定义Reintentar
 */
function shouldRetryWithoutTools(sanitizedError) {
  const message = (sanitizedError?.upstreamMessage || sanitizedError?.message || '').toLowerCase()
  if (!message) {
    return false
  }
  return (
    message.includes('json schema is invalid') ||
    message.includes('invalid json payload') ||
    message.includes('tools.') ||
    message.includes('function_declarations')
  )
}

/**
 * 从Solicitud中Eliminación工具定义（用于Reintentar）
 */
function stripToolsFromRequest(requestData) {
  if (!requestData || !requestData.request) {
    return requestData
  }
  const nextRequest = {
    ...requestData,
    request: {
      ...requestData.request
    }
  }
  delete nextRequest.request.tools
  delete nextRequest.request.toolConfig
  return nextRequest
}

/**
 * Escribir Anthropic SSE Evento
 * 将Evento和Datos以 SSE Formato发送给Cliente
 */
function writeAnthropicSseEvent(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ============================================================================
// Depurar和跟踪Función
// ============================================================================

/**
 * Registro工具定义到Archivo（Depurar用）
 * 只在Variable de entorno ANTHROPIC_DEBUG_TOOLS_DUMP Habilitar时生效
 */
function dumpToolsPayload({ vendor, model, tools, toolChoice }) {
  if (!isEnvEnabled(process.env[TOOLS_DUMP_ENV])) {
    return
  }
  if (!Array.isArray(tools) || tools.length === 0) {
    return
  }
  if (vendor !== 'antigravity') {
    return
  }

  const filePath = path.join(getProjectRoot(), TOOLS_DUMP_FILENAME)
  const payload = {
    timestamp: new Date().toISOString(),
    vendor,
    model,
    tool_choice: toolChoice || null,
    tools
  }

  try {
    fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8')
    logger.warn(`🧾 Tools payload dumped to ${filePath}`)
  } catch (error) {
    logger.warn('Failed to dump tools payload:', error.message)
  }
}

/**
 * Actualizar速率Límite计数器
 * 跟踪 token 使用量和成本
 */
async function applyRateLimitTracking(
  rateLimitInfo,
  usageSummary,
  model,
  context = '',
  keyId = null
) {
  if (!rateLimitInfo) {
    return
  }

  const label = context ? ` (${context})` : ''

  try {
    const { totalTokens, totalCost } = await updateRateLimitCounters(
      rateLimitInfo,
      usageSummary,
      model,
      keyId,
      'gemini'
    )
    if (totalTokens > 0) {
      logger.api(`📊 Updated rate limit token count${label}: +${totalTokens} tokens`)
    }
    if (typeof totalCost === 'number' && totalCost > 0) {
      logger.api(`💰 Updated rate limit cost count${label}: +$${totalCost.toFixed(6)}`)
    }
  } catch (error) {
    logger.error(`❌ Failed to update rate limit counters${label}:`, error)
  }
}

// ============================================================================
// 主入口Función：API SolicitudProcesar
// ============================================================================

/**
 * Procesar Anthropic Formato的Solicitud并转发到 Gemini/Antigravity
 *
 * 这是整个Módulo的主入口，完整流程：
 * 1. Validar vendor Soportar
 * 2. 选择可用的 Gemini Cuenta
 * 3. 模型Retirada匹配（如果Solicitud的模型不可用）
 * 4. Construir Gemini Solicitud (buildGeminiRequestFromAnthropic)
 * 5. 发送Solicitud（流式或非流式）
 * 6. ProcesarRespuesta并Convertir为 Anthropic Formato
 * 7. 如果工具相关Error，尝试Eliminación工具Reintentar
 * 8. Retornar结果给Cliente
 *
 * @param {Object} req - Express SolicitudObjeto
 * @param {Object} res - Express RespuestaObjeto
 * @param {Object} options - Incluir vendor 和 baseModel
 */
async function handleAnthropicMessagesToGemini(req, res, { vendor, baseModel }) {
  if (!SUPPORTED_VENDORS.has(vendor)) {
    return res.status(400).json(buildAnthropicError(`Unsupported vendor: ${vendor}`))
  }

  dumpToolsPayload({
    vendor,
    model: baseModel,
    tools: req.body?.tools || null,
    toolChoice: req.body?.tool_choice || null
  })

  const pickFallbackModel = (account, requestedModel) => {
    const supportedModels = Array.isArray(account?.supportedModels) ? account.supportedModels : []
    if (supportedModels.length === 0) {
      return requestedModel
    }

    const normalize = (m) => String(m || '').replace(/^models\//, '')
    const requested = normalize(requestedModel)
    const normalizedSupported = supportedModels.map(normalize)

    if (normalizedSupported.includes(requested)) {
      return requestedModel
    }

    // Claude Code 常见探测模型：优先Retirada到 Opus 4.5（如果账号Soportar）
    const preferred = ['claude-opus-4-5', 'claude-sonnet-4-5-thinking', 'claude-sonnet-4-5']
    for (const candidate of preferred) {
      if (normalizedSupported.includes(candidate)) {
        return candidate
      }
    }

    return normalizedSupported[0]
  }

  const isStream = req.body?.stream === true
  const sessionHash = sessionHelper.generateSessionHash(req.body)
  const upstreamSessionId = sessionHash || req.apiKey?.id || null

  let accountSelection
  try {
    accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
      req.apiKey,
      sessionHash,
      baseModel,
      { oauthProvider: vendor }
    )
  } catch (error) {
    logger.error('Failed to select Gemini account (via /v1/messages):', error)
    return res
      .status(503)
      .json(buildAnthropicError(error.message || 'No available Gemini accounts'))
  }

  let { accountId } = accountSelection
  const { accountType } = accountSelection
  if (accountType !== 'gemini') {
    return res
      .status(400)
      .json(buildAnthropicError('Only Gemini OAuth accounts are supported for this vendor'))
  }

  const account = await geminiAccountService.getAccount(accountId)
  if (!account) {
    return res.status(503).json(buildAnthropicError('Gemini OAuth account not found'))
  }

  await geminiAccountService.markAccountUsed(account.id)

  let proxyConfig = null
  if (account.proxy) {
    try {
      proxyConfig = typeof account.proxy === 'string' ? JSON.parse(account.proxy) : account.proxy
    } catch (e) {
      logger.warn('Failed to parse proxy configuration:', e)
    }
  }

  const client = await geminiAccountService.getOauthClient(
    account.accessToken,
    account.refreshToken,
    proxyConfig,
    account.oauthProvider
  )

  let { projectId } = account
  if (vendor === 'antigravity') {
    projectId = ensureAntigravityProjectId(account)
    if (!account.projectId && account.tempProjectId !== projectId) {
      await geminiAccountService.updateTempProjectId(account.id, projectId)
      account.tempProjectId = projectId
    }
  }

  const effectiveModel = pickFallbackModel(account, baseModel)
  if (effectiveModel !== baseModel) {
    logger.warn('⚠️ Requested model not supported by account, falling back', {
      requestedModel: baseModel,
      effectiveModel,
      vendor,
      accountId
    })
  }

  let requestData = buildGeminiRequestFromAnthropic(req.body, effectiveModel, {
    vendor,
    sessionId: sessionHash
  })

  // Antigravity 上游对 function calling 的Habilitar/校验更严格：参考实现普遍使用 VALIDATED。
  // 这里仅在 tools 存在且未显式Deshabilitar（tool_choice=none）时应用，避免破坏原始语义。
  if (
    vendor === 'antigravity' &&
    Array.isArray(requestData?.request?.tools) &&
    requestData.request.tools.length > 0
  ) {
    const existingCfg = requestData?.request?.toolConfig?.functionCallingConfig || null
    const mode = existingCfg?.mode
    if (mode !== 'NONE') {
      const nextCfg = { ...(existingCfg || {}), mode: 'VALIDATED' }
      requestData = {
        ...requestData,
        request: {
          ...requestData.request,
          toolConfig: { functionCallingConfig: nextCfg }
        }
      }
    }
  }

  // Antigravity PredeterminadoHabilitar tools（对齐 CLIProxyAPI）。若上游拒绝 schema，会在下方自动Reintentar去掉 tools/toolConfig。

  const abortController = new AbortController()
  req.on('close', () => {
    if (!abortController.signal.aborted) {
      abortController.abort()
    }
  })

  if (!isStream) {
    try {
      const attemptRequest = async (payload) => {
        if (vendor === 'antigravity') {
          return await geminiAccountService.generateContentAntigravity(
            client,
            payload,
            null,
            projectId,
            upstreamSessionId,
            proxyConfig
          )
        }
        return await geminiAccountService.generateContent(
          client,
          payload,
          null,
          projectId,
          upstreamSessionId,
          proxyConfig
        )
      }

      let rawResponse
      try {
        rawResponse = await attemptRequest(requestData)
      } catch (error) {
        const sanitized = sanitizeUpstreamError(error)
        if (shouldRetryWithoutTools(sanitized) && requestData.request?.tools) {
          logger.warn('⚠️ Tool schema rejected by upstream, retrying without tools', {
            vendor,
            accountId
          })
          rawResponse = await attemptRequest(stripToolsFromRequest(requestData))
        } else if (
          // [429 Cuenta切换] 检测到 Antigravity Cuota耗尽Error时，尝试切换CuentaReintentar
          vendor === 'antigravity' &&
          sanitized.statusCode === 429 &&
          (sanitized.message?.toLowerCase()?.includes('exhausted') ||
            sanitized.upstreamMessage?.toLowerCase()?.includes('exhausted') ||
            sanitized.message?.toLowerCase()?.includes('capacity'))
        ) {
          logger.warn(
            '⚠️ Antigravity 429 quota exhausted (non-stream), switching account and retrying',
            {
              vendor,
              accountId,
              model: effectiveModel
            }
          )
          // Eliminar当前Sesión映射，让调度器选择其他Cuenta
          if (sessionHash) {
            await unifiedGeminiScheduler._deleteSessionMapping(sessionHash)
          }
          // 重新选择Cuenta
          try {
            const newAccountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
              req.apiKey,
              sessionHash,
              effectiveModel,
              { oauthProvider: vendor }
            )
            const newAccountId = newAccountSelection.accountId
            const newClient = await geminiAccountService.getGeminiClient(newAccountId)
            if (!newClient) {
              throw new Error('Failed to get new Gemini client for retry')
            }
            logger.info(
              `🔄 Retrying non-stream with new account: ${newAccountId} (was: ${accountId})`
            )
            // 用新Cuenta的 client Reintentar
            rawResponse =
              vendor === 'antigravity'
                ? await geminiAccountService.generateContentAntigravity(
                    newClient,
                    requestData,
                    null,
                    projectId,
                    upstreamSessionId,
                    proxyConfig
                  )
                : await geminiAccountService.generateContent(
                    newClient,
                    requestData,
                    null,
                    projectId,
                    upstreamSessionId,
                    proxyConfig
                  )
            // Actualizar accountId 以便后续使用Registro
            accountId = newAccountId
          } catch (retryError) {
            logger.error('❌ Failed to retry non-stream with new account:', retryError)
            throw error // 抛出原始Error
          }
        } else {
          throw error
        }
      }

      const payload = rawResponse?.response || rawResponse
      let content = convertGeminiPayloadToAnthropicContent(payload)
      let hasToolUse = content.some((block) => block.type === 'tool_use')

      // Antigravity 某些模型可能不会Retornar functionCall（导致永远没有 tool_use），但会把 “Write: xxx” 以纯文本形式输出。
      // OpcionalRetirada：Analizar该文本并合成标准 tool_use，交给 claude-cli 去Ejecutar。
      if (!hasToolUse && isEnvEnabled(process.env[TEXT_TOOL_FALLBACK_ENV])) {
        const fullText = extractGeminiText(payload)
        const extracted = tryExtractWriteToolFromText(fullText, process.cwd())
        if (extracted?.tool) {
          const toolUseId = buildToolUseId()
          const blocks = []
          if (extracted.prefixText) {
            blocks.push({ type: 'text', text: extracted.prefixText })
          }
          blocks.push({
            type: 'tool_use',
            id: toolUseId,
            name: extracted.tool.name,
            input: extracted.tool.input
          })
          content = blocks
          hasToolUse = true
          logger.warn('⚠️ Synthesized tool_use from plain text Write directive', {
            vendor,
            accountId,
            tool: extracted.tool.name
          })
        }
      }

      const usageMetadata = payload?.usageMetadata || {}
      const inputTokens = usageMetadata.promptTokenCount || 0
      const outputTokens = resolveUsageOutputTokens(usageMetadata)
      const finishReason = payload?.candidates?.[0]?.finishReason

      const stopReason = hasToolUse
        ? 'tool_use'
        : mapGeminiFinishReasonToAnthropicStopReason(finishReason)

      if (req.apiKey?.id && (inputTokens > 0 || outputTokens > 0)) {
        await apiKeyService.recordUsage(
          req.apiKey.id,
          inputTokens,
          outputTokens,
          0,
          0,
          effectiveModel,
          accountId,
          'gemini'
        )
        await applyRateLimitTracking(
          req.rateLimitInfo,
          { inputTokens, outputTokens, cacheCreateTokens: 0, cacheReadTokens: 0 },
          effectiveModel,
          'anthropic-messages',
          req.apiKey?.id
        )
      }

      const responseBody = {
        id: `msg_${crypto.randomBytes(12).toString('hex')}`,
        type: 'message',
        role: 'assistant',
        model: req.body.model || effectiveModel,
        content,
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens
        }
      }

      dumpAnthropicNonStreamResponse(req, 200, responseBody, {
        vendor,
        accountId,
        effectiveModel,
        forcedVendor: vendor
      })

      return res.status(200).json(responseBody)
    } catch (error) {
      const sanitized = sanitizeUpstreamError(error)
      logger.error('Upstream Gemini error (via /v1/messages):', sanitized)
      dumpAnthropicNonStreamResponse(
        req,
        sanitized.statusCode || 502,
        buildAnthropicError(sanitized.upstreamMessage || sanitized.message),
        { vendor, accountId, effectiveModel, forcedVendor: vendor, upstreamError: sanitized }
      )
      return res
        .status(sanitized.statusCode || 502)
        .json(buildAnthropicError(sanitized.upstreamMessage || sanitized.message))
    }
  }

  const messageId = `msg_${crypto.randomBytes(12).toString('hex')}`
  const responseModel = req.body.model || effectiveModel

  try {
    const startStream = async (payload) => {
      if (vendor === 'antigravity') {
        return await geminiAccountService.generateContentStreamAntigravity(
          client,
          payload,
          null,
          projectId,
          upstreamSessionId,
          abortController.signal,
          proxyConfig
        )
      }
      return await geminiAccountService.generateContentStream(
        client,
        payload,
        null,
        projectId,
        upstreamSessionId,
        abortController.signal,
        proxyConfig
      )
    }

    let streamResponse
    try {
      streamResponse = await startStream(requestData)
    } catch (error) {
      const sanitized = sanitizeUpstreamError(error)
      if (shouldRetryWithoutTools(sanitized) && requestData.request?.tools) {
        logger.warn('⚠️ Tool schema rejected by upstream, retrying stream without tools', {
          vendor,
          accountId
        })
        streamResponse = await startStream(stripToolsFromRequest(requestData))
      } else if (
        // [429 Cuenta切换] 检测到 Antigravity Cuota耗尽Error时，尝试切换CuentaReintentar
        vendor === 'antigravity' &&
        sanitized.statusCode === 429 &&
        (sanitized.message?.toLowerCase()?.includes('exhausted') ||
          sanitized.upstreamMessage?.toLowerCase()?.includes('exhausted') ||
          sanitized.message?.toLowerCase()?.includes('capacity'))
      ) {
        logger.warn('⚠️ Antigravity 429 quota exhausted, switching account and retrying', {
          vendor,
          accountId,
          model: effectiveModel
        })
        // Eliminar当前Sesión映射，让调度器选择其他Cuenta
        if (sessionHash) {
          await unifiedGeminiScheduler._deleteSessionMapping(sessionHash)
        }
        // 重新选择Cuenta
        try {
          const newAccountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
            req.apiKey,
            sessionHash,
            effectiveModel,
            { oauthProvider: vendor }
          )
          const newAccountId = newAccountSelection.accountId
          const newClient = await geminiAccountService.getGeminiClient(newAccountId)
          if (!newClient) {
            throw new Error('Failed to get new Gemini client for retry')
          }
          logger.info(`🔄 Retrying with new account: ${newAccountId} (was: ${accountId})`)
          // 用新Cuenta的 client Reintentar
          streamResponse =
            vendor === 'antigravity'
              ? await geminiAccountService.generateContentStreamAntigravity(
                  newClient,
                  requestData,
                  null,
                  projectId,
                  upstreamSessionId,
                  abortController.signal,
                  proxyConfig
                )
              : await geminiAccountService.generateContentStream(
                  newClient,
                  requestData,
                  null,
                  projectId,
                  upstreamSessionId,
                  abortController.signal,
                  proxyConfig
                )
          // Actualizar accountId 以便后续使用Registro
          accountId = newAccountId
        } catch (retryError) {
          logger.error('❌ Failed to retry with new account:', retryError)
          throw error // 抛出原始Error
        }
      } else {
        throw error
      }
    }

    // 仅在上游流Éxito建立后再Iniciando向Cliente发送 SSE。
    // 这样如果上游在握手阶段直接Retornar 4xx/5xx（例如 schema 400 或Cuota 429），
    // 我们可以Retornar真实 HTTP 状态码，而不是先 200 再在 SSE 内发 error Evento。
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    writeAnthropicSseEvent(res, 'message_start', {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        model: responseModel,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }
    })

    const isAntigravityVendor = vendor === 'antigravity'
    const wantsThinkingBlockFirst =
      isAntigravityVendor &&
      requestData?.request?.generationConfig?.thinkingConfig?.include_thoughts === true

    // ========================================================================
    // [大东的 2.0 补丁 - Corrección版] 活跃度看门狗 (Watchdog)
    // ========================================================================
    let activityTimeout = null
    const STREAM_ACTIVITY_TIMEOUT_MS = 90000 // 90秒无Datos视为卡死

    const resetActivityTimeout = () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout)
      }
      activityTimeout = setTimeout(() => {
        if (finished) {
          return
        }

        // 🛑【关键修改】先锁门！防止 abort() 触发的 onError 再次Escribir res
        finished = true

        logger.warn('⚠️ Upstream stream zombie detected (no data for 45s). Forcing termination.', {
          requestId: req.requestId
        })

        if (!abortController.signal.aborted) {
          abortController.abort()
        }

        writeAnthropicSseEvent(res, 'error', {
          type: 'error',
          error: {
            type: 'overloaded_error',
            message: 'Upstream stream timed out (zombie connection). Please try again.'
          }
        })
        res.end()
      }, STREAM_ACTIVITY_TIMEOUT_MS)
    }

    // 🔥【这里！】一定要加这句来启动它！
    resetActivityTimeout()
    // ========================================================================

    let buffer = ''
    let emittedText = ''
    let emittedThinking = ''
    let emittedThoughtSignature = ''
    let finished = false
    let usageMetadata = null
    let finishReason = null
    let emittedAnyToolUse = false
    let sseEventIndex = 0
    const emittedToolCallKeys = new Set()
    const emittedToolUseNames = new Set()
    const pendingToolCallsById = new Map()

    let currentIndex = wantsThinkingBlockFirst ? 0 : -1
    let currentBlockType = wantsThinkingBlockFirst ? 'thinking' : null

    const startTextBlock = (index) => {
      writeAnthropicSseEvent(res, 'content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' }
      })
    }

    const stopCurrentBlock = () => {
      writeAnthropicSseEvent(res, 'content_block_stop', {
        type: 'content_block_stop',
        index: currentIndex
      })
    }

    const startThinkingBlock = (index) => {
      writeAnthropicSseEvent(res, 'content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'thinking', thinking: '' }
      })
    }

    if (wantsThinkingBlockFirst) {
      startThinkingBlock(0)
    }

    const switchBlockType = (nextType) => {
      if (currentBlockType === nextType) {
        return
      }
      if (currentBlockType === 'text' || currentBlockType === 'thinking') {
        stopCurrentBlock()
      }
      currentIndex += 1
      currentBlockType = nextType
      if (nextType === 'text') {
        startTextBlock(currentIndex)
      } else if (nextType === 'thinking') {
        startThinkingBlock(currentIndex)
      }
    }

    const canStartThinkingBlock = (_hasSignature = false) => {
      // Antigravity 特殊Procesar：某些情况下不应启动 thinking block
      if (isAntigravityVendor) {
        // 如果 wantsThinkingBlockFirst 且已发送过工具调用，不应再启动 thinking
        if (wantsThinkingBlockFirst && emittedAnyToolUse) {
          return false
        }
        // [EliminaciónRegla2] Firma可能在后续 chunk 中到达，不应提前阻止 thinking 启动
      }
      if (currentIndex < 0) {
        return true
      }
      if (currentBlockType === 'thinking') {
        return true
      }
      if (emittedThinking || emittedThoughtSignature) {
        return true
      }
      return false
    }

    const emitToolUseBlock = (name, args, id = null) => {
      const toolUseId = typeof id === 'string' && id ? id : buildToolUseId()
      const jsonArgs = stableJsonStringify(args || {})

      if (name) {
        emittedToolUseNames.add(name)
      }
      currentIndex += 1
      const toolIndex = currentIndex

      writeAnthropicSseEvent(res, 'content_block_start', {
        type: 'content_block_start',
        index: toolIndex,
        content_block: { type: 'tool_use', id: toolUseId, name, input: {} }
      })

      writeAnthropicSseEvent(res, 'content_block_delta', {
        type: 'content_block_delta',
        index: toolIndex,
        delta: { type: 'input_json_delta', partial_json: jsonArgs }
      })

      writeAnthropicSseEvent(res, 'content_block_stop', {
        type: 'content_block_stop',
        index: toolIndex
      })
      emittedAnyToolUse = true
      currentBlockType = null
    }

    const resolveFunctionCallArgs = (functionCall) => {
      if (!functionCall || typeof functionCall !== 'object') {
        return { args: null, json: '', canContinue: false }
      }
      const canContinue =
        functionCall.willContinue === true ||
        functionCall.will_continue === true ||
        functionCall.continue === true ||
        functionCall.willContinue === 'true' ||
        functionCall.will_continue === 'true'

      const raw =
        functionCall.args !== undefined
          ? functionCall.args
          : functionCall.partialArgs !== undefined
            ? functionCall.partialArgs
            : functionCall.partial_args !== undefined
              ? functionCall.partial_args
              : functionCall.argsJson !== undefined
                ? functionCall.argsJson
                : functionCall.args_json !== undefined
                  ? functionCall.args_json
                  : ''

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { args: raw, json: '', canContinue }
      }

      const json =
        typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw)
      if (!json) {
        return { args: null, json: '', canContinue }
      }

      try {
        const parsed = JSON.parse(json)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { args: parsed, json: '', canContinue }
        }
      } catch (_) {
        // ignore: treat as partial JSON string
      }

      return { args: null, json, canContinue }
    }

    const flushPendingToolCallById = (id, { force = false } = {}) => {
      const pending = pendingToolCallsById.get(id)
      if (!pending) {
        return
      }
      if (!pending.name) {
        return
      }
      if (!pending.args && pending.argsJson) {
        try {
          const parsed = JSON.parse(pending.argsJson)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            pending.args = parsed
            pending.argsJson = ''
          }
        } catch (_) {
          // keep buffering
        }
      }
      if (!pending.args) {
        if (!force) {
          return
        }
        pending.args = {}
      }

      const toolKey = `id:${id}`
      if (emittedToolCallKeys.has(toolKey)) {
        pendingToolCallsById.delete(id)
        return
      }
      emittedToolCallKeys.add(toolKey)

      if (currentBlockType === 'text' || currentBlockType === 'thinking') {
        stopCurrentBlock()
      }
      currentBlockType = 'tool_use'
      emitToolUseBlock(pending.name, pending.args, id)
      pendingToolCallsById.delete(id)
    }

    const finalize = async () => {
      if (finished) {
        return
      }
      finished = true

      // 若存在未Completado的工具调用（例如 args 分段但上游提前结束），尽力 flush，避免Cliente卡死。
      for (const id of pendingToolCallsById.keys()) {
        flushPendingToolCallById(id, { force: true })
      }

      // 上游可能在没有 finishReason 的情况下静默结束（例如 browser_snapshot 输出过大被截断）。
      // 这种情况下主动向Cliente发送Error，避免长Tiempo挂起。
      if (!finishReason) {
        logger.warn(
          '⚠️ Upstream stream ended without finishReason; sending overloaded_error to client',
          {
            requestId: req.requestId,
            model: effectiveModel,
            hasToolCalls: emittedAnyToolUse
          }
        )

        writeAnthropicSseEvent(res, 'error', {
          type: 'error',
          error: {
            type: 'overloaded_error',
            message:
              'Upstream connection interrupted unexpectedly (missing finish reason). Please retry.'
          }
        })

        // Registro摘要便于排查
        dumpAnthropicStreamSummary(req, {
          vendor,
          accountId,
          effectiveModel,
          responseModel,
          stop_reason: 'error',
          tool_use_names: Array.from(emittedToolUseNames).filter(Boolean),
          text_preview: emittedText ? emittedText.slice(0, 800) : '',
          usage: { input_tokens: 0, output_tokens: 0 }
        })

        if (vendor === 'antigravity') {
          dumpAntigravityStreamSummary({
            requestId: req.requestId,
            model: effectiveModel,
            totalEvents: sseEventIndex,
            finishReason: null,
            hasThinking: Boolean(emittedThinking || emittedThoughtSignature),
            hasToolCalls: emittedAnyToolUse,
            toolCallNames: Array.from(emittedToolUseNames).filter(Boolean),
            usage: { input_tokens: 0, output_tokens: 0 },
            textPreview: emittedText ? emittedText.slice(0, 500) : '',
            error: 'missing_finish_reason'
          }).catch(() => {})
        }

        res.end()
        return
      }

      const inputTokens = usageMetadata?.promptTokenCount || 0
      const outputTokens = resolveUsageOutputTokens(usageMetadata)

      if (currentBlockType === 'text' || currentBlockType === 'thinking') {
        stopCurrentBlock()
      }

      writeAnthropicSseEvent(res, 'message_delta', {
        type: 'message_delta',
        delta: {
          stop_reason: emittedAnyToolUse
            ? 'tool_use'
            : mapGeminiFinishReasonToAnthropicStopReason(finishReason),
          stop_sequence: null
        },
        usage: {
          output_tokens: outputTokens
        }
      })

      writeAnthropicSseEvent(res, 'message_stop', { type: 'message_stop' })
      res.end()

      dumpAnthropicStreamSummary(req, {
        vendor,
        accountId,
        effectiveModel,
        responseModel,
        stop_reason: emittedAnyToolUse
          ? 'tool_use'
          : mapGeminiFinishReasonToAnthropicStopReason(finishReason),
        tool_use_names: Array.from(emittedToolUseNames).filter(Boolean),
        text_preview: emittedText ? emittedText.slice(0, 800) : '',
        usage: { input_tokens: inputTokens, output_tokens: outputTokens }
      })

      // Registro Antigravity 上游流摘要用于Depurar
      if (vendor === 'antigravity') {
        dumpAntigravityStreamSummary({
          requestId: req.requestId,
          model: effectiveModel,
          totalEvents: sseEventIndex,
          finishReason,
          hasThinking: Boolean(emittedThinking || emittedThoughtSignature),
          hasToolCalls: emittedAnyToolUse,
          toolCallNames: Array.from(emittedToolUseNames).filter(Boolean),
          usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          textPreview: emittedText ? emittedText.slice(0, 500) : ''
        }).catch(() => {})
      }

      if (req.apiKey?.id && (inputTokens > 0 || outputTokens > 0)) {
        await apiKeyService.recordUsage(
          req.apiKey.id,
          inputTokens,
          outputTokens,
          0,
          0,
          effectiveModel,
          accountId,
          'gemini'
        )
        await applyRateLimitTracking(
          req.rateLimitInfo,
          { inputTokens, outputTokens, cacheCreateTokens: 0, cacheReadTokens: 0 },
          effectiveModel,
          'anthropic-messages-stream'
        )
      }
    }

    streamResponse.on('data', (chunk) => {
      resetActivityTimeout() // <--- 【Nueva característica】收到Datos了，重置倒计时！

      if (finished) {
        return
      }

      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) {
          continue
        }

        const parsed = parseSSELine(line)
        if (parsed.type === 'control') {
          continue
        }
        if (parsed.type !== 'data' || !parsed.data) {
          continue
        }

        const payload = parsed.data?.response || parsed.data

        // Registro上游 SSE Evento用于Depurar
        if (vendor === 'antigravity') {
          sseEventIndex += 1
          dumpAntigravityStreamEvent({
            requestId: req.requestId,
            eventIndex: sseEventIndex,
            eventType: parsed.type,
            data: payload
          }).catch(() => {})
        }

        const { usageMetadata: currentUsageMetadata, candidates } = payload || {}
        if (currentUsageMetadata) {
          usageMetadata = currentUsageMetadata
        }

        const [candidate] = Array.isArray(candidates) ? candidates : []
        const { finishReason: currentFinishReason } = candidate || {}
        if (currentFinishReason) {
          finishReason = currentFinishReason
        }

        const parts = extractGeminiParts(payload)
        const rawThoughtSignature = extractGeminiThoughtSignature(payload)
        // Antigravity 专用净化：确保FirmaFormato符合 API 要求
        const thoughtSignature = isAntigravityVendor
          ? sanitizeThoughtSignatureForAntigravity(rawThoughtSignature)
          : rawThoughtSignature
        const fullThoughtForToolOrdering = extractGeminiThoughtText(payload)

        if (wantsThinkingBlockFirst) {
          // 关键：确保 thinking/signature 在 tool_use 之前输出，避免出现 tool_use 后紧跟 thinking(signature)
          // 导致下一轮Solicitud的 thinking 校验/工具调用校验Falló（Antigravity 会Retornar 400）。
          if (thoughtSignature && canStartThinkingBlock()) {
            let delta = ''
            if (thoughtSignature.startsWith(emittedThoughtSignature)) {
              delta = thoughtSignature.slice(emittedThoughtSignature.length)
            } else if (thoughtSignature !== emittedThoughtSignature) {
              delta = thoughtSignature
            }
            if (delta) {
              switchBlockType('thinking')
              writeAnthropicSseEvent(res, 'content_block_delta', {
                type: 'content_block_delta',
                index: currentIndex,
                delta: { type: 'signature_delta', signature: delta }
              })
              emittedThoughtSignature = thoughtSignature
            }
          }

          if (fullThoughtForToolOrdering && canStartThinkingBlock()) {
            let delta = ''
            if (fullThoughtForToolOrdering.startsWith(emittedThinking)) {
              delta = fullThoughtForToolOrdering.slice(emittedThinking.length)
            } else {
              delta = fullThoughtForToolOrdering
            }
            if (delta) {
              switchBlockType('thinking')
              emittedThinking = fullThoughtForToolOrdering
              writeAnthropicSseEvent(res, 'content_block_delta', {
                type: 'content_block_delta',
                index: currentIndex,
                delta: { type: 'thinking_delta', thinking: delta }
              })
            }
          }
        }
        for (const part of parts) {
          const functionCall = part?.functionCall
          if (!functionCall?.name) {
            continue
          }

          const id = typeof functionCall.id === 'string' && functionCall.id ? functionCall.id : null
          const { args, json, canContinue } = resolveFunctionCallArgs(functionCall)

          // 若没有 id（无法聚合多段 args），只在拿到可用 args 时才 emit
          if (!id) {
            const finalArgs = args || {}
            const toolKey = `${functionCall.name}:${stableJsonStringify(finalArgs)}`
            if (emittedToolCallKeys.has(toolKey)) {
              continue
            }
            emittedToolCallKeys.add(toolKey)

            if (currentBlockType === 'text' || currentBlockType === 'thinking') {
              stopCurrentBlock()
            }
            currentBlockType = 'tool_use'
            emitToolUseBlock(functionCall.name, finalArgs, null)
            continue
          }

          const pending = pendingToolCallsById.get(id) || {
            id,
            name: functionCall.name,
            args: null,
            argsJson: ''
          }
          pending.name = functionCall.name
          if (args) {
            pending.args = args
            pending.argsJson = ''
          } else if (json) {
            pending.argsJson += json
          }
          pendingToolCallsById.set(id, pending)

          // 能确定“本次已完整”时再 emit；否则继续等待后续 SSE Evento补全 args。
          if (!canContinue) {
            flushPendingToolCallById(id)
          }
        }

        if (thoughtSignature && canStartThinkingBlock(true)) {
          let delta = ''
          if (thoughtSignature.startsWith(emittedThoughtSignature)) {
            delta = thoughtSignature.slice(emittedThoughtSignature.length)
          } else if (thoughtSignature !== emittedThoughtSignature) {
            delta = thoughtSignature
          }
          if (delta) {
            switchBlockType('thinking')
            writeAnthropicSseEvent(res, 'content_block_delta', {
              type: 'content_block_delta',
              index: currentIndex,
              delta: { type: 'signature_delta', signature: delta }
            })
            emittedThoughtSignature = thoughtSignature
          }
        }

        const fullThought = extractGeminiThoughtText(payload)
        if (
          fullThought &&
          canStartThinkingBlock(Boolean(thoughtSignature || emittedThoughtSignature))
        ) {
          let delta = ''
          if (fullThought.startsWith(emittedThinking)) {
            delta = fullThought.slice(emittedThinking.length)
          } else {
            delta = fullThought
          }
          if (delta) {
            switchBlockType('thinking')
            emittedThinking = fullThought
            writeAnthropicSseEvent(res, 'content_block_delta', {
              type: 'content_block_delta',
              index: currentIndex,
              delta: { type: 'thinking_delta', thinking: delta }
            })
            // [FirmaCaché] 当 thinking 内容和Firma都有时，Caché供后续Solicitud使用
            if (isAntigravityVendor && sessionHash && emittedThoughtSignature) {
              signatureCache.cacheSignature(sessionHash, fullThought, emittedThoughtSignature)
            }
          }
        }

        const fullText = extractGeminiText(payload)
        if (fullText) {
          let delta = ''
          if (fullText.startsWith(emittedText)) {
            delta = fullText.slice(emittedText.length)
          } else {
            delta = fullText
          }
          if (delta) {
            switchBlockType('text')
            emittedText = fullText
            writeAnthropicSseEvent(res, 'content_block_delta', {
              type: 'content_block_delta',
              index: currentIndex,
              delta: { type: 'text_delta', text: delta }
            })
          }
        }
      }
    })

    streamResponse.on('end', () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout)
      } // <--- 【Nueva característica】正常结束，取消报警

      finalize().catch((e) => logger.error('Failed to finalize Anthropic SSE response:', e))
    })

    streamResponse.on('error', (error) => {
      if (activityTimeout) {
        clearTimeout(activityTimeout)
      } // <--- 【Nueva característica】报错了，取消报警

      if (finished) {
        return
      }
      const sanitized = sanitizeUpstreamError(error)
      logger.error('Upstream Gemini stream error (via /v1/messages):', sanitized)
      writeAnthropicSseEvent(
        res,
        'error',
        buildAnthropicError(sanitized.upstreamMessage || sanitized.message)
      )
      res.end()
    })

    return undefined
  } catch (error) {
    // ============================================================
    // [大东Corrección 3.0] 彻底防止 JSON Bucle引用导致Servicio崩溃
    // ============================================================

    // 1. 使用 util.inspect Seguridad地将ErrorObjeto转为Cadena，不使用 JSON.stringify
    const safeErrorDetails = util.inspect(error, {
      showHidden: false,
      depth: 2,
      colors: false,
      breakLength: Infinity
    })

    // 2. 打印SeguridadRegistro，绝对不会崩
    logger.error(`❌ [Critical] Failed to start Gemini stream. Error详情:\n${safeErrorDetails}`)

    const sanitized = sanitizeUpstreamError(error)

    // 3. 特殊Procesar Antigravity 的ParámetroError (400)，输出详细SolicitudInformación便于Depurar
    if (
      vendor === 'antigravity' &&
      effectiveModel.includes('claude') &&
      isInvalidAntigravityArgumentError(sanitized)
    ) {
      logger.warn('⚠️ Antigravity Claude invalid argument detected', {
        requestId: req.requestId,
        ...summarizeAntigravityRequestForDebug(requestData),
        statusCode: sanitized.statusCode,
        upstreamType: sanitized.upstreamType,
        upstreamMessage: sanitized.upstreamMessage || sanitized.message
      })
    }

    // 4. 确保Retornar JSON Respuesta给Cliente (让Cliente知道出错了并Reintentar)
    if (!res.headersSent) {
      // Registro非流式RespuestaRegistro
      dumpAnthropicNonStreamResponse(
        req,
        sanitized.statusCode || 502,
        buildAnthropicError(sanitized.upstreamMessage || sanitized.message),
        { vendor, accountId, effectiveModel, forcedVendor: vendor, upstreamError: sanitized }
      )

      return res
        .status(sanitized.statusCode || 502)
        .json(buildAnthropicError(sanitized.upstreamMessage || sanitized.message))
    }

    // 5. 如果头已经发了，走 SSE 发送Error
    writeAnthropicSseEvent(
      res,
      'error',
      buildAnthropicError(sanitized.upstreamMessage || sanitized.message)
    )
    res.end()
    return undefined
  }
}

async function handleAnthropicCountTokensToGemini(req, res, { vendor }) {
  if (!SUPPORTED_VENDORS.has(vendor)) {
    return res.status(400).json(buildAnthropicError(`Unsupported vendor: ${vendor}`))
  }

  const sessionHash = sessionHelper.generateSessionHash(req.body)

  const model = (req.body?.model || '').trim()
  if (!model) {
    return res.status(400).json(buildAnthropicError('Missing model'))
  }

  let accountSelection
  try {
    accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
      req.apiKey,
      sessionHash,
      model,
      { oauthProvider: vendor }
    )
  } catch (error) {
    logger.error('Failed to select Gemini account (count_tokens):', error)
    return res
      .status(503)
      .json(buildAnthropicError(error.message || 'No available Gemini accounts'))
  }

  const { accountId, accountType } = accountSelection
  if (accountType !== 'gemini') {
    return res
      .status(400)
      .json(buildAnthropicError('Only Gemini OAuth accounts are supported for this vendor'))
  }

  const account = await geminiAccountService.getAccount(accountId)
  if (!account) {
    return res.status(503).json(buildAnthropicError('Gemini OAuth account not found'))
  }

  await geminiAccountService.markAccountUsed(account.id)

  let proxyConfig = null
  if (account.proxy) {
    try {
      proxyConfig = typeof account.proxy === 'string' ? JSON.parse(account.proxy) : account.proxy
    } catch (e) {
      logger.warn('Failed to parse proxy configuration:', e)
    }
  }

  const client = await geminiAccountService.getOauthClient(
    account.accessToken,
    account.refreshToken,
    proxyConfig,
    account.oauthProvider
  )

  const normalizedMessages = normalizeAnthropicMessages(req.body.messages || [], { vendor })
  const toolUseIdToName = buildToolUseIdToNameMap(normalizedMessages || [])

  let canEnableThinking = false
  if (vendor === 'antigravity' && req.body?.thinking?.type === 'enabled') {
    const budgetRaw = Number(req.body.thinking.budget_tokens)
    if (Number.isFinite(budgetRaw)) {
      canEnableThinking = canEnableAntigravityThinking(normalizedMessages)
    }
  }

  const contents = convertAnthropicMessagesToGeminiContents(
    normalizedMessages || [],
    toolUseIdToName,
    {
      vendor,
      stripThinking: vendor === 'antigravity' && !canEnableThinking,
      sessionId: sessionHash
    }
  )

  try {
    const countResult =
      vendor === 'antigravity'
        ? await geminiAccountService.countTokensAntigravity(client, contents, model, proxyConfig)
        : await geminiAccountService.countTokens(client, contents, model, proxyConfig)

    const totalTokens = countResult?.totalTokens || 0
    return res.status(200).json({ input_tokens: totalTokens })
  } catch (error) {
    const sanitized = sanitizeUpstreamError(error)
    logger.error('Upstream token count error (via /v1/messages/count_tokens):', sanitized)
    return res
      .status(sanitized.statusCode || 502)
      .json(buildAnthropicError(sanitized.upstreamMessage || sanitized.message))
  }
}

// ============================================================================
// Módulo导出
// ============================================================================

module.exports = {
  // 主入口：Procesar /v1/messages Solicitud
  handleAnthropicMessagesToGemini,
  // 辅助入口：Procesar /v1/messages/count_tokens Solicitud
  handleAnthropicCountTokensToGemini
}
