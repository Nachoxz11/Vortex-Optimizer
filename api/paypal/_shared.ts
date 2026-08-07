import { createClient } from '@supabase/supabase-js'
import type { VercelResponse } from '@vercel/node'

export const PREMIUM_PRICE = '4.99'
export const PREMIUM_CURRENCY = 'USD'

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export function paypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

export async function paypalAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) throw new Error(`PayPal token request failed: ${response.status}`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('PayPal did not return an access token')
  return data.access_token
}

export async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await paypalAccessToken()
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`PayPal API ${response.status}: ${JSON.stringify(data)}`)
  return data
}

export function adminSupabase() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function authenticatedUser(req: { headers: Record<string, string | string[] | undefined> }) {
  const header = req.headers.authorization
  const token = Array.isArray(header) ? header[0] : header
  if (!token?.startsWith('Bearer ')) throw new Error('Authentication required')
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'))
  const { data, error } = await supabase.auth.getUser(token.slice(7))
  if (error || !data.user) throw new Error('Invalid authentication token')
  return data.user
}

export async function grantPermanentPremium(userId: string, paypalOrderId: string) {
  const { error } = await adminSupabase().from('profiles').upsert({
    id: userId,
    is_premium: true,
    premium_until: null,
    paypal_subscription_id: paypalOrderId,
  }, { onConflict: 'id' })
  if (error) throw new Error(`Supabase premium update failed: ${error.message}`)
}
