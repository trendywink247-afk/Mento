import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import type { Request, Response } from 'express'
import { MetricsService } from '../modules/metrics/metrics.service'

/**
 * MetricsInterceptor — records HTTP request duration for every route.
 *
 * Labels:
 *   route  — parameterised path from Express route (e.g. /auth/otp/:phone).
 *             Falls back to the raw pathname if the route isn't matched yet.
 *   status — HTTP status code as a string (e.g. '200', '404').
 *
 * Registered globally via APP_INTERCEPTOR in AppModule.
 * PII never appears in label values: route params are the pattern, not the value.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()

    const endTimer = this.metricsService.httpRequestDuration.startTimer()

    return next.handle().pipe(
      tap({
        next: () => {
          const route = (req.route?.path as string | undefined) ?? req.path
          endTimer({ route, status: String(res.statusCode) })
        },
        error: (err: { status?: number }) => {
          const route = (req.route?.path as string | undefined) ?? req.path
          const status = String(err?.status ?? 500)
          endTimer({ route, status })
        },
      }),
    )
  }
}
