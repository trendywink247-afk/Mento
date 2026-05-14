import { ImageResponse } from 'next/og'

export const alt = 'Mento Pricing — Tiered Mentorship for UPSC Aspirants'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function PricingOgImage() {
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
            fontSize: 64,
            color: '#0f172a',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          Tiered Mentorship for UPSC Aspirants — Free to Max
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#475569',
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          Start free. Upgrade when the conversation deepens. No coaching pitch.
        </div>
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            gap: 20,
          }}
        >
          {['Free', 'Basic ₹399', 'Pro ₹599', 'Max ₹999'].map((tier) => (
            <div
              key={tier}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: tier.startsWith('Pro') ? '#2563eb' : '#e2e8f0',
                color: tier.startsWith('Pro') ? '#ffffff' : '#0f172a',
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {tier}
            </div>
          ))}
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
          ai.geekspace.space/pricing
        </div>
      </div>
    ),
    { ...size },
  )
}
