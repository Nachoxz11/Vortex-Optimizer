import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    version,
    url: `https://github.com/Nachoxz11/Vortex-Optimizer/releases/download/v${version}/Vortex-Optimizer-${version}-setup.exe`,
    notes: 'Activación Premium por keys e inicio automático con Windows.',
  })
}
