import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const toolsDir = resolve('src-tauri', 'tools')
const manifestPath = resolve(toolsDir, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (!Array.isArray(manifest.tools)) throw new Error('tools/manifest.json debe contener un array tools')

for (const tool of manifest.tools) {
  if (!tool.id || !tool.file || !tool.label) throw new Error('Cada herramienta debe tener id, file y label')
  if (tool.file.includes('/') || tool.file.includes('\\')) throw new Error(`Nombre de herramienta inválido: ${tool.file}`)
  const path = resolve(toolsDir, tool.file)
  if (!existsSync(path)) {
    if (tool.optional) console.warn(`[tools] Opcional ausente: ${tool.file}`)
    else throw new Error(`[tools] Falta la herramienta requerida: ${tool.file}`)
  } else {
    console.log(`[tools] Incluida: ${tool.file}`)
  }
}
