'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { otpCodeSchema } from '@mento/validation'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

function OtpForm() {
  const router = useRouter()
  const params = useSearchParams()
  const phone = params.get('phone') ?? ''
  const role = params.get('role') ?? ''
  const setSession = useAuthStore((s) => s.setSession)

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = otpCodeSchema.safeParse(code)
    if (!parsed.success) {
      setError('Enter the 6-digit code')
      return
    }
    if (!phone) {
      setError('Missing phone number; go back to login')
      return
    }
    setLoading(true)
    try {
      const session = await getApiClient().auth.verifyOtp(phone, parsed.data)
      setSession(session)

      // Route based on onboarding state.
      const state = await getApiClient().onboarding.state().catch(() => null)
      const dest = nextDestination(state, role)
      router.push(dest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  function nextDestination(
    state: Awaited<ReturnType<ReturnType<typeof getApiClient>['onboarding']['state']>> | null,
    rolePick: string,
  ): string {
    // If the user picked MENTOR pre-auth, send to mentor onboarding regardless of API role.
    if (rolePick === 'MENTOR' && (!state || state.role !== 'MENTOR' || !state.mentorOnboardingSubmitted)) {
      return '/onboarding/mentor'
    }
    if (!state || !state.nextStep) return '/dashboard'
    if (state.nextStep === 'mentee.mirror') return '/onboarding/mirror'
    if (state.nextStep === 'mentor.journey') return '/onboarding/mentor'
    if (state.nextStep === 'mentor.credentials') return '/onboarding/mentor#credentials'
    if (state.nextStep === 'mentor.waiting_verification') return '/onboarding/submitted'
    return '/dashboard'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to</p>
        <p className="font-medium">{phone || '(no phone)'}</p>
      </div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="w-full rounded-md border bg-background px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </button>
      <button
        type="button"
        className="block w-full text-center text-xs text-muted-foreground hover:underline"
        onClick={() => router.back()}
      >
        Use a different number
      </button>
    </form>
  )
}

export default function OtpPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OtpForm />
    </Suspense>
  )
}
