import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

/** Shape returned by the airserviz-image-optimizer Lambda */
interface OptimizedImage {
  success: boolean;
  url: string;
  key: string;
  reduction: string;
}

/**
 * Invokes the deployed image-optimizer Lambda (sharp → WebP → S3) and returns
 * the public URL of the stored image. Credentials come from the standard AWS
 * provider chain (env vars, ~/.aws, or an IAM role) — never hard-coded here.
 *
 * Boundary note: this stays within catalog-service's bounded context. The
 * Lambda only transforms bytes and writes to S3; catalog-service persists the
 * returned URL in its OWN database (services.imageUrl). No other service's DB
 * is touched.
 */
@Injectable()
export class LambdaImageService {
  private readonly logger = new Logger(LambdaImageService.name);
  private readonly lambda: LambdaClient;
  private readonly fnName: string;

  constructor(config: ConfigService) {
    this.fnName = config.get<string>('IMAGE_OPTIMIZER_FN', 'airserviz-image-optimizer');
    this.lambda = new LambdaClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async optimizeAndStore(imageBase64: string, filename = 'service.jpg'): Promise<string> {
    try {
      const res = await this.lambda.send(
        new InvokeCommand({
          FunctionName: this.fnName,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ imageBase64, filename, folder: 'services' }),
        }),
      );

      const raw = res.Payload ? Buffer.from(res.Payload).toString('utf8') : '';

      // Lambda ran but the handler threw (unhandled error inside the function)
      if (res.FunctionError) {
        throw new Error(`Lambda ${res.FunctionError}: ${raw}`);
      }

      const parsed = JSON.parse(raw) as OptimizedImage;
      if (!parsed?.success || !parsed.url) {
        throw new Error(`Respuesta inesperada de la Lambda: ${raw}`);
      }

      this.logger.log(`Service image optimized → ${parsed.url} (${parsed.reduction} smaller)`);
      return parsed.url;
    } catch (err) {
      // Surface a clean 503 to the client; keep the real cause in the logs
      this.logger.error(`Image optimization failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo procesar la imagen');
    }
  }
}
