#!/usr/bin/env python3
"""
Fix Spanish translations that broke JavaScript object keys.
This script fixes object keys that were incorrectly translated.
"""

import os
import re
from pathlib import Path

def fix_object_keys_in_file(file_path):
    """Fix translated object keys in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changes_made = 0

        # Fix common mistranslated object keys (Chinese original -> English key)
        fixes = {
            # Object keys that should remain in Chinese or be translated to valid JS keys
            "TokenLímite": "TokenLimit",
            "Límite de concurrencia:": "ConcurrencyLimit:",
            "速率窗口(分钟):": "RateWindow(min):",
            "速率SolicitudLímite:": "RateRequestLimit:",
            "日CostoLímite($):": "DailyCostLimit($):",
            "总CostoLímite($):": "TotalCostLimit($):",
            "周OpusCostoLímite($):": "WeeklyOpusCostLimit($):",
            "允许Modelo:": "AllowedModels:",
            "允许Cliente:": "AllowedClients:",
            "Solicitudes totales": "totalRequests",
            "Token totales": "totalTokens",
            "Costo total": "totalCost",
            "平均费用/次": "avgCost",
            "输入": "inputTokens",
            "输出": "outputTokens",
            "缓存创建": "cacheCreateTokens",
            "缓存读取": "cacheReadTokens",
        }

        for mistranslation, correct in fixes.items():
            if mistranslation in content:
                content = content.replace(mistranslation, correct)
                changes_made += 1

        # Also need to fix values that became broken
        value_fixes = {
            "'无Límite'": "'Sin límite'",
            "? '无Límite'": "? 'Sin límite'",
            ": '无Límite'": ": 'Sin límite'",
            "全部服务": "Todos los servicios",
        }

        for mistranslation, correct in value_fixes.items():
            if mistranslation in content:
                content = content.replace(mistranslation, correct)
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
    """Main function to fix all Vue files."""
    src_dir = Path("/Users/obedvargasvillarreal/claude-relay-service/web/admin-spa/src")

    if not src_dir.exists():
        print(f"Source directory not found: {src_dir}")
        return

    total_changes = 0
    files_processed = 0

    # Find all .vue files
    vue_files = list(src_dir.rglob("*.vue"))

    print(f"Checking {len(vue_files)} Vue files...")

    for vue_file in vue_files:
        changes = fix_object_keys_in_file(vue_file)
        if changes > 0:
            total_changes += changes
            files_processed += 1
            print(f"✓ {vue_file.relative_to(src_dir)}: {changes} fixes")

    print(f"\nFix complete!")
    print(f"Files processed: {files_processed}")
    print(f"Total fixes: {total_changes}")

if __name__ == "__main__":
    main()
