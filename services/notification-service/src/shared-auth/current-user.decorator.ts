/* ─────────────────────────────────────────────────────────────────────────────
 * FUENTE CANÓNICA — no editar las copias dentro de services/
 * Se sincroniza con: bash scripts/sync-shared-auth.sh
 * ────────────────────────────────────────────────────────────────────────────*/

import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthenticatedUser, RequestWithUser } from './jwt-auth.guard';

/**
 * Inyecta la identidad verificada en el controlador:
 *
 *     @Get()
 *     @UseGuards(JwtAuthGuard)
 *     findMine(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Sustituye a `@Headers('x-actor-id')`, que devolvía lo que el cliente quisiera.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Si esto salta, el controlador usa @CurrentUser sin @UseGuards(JwtAuthGuard).
    // Es un error de programación, no del cliente: devolver 401 lo disfrazaría
    // de problema de credenciales y costaría horas de diagnóstico.
    if (!user) {
      throw new InternalServerErrorException(
        'CurrentUser sin identidad resuelta: falta @UseGuards(JwtAuthGuard) en esta ruta',
      );
    }

    return data ? user[data] : user;
  },
);
