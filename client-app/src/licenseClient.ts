export type LicenseValidationResponse =
  | {
      ok: true;
      valid: true;
      license_id: number;
      activation_id: number;
      status: "active" | "blocked" | "expired";
      expires_at: string | null;
    }
  | {
      ok: true;
      valid: false;
      reason:
        | "not_found"
        | "blocked"
        | "expired"
        | "activation_limit_exceeded"
        | "device_not_activated"
        | "deactivated"
        | "invalid_payload";
    };

type LicenseRequest = {
  license_key: string;
  device_id: string;
  device_name?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }

  return JSON.parse(text) as T;
}

export function createLicenseClient(serverUrl: string) {
  const base = serverUrl.replace(/\/+$/, "");

  return {
    activate(input: LicenseRequest) {
      return postJson<LicenseValidationResponse>(
        `${base}/api/license/activate`,
        input
      );
    },

    check(input: Omit<LicenseRequest, "device_name">) {
      return postJson<LicenseValidationResponse>(
        `${base}/api/license/check`,
        input
      );
    },

    deactivate(input: Omit<LicenseRequest, "device_name">) {
      return postJson<{ ok: true; deactivated: boolean }>(
        `${base}/api/license/deactivate`,
        input
      );
    },
  };
}