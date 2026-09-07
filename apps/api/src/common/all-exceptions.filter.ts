import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Stable error envelope for every failure (§10.4). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { error: 'InternalServerError', message: 'Unexpected error' };

    const body =
      typeof payload === 'string'
        ? { error: HttpStatus[status], message: payload }
        : { error: 'Error', message: 'Request failed', ...(payload as object) };

    if (status >= 500) this.logger.error(exception);

    res.status(status).json({ statusCode: status, ...body });
  }
}
