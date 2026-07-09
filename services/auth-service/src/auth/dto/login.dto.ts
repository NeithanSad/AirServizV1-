import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'maria@airserviz.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss!' })
  @IsString()
  @MinLength(8)
  password: string;
}
