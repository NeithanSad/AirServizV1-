import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

/**
 * The ownership check (an actor may only edit their OWN profile) lives in
 * the controller, not the service — this is the one place that guard is
 * actually exercised.
 */
describe('ProfilesController', () => {
  let controller: ProfilesController;
  let service: { upsert: jest.Mock; findAll: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    service = {
      upsert: jest.fn().mockResolvedValue({ userId: 'user-1', fullName: 'Actualizado' }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };

    const module = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [{ provide: ProfilesService, useValue: service }],
    }).compile();

    controller = module.get(ProfilesController);
  });

  describe('upsert — ownership guard', () => {
    it('rejects an actor editing a profile that is not their own', async () => {
      await expect(
        controller.upsert('user-1', { fullName: 'Hijack' } as any, 'user-2'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.upsert).not.toHaveBeenCalled();
    });

    it('allows the actor to edit their own profile', async () => {
      const result = await controller.upsert('user-1', { fullName: 'Actualizado' } as any, 'user-1');
      expect(service.upsert).toHaveBeenCalledWith('user-1', { fullName: 'Actualizado' });
      expect(result.data.fullName).toBe('Actualizado');
    });
  });

  describe('findAll / findOne', () => {
    it('wraps the service result in the standard {success, count, data} envelope', async () => {
      service.findAll.mockResolvedValueOnce([{ userId: 'a' }, { userId: 'b' }]);
      const result = await controller.findAll('PROVIDER' as any);
      expect(result).toEqual({ success: true, count: 2, data: [{ userId: 'a' }, { userId: 'b' }] });
      expect(service.findAll).toHaveBeenCalledWith('PROVIDER');
    });

    it('findOne wraps a single profile in {success, data}', async () => {
      const result = await controller.findOne('user-1');
      expect(result).toEqual({ success: true, data: { userId: 'user-1' } });
    });
  });
});
