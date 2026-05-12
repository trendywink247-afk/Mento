'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { OtpInput } from '@/components/OtpInput'
import { identify } from '@/lib/analytics'
import { MotionTap } from '@/components/motion'

const RESEND_SECONDS = 30

function maskPhone(phone: string): string {
  // +919876543210 → +91 98765 ••••••
  if (phone.startsWith('+91') && phone.length === 13) {
    return `+91 ${phone.slice(3, 8)} ••••••`
  }
  return phone
}

function OtpForm() {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('auth.otp')
  const te = useTranslations('auth.errors')
  const phone = params.get('phone') ?? ''
  const role = params.get('role') ?? ''
  const setSession = useAuthStore((s) => s.setSession)

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearKey, setClearKey] = useState(0)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const [resending, setResending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCountdown()
    return () => stopCountdown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startCountdown() {
    stopCountdown()
    setCountdown(RESEND_SECONDS)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopCountdown()
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  function stopCountdown() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function nextDestination(
    state: Awaited<ReturnType<ReturnType<typeof getApiClient>['onboarding']['state']>> | null,
    rolePick: string,
  ): string {
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

  const handleVerify = useCallback(async (codeValue: string) => {
    if (codeValue.length !== 6 || submitting) return
    if (!phone) {
      setError(te('missingPhone'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const session = await getApiClient().auth.verifyOtp(phone, codeValue)
      setSession(session)
      // Identify in PostHog and Sentry — UUID only, no PII.
      identify(session.user.id, { role: session.user.role })
      Sentry.setUser({ id: session.user.id })
      const state = await getApiClient().onboarding.state().catch(() => null)
      router.push(nextDestination(state, role))
    } catch {
      setError(te('otpWrongCode'))
      setCode('')
      setClearKey((k) => k + 1)
    } finally {
      setSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, role, submitting, te])

  // Web OTP API — feature-detected, no crash on Safari/Firefox
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('OTPCredential' in window)) return
    const controller = new AbortController()
    ;(async () => {
      try {
        const otp = await (navigator.credentials as unknown as {
          get(opts: { otp: { transport: string[] }; signal: AbortSignal }): Promise<{ code: string } | null>
        }).get({ otp: { transport: ['sms'] }, signal: controller.signal })
        if (otp?.code) {
          const digits = otp.code.replace(/\D/g, '').slice(0, 6)
          setCode(digits)
          if (digits.length === 6) {
            await handleVerify(digits)
          }
        }
      } catch {
        // Dismissed or unsupported — silently ignore
      }
    })()
    return () => controller.abort()
  }, [handleVerify])

  async function handleResend() {
    if (!phone || resending || countdown > 0) return
    setResending(true)
    setError(null)
    try {
      await getApiClient().auth.requestOtp(phone)
      startCountdown()
      setCode('')
      setClearKey((k) => k + 1)
    } catch {
      setError(te('otpResendFailed'))
    } finally {
      setResending(false)
    }
  }

  function handleEditPhone() {
    router.push(`/login?phone=${encodeURIComponent(phone)}`)
  }

  return (
    <div className="space-y-6">
      {/* Phone display with edit affordance */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">{t('codeSentTo')}</p>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{maskPhone(phone) || '(no phone)'}</span>
          <button
            type="button"
            onClick={handleEditPhone}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            aria-label={t('editPhoneLabel')}
          >
            <PencilIcon />
            {t('editPhone')}
          </button>
        </div>
      </div>

      {/* 6-cell OTP input */}
      <div>
        <OtpInput
          key={clearKey}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={submitting}
          hasError={!!error}
        />
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {submitting && (
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <SpinnerIcon />
            {t('verifying')}
          </p>
        )}
      </div>

      {/* Submit button (fallback) */}
      <MotionTap disabled={submitting || code.length !== 6}>
        <button
          type="button"
          onClick={() => handleVerify(code)}
          disabled={submitting || code.length !== 6}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('verifying') : t('verifyAndSignIn')}
        </button>
      </MotionTap>

      {/* Resend countdown */}
      <div className="text-center">
        {countdown > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('resendIn', { seconds: countdown })}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
          >
            {resending ? t('resending') : t('resendOtp')}
          </button>
        )}
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

export default function OtpPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OtpForm />
    </Suspense>
  )
}
