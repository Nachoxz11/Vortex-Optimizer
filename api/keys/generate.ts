import { createHash, randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminSupabase, authenticatedUser, setCors } from '../paypal/_shared'

const OWNER_EMAIL = 'ig.devgo@gmail.com'
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function hashKey(value: string) {
  return createHash('sha256').update(value.trim().toUpperCase()).digest('hex')
}

function randomPart(length = 4) {
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => KEY_ALPHABET[byte % KEY_ALPHABET.length]).join('')
}

function createKey() {
  return `VX-${randomPart()}-${randomPart()}-${randomPart()}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await authenticatedUser({
      headers: req.headers as Record<string, string | string[] | undefined>,
    })
    if (user.email?.trim().toLowerCase() !== OWNER_EMAIL) {
      return res.status(403).json({ error: 'Solo el owner puede generar keys.' })
    }

    const count = Number.isInteger(req.body?.count) ? Number(req.body.count) : 1
    const durationDays = req.body?.durationDays == null || req.body.durationDays === ''
      ? null
      : Number(req.body.durationDays)
    if (count < 1 || count > 100) return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 100.' })
    if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650)) {
      return res.status(400).json({ error: 'La duración debe estar entre 1 y 3650 días, o quedar vacía para una key permanente.' })
    }

    const keys = Array.from({ length: count }, createKey)
    const db = adminSupabase()
    const { error } = await db.from('premium_keys').insert(keys.map((key) => ({
      key_hash: hashKey(key),
      duration_days: durationDays,
    })))
    if (error) throw new Error(error.message)

    return res.status(200).json({ ok: true, keys, durationDays })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron generar las keys.'
    const status = message === 'Authentication required' || message === 'Invalid authentication token' ? 401 : 500
    return res.status(status).json({ error: message })
  }
}
