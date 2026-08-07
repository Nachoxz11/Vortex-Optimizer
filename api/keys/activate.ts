import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminSupabase, authenticatedUser, setCors } from '../paypal/_shared'

function hashKey(value: string) {
  return createHash('sha256').update(value.trim().toUpperCase()).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await authenticatedUser({
      headers: req.headers as Record<string, string | string[] | undefined>,
    })
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : ''
    if (!key || key.length < 8 || key.length > 128) {
      return res.status(400).json({ error: 'La key no es válida.' })
    }

    const db = adminSupabase()
    const { data: license, error: lookupError } = await db
      .from('premium_keys')
      .select('id, duration_days, redeemed_by')
      .eq('key_hash', hashKey(key))
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)
    if (!license) return res.status(404).json({ error: 'Key inválida.' })
    if (license.redeemed_by && license.redeemed_by !== user.id) {
      return res.status(409).json({ error: 'Esta key ya fue utilizada.' })
    }

    if (!license.redeemed_by) {
      const { data: redeemed, error: redeemError } = await db
        .from('premium_keys')
        .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
        .eq('id', license.id)
        .is('redeemed_by', null)
        .select('id')
        .maybeSingle()

      if (redeemError) throw new Error(redeemError.message)
      if (!redeemed) return res.status(409).json({ error: 'Esta key ya fue utilizada.' })
    }

    const premiumUntil = license.duration_days
      ? new Date(Date.now() + license.duration_days * 86_400_000).toISOString()
      : null
    const { error: profileError } = await db.from('profiles').upsert({
      id: user.id,
      is_premium: true,
      premium_until: premiumUntil,
      paypal_subscription_id: null,
    }, { onConflict: 'id' })
    if (profileError) throw new Error(profileError.message)

    return res.status(200).json({ ok: true, premiumUntil })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo activar la key.'
    const status = message === 'Authentication required' || message === 'Invalid authentication token' ? 401 : 500
    return res.status(status).json({ error: message })
  }
}
