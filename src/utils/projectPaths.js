const path = require('path')

// 该Archivo位于 src/utils 下，向上两级即项目根Directorio。
function getProjectRoot() {
  return path.resolve(__dirname, '..', '..')
}

module.exports = {
  getProjectRoot
}
