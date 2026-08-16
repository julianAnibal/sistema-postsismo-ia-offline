import type { OutboxAcknowledgement, OutboxItem } from '../domain/types';

export const removeAcknowledgedOutboxItems = (
  items: OutboxItem[],
  acknowledgements: OutboxAcknowledgement[],
): OutboxItem[] => {
  const acknowledged = new Map(
    acknowledgements.map((item) => [item.outboxId, item] as const),
  );
  return items.filter((item) => {
    const receipt = acknowledged.get(item.id);
    return !receipt || receipt.entityId !== item.entityId || receipt.createdAt !== item.createdAt;
  });
};
