import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mento — Anonymous UPSC mentorship',
    short_name: 'Mento',
    description: 'Walk the UPSC path with someone who has been there.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      // Replace with real generated icons before launch.
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
