import type { LicenseValidationResponse } from "./licenseClient.js";

type ProtectedAppOptions = {
  checkIntervalMs: number;
  onCheck: () => Promise<LicenseValidationResponse>;
};

export async function runProtectedApp(options: ProtectedAppOptions) {
  console.log("🚀 Meridian protected app started");
  console.log("");
  console.log("This is a demo protected application.");
  console.log("If you see this message, license validation passed.");
  console.log("");

  let tick = 0;

  const appTimer = setInterval(() => {
    tick += 1;
    console.log(`✅ App is running... ${tick}`);
  }, 1000);

  const checkTimer = setInterval(async () => {
    try {
      const result = await options.onCheck();

      if (result.valid) {
        console.log(`🔐 License re-check OK · activation_id: ${result.activation_id}`);
        return;
      }

      console.log("");
      console.log("⛔ License became invalid while app was running");
      console.log(`Reason: ${result.reason}`);
      console.log("Application stopped.");

      clearInterval(appTimer);
      clearInterval(checkTimer);
      process.exit(1);
    } catch (e: unknown) {
      console.log("");
      console.log("⛔ License re-check failed");
      console.log(e instanceof Error ? e.message : String(e));
      console.log("Application stopped.");

      clearInterval(appTimer);
      clearInterval(checkTimer);
      process.exit(1);
    }
  }, options.checkIntervalMs);
}