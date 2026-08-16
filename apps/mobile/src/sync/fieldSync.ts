import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { AppState, MediaEvidence } from '../domain/types';

const ENDPOINT_KEY = '1000-ojos.sync.endpoint';
const TOKEN_KEY = '1000-ojos.sync.token';
const INSTALLATION_KEY = '1000-ojos.installation.id';
const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const getSecret = async (key: string) => Platform.OS === 'web'
  ? globalThis.sessionStorage?.getItem(key) ?? null
  : SecureStore.getItemAsync(key, secureOptions);

const setSecret = async (key: string, value: string) => {
  if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value, secureOptions);
};

export const loadSyncSettings = async () => ({ endpoint: (await getSecret(ENDPOINT_KEY)) ?? '', token: (await getSecret(TOKEN_KEY)) ?? '' });

export const saveSyncSettings = async (endpoint: string, token: string) => {
  const normalized = endpoint.trim().replace(/\/$/, '');
  if (!/^https:\/\//.test(normalized) && !/^http:\/\/localhost(?::\d+)?$/.test(normalized)) throw new Error('La dirección debe usar HTTPS.');
  await setSecret(ENDPOINT_KEY, normalized);
  await setSecret(TOKEN_KEY, token.trim());
};

const installationHash = async () => {
  let id = await getSecret(INSTALLATION_KEY);
  if (!id) { id = Crypto.randomUUID(); await setSecret(INSTALLATION_KEY, id); }
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, id);
};

const uploadMedia = async (endpoint: string, token: string, operationId: string, batchId: string, media: MediaEvidence) => {
  const source = await fetch(media.uri);
  const body = await source.blob();
  const response = await fetch(`${endpoint}/api/internal/v1/field-media`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': media.mimeType, 'x-operation-id': operationId, 'x-batch-id': batchId, 'x-media-id': media.id, 'x-content-sha256': media.sha256 },
    body,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? `Falló la foto ${media.id}.`);
  return payload.data.objectKey as string;
};

export const synchronizeFieldState = async (state: AppState) => {
  const connection = await NetInfo.fetch();
  if (!connection.isConnected) throw new Error('Sin conexión. La cola permanece en el teléfono.');
  const { endpoint, token } = await loadSyncSettings();
  if (!endpoint || !token) throw new Error('Configure el servidor y el token operativo.');
  const batchId = `batch-${Crypto.randomUUID()}`;
  const operationId = state.operationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const queuedIds = new Set(state.outbox.map((item) => item.entityId));
  const queuedMedia = state.media.filter((item) => queuedIds.has(item.id));
  const objectKeys = new Map<string, string>();
  for (const media of queuedMedia) objectKeys.set(media.id, await uploadMedia(endpoint, token, operationId, batchId, media));
  const response = await fetch(`${endpoint}/api/internal/v1/field-sync`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 1, batchId, operationId, deviceIdHash: await installationHash(), createdAt: new Date().toISOString(), infrastructures: state.infrastructures, inspections: state.inspections.filter((item) => queuedIds.has(item.id)), media: queuedMedia.map(({ uri: _uri, immutable: _immutable, ...item }) => ({ ...item, objectKey: objectKeys.get(item.id) })), annotations: state.annotations.filter((item) => queuedIds.has(item.id)) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? 'El servidor rechazó el lote.');
  return { batchId, acknowledgedEntityIds: [...queuedIds] };
};
