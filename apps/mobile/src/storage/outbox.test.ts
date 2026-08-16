import { describe, expect, it } from 'vitest';

import type { OutboxItem } from '../domain/types';
import { removeAcknowledgedOutboxItems } from './outbox';

const pending = (createdAt: string): OutboxItem => ({
  id: 'outbox-inspection-inspection-1',
  entityType: 'inspection',
  entityId: 'inspection-1',
  operation: 'upsert',
  createdAt,
  status: 'pending',
});

describe('removeAcknowledgedOutboxItems', () => {
  it('removes the exact outbox revision confirmed by the server', () => {
    const item = pending('2038-01-19T10:00:00.000Z');
    expect(removeAcknowledgedOutboxItems([item], [{
      outboxId: item.id,
      entityId: item.entityId,
      createdAt: item.createdAt,
    }])).toEqual([]);
  });

  it('preserves a newer mutation of the same entity', () => {
    const current = pending('2038-01-19T10:00:01.000Z');
    expect(removeAcknowledgedOutboxItems([current], [{
      outboxId: current.id,
      entityId: current.entityId,
      createdAt: '2038-01-19T10:00:00.000Z',
    }])).toEqual([current]);
  });
});
