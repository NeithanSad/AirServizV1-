import { Body, Controller, Headers, Post, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiHeader,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { LambdaImageService } from './lambda-image.service';
import { UploadImageDto } from './dto/upload-image.dto';

@ApiTags('services')
@Controller('services')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly images: LambdaImageService) {}

  /**
   * POST /services/media — optimize an uploaded image via the Lambda pipeline
   * and return its public S3 URL. The provider-app calls this on file select,
   * then submits the returned URL as `imageUrl` when creating the service.
   */
  @Post('media')
  @ApiOperation({ summary: 'Sube y optimiza la imagen de un servicio (devuelve URL de S3)' })
  @ApiHeader({ name: 'x-actor-id', description: 'UUID del proveedor que sube la imagen', required: false })
  @ApiOkResponse({ description: 'Imagen almacenada; devuelve la URL pública' })
  @ApiServiceUnavailableResponse({ description: 'No se pudo procesar la imagen' })
  async upload(@Body() dto: UploadImageDto, @Headers('x-actor-id') actorId?: string) {
    this.logger.log(
      `POST /services/media — provider=${actorId ?? 'anon'} file=${dto.filename ?? 'n/a'}`,
    );
    const url = await this.images.optimizeAndStore(dto.imageBase64, dto.filename);
    return { success: true, data: { url } };
  }
}
