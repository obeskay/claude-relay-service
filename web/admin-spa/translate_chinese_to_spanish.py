#!/usr/bin/env python3
"""
Translate Chinese text to Spanish in Vue files.
This script performs bulk replacements of common Chinese UI strings.
"""

import os
import re
from pathlib import Path

# Translation dictionary for common Chinese to Spanish strings
TRANSLATIONS = {
    # Common UI terms
    "加载中": "Cargando",
    "加载中...": "Cargando...",
    "暂无数据": "Sin datos por ahora",
    "暂无": "Sin",
    "暂无标签": "Sin etiquetas",
    "暂无记录": "Sin registros",
    "未知": "Desconocido",
    "未知账户": "Cuenta desconocida",
    "未知错误": "Error desconocido",
    "未知Plataforma": "Plataforma desconocida",
    "详情": "Detalles",
    "详情信息": "Información detallada",
    "确定": "Confirmar",
    "取消": "Cancelar",
    "关闭": "Cerrar",
    "保存": "Guardar",
    "删除": "Eliminar",
    "编辑": "Editar",
    "新增": "Agregar",
    "创建": "Crear",
    "更新": "Actualizar",
    "提交": "Enviar",
    "重置": "Restablecer",
    "搜索": "Buscar",
    "筛选": "Filtrar",
    "排序": "Ordenar",
    "导出": "Exportar",
    "导入": "Importar",
    "刷新": "Actualizar",
    "下载": "Descargar",
    "上传": "Subir",
    "复制": "Copiar",
    "粘贴": "Pegar",
    "查看": "Ver",
    "预览": "Vista previa",
    "确认": "Confirmar",
    "确认删除": "Confirmar eliminación",

    # Status messages
    "成功": "Exitoso",
    "失败": "Fallido",
    "创建成功": "Creado exitosamente",
    "创建失败": "Error al crear",
    "保存成功": "Guardado exitosamente",
    "保存失败": "Error al guardar",
    "删除成功": "Eliminado exitosamente",
    "删除失败": "Error al eliminar",
    "更新成功": "Actualizado exitosamente",
    "更新失败": "Error al actualizar",
    "操作成功": "Operación exitosa",
    "操作失败": "Operación fallida",

    # Time and dates
    "今日": "Hoy",
    "本月": "Este mes",
    "所有时间": "Todos los tiempos",
    "开始时间": "Hora de inicio",
    "结束时间": "Hora de finalización",
    "开始日期": "Fecha inicial",
    "结束日期": "Fecha final",
    "时间范围": "Rango de tiempo",
    "日期范围": "Rango de fechas",
    "选择时间范围": "Seleccionar rango de tiempo",
    "选择日期范围": "Seleccionar rango de fechas",

    # Numbers and quantities
    "总计": "Total",
    "总费用": "Costo total",
    "总请求数": "Solicitudes totales",
    "总 Tokens": "Tokens totales",
    "平均": "Promedio",
    "平均费用": "Costo promedio",
    "平均费用/次": "Costo promedio/solicitud",
    "费用": "Costo",
    "费用：": "Costo：",
    "计费": "Facturación",
    "计费费用": "Costo facturado",

    # Account and user management
    "账户": "Cuenta",
    "账户管理": "Gestión de cuentas",
    "用户": "Usuario",
    "用户管理": "Gestión de usuarios",
    "管理员": "Administrador",
    "登录": "Iniciar sesión",
    "登出": "Cerrar sesión",
    "注册": "Registrarse",
    "密码": "Contraseña",
    "用户名": "Nombre de usuario",
    "邮箱": "Correo electrónico",
    "手机": "Teléfono",

    # API Keys
    "API Keys": "API Keys",
    "API Key": "API Key",
    "API Keys 管理": "Gestión de API Keys",
    "API Keys 概况": "Resumen de API Keys",
    "密钥": "Clave",
    "令牌": "Token",
    "访问密钥": "Clave de acceso",
    "活跃 Keys": "Keys activas",
    "已删除 Keys": "Keys eliminadas",
    "总计 Keys": "Total de Keys",
    "激活 Keys": "Keys activas",

    # Limits and restrictions
    "限制": "Límite",
    "限制配置": "Configuración de límites",
    "限制配置（聚合查询模式）": "Configuración de límites (modo de consulta agregada)",
    "并发限制": "Límite de concurrencia",
    "模型限制": "Límite de modelos",
    "客户端限制": "Límite de clientes",
    "每日费用限制": "Límite de costo diario",
    "总费用限制": "Límite de costo total",
    "时间窗口限制": "Límite de ventana de tiempo",
    "限制 ": "Límite ",
    "受限模型列表": "Lista de modelos restringidos",
    "允许所有模型": "Todos los modelos permitidos",
    "允许所有客户端": "Todos los clientes permitidos",

    # Models and tokens
    "模型": "Modelo",
    "所有模型": "Todos los modelos",
    "模型名称": "Nombre del modelo",
    "模型使用": "Uso del modelo",
    "模型使用统计": "Estadísticas de uso del modelo",
    "输入": "Entrada",
    "输出": "Salida",
    "Token": "Token",
    "Tokens": "Tokens",
    "Token totales": "Tokens totales",
    "缓存": "Caché",
    "缓存创建": "Caché creación",
    "缓存读取": "Caché lectura",
    "缓存创建:": "Caché creac:",
    "缓存读取:": "Caché lect:",
    "缓存创/读": "Caché creac/lect",
    "官方API": "API oficial",

    # Tabs and navigation
    "仪表板": "Panel",
    "系统设置": "Configuración",
    "额度卡": "Tarjetas de cupo",
    "设置": "Configuración",

    # Statistics and analytics
    "统计": "Estadísticas",
    "统计数据": "Datos estadísticos",
    "统计摘要": "Resumen estadístico",
    "聚合统计": "Estadísticas agregadas",
    "聚合统计摘要": "Resumen de estadísticas agregadas",
    "使用占比": "Uso por clave",
    "使用占比仅在多Key查询时显示": "El uso por clave solo se muestra en consultas de múltiples claves",
    "请求": "Solicitud",
    "请求次数": "Número de solicitudes",
    "次": "veces",
    "条记录": "registros",
    "条": "registros",
    "个": " ",  # Usually a counter word, replace with space
    " 种": " tipos de ",

    # Costs and pricing
    "价格": "Precio",
    "定价": "Precios",
    "成本": "Costo",
    "费用统计": "Estadísticas de costos",
    "服务费用统计": "Estadísticas de costos de servicio",
    "输入:": "Entrada:",
    "输出:": "Salida:",

    # Operations
    "操作": "Operación",
    "操作成功": "Operación exitosa",
    "操作失败": "Operación fallida",
    "批量操作": "Operación por lotes",
    "批量编辑": "Edición por lotes",
    "批量删除": "Eliminación por lotes",

    # Tags and labels
    "标签": "Etiqueta",
    "标签管理": "Gestión de etiquetas",
    "标签创建成功": "Etiqueta creada exitosamente",
    "标签已删除": "Etiqueta eliminada",
    "标签已重命名": "Etiqueta renombrada",
    "重命名": "Renombrar",
    "重命名标签": "Renombrar etiqueta",
    "新名称": "Nuevo nombre",
    "管理标签": "Gestionar etiquetas",
    "个 Key": " claves",

    # Messages and notifications
    "此操作将从": "Esta acción eliminará la etiqueta de",
    "个 API Key 中移除该标签，不可恢复。": " API Keys y no se puede deshacer.",
    "此 API Key 不能访问以上列出的模型": "Esta API Key no puede acceder a los modelos listados arriba",
    "请输入": "Ingrese",
    "输入新标签名称": "Ingrese nombre de nueva etiqueta",
    "请输入新标签名称": "Ingrese el nuevo nombre de la etiqueta",
    "没有可导出的记录": "No hay registros para exportar",
    "加载请求记录失败：": "Error al cargar registros：",
    "请求次数和费用限制为\"或\"的关系，任一达到限制即触发限流": "Las solicitudes y el límite de costo son una relación \"O\", se activa el limitante cuando se alcance cualquiera de los dos",
    "请求次数和Token使用量为\"或\"的关系，任一达到限制即触发限流": "Las solicitudes y el uso de tokens son una relación \"O\", se activa el limitante cuando se alcance cualquiera de los dos",
    " 仅限制请求次数 ": " Solo limitar solicitudes ",
    "每个 API Key 有独立的限制设置，聚合模式下不显示单个限制配置": "Cada API Key tiene su propia configuración de límites, en modo agregado no se muestra la configuración individual",

    # Other common terms
    "备注": "Nota",
    "描述": "Descripción",
    "名称": "Nombre",
    "类型": "Tipo",
    "状态": "Estado",
    "启用": "Habilitar",
    "禁用": "Deshabilitar",
    "启用中": "Habilitado",
    "禁用中": "Deshabilitado",
    "有效": "Válido",
    "无效": "Inválido",
    " 个无效的 API Key": " API Keys inválidas",
    "详细限制信息": "Información detallada de límites",
    "其他": "Otro",
    "其他 ": "Otras ",
    " 个Keys": " claves",
    "限制 ": "Limitar ",

    # Tutorial and help
    "教程": "Tutorial",
    "帮助": "Ayuda",
    "文档": "Documentación",
    "说明": "Instrucciones",
    "提示": "Sugerencia",
    "注意": "Nota",
    "警告": "Advertencia",
    "错误": "Error",
    "信息": "Información",

    # Colors and themes
    "主题": "Tema",
    "明亮": "Claro",
    "暗黑": "Oscuro",
    "跟随系统": "Seguir sistema",

    # Specific to your app
    "Claude 模型周费用限制": "Límite de costo semanal de modelos Claude",
    "计费 = 官方费用 × 全局倍率 × Key倍率": "Facturación = Costo oficial × Tasa global × Tasa de Key",
    "全局": "Global",
    "全局 ": "Global ",
    "官方API": "API oficial",
    "服务费用统计": "Estadísticas de costos de servicio",
    "Token 详情": "Detalles de Token",
    "费用 ": "Costo ",
    "价格参考": "Referencia de precios",

    # Platform names
    "平台": "Plataforma",
    "平台：": "Plataforma：",
    "Plataforma": "Plataforma",

    # More generic terms
    "至": "a",
    "或": "o",
    "和": "y",
    "的": "",  # Possessive particle, often can be removed
    "了": "",  # Past tense marker
    "在": "en",
    "从": "de",
    "用于": "para",
    "为": "para",
    "中": "en",
    "上": "arriba",
    "下": "abajo",
    "左": "izquierda",
    "右": "derecha",
    "前": "anterior",
    "后": "siguiente",
    "第一个": "primero",
    "最后一个": "último",
    "下一个": "siguiente",
    "上一个": "anterior",
}

def translate_file(file_path):
    """Translate Chinese text in a file to Spanish."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changes_made = 0

        # Apply translations in order of longest keys first (to avoid partial replacements)
        for chinese, spanish in sorted(TRANSLATIONS.items(), key=lambda x: len(x[0]), reverse=True):
            if chinese in content:
                content = content.replace(chinese, spanish)
                changes_made += 1

        # Only write if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes_made

        return 0
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0

def main():
    """Main function to translate all Vue files."""
    src_dir = Path("/Users/obedvargasvillarreal/claude-relay-service/web/admin-spa/src")

    if not src_dir.exists():
        print(f"Source directory not found: {src_dir}")
        return

    total_changes = 0
    files_processed = 0

    # Find all .vue files
    vue_files = list(src_dir.rglob("*.vue"))

    print(f"Found {len(vue_files)} Vue files to process...")

    for vue_file in vue_files:
        changes = translate_file(vue_file)
        if changes > 0:
            total_changes += changes
            files_processed += 1
            print(f"✓ {vue_file.relative_to(src_dir)}: {changes} replacements")

    print(f"\nTranslation complete!")
    print(f"Files processed: {files_processed}")
    print(f"Total replacements: {total_changes}")

if __name__ == "__main__":
    main()
