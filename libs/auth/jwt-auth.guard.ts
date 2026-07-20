/* ─────────────────────────────────────────────────────────────────────────────
 * FUENTE CANÓNICA — no editar las copias dentro de services/
 *
 * Este archivo se copia a `services/<svc>/src/auth/` con:
 *     bash scripts/sync-shared-auth.sh
 * y CI comprueba que no hayan divergido con:
 *     bash scripts/sync-shared-auth.sh --check
 *
 * Se vendoriza en lugar de importarse porque el contexto de build de Docker es
 * el directorio de cada servicio (ver su Dockerfile), así que `libs/` no existe
 * al compilar la imagen. Mover el contexto a la raíz del repo rompería los
 * filtros por ruta del CI, que solo reconstruyen el servicio que cambió.
 * ────────────────────────────────────────────────────────────────────────────*/

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/** Identidad verificada, extraída del token. */
export interface AuthenticatedUser {
  /** `sub` del JWT — el UUID del usuario. */
  id: string;
  email?: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN' | string;
}

/** Request de Express con la identidad ya resuelta por el guard. */
export interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Deriva la identidad del usuario del JWT **verificado**.
 *
 * Por qué existe
 * --------------
 * Antes los servicios leían el `userId` de una cabecera `x-actor-id` que
 * enviaba el propio cliente. Kong comprobaba que el token fuese legítimo, pero
 * nadie comprobaba que la cabecera correspondiera a ese token: bastaba con
 * cambiarla para actuar en nombre de otro usuario (IDOR con escalada
 * horizontal, demostrado sobre el entorno real).
 *
 * La identidad ahora sale de la firma criptográfica, que el cliente no puede
 * falsificar sin el secreto.
 *
 * Por qué se valida otra vez si Kong ya validó
 * --------------------------------------------
 * Defensa en profundidad. Kong protege el borde, pero cualquier proceso dentro
 * de la red del stack puede llegar directo al puerto del servicio y forjar
 * cabeceras. Verificar aquí cuesta microsegundos y elimina la suposición de
 * que "la red interna es de confianza".
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    // Fail-closed: sin secreto no se puede verificar nada, y arrancar en ese
    // estado significaría aceptar cualquier token o rechazarlos todos según el
    // detalle de implementación. Mejor no arrancar.
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET falta o mide menos de 32 caracteres. El servicio no puede ' +
          'verificar identidades y no arrancará. Ver infra/docker-compose/.env.example.',
      );
    }
    this.secret = secret;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Falta la cabecera Authorization: Bearer <token>');
    }

    let payload: { sub?: string; email?: string; role?: string };
    try {
      payload = this.jwt.verify(token, { secret: this.secret });
    } catch {
      // El motivo concreto (caducado, firma inválida, malformado) se omite a
      // propósito: distinguirlos ayuda a un atacante a afinar. El cliente solo
      // necesita saber que debe renovar o volver a autenticarse.
      throw new UnauthorizedException('Token inválido o caducado');
    }

    if (!payload.sub) {
      this.logger.warn('Token verificado pero sin claim `sub` — se rechaza');
      throw new UnauthorizedException('El token no identifica a ningún usuario');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'CLIENT',
    };

    return true;
  }

  private extractBearerToken(request: RequestWithUser): string | null {
    const header = request.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith('Bearer ')) return null;
    const token = value.slice(7).trim();
    return token.length > 0 ? token : null;
  }
}
