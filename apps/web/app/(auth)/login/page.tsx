'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { identify } from '@/lib/analytics'
import { MotionTap } from '@/components/motion'

// Augment window to allow Google Identity Services global
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }): void
          renderButton(
            element: HTMLElement,
            config: {
              type?: string
              theme?: string
              size?: string
              width?: number | string
              text?: string
              shape?: string
            },
          ): void
          prompt(): void
        }
      }
    }
  }
}

// 10-digit India mobile number validation (client-side, user-facing)
function validateIndianPhone(digits: string, t: ReturnType<typeof useTranslations<'auth.errors'>>): string | null {
  if (digits.length === 0) return t('phoneEmpty')
  if (digits.length < 10) return t('phoneTooShort')
  if (digits.length > 10) return t('phoneTooLong')
  if (!/^[6-9]\d{9}$/.test(digits)) return t('phoneInvalidStart')
  return null
}

/** Mirror the nextDestination logic from /otp/page.tsx */
function nextDestination(
  state: Awaited<ReturnType<ReturnType<typeof getApiClient>['onboarding']['state']>> | null,
): string {
  if (!state || !state.nextStep) return '/dashboard'
  if (state.nextStep === 'mentee.mirror') return '/onboarding/mirror'
  if (state.nextStep === 'mentor.journey') return '/onboarding/mentor'
  if (state.nextStep === 'mentor.credentials') return '/onboarding/mentor#credentials'
  if (state.nextStep === 'mentor.waiting_verification') return '/onboarding/submitted'
  return '/dashboard'
}

// ─────────────────────────────────────────────
// Google Sign-in button component
// ─────────────────────────────────────────────

type GoogleSigninState = 'idle' | 'loading' | 'error'
type GoogleError = 'failed' | 'unverified' | 'suspended' | null

interface GoogleSigninButtonProps {
  onSuccess: () => void
}

