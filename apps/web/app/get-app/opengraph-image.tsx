import { ImageResponse } from 'next/og'

export const alt = 'Mento — Get the mobile app'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function GetAppOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #dbeafe 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 42,
            color: '#2563eb',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            marginBottom: 30,
          }}
        >
          Mento
        </div>
        <div
          style={{
            fontSize: 72,
            color: '#0f172a',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          Get the mobile app
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#475569',
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          Real-time chat with your mentor. Push notifications. Offline journals.
          Available on iOS and Android.
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 80,
            fontSize: 22,
            color: '#94a3b8',
          }}
        >
          mento.in/get-app
        </div>
      </div>
    ),
    { ...size },
  )
}
