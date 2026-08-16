import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { createDraftInspection, createSeedState } from '../data/seed';
import {
  AppState,
  EvidenceAnnotation,
  Inspection,
  MediaEvidence,
  OutboxItem,
} from '../domain/types';

const STORAGE_KEY = '@sierra-clara/field-state/v1';

const upsert = <T extends { id: string }>(items: T[], item: T) => [
  ...items.filter((candidate) => candidate.id !== item.id),
  item,
];

const queue = (
  items: OutboxItem[],
  entityType: OutboxItem['entityType'],
  entityId: string,
): OutboxItem[] => {
  const next: OutboxItem = {
    id: `outbox-${entityType}-${entityId}`,
    entityType,
    entityId,
    operation: 'upsert',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  return upsert(items, next);
};

const persist = (state: AppState) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));

export const useFieldStore = () => {
  const [state, setState] = useState<AppState>(createSeedState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as AppState;
        if (parsed.schemaVersion === 1) {
          setState({ ...parsed, modelAnalyses: parsed.modelAnalyses ?? [] });
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const commit = useCallback((mutate: (current: AppState) => AppState) => {
    setState((current) => {
      const next = mutate(current);
      void persist(next);
      return next;
    });
  }, []);

  const getInspection = useCallback(
    (infrastructureId: string) =>
      state.inspections.find((item) => item.infrastructureId === infrastructureId) ??
      createDraftInspection(infrastructureId),
    [state.inspections],
  );

  const saveInspection = useCallback(
    (inspection: Inspection) => {
      const updated: Inspection = { ...inspection, updatedAt: new Date().toISOString() };
      commit((current) => ({
        ...current,
        inspections: upsert(current.inspections, updated),
        outbox: queue(current.outbox, 'inspection', updated.id),
      }));
    },
    [commit],
  );

  const addEvidence = useCallback(
    (inspection: Inspection, media: MediaEvidence, annotation: EvidenceAnnotation) => {
      const updatedInspection: Inspection = {
        ...inspection,
        mediaIds: Array.from(new Set([...inspection.mediaIds, media.id])),
        updatedAt: new Date().toISOString(),
      };
      commit((current) => ({
        ...current,
        inspections: upsert(current.inspections, updatedInspection),
        media: upsert(current.media, media),
        annotations: upsert(current.annotations, annotation),
        outbox: queue(
          queue(queue(current.outbox, 'inspection', inspection.id), 'media', media.id),
          'annotation',
          annotation.id,
        ),
      }));
    },
    [commit],
  );

  const reset = useCallback(() => {
    const seed = createSeedState();
    setState(seed);
    void persist(seed);
  }, []);

  return { state, ready, getInspection, saveInspection, addEvidence, reset };
};
