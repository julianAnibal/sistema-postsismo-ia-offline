import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { DeviceCapabilities } from './devicePolicy';

export const collectDeviceCapabilities = async (): Promise<DeviceCapabilities> => {
  let maxAppMemoryBytes: number | null = null;
  let availableStorageBytes: number | null = null;

  if (Platform.OS === 'android') {
    try {
      maxAppMemoryBytes = await Device.getMaxMemoryAsync();
    } catch {
      maxAppMemoryBytes = null;
    }
  }

  if (Platform.OS !== 'web') {
    try {
      const available = Paths.availableDiskSpace;
      availableStorageBytes = available > 0 ? available : null;
    } catch {
      availableStorageBytes = null;
    }
  }

  return {
    platform: Platform.OS,
    isPhysicalDevice: Device.isDevice,
    totalMemoryBytes: Device.totalMemory,
    maxAppMemoryBytes,
    availableStorageBytes,
    cpuArchitectures: Device.supportedCpuArchitectures ?? [],
  };
};