function GoogleSigninButton({ onSuccess }: GoogleSigninButtonProps) {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  const gsiRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<GoogleSigninState>('idle')
  const [googleError, setGoogleError] = useState<GoogleError>(null)
  const [gsiReady, setGsiReady] = useState(false)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredential = useCallback(
    async (credential: string) => {
      setState('loading')
      setGoogleError(null)
      try {
        const session = await getApiClient().auth.googleSignin(credential)
        setSession(session)
        identify(session.user.id, { role: session.user.role })
        const onboardingState = await getApiClient().onboarding.state().catch(() => null)
        onSuccess()
        router.push(nextDestination(onboardingState))
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : ''
        if (msg.includes('not verified') || msg.includes('email_verified')) {
          setGoogleError('unverified')
        } else if (msg.includes('suspended')) {
          setGoogleError('suspended')
        } else {
          setGoogleError('failed')
        }
        setState('error')
      }
    },
    [router, setSession, onSuccess],
  )

  // Initialize GSI once the script loads and ref is ready
  const initGsi = useCallback(() => {
    if (!window.google || !gsiRef.current || !clientId) return
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        handleCredential(response.credential)
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    window.google.accounts.id.renderButton(gsiRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: gsiRef.current.offsetWidth || 400,
      text: 'continue_with',
      shape: 'rectangular',
    })
    setGsiReady(true)
  }, [clientId, handleCredential])

  // When the GSI script loads
  function onGsiScriptLoad() {
    initGsi()
  }

  // Re-init if ref becomes available after script already loaded
  useEffect(() => {
    if (window.google && gsiRef.current && !gsiReady) {
      initGsi()
    }
  }, [initGsi, gsiReady])

  // If no client ID is configured — show a non-crashing banner
  if (!clientId) {
    return (
      <div className="w-full rounded-lg border border-dashed bg-muted/40 px-4 py-2.5 text-center text-xs text-muted-foreground">
        {t('googleNotConfigured')}
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={onGsiScriptLoad}
      />

      <div className="space-y-2">
        {/* GSI renders its own button inside this div */}
        <div
          ref={gsiRef}
          className={[
            'w-full overflow-hidden rounded-lg',
            state === 'loading' ? 'opacity-60 pointer-events-none' : '',
          ].join(' ')}
          style={{ minHeight: '44px' }}
        />

        {/* Loading overlay */}
        {state === 'loading' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <SpinnerIcon />
            {t('googleVerifying')}
          </p>
        )}

        {/* Error messages */}
        {googleError === 'failed' && (
          <p className="text-xs text-destructive text-center" role="alert">
            {t('googleFailed')}
          </p>
        )}
        {googleError === 'unverified' && (
          <p className="text-xs text-destructive text-center" role="alert">
            {t('googleUnverified')}
          </p>
        )}
        {googleError === 'suspended' && (
          <p className="text-xs text-destructive text-center" role="alert">
            {t('googleSuspended')}
          </p>
        )}
      </div>
    </>
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

// ─────────────────────────────────────────────
// Phone OTP form
// ─────────────────────────────────────────────

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('auth.login')
  const te = useTranslations('auth.errors')

  // If returning from OTP page with ?phone=+91XXXXXXXXXX, pre-fill the 10 digits
  const prefillRaw = params.get('phone') ?? ''
  const prefillDigits = prefillRaw.startsWith('+91') ? prefillRaw.slice(3) : prefillRaw.replace(/^\+\d{0,2}/, '')

  const [digits, setDigits] = useState(prefillDigits.slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [touched, setTouched] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Live validation after first invalid submit
  useEffect(() => {
    if (touched && digits.length > 0) {
      const err = validateIndianPhone(digits, te)
      setError(err)
    }
  }, [digits, touched, te])

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 250)
  }

  function handleBlur() {
    if (digits.length > 0) {
      const err = validateIndianPhone(digits, te)
      setError(err)
      setTouched(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    const validationError = validateIndianPhone(digits, te)
    if (validationError) {
      setError(validationError)
      triggerShake()
      inputRef.current?.focus()
      return
    }
    if (!agreed) {
      setError(te('termsRequired'))
      return
    }
    setError(null)
    const phone = `+91${digits}`
    setLoading(true)
    try {
      const res = await getApiClient().auth.requestOtp(phone)
      if (res.devCode) setDevCode(res.devCode)
      router.push(`/otp?phone=${encodeURIComponent(phone)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : te('otpSendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const hasError = !!error
  const inputClasses = [
    'flex-1 min-w-0 border-y border-r bg-background px-3 py-2.5 text-sm rounded-r-lg',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
    'placeholder:text-muted-foreground/60',
    hasError
      ? 'border-destructive focus:ring-destructive'
      : 'border-input',
  ].join(' ')

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Google sign-in */}
      <GoogleSigninButton onSuccess={() => { /* navigation handled inside component */ }} />

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">{t('orSignInWithPhone')}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Phone input */}
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
          {t('mobileNumberLabel')}
        </label>
        <div
          className={[
            'flex rounded-lg overflow-hidden border transition-all duration-150',
            shake ? 'animate-[shake_200ms_ease-in-out]' : '',
            hasError ? 'border-destructive' : 'border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
          ].join(' ')}
        >
          {/* +91 chip */}
          <div className="flex items-center gap-1.5 border-r bg-muted px-3 py-2.5 select-none shrink-0">
            <span className="text-base leading-none" role="img" aria-label="India flag">🇮🇳</span>
            <span className="text-sm font-medium text-muted-foreground">+91</span>
          </div>
          {/* 10-digit input */}
          <input
            ref={inputRef}
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onBlur={handleBlur}
            placeholder={t('phonePlaceholder')}
            className={inputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'phone-error' : 'phone-hint'}
            autoFocus
            autoComplete="tel-national"
          />
        </div>
        {hasError ? (
          <p id="phone-error" className="mt-1.5 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p id="phone-hint" className="mt-1.5 text-xs text-muted-foreground">
            {t('phoneHint')}
          </p>
        )}
        {devCode && (
          <p className="mt-1 text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1">
            {t('devOtpLabel')} <strong>{devCode}</strong>
          </p>
        )}
      </div>

      {/* Terms checkbox */}
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          {t('termsText')}{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {t('termsLink')}
          </a>
          {' '}{t('termsConnector')}{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {t('privacyLink')}
          </a>
        </span>
      </label>

      {/* CTA */}
      <MotionTap disabled={loading || !agreed}>
        <button
          type="submit"
          disabled={loading || !agreed}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('sending') : t('sendOtp')}
        </button>
      </MotionTap>

      {/* Trust strip */}
      <p className="text-center text-[11px] text-muted-foreground/70 pt-1">
        {t('trustStrip')}
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginForm />
    </Suspense>
  )
}
