import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packagePath = resolve(root, 'package.json')
const packageLockPath = resolve(root, 'package-lock.json')
const tauriPath = resolve(root, 'src-tauri', 'tauri.conf.json')
const cargoPath = resolve(root, 'src-tauri', 'Cargo.toml')
const cargoLockPath = resolve(root, 'src-tauri', 'Cargo.lock')
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version

const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'))
packageLock.version = version
packageLock.packages[''].version = version
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`)

const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'))
tauri.version = version
writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`)

const cargo = readFileSync(cargoPath, 'utf8').replace(/(\[package\][\s\S]*?version = ")([^"]+)(")/, `$1${version}$3`)
writeFileSync(cargoPath, cargo)

const cargoLock = readFileSync(cargoLockPath, 'utf8').replace(/(name = "xtweaks"\r?\nversion = ")([^"]+)(")/, `$1${version}$3`)
writeFileSync(cargoLockPath, cargoLock)

console.log(`Synchronized application version to ${version}`)
