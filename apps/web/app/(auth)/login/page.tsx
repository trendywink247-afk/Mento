'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiClient } from '@/lib/api'
import { MotionTap } from '@/components/motion'

// 10-digit India mobile number validation (client-side, user-facing)
function validateIndianPhone(digits: string): string | null {
  if (digits.length === 0) return 'Please enter your 10-digit mobile number.'
  if (digits.length < 10) return 'Please enter a 10-digit Indian mobile number.'
  if (digits.length > 10) return 'Please enter exactly 10 digits.'
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Please enter a valid Indian mobile number (starts with 6–9).'
  return null
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
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
      const err = validateIndianPhone(digits)
      setError(err)
    }
  }, [digits, touched])

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 250)
  }

  function handleBlur() {
    if (digits.length > 0) {
      const err = validateIndianPhone(digits)
      setError(err)
      setTouched(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    const validationError = validateIndianPhone(digits)
    if (validationError) {
      setError(validationError)
      triggerShake()
      inputRef.current?.focus()
      return
    }
    if (!agreed) {
      setError('Please agree to the Terms & Privacy to continue.')
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
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.')
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
      {/* Google sign-in (disabled — Phase J) */}
      <div className="relative group">
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-3 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
          aria-disabled="true"
          title="Coming soon"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 transition-opacity">
          Coming soon
        </span>
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or sign in with phone</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Phone input */}
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
          Mobile number
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
            placeholder="98765 43210"
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
            We&apos;ll send a 6-digit code by SMS.
          </p>
        )}
        {devCode && (
          <p className="mt-1 text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1">
            Dev OTP: <strong>{devCode}</strong>
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
          I agree to Mento&apos;s{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Terms
          </a>
          {' '}&amp;{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Privacy
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
          {loading ? 'Sending…' : 'Send OTP'}
        </button>
      </MotionTap>

      {/* Trust strip */}
      <p className="text-center text-[11px] text-muted-foreground/70 pt-1">
        🔒 Anonymous &nbsp;·&nbsp; 🛡 Verified mentors &nbsp;·&nbsp; 🇮🇳 Built in India
      </p>
    </form>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginForm />
    </Suspense>
  )
}
