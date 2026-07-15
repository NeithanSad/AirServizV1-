import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { SERVICE_CATEGORIES, ServiceCategory } from '../entities/service.entity';

export class CreateServiceDto {
  @ApiProperty({ example: 'Reparación de fugas de agua', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Detección y reparación de fugas en cocina y baño.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 150.0, description: 'Price in USD' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiProperty({ enum: SERVICE_CATEGORIES, example: 'PLOMERIA' })
  @IsIn(SERVICE_CATEGORIES)
  category: ServiceCategory;

  @ApiPropertyOptional({
    description: 'URL de la imagen (normalmente la que devuelve POST /services/media tras optimizarla)',
    example: 'https://airserviz-media-960422538066.s3.us-east-1.amazonaws.com/services/uuid-foto.webp',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;
}
