import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createDraftInspection, createSeedState } from '../data/seed';
import {
  finalizeInspectionRevision,
  reopenInspectionAfterMutation,
} from '../domain/inspectionRevision';
import {
  AppState,
  EvidenceAnnotation,
  Infrastructure,
  Inspection,
  MediaEvidence,
  OutboxAcknowledgement,
  OutboxItem,
} from '../domain/types';
import {
  clearEvidenceFiles,
  deleteAllowlistedEvidenceFiles,
  EvidenceIntegrityError,
  prepareEvidenceFilesForLoad,
} from './evidenceFiles';
import { migrateFieldState } from './migrations';
import { removeAcknowledgedOutboxItems } from './outbox';

const STORAGE_KEY = '@sierra-clara/field-state/v2';
const LEGACY_STORAGE_KEY = '@sierra-clara/field-state/v1';

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
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const enqueuePersist = useCallback(
    (next: AppState, afterSuccess?: () => Promise<string | null>): Promise<boolean> => {
      const operation = writeQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await persist(next);
            setStorageError(null);
            if (afterSuccess) {
              try {
                const warning = await afterSuccess();
                if (warning) setStorageError(warning);
              } catch {
                setStorageError('Los datos se guardaron, pero quedó almacenamiento residual que no pudo eliminarse.');
              }
            }
            return true;
          } catch {
            setStorageError('No fue posible guardar los cambios en el almacenamiento local.');
            return false;
          }
        });
      writeQueue.current = operation.then(() => undefined);
      return operation;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const current = await AsyncStorage.getItem(STORAGE_KEY);
        const legacy = current ? null : await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        const stored = current ?? legacy;
        if (!stored) return;
        const parsed: unknown = JSON.parse(stored);
        const sourceSchemaVersion =
          typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed
            ? Number(parsed.schemaVersion)
            : NaN;
        const migrated = migrateFieldState(parsed);
        if (!migrated) {
          if (active) setStorageError('Los datos locales existentes no superaron la validación y no se cargaron.');
          return;
        }
        const prepared = await prepareEvidenceFilesForLoad(migrated.media, {
          rehashLegacy: sourceSchemaVersion === 1,
        });
        const next = { ...migrated, media: prepared.media };
        try {
          await persist(next);
        } catch (error) {
          deleteAllowlistedEvidenceFiles(prepared.createdFileUris);
          throw error;
        }

        let cleanupWarning = false;
        if (legacy) {
          try {
            await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            cleanupWarning = true;
          }
        }
        if (deleteAllowlistedEvidenceFiles(prepared.obsoleteFileUris).length > 0) {
          cleanupWarning = true;
        }
        if (active) {
          stateRef.current = next;
          setState(next);
          if (cleanupWarning) {
            setStorageError('La migración se guardó, pero no fue posible eliminar una copia local antigua.');
          }
        }
      } catch (error) {
        // Corrupt or unavailable local state falls back to the synthetic seed.
        if (active) {
          setStorageError(
            error instanceof EvidenceIntegrityError
              ? 'La evidencia local no superó la verificación y el estado no fue migrado.'
              : 'No fue posible leer o migrar el almacenamiento local.',
          );
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback((mutate: (current: AppState) => AppState) => {
    const next = mutate(stateRef.current);
    stateRef.current = next;
    setState(next);
    return enqueuePersist(next);
  }, [enqueuePersist]);

  const getInspection = useCallback(
    (infrastructureId: string) =>
      state.inspections.find((item) => item.infrastructureId === infrastructureId) ??
      createDraftInspection(infrastructureId),
    [state.inspections],
  );

  const saveInspection = useCallback(
    (inspection: Inspection, markReviewed: boolean) => {
      const updated: Inspection = {
        ...finalizeInspectionRevision(inspection, markReviewed),
        updatedAt: new Date().toISOString(),
      };
      return commit((current) => ({
        ...current,
        inspections: upsert(current.inspections, updated),
        outbox: queue(current.outbox, 'inspection', updated.id),
      }));
    },
    [commit],
  );

  const createReport = useCallback(
    (infrastructure: Infrastructure, inspection: Inspection) =>
      commit((current) => ({
        ...current,
        infrastructures: upsert(current.infrastructures, infrastructure),
        inspections: upsert(current.inspections, inspection),
        outbox: queue(current.outbox, 'inspection', inspection.id),
      })),
    [commit],
  );

  const addEvidence = useCallback(
    (inspection: Inspection, media: MediaEvidence, annotation: EvidenceAnnotation) => {
      const updatedInspection: Inspection = {
        ...reopenInspectionAfterMutation(inspection),
        mediaIds: Array.from(new Set([...inspection.mediaIds, media.id])),
        updatedAt: new Date().toISOString(),
      };
      return commit((current) => ({
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

  const acknowledgeSync = useCallback(
    (acknowledgements: OutboxAcknowledgement[]) =>
      commit((current) => ({
        ...current,
        outbox: removeAcknowledgedOutboxItems(current.outbox, acknowledgements),
      })),
    [commit],
  );

  const reset = useCallback(() => {
    const seed = createSeedState();
    return enqueuePersist(seed, async () => {
      stateRef.current = seed;
      setState(seed);
      let residual = false;
      try {
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        residual = true;
      }
      try {
        clearEvidenceFiles();
      } catch {
        residual = true;
      }
      return residual
        ? 'El estado se restableció, pero quedaron archivos o datos heredados que no pudieron eliminarse.'
        : null;
    });
  }, [enqueuePersist]);

  return {
    state,
    ready,
    storageError,
    getInspection,
    createReport,
    saveInspection,
    addEvidence,
    acknowledgeSync,
    reset,
  };
};
