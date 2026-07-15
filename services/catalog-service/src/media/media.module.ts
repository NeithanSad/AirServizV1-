import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { LambdaImageService } from './lambda-image.service';

@Module({
  controllers: [MediaController],
  providers: [LambdaImageService],
})
export class MediaModule {}
