import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUrl,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ProfileRole } from '../entities/profile.entity';

const ROLES: ProfileRole[] = ['CLIENT', 'PROVIDER', 'ADMIN'];

export class UpsertProfileDto {
  @ApiProperty({ example: 'Mario Fontanería', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiPropertyOptional({ enum: ROLES, default: 'CLIENT' })
  @IsOptional()
  @IsIn(ROLES)
  role?: ProfileRole;

  @ApiPropertyOptional({ example: 'Plomero certificado con 10 años de experiencia.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://randomuser.me/api/portraits/men/32.jpg' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  photoUrl?: string;

  @ApiPropertyOptional({ example: '+52 555 123 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Ciudad de México' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Av. Insurgentes Sur 1234, Col. Del Valle' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: 19.432608 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -99.133209 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
