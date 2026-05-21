/// <reference types="vite/client" />

type LicenseReason =
    | "no_license"
    | "not_found"
    | "blocked"
    | "expired"
    | "activation_limit_exceeded"
    | "device_not_activated"
    | "deactivated"
    | "invalid_payload";

type LicenseValidationResponse =
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
        reason: LicenseReason;
    };

interface Window {
    meridian: {
        version: string;
        license: {
            device: () => Promise<{
                device_id: string;
                device_name: string;
                server_url: string;
            }>;
            check: () => Promise<LicenseValidationResponse>;
            activate: (licenseKey: string) => Promise<LicenseValidationResponse>;
            deactivate: () => Promise<{ ok: true; deactivated: boolean }>;
        };
    };
    settings: {
        get: () => Promise<{
            server_url: string;
            check_interval: number;
        }>;

        set: (data: {
            server_url?: string;
            check_interval?: number;
        }) => Promise<boolean>;
    };
}