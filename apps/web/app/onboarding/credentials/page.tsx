'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { capture } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocKind = 'aadhaar' | 'hall_ticket' | 'marks_sheet'

interface DocState {
  file: File | null
  key: string | null
  uploading: boolean
  error: string | null
  done: boolean
}

const INITIAL_DOC: DocState = {
  file: null,
  key: null,
  uploading: false,
  error: null,
  done: false,
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_DOC_BYTES = 5 * 1024 * 1024 // 5 MB

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CredentialsPage() {
  const router = useRouter()
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  const [aadhaar, setAadhaar] = useState<DocState>(INITIAL_DOC)
  const [hallTicket, setHallTicket] = useState<DocState>(INITIAL_DOC)
  const [marksSheet, setMarksSheet] = useState<DocState>(INITIAL_DOC)

  const [aadhaarLast4, setAadhaarLast4] = useState('')
  const [bankAccount, setBankAccount] = useState({
    accountNumber: '',
    ifsc: '',
    beneficiaryName: '',
    upiId: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=MENTOR')
  }, [hasHydrated, tokens, router])

  // Upload a single document: get presign → PUT to URL → store key.
  async function uploadDoc(
    file: File,
    kind: DocKind,
    setter: React.Dispatch<React.SetStateAction<DocState>>,
  ) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setter((s) => ({ ...s, error: 'Unsupported file type. Use PDF, JPEG, PNG, or WEBP.' }))
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      setter((s) => ({ ...s, error: 'File too large. Maximum size is 5 MB.' }))
      return
    }

    setter((s) => ({ ...s, file, uploading: true, error: null, done: false }))

    try {
      const { uploadUrl, publicKey } = await getApiClient().storage.presignUpload({
        kind,
        mime: file.type,
        sizeBytes: file.size,
      })

      // Upload directly to the presigned URL (R2 or local dev endpoint).
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
      }

      setter(() => ({ file, key: publicKey, uploading: false, error: null, done: true }))
      capture('onboarding.credentials.doc_uploaded', { kind })
    } catch (err) {
      setter((s) => ({
        ...s,
        uploading: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
  }

  function handleFile(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: DocKind,
    setter: React.Dispatch<React.SetStateAction<DocState>>,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    void uploadDoc(file, kind, setter)
    // Reset input so same file can be re-selected after error.
    e.target.value = ''
  }

  const canSubmit =
    aadhaar.done &&
    hallTicket.done &&
    /^\d{4}$/.test(aadhaarLast4) &&
    bankAccount.accountNumber.trim() !== '' &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankAccount.ifsc) &&
    bankAccount.beneficiaryName.trim() !== '' &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      await getApiClient().onboarding.submitVerification({
        aadhaarKey: aadhaar.key!,
        hallTicketKey: hallTicket.key!,
        marksSheetKey: marksSheet.key ?? undefined,
        aadhaarLast4,
        bankAccount: {
          accountNumber: bankAccount.accountNumber.trim(),
          ifsc: bankAccount.ifsc.trim().toUpperCase(),
          beneficiaryName: bankAccount.beneficiaryName.trim(),
          upiId: bankAccount.upiId.trim() || undefined,
        },
      })
      capture('onboarding.credentials.submitted')
      router.replace('/onboarding/submitted')
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not submit verification. Please try again.',
      )
      setSubmitting(false)
    }
  }

  if (!hasHydrated) return null

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Verify your credentials</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Upload your Mains hall ticket and Aadhaar for manual verification. Our team reviews every
          submission within 1-2 business days. Your documents are stored securely and never shared.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {/* Aadhaar */}
          <DocUploadField
            label="Aadhaar (front page)"
            description="PDF, JPEG, PNG or WEBP — max 5 MB"
            required
            state={aadhaar}
            kind="aadhaar"
            setter={setAadhaar}
            onChange={(e) => handleFile(e, 'aadhaar', setAadhaar)}
          />

          {/* Aadhaar last 4 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Last 4 digits of Aadhaar <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              We never collect the full Aadhaar number. Only the last 4 digits are used to verify
              uniqueness on this platform.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={aadhaarLast4}
              onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 5678"
              className="w-32 rounded-md border bg-background px-3 py-2 text-sm tracking-widest"
            />
          </div>

          {/* Hall ticket */}
          <DocUploadField
            label="Mains hall ticket"
            description="PDF, JPEG, PNG or WEBP — max 5 MB — required"
            required
            state={hallTicket}
            kind="hall_ticket"
            setter={setHallTicket}
            onChange={(e) => handleFile(e, 'hall_ticket', setHallTicket)}
          />

          {/* Marks sheet */}
          <DocUploadField
            label="Marks sheet (optional)"
            description="PDF, JPEG, PNG or WEBP — max 5 MB. Upload for purple tick."
            required={false}
            state={marksSheet}
            kind="marks_sheet"
            setter={setMarksSheet}
            onChange={(e) => handleFile(e, 'marks_sheet', setMarksSheet)}
          />

          {/* Bank account */}
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-base font-medium">Bank / UPI details</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                For mentor earnings payouts. Required to be listed as a paid mentor.
              </p>
            </div>

            <div className="space-y-3">
              <Field
                label="Account number"
                required
                value={bankAccount.accountNumber}
                onChange={(v) => setBankAccount((b) => ({ ...b, accountNumber: v }))}
                placeholder="e.g. 1234567890"
              />
              <Field
                label="IFSC code"
                required
                value={bankAccount.ifsc}
                onChange={(v) => setBankAccount((b) => ({ ...b, ifsc: v.toUpperCase() }))}
                placeholder="e.g. SBIN0001234"
                pattern="[A-Z]{4}0[A-Z0-9]{6}"
                title="IFSC: 4 uppercase letters + 0 + 6 alphanumeric"
              />
              <Field
                label="Beneficiary name"
                required
                value={bankAccount.beneficiaryName}
                onChange={(v) => setBankAccount((b) => ({ ...b, beneficiaryName: v }))}
                placeholder="Name on bank account"
              />
              <Field
                label="UPI ID (optional)"
                value={bankAccount.upiId}
                onChange={(v) => setBankAccount((b) => ({ ...b, upiId: v }))}
                placeholder="e.g. name@upi"
              />
            </div>
          </section>

          {/* Safety note */}
          <p className="rounded-md bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            Your documents are stored encrypted. Only Mento admins reviewing verification
            requests can view them. We follow DPDP Act 2023 guidelines for data storage.
          </p>

          {submitError && (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} />
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for verification'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DocUploadField({
  label,
  description,
  required,
  state,
  kind,
  setter,
  onChange,
}: {
  label: string
  description: string
  required: boolean
  state: DocState
  kind: DocKind
  setter: React.Dispatch<React.SetStateAction<DocState>>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <p className="text-xs text-muted-foreground">{description}</p>

      <div
        onClick={() => inputRef.current?.click()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
          state.done
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
            : state.error
              ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
              : 'border-input hover:border-primary/60 hover:bg-accent',
        ].join(' ')}
      >
        {state.uploading ? (
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        ) : state.done ? (
          <CheckCircle2 size={20} className="text-emerald-600" />
        ) : (
          <Upload size={20} className="text-muted-foreground" />
        )}
        <span className="mt-2 text-xs text-muted-foreground">
          {state.uploading
            ? 'Uploading…'
            : state.done
              ? state.file?.name ?? 'Uploaded'
              : 'Click to select file'}
        </span>
        {state.error && (
          <span className="mt-1 text-xs text-red-600">{state.error}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={onChange}
      />

      {state.done && (
        <button
          type="button"
          onClick={() => setter(INITIAL_DOC)}
          className="text-xs text-muted-foreground hover:underline"
        >
          Remove and re-upload
        </button>
      )}
    </div>
  )
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  pattern,
  title,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  pattern?: string
  title?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        pattern={pattern}
        title={title}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  )
}
