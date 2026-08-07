import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminSupabase, paypalRequest } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const event = req.body
  const transmissionId = req.headers['paypal-transmission-id']
  const transmissionTime = req.headers['paypal-transmission-time']
  const transmissionSig = req.headers['paypal-transmission-sig']
  const certUrl = req.headers['paypal-cert-url']
  const authAlgo = req.headers['paypal-auth-algo']

  try {
    if (![transmissionId, transmissionTime, transmissionSig, certUrl, authAlgo].every((value) => typeof value === 'string')) {
      return res.status(400).json({ error: 'Missing PayPal signature headers' })
    }
    const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    })
    if (verification.verification_status !== 'SUCCESS') return res.status(400).json({ error: 'Invalid webhook signature' })

    const userId = event.resource?.custom_id ?? event.resource?.purchase_units?.[0]?.custom_id
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        if (userId) {
          await adminSupabase().from('profiles').upsert({ id: userId, is_premium: true, premium_until: null, paypal_subscription_id: event.resource.id }, { onConflict: 'id' })
        }
        break
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED':
        if (userId) await adminSupabase().from('profiles').update({ is_premium: false, premium_until: null }).eq('id', userId)
        break
      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Webhook handler failed' })
  }
}
