import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request payload against a contracts Zod schema (§3.2, §10.2).
 * Use as `new ZodBody(CreateChildSchema)` on a @Body() parameter.
 */
@Injectable()
export class ZodBody<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: 'Request payload failed validation',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
