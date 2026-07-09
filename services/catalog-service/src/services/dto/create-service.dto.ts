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

  @ApiPropertyOptional({ example: 'https://picsum.photos/seed/plumbing/400/300' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;
}
