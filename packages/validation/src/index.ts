import { z } from 'zod'

// E.164 phone format, India focus (+91 + 10 digits) but accept other prefixes too.
export const phoneSchema = z
  .string()
  .regex(/^\+\d{10,15}$/, 'Phone must be in E.164 format e.g. +911234567890')

export const otpCodeSchema = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits')

export const otpRequestSchema = z.object({
  phone: phoneSchema,
})

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
})

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(500).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  language: z.string().length(2).optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  type: z.enum(['TEXT', 'IMAGE', 'VOICE', 'FILE']),
  body: z.string().max(4000).optional(),
  attachmentUrl: z.string().url().optional(),
  clientMessageId: z.string().uuid(),
})

export const presignUploadSchema = z.object({
  mime: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
  size: z.number().int().positive().max(20 * 1024 * 1024), // 20 MB cap
  kind: z.enum(['avatar', 'chat-image', 'chat-voice', 'chat-file']),
})

export const registerPushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
})

export type OtpRequestInput = z.infer<typeof otpRequestSchema>
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type PresignUploadInput = z.infer<typeof presignUploadSchema>
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>
