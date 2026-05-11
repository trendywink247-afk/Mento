import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  // Trust the first proxy hop (Caddy in prod) so req.ip is the real client IP.
  // NestJS doesn't expose set('trust proxy') directly via the Adapter type — get
  // the underlying Express instance from the HttpAdapter.
  const httpAdapter = app.getHttpAdapter()
  const expressApp = httpAdapter.getInstance() as { set?: (k: string, v: unknown) => void }
  expressApp.set?.('trust proxy', 1)

  // Strict security headers. Caddy adds HSTS at the edge — set it here too as a backstop.
  app.use(
    helmet({
      contentSecurityPolicy: false, // Next.js / Expo handle their own CSP
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: false,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
      frameguard: { action: 'deny' },
    }),
  )

  const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3030,http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  app.enableCors({
    origin: (origin, cb) => {
      // Non-browser clients (curl, mobile native) have no Origin — allow.
      if (!origin) return cb(null, true)
      if (allowed.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.setGlobalPrefix('', { exclude: ['healthz', 'readyz'] })

  const port = Number(process.env.API_PORT ?? 4000)
  await app.listen(port, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}`)
}

bootstrap()
