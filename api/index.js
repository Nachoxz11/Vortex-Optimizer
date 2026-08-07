module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, message: 'Vortex-Optimizer update endpoint ready' })
}
