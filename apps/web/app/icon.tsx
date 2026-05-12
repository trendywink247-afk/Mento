import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/**
 * Auto-generated favicon — Mento "M" on the trust-blue brand color.
 * Replace with a designed SVG mark when one lands.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: '#2563eb',
          color: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        M
      </div>
    ),
    size,
  )
}
