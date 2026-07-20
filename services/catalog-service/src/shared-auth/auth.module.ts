/* ─────────────────────────────────────────────────────────────────────────────
 * FUENTE CANÓNICA — no editar las copias dentro de services/
 * Se sincroniza con: bash scripts/sync-shared-auth.sh
 * ────────────────────────────────────────────────────────────────────────────*/

import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Módulo de verificación de identidad, listo para importar en el AppModule de
 * cualquier servicio:
 *
 *     @Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), SharedAuthModule, ...] })
 *
 * Es `@Global` para que los controladores puedan usar `@UseGuards(JwtAuthGuard)`
 * sin importarlo en cada módulo de features.
 *
 * Nota: `JwtModule.register({})` sin secreto es intencionado. El guard pasa el
 * secreto explícitamente en cada `verify()`, tomándolo de ConfigService, de modo
 * que no queda un secreto capturado en el momento del arranque del módulo.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class SharedAuthModule {}
