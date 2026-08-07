import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, paypalRequest, PREMIUM_CURRENCY, PREMIUM_PRICE, setCors } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await authenticatedUser(req)
    const order = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `vortex-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: 'vortex-premium-permanent',
          custom_id: user.id,
          description: 'Vortex Optimizer Premium Permanente',
          amount: { currency_code: PREMIUM_CURRENCY, value: PREMIUM_PRICE },
        }],
        application_context: { brand_name: 'Vortex Optimizer', user_action: 'PAY_NOW' },
      }),
    })
    const approvalUrl = order.links?.find((link: { rel?: string }) => link.rel === 'approve')?.href
    return res.status(200).json({ id: order.id, approvalUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create PayPal order'
    return res.status(message.includes('Authentication') ? 401 : 500).json({ error: message })
  }
}
