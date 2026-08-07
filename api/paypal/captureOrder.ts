import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, grantPermanentPremium, paypalRequest, PREMIUM_CURRENCY, PREMIUM_PRICE, setCors } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderID } = req.body

  if (!orderID || typeof orderID !== 'string') {
    return res.status(400).json({ error: 'Missing orderID' })
  }

  try {
    const user = await authenticatedUser(req)
    const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `vortex-capture-${orderID}` },
      body: '{}',
    })
    const unit = order.purchase_units?.[0]
    const captured = unit?.payments?.captures?.[0]
    const amount = captured?.amount
    if (order.status !== 'COMPLETED' || unit?.custom_id !== user.id || amount?.currency_code !== PREMIUM_CURRENCY || amount?.value !== PREMIUM_PRICE) {
      return res.status(400).json({ error: 'Payment verification failed' })
    }
    await grantPermanentPremium(user.id, orderID)
    return res.status(200).json({ status: 'COMPLETED', orderID })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to capture PayPal order'
    return res.status(message.includes('Authentication') ? 401 : 500).json({ error: message })
  }
}
