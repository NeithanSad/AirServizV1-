import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'maria@airserviz.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'María González' })
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'S3cur3P@ss!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt max input length
  password: string;

  @ApiPropertyOptional({ enum: ['CLIENT', 'PROVIDER', 'ADMIN'], default: 'CLIENT' })
  @IsEnum(['CLIENT', 'PROVIDER', 'ADMIN'])
  @IsOptional()
  role?: UserRole;
}
