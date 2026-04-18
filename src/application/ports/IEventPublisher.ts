import type { UserEvent } from '../../domain/events.js';

/**
 * Outbound port — how the outbox worker delivers events to downstream consumers.
 * A no-op implementation can be used in tests.
 * Real implementations: AMQP, Kafka, HTTP webhook, etc.
 */
export interface IEventPublisher {
  publish(event: UserEvent): Promise<void>;
}
