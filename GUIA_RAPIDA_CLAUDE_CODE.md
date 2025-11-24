# 🚀 Guía Rápida - Claude Code (Todos los Sistemas)

## 📋 Datos de Conexión

```
URL: http://5.78.116.125:3011/api
API Key: cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71
```

---

## 🪟 Windows (PowerShell)

### 1. Instalar Node.js

Descargar de https://nodejs.org/ (versión LTS)

### 2. Instalar Claude Code

```powershell
npm install -g @anthropic-ai/claude-code
```

### 3. Configurar (Permanente)

```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://5.78.116.125:3011/api", [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71", [System.EnvironmentVariableTarget]::User)
```

⚠️ **Cerrar y reabrir PowerShell después de configurar**

### 4. Usar

```powershell
claude
```

---

## 🍎 macOS

### 1. Instalar Node.js

```bash
brew install node
```

O descargar de https://nodejs.org/

### 2. Instalar Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 3. Configurar (Permanente)

```bash
# Para zsh (por defecto)
echo 'export ANTHROPIC_BASE_URL="http://5.78.116.125:3011/api"' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN="cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"' >> ~/.zshrc
source ~/.zshrc

# Para bash
echo 'export ANTHROPIC_BASE_URL="http://5.78.116.125:3011/api"' >> ~/.bash_profile
echo 'export ANTHROPIC_AUTH_TOKEN="cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"' >> ~/.bash_profile
source ~/.bash_profile
```

### 4. Usar

```bash
claude
```

---

## 🐧 Linux

### 1. Instalar Node.js

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install -y nodejs npm
```

**Fedora:**

```bash
sudo dnf install -y nodejs npm
```

**Arch:**

```bash
sudo pacman -S nodejs npm
```

### 2. Instalar Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 3. Configurar (Permanente)

```bash
# Para bash (más común)
cat >> ~/.bashrc << 'EOF'
export ANTHROPIC_BASE_URL="http://5.78.116.125:3011/api"
export ANTHROPIC_AUTH_TOKEN="cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"
EOF
source ~/.bashrc

# Para zsh
cat >> ~/.zshrc << 'EOF'
export ANTHROPIC_BASE_URL="http://5.78.116.125:3011/api"
export ANTHROPIC_AUTH_TOKEN="cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"
EOF
source ~/.zshrc
```

### 4. Usar

```bash
claude
```

---

## ✅ Verificar Configuración

**Windows (PowerShell):**

```powershell
echo $env:ANTHROPIC_BASE_URL
echo $env:ANTHROPIC_AUTH_TOKEN
```

**macOS/Linux:**

```bash
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_AUTH_TOKEN
```

**Salida esperada:**

```
http://5.78.116.125:3011/api
cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71
```

---

## 🔧 Configuración Temporal (Para probar)

**Windows:**

```powershell
$env:ANTHROPIC_BASE_URL = "http://5.78.116.125:3011/api"
$env:ANTHROPIC_AUTH_TOKEN = "cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"
claude
```

**macOS/Linux:**

```bash
export ANTHROPIC_BASE_URL="http://5.78.116.125:3011/api"
export ANTHROPIC_AUTH_TOKEN="cr_26dc109486a25c864b2776edabc7c2a465cc1779cae1f5d6963ff53946000b71"
claude
```

---

## 🆘 Solución Rápida de Problemas

| Problema                           | Solución                                               |
| ---------------------------------- | ------------------------------------------------------ |
| `claude: command not found`        | Reinstalar: `npm install -g @anthropic-ai/claude-code` |
| Variables no funcionan (Windows)   | Cerrar y reabrir PowerShell completamente              |
| Variables no funcionan (Mac/Linux) | Ejecutar `source ~/.bashrc` o `source ~/.zshrc`        |
| Error de permisos                  | Usar `sudo` en el comando de instalación               |
| No conecta al servicio             | Verificar: `curl http://5.78.116.125:3011/health`      |

---

## 📊 Monitoreo

Ver estadísticas en: http://5.78.116.125:3011/admin-next/api-stats

---

## 🔒 Seguridad

⚠️ **NO compartas esta API Key fuera del equipo**

Si crees que la API Key está comprometida, contacta a Obed.

---

**¿Necesitas ayuda?** Contacta a Obed.
