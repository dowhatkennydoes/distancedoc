/**
 * Stripe Client Initialization - Secure Server-Side Only
 * 
 * All Stripe API calls must be made server-side to protect secret keys.
 * Never expose Stripe secret keys to the client.
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

// Initialize Stripe client with latest API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20.acacia',
  typescript: true,
})

/**
 * Helper: Get Stripe customer ID from clinic or user
 */
export async function getStripeCustomerId(clinicId?: string, userId?: string): Promise<string | null> {
  // TODO: Query database to get Stripe customer ID
  // For now, return null (placeholder)
  return null
}

/**
 * Helper: Create Stripe checkout session
 */
export async function createCheckoutSession(
  priceId: string,
  customerId: string,
  metadata?: Record<string, string>
) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`,
    metadata: metadata || {},
  })
}

/**
 * Helper: Format Stripe amount (cents to dollars)
 */
export function formatStripeAmount(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

/**
 * Helper: Format date from Stripe timestamp
 */
export function formatStripeDate(timestamp: number): Date {
  return new Date(timestamp * 1000)
}
