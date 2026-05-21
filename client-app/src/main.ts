import "dotenv/config";

import { getDeviceId, getDeviceName } from "./device.js";
import { createLicenseClient } from "./licenseClient.js";
import {
  readStoredLicense,
  removeStoredLicense,
  saveStoredLicense,
} from "./storage.js";
import { runProtectedApp } from "./protectedApp.js";

const serverUrl = process.env.LICENSE_SERVER_URL || "http://localhost:3000";
const deviceId = getDeviceId();
const deviceName = getDeviceName();

const action = process.argv[2] || "check";
const argKey = process.argv[3]?.trim();

const client = createLicenseClient(serverUrl);

function getLicenseKeyOrExit() {
  const stored = readStoredLicense();

  if (!stored?.license_key) {
    console.log("❌ No license key found.");
    console.log("");
    console.log("Activate first:");
    console.log("  npm run activate LM-XXXX-XXXX-XXXX");
    process.exit(1);
  }

  return stored.license_key;
}

function printHeader(actionName: string) {
  console.log("");
  console.log(`Action: ${actionName}`);
  console.log(`Server: ${serverUrl}`);
  console.log(`Device ID: ${deviceId}`);
  console.log(`Device Name: ${deviceName}`);
  console.log("");
}

async function main() {
  if (action === "activate") {
    const licenseKey = argKey;

    if (!licenseKey) {
      console.log("❌ License key is required.");
      console.log("");
      console.log("Usage:");
      console.log("  npm run activate LM-XXXX-XXXX-XXXX");
      process.exit(1);
    }

    const result = await client.activate({
      license_key: licenseKey,
      device_id: deviceId,
      device_name: deviceName,
    });

    printHeader("activate");

    if (!result.valid) {
      console.log("⛔ License denied");
      console.log(`Reason: ${result.reason}`);
      process.exit(1);
    }

    saveStoredLicense(licenseKey);

    console.log("✅ License activated");
    console.log(`License ID: ${result.license_id}`);
    console.log(`Activation ID: ${result.activation_id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Expires at: ${result.expires_at ?? "never"}`);
    console.log("");
    console.log("Saved to license.json");
    return;
  }

  if (action === "check") {
    const licenseKey = getLicenseKeyOrExit();

    const result = await client.check({
      license_key: licenseKey,
      device_id: deviceId,
    });

    printHeader("check");

    if (!result.valid) {
      console.log("⛔ License denied");
      console.log(`Reason: ${result.reason}`);
      process.exit(1);
    }

    console.log("✅ License is valid");
    console.log(`License ID: ${result.license_id}`);
    console.log(`Activation ID: ${result.activation_id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Expires at: ${result.expires_at ?? "never"}`);
    return;
  }

  if (action === "deactivate") {
    const licenseKey = getLicenseKeyOrExit();

    const result = await client.deactivate({
      license_key: licenseKey,
      device_id: deviceId,
    });

    printHeader("deactivate");

    console.log("Device deactivation");
    console.log(`Deactivated: ${result.deactivated}`);

    removeStoredLicense();
    console.log("Removed license.json");
    return;
  }

  if (action === "app") {
    const licenseKey = getLicenseKeyOrExit();

    const startupResult = await client.check({
      license_key: licenseKey,
      device_id: deviceId,
    });

    printHeader("app startup check");

    if (!startupResult.valid) {
      console.log("⛔ Application blocked");
      console.log(`Reason: ${startupResult.reason}`);
      process.exit(1);
    }

    console.log("✅ License check passed");
    console.log("Starting protected application...");
    console.log("");

    await runProtectedApp({
      checkIntervalMs: 10_000,
      onCheck: () =>
        client.check({
          license_key: licenseKey,
          device_id: deviceId,
        }),
    });

    return;
  }

  console.log("Unknown action.");
  console.log("");
  console.log("Use:");
  console.log("  npm run activate LM-XXXX-XXXX-XXXX");
  console.log("  npm run check");
  console.log("  npm run deactivate");
  console.log("  npm run app");
}

main().catch((e: unknown) => {
  console.error("❌ Client app error:");
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});