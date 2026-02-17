/**
 * OpenAI 到 Claude FormatoConvertirServicio
 * Procesar OpenAI API Formato与 Claude API Formato之间的Convertir
 */

const logger = require('../utils/logger')

class OpenAIToClaudeConverter {
  constructor() {
    // 停止原因映射
    this.stopReasonMapping = {
      end_turn: 'stop',
      max_tokens: 'length',
      stop_sequence: 'stop',
      tool_use: 'tool_calls'
    }
  }

  /**
   * 将 OpenAI SolicitudFormatoConvertir为 Claude Formato
   * @param {Object} openaiRequest - OpenAI Formato的Solicitud
   * @returns {Object} Claude Formato的Solicitud
   */
  convertRequest(openaiRequest) {
    const claudeRequest = {
      model: openaiRequest.model, // 直接使用提供的模型名，不进Fila映射
      messages: this._convertMessages(openaiRequest.messages),
      max_tokens: openaiRequest.max_tokens || 4096,
      temperature: openaiRequest.temperature,
      top_p: openaiRequest.top_p,
      stream: openaiRequest.stream || false
    }

    // 定义 Claude Code 的Predeterminado系统提示词
    const claudeCodeSystemMessage = "You are Claude Code, Anthropic's official CLI for Claude."

    // 如果 OpenAI Solicitud中Incluir系统消息,提取并Verificar
    const systemMessage = this._extractSystemMessage(openaiRequest.messages)
    if (systemMessage && systemMessage.includes('You are currently in Xcode')) {
      // Xcode 系统提示词
      claudeRequest.system = systemMessage
      logger.info(
        `🔍 Xcode request detected, using Xcode system prompt (${systemMessage.length} chars)`
      )
      logger.debug(`📋 System prompt preview: ${systemMessage.substring(0, 150)}...`)
    } else {
      // 使用 Claude Code Predeterminado系统提示词
      claudeRequest.system = claudeCodeSystemMessage
      logger.debug(
        `📋 Using Claude Code default system prompt${systemMessage ? ' (ignored custom prompt)' : ''}`
      )
    }

    // Procesar停止序Columna
    if (openaiRequest.stop) {
      claudeRequest.stop_sequences = Array.isArray(openaiRequest.stop)
        ? openaiRequest.stop
        : [openaiRequest.stop]
    }

    // Procesar工具调用
    if (openaiRequest.tools) {
      claudeRequest.tools = this._convertTools(openaiRequest.tools)
      if (openaiRequest.tool_choice) {
        claudeRequest.tool_choice = this._convertToolChoice(openaiRequest.tool_choice)
      }
    }

    // OpenAI 特有的Parámetro已在Convertir过程中被忽略
    // 包括: n, presence_penalty, frequency_penalty, logit_bias, user

    logger.debug('📝 Converted OpenAI request to Claude format:', {
      model: claudeRequest.model,
      messageCount: claudeRequest.messages.length,
      hasSystem: !!claudeRequest.system,
      stream: claudeRequest.stream
    })

    return claudeRequest
  }

  /**
   * 将 Claude RespuestaFormatoConvertir为 OpenAI Formato
   * @param {Object} claudeResponse - Claude Formato的Respuesta
   * @param {String} requestModel - 原始Solicitud的模型名
   * @returns {Object} OpenAI Formato的Respuesta
   */
  convertResponse(claudeResponse, requestModel) {
    const timestamp = Math.floor(Date.now() / 1000)

    const openaiResponse = {
      id: `chatcmpl-${this._generateId()}`,
      object: 'chat.completion',
      created: timestamp,
      model: requestModel || 'gpt-4',
      choices: [
        {
          index: 0,
          message: this._convertClaudeMessage(claudeResponse),
          finish_reason: this._mapStopReason(claudeResponse.stop_reason)
        }
      ],
      usage: this._convertUsage(claudeResponse.usage)
    }

    logger.debug('📝 Converted Claude response to OpenAI format:', {
      responseId: openaiResponse.id,
      finishReason: openaiResponse.choices[0].finish_reason,
      usage: openaiResponse.usage
    })

    return openaiResponse
  }

