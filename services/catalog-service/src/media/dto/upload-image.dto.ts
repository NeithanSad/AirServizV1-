import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UploadImageDto {
  @ApiProperty({
    description: 'Bytes de la imagen en base64 (sin el prefijo "data:image/...;base64,")',
  })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ example: 'mi-servicio.jpg', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  filename?: string;
}
