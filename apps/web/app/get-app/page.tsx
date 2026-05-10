export const metadata = { title: 'Get the Mento app' }

export default function GetAppPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Mento works best as an app</h1>
      <p className="max-w-md text-muted-foreground">
        Real-time chat with your mentor, push notifications, offline access. Get the mobile app.
      </p>
      <div className="flex flex-col gap-3">
        <a
          className="inline-block rounded-md bg-black px-6 py-3 text-white"
          href="https://apps.apple.com/in/app/mento/id000000000"
        >
          Download on the App Store
        </a>
        <a
          className="inline-block rounded-md bg-emerald-600 px-6 py-3 text-white"
          href="https://play.google.com/store/apps/details?id=app.mento"
        >
          Get it on Google Play
        </a>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Open this page on a desktop browser to access the web version.
      </p>
    </main>
  )
}
