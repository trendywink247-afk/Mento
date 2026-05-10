export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-sm rounded-lg border bg-background p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Mento</h1>
          <p className="mt-1 text-sm text-muted-foreground">UPSC mentorship</p>
        </div>
        {children}
      </div>
    </main>
  )
}
