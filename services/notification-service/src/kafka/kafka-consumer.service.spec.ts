import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Exercises the private handleMessage() — the actual Kafka message entry
 * point — directly. Constructing the service is safe without a real broker:
 * the kafkajs Kafka() client is only local object setup; nothing touches the
 * network until onModuleInit()/consumer.connect(), which this spec never
 * calls.
 */
describe('KafkaConsumerService', () => {
  let consumer: KafkaConsumerService;
  let recordSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        KafkaConsumerService,
        NotificationsService,
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: unknown) => fallback },
        },
      ],
    }).compile();

    consumer = module.get(KafkaConsumerService);
    recordSpy = jest.spyOn(module.get(NotificationsService), 'record');
  });

  // handleMessage is private — invoke it the same way kafkajs's consumer.run() does
  function deliver(topic: string, value: string | null, partition = 0, offset = '0') {
    return (consumer as any).handleMessage({
      topic,
      partition,
      message: { value: value === null ? null : Buffer.from(value), offset },
    });
  }

  it('parses a valid JSON message and forwards it to NotificationsService.record', async () => {
    await deliver(
      'order_confirmed',
      JSON.stringify({ eventType: 'order_confirmed', payload: { id: 'order-1' } }),
      1,
      '42',
    );

    expect(recordSpy).toHaveBeenCalledTimes(1);
    const [event, meta] = recordSpy.mock.calls[0];
    expect(event.eventType).toBe('order_confirmed');
    expect(meta).toMatchObject({ topic: 'order_confirmed', partition: 1, offset: '42' });
    expect(typeof meta.processingTimeMs).toBe('number');
  });

  it('skips an empty message (no value) without throwing', async () => {
    await expect(deliver('order_created', null)).resolves.toBeUndefined();
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('skips a message that is not valid JSON without throwing or crashing the consumer', async () => {
    await expect(deliver('order_created', 'not-json-{{{')).resolves.toBeUndefined();
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
