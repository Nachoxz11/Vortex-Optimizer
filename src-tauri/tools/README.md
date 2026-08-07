# Herramientas integradas

Esta carpeta contiene las utilidades de terceros que Vortex-Optimizer distribuye dentro del
instalador. Tauri incluye todos sus archivos mediante `tools/**/*`.

## Herramientas incluidas

- `speedtest.exe` — Ookla Speedtest CLI 1.2.0.
- `nvidiaProfileInspector.exe` — NVIDIA Profile Inspector 3.0.2.1.
- `Reference.xml` y `nvidiaProfileInspector.exe.config` — archivos auxiliares de NVIDIA Profile Inspector.

Las versiones y hashes SHA-256 están declarados en `manifest.json`. El script de empaquetado falla
si falta una herramienta marcada como requerida.

## Cómo agregar una herramienta

1. Copiá el ejecutable y sus DLL/XML auxiliares directamente en esta carpeta.
2. Registrá el archivo en `manifest.json` con `id`, `file`, `label`, `version`, `sha256` y `optional`.
3. Usá el nombre del campo `file` desde el código mediante `tools.open`.
4. Ejecutá `npm run package:win`.

La aplicación busca primero la copia empaquetada, luego la copia de desarrollo y finalmente las
ubicaciones del sistema específicas de cada herramienta. Nunca descarga herramientas durante la
ejecución.

## Licencias y fuentes

- NVIDIA Profile Inspector: MIT — https://github.com/Orbmu2k/nvidiaProfileInspector/releases
- Ookla Speedtest CLI: https://www.speedtest.net/apps/cli

Conservá los avisos de licencia y los archivos auxiliares incluidos por cada distribuidor al
publicar el instalador.
