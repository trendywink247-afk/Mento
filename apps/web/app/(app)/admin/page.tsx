import Link from 'next/link'

const tiles: Array<{ href: string; label: string; description: string }> = [
  { href: '/admin/moderation', label: 'Moderation', description: 'Triage reported messages — warn, suspend, or ban.' },
  { href: '/admin/users', label: 'Users', description: 'List, change roles, suspend.' },
  {
    href: '/admin/mentors',
    label: 'Mentor verification',
    description: 'Review pending credentials — approve, reject, or ban.',
  },
  { href: '/admin/assignments', label: 'Assignments', description: 'Pair mentors with aspirants.' },
  { href: '/admin/audit', label: 'Audit log', description: 'See recent admin actions.' },
  { href: '/admin/invites', label: 'Invite codes', description: 'Mint and manage beta invite codes.' },
  { href: '/admin/flags', label: 'Feature flags', description: 'Toggle feature flags without deploying code. Changes propagate within 30s.' },
]

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage users, mentors, and aspirant pairings.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg border bg-card p-5 hover:shadow-sm"
          >
            <p className="text-base font-medium">{t.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
