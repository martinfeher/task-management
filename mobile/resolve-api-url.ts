import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_API_URL = "http://localhost:3000";

function readConfiguredApiUrl() {
  return (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

function getDevMachineHostFromExpo(): string | null {
  const rawCandidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoGoConfig?.hostUri,
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    // Legacy manifest (Expo SDK < 49)
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    const host = raw.split(":")[0]?.trim();
    if (!host || host === "localhost" || host === "127.0.0.1") continue;
    return host;
  }

  return null;
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Resolves the REST API base URL for Expo clients.
 * On a physical device, `localhost` is the phone — in dev we swap loopback for
 * the Metro bundler host (your Mac's LAN IP) or the Android emulator alias.
 */
export function resolveMobileApiUrl() {
  const configured = readConfiguredApiUrl();

  if (!__DEV__) {
    return configured;
  }

  try {
    const url = new URL(configured);
    if (!isLoopbackHostname(url.hostname)) {
      return configured;
    }

    const devHost = getDevMachineHostFromExpo();
    if (devHost) {
      url.hostname = devHost;
      return url.toString().replace(/\/$/, "");
    }

    if (Platform.OS === "android") {
      url.hostname = "10.0.2.2";
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return configured;
  }

  return configured;
}

export function formatMobileApiConnectionHint(apiUrl: string) {
  if (!__DEV__) {
    return `Check that EXPO_PUBLIC_API_URL (${apiUrl}) is reachable from this device.`;
  }

  try {
    const { hostname } = new URL(apiUrl);
    if (isLoopbackHostname(hostname)) {
      return (
        "On a phone, localhost is the device itself. Set EXPO_PUBLIC_API_URL in mobile/.env " +
        "to your computer's LAN IP (e.g. http://192.168.1.10:3000), run `npm run dev` on the web app, " +
        "and use the same Wi‑Fi network."
      );
    }
  } catch {
    // ignore
  }

  return (
    "Make sure the web app is running (npm run dev in the project root) and your phone can reach " +
    apiUrl +
    " (same Wi‑Fi, firewall allows port 3000)."
  );
}
