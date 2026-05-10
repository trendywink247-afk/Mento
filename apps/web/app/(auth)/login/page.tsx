'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { phoneSchema } from '@mento/validation'
import { getApiClient } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('+91')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid phone')
      return
    }
    setLoading(true)
    try {
      const res = await getApiClient().auth.requestOtp(parsed.data)
      if (res.devCode) setDevCode(res.devCode)
      router.push(`/otp?phone=${encodeURIComponent(parsed.data)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <p className="mt-1 text-xs text-muted-foreground">We&apos;ll send a 6-digit code by SMS.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {devCode && <p className="text-xs text-muted-foreground">Dev OTP: {devCode}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send OTP'}
      </button>
    </form>
  )
}