  /**
   * Convertir流式Respuesta的单个Datos块
   * @param {String} chunk - Claude SSE Datos块
   * @param {String} requestModel - 原始Solicitud的模型名
   * @param {String} sessionId - SesiónID
   * @returns {String} OpenAI Formato的 SSE Datos块
   */
  convertStreamChunk(chunk, requestModel, sessionId) {
    if (!chunk || chunk.trim() === '') {
      return ''
    }

    // Analizar SSE Datos
    const lines = chunk.split('\n')
    const convertedChunks = []
    let hasMessageStop = false

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6)
        if (data === '[DONE]') {
          convertedChunks.push('data: [DONE]\n\n')
          continue
        }

        try {
          const claudeEvent = JSON.parse(data)

          // Verificar是否是 message_stop Evento
          if (claudeEvent.type === 'message_stop') {
            hasMessageStop = true
          }

          const openaiChunk = this._convertStreamEvent(claudeEvent, requestModel, sessionId)
          if (openaiChunk) {
            convertedChunks.push(`data: ${JSON.stringify(openaiChunk)}\n\n`)
          }
        } catch (e) {
          // 跳过无法Analizar的Datos，不传递非JSONFormato的Fila
          continue
        }
      }
      // 忽略 event: Fila和空Fila，OpenAI Formato不Incluir这些
    }

    // 如果收到 message_stop Evento，添加 [DONE] 标记
    if (hasMessageStop) {
      convertedChunks.push('data: [DONE]\n\n')
    }

    return convertedChunks.join('')
  }

  /**
   * 提取系统消息
   */
  _extractSystemMessage(messages) {
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    if (systemMessages.length === 0) {
      return null
    }

    // 合并所有系统消息
    return systemMessages.map((msg) => msg.content).join('\n\n')
  }

  /**
   * Convertir消息Formato
   */
  _convertMessages(messages) {
    const claudeMessages = []

    for (const msg of messages) {
      // 跳过系统消息（已经在 system CampoProcesar）
      if (msg.role === 'system') {
        continue
      }

      // ConvertirRolNombre
      const role = msg.role === 'user' ? 'user' : 'assistant'

      // Convertir消息内容
      const { content: rawContent } = msg
      let content

      if (typeof rawContent === 'string') {
        content = rawContent
      } else if (Array.isArray(rawContent)) {
        // Procesar多模态内容
        content = this._convertMultimodalContent(rawContent)
      } else {
        content = JSON.stringify(rawContent)
      }

      const claudeMsg = {
        role,
        content
      }

      // Procesar工具调用
      if (msg.tool_calls) {
        claudeMsg.content = this._convertToolCalls(msg.tool_calls)
      }

      // Procesar工具Respuesta
      if (msg.role === 'tool') {
        claudeMsg.role = 'user'
        claudeMsg.content = [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content
          }
        ]
      }

      claudeMessages.push(claudeMsg)
    }

    return claudeMessages
  }

  /**
   * Convertir多模态内容
   */
  _convertMultimodalContent(content) {
    return content.map((item) => {
      if (item.type === 'text') {
        return {
          type: 'text',
          text: item.text
        }
      } else if (item.type === 'image_url') {
        const imageUrl = item.image_url.url

        // Verificar是否是 base64 Formato的图片
        if (imageUrl.startsWith('data:')) {
          // Analizar data URL: data:image/jpeg;base64,/9j/4AAQ...
          const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (matches) {
            const mediaType = matches[1] // e.g., 'image/jpeg', 'image/png'
            const base64Data = matches[2]

            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            }
          } else {
            // 如果Formato不正确，尝试使用PredeterminadoProcesar
            logger.warn('⚠️ Invalid base64 image format, using default parsing')
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageUrl.split(',')[1] || ''
              }
            }
          }
        } else {
          // 如果是 URL Formato的图片，Claude 不Soportar直接 URL，需要报错
          logger.error(
            '❌ URL images are not supported by Claude API, only base64 format is accepted'
          )
          throw new Error(
            'Claude API only supports base64 encoded images, not URLs. Please convert the image to base64 format.'
          )
        }
      }
      return item
    })
  }

  /**
   * Convertir工具定义
   */
  _convertTools(tools) {
    return tools.map((tool) => {
      if (tool.type === 'function') {
        return {
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters
        }
      }
      return tool
    })
  }

  /**
   * Convertir工具选择
   */
  _convertToolChoice(toolChoice) {
    if (toolChoice === 'none') {
      return { type: 'none' }
    }
    if (toolChoice === 'auto') {
      return { type: 'auto' }
    }
    if (toolChoice === 'required') {
      return { type: 'any' }
    }
    if (toolChoice.type === 'function') {
      return {
        type: 'tool',
        name: toolChoice.function.name
      }
    }
    return { type: 'auto' }
  }

  /**
   * Convertir工具调用
   */
  _convertToolCalls(toolCalls) {
    return toolCalls.map((tc) => ({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments)
    }))
  }

  /**
   * Convertir Claude 消息为 OpenAI Formato
   */
  _convertClaudeMessage(claudeResponse) {
    const message = {
      role: 'assistant',
      content: null
    }

    // Procesar内容
    if (claudeResponse.content) {
      if (typeof claudeResponse.content === 'string') {
        message.content = claudeResponse.content
      } else if (Array.isArray(claudeResponse.content)) {
        // 提取文本内容和工具调用
        const textParts = []
        const toolCalls = []

        for (const item of claudeResponse.content) {
          if (item.type === 'text') {
            textParts.push(item.text)
          } else if (item.type === 'tool_use') {
            toolCalls.push({
              id: item.id,
              type: 'function',
              function: {
                name: item.name,
                arguments: JSON.stringify(item.input)
              }
            })
          }
        }

        message.content = textParts.join('') || null
        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls
        }
      }
    }

    return message
  }

  /**
   * Convertir停止原因
   */
  _mapStopReason(claudeReason) {
    return this.stopReasonMapping[claudeReason] || 'stop'
  }

  /**
   * Convertir使用Estadística
   */
  _convertUsage(claudeUsage) {
    if (!claudeUsage) {
      return undefined
    }

    return {
      prompt_tokens: claudeUsage.input_tokens || 0,
      completion_tokens: claudeUsage.output_tokens || 0,
      total_tokens: (claudeUsage.input_tokens || 0) + (claudeUsage.output_tokens || 0)
    }
  }

  /**
   * Convertir流式Evento
   */
  _convertStreamEvent(event, requestModel, sessionId) {
    const timestamp = Math.floor(Date.now() / 1000)
    const baseChunk = {
      id: sessionId,
      object: 'chat.completion.chunk',
      created: timestamp,
      model: requestModel || 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null
        }
      ]
    }

    // 根据EventoTipoProcesar
    if (event.type === 'message_start') {
      // Procesar消息IniciandoEvento，发送RolInformación
      baseChunk.choices[0].delta.role = 'assistant'
      return baseChunk
    } else if (event.type === 'content_block_start' && event.content_block) {
      if (event.content_block.type === 'text') {
        baseChunk.choices[0].delta.content = event.content_block.text || ''
      } else if (event.content_block.type === 'tool_use') {
        // Iniciando工具调用
        baseChunk.choices[0].delta.tool_calls = [
          {
            index: event.index || 0,
            id: event.content_block.id,
            type: 'function',
            function: {
              name: event.content_block.name,
              arguments: ''
            }
          }
        ]
      }
    } else if (event.type === 'content_block_delta' && event.delta) {
      if (event.delta.type === 'text_delta') {
        baseChunk.choices[0].delta.content = event.delta.text || ''
      } else if (event.delta.type === 'input_json_delta') {
        // 工具调用Parámetro的增量Actualizar
        baseChunk.choices[0].delta.tool_calls = [
          {
            index: event.index || 0,
            function: {
              arguments: event.delta.partial_json || ''
            }
          }
        ]
      }
    } else if (event.type === 'message_delta' && event.delta) {
      if (event.delta.stop_reason) {
        baseChunk.choices[0].finish_reason = this._mapStopReason(event.delta.stop_reason)
      }
      if (event.usage) {
        baseChunk.usage = this._convertUsage(event.usage)
      }
    } else if (event.type === 'message_stop') {
      // message_stop Evento不需要Retornar chunk，[DONE] 标记会在 convertStreamChunk 中添加
      return null
    } else {
      // 忽略其他Tipo的Evento
      return null
    }

    return baseChunk
  }

  /**
   * Generar随机 ID
   */
  _generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

module.exports = new OpenAIToClaudeConverter()
