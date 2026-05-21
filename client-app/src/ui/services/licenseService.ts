export type Screen = "loading" | "activation" | "valid" | "invalid";

export type DeviceInfo = {
    device_id: string;
    device_name: string;
    server_url: string;
};

export function reasonText(reason: string) {
    const map: Record<string, string> = {
        no_license: "Лицензия ещё не активирована.",
        not_found: "Ключ не найден на сервере.",
        blocked: "Ключ заблокирован администратором.",
        expired: "Срок действия лицензии истёк.",
        activation_limit_exceeded: "Превышен лимит активаций.",
        device_not_activated: "Это устройство не активировано.",
        deactivated: "Это устройство было деактивировано.",
        invalid_payload: "Некорректные данные запроса.",
        server_error: "Нет соединения с сервером лицензий.",
    };

    return map[reason] ?? reason;
}

const LAST_VALID_AT_KEY = "entitlex_last_valid_at";
const LAST_VALID_LICENSE_KEY = "entitlex_last_valid_license";
const OFFLINE_GRACE_HOURS = 24;

export type CachedLicenseState = {
    last_valid_at: string;
    activation_id: number | null;
    expires_at: string | null;
};

export function rememberValidCheck(input: {
    activation_id: number;
    expires_at: string | null;
}) {
    const payload: CachedLicenseState = {
        last_valid_at: new Date().toISOString(),
        activation_id: input.activation_id,
        expires_at: input.expires_at,
    };

    localStorage.setItem(LAST_VALID_AT_KEY, payload.last_valid_at);
    localStorage.setItem(LAST_VALID_LICENSE_KEY, JSON.stringify(payload));
}

export function getCachedLicenseState(): CachedLicenseState | null {
    try {
        const raw = localStorage.getItem(LAST_VALID_LICENSE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw) as Partial<CachedLicenseState>;

        if (!data.last_valid_at) return null;

        return {
            last_valid_at: data.last_valid_at,
            activation_id:
                typeof data.activation_id === "number" ? data.activation_id : null,
            expires_at: typeof data.expires_at === "string" ? data.expires_at : null,
        };
    } catch {
        return null;
    }
}

export function hasOfflineGrace() {
    const cached = getCachedLicenseState();
    if (!cached) return false;

    const now = Date.now();

    // ❗ проверка срока лицензии
    if (cached.expires_at) {
        const exp = new Date(cached.expires_at).getTime();
        if (Number.isFinite(exp) && exp < now) {
            return false;
        }
    }

    const diffMs = now - new Date(cached.last_valid_at).getTime();
    const hours = diffMs / 1000 / 60 / 60;

    return hours < OFFLINE_GRACE_HOURS;
}

export function clearValidCheckMemory() {
    localStorage.removeItem(LAST_VALID_AT_KEY);
    localStorage.removeItem(LAST_VALID_LICENSE_KEY);
}

export async function getSettings() {
    return window.settings.get();
}

export async function saveSettings(data: {
    server_url?: string;
    check_interval?: number;
}) {
    return window.settings.set(data);
}

export function fmtDate(v: string | null | undefined) {
    if (!v) return "Без срока";
    return v.slice(0, 10);
}

export function getEntitlexVersion() {
    return window.meridian.version;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
    return window.meridian.license.device();
}

export async function checkLicense() {
    return window.meridian.license.check();
}

export async function activateLicense(licenseKey: string) {
    return window.meridian.license.activate(licenseKey);
}

export async function deactivateLicense() {
    return window.meridian.license.deactivate();
}

export function isExpiringSoon(date?: string | null, days = 7) {
    if (!date) return false;

    const expiresAt = new Date(date).getTime();
    if (!Number.isFinite(expiresAt)) return false;

    const diffMs = expiresAt - Date.now();
    return diffMs > 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

export function daysUntil(date?: string | null) {
    if (!date) return null;

    const expiresAt = new Date(date).getTime();
    if (!Number.isFinite(expiresAt)) return null;

    const diffMs = expiresAt - Date.now();
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function licenseLifetimePercent(expiresAt?: string | null, warningDays = 7) {
    const days = daysUntil(expiresAt);

    if (days === null) return null;
    if (days <= 0) return 0;
    if (days >= warningDays) return 100;

    return Math.round((days / warningDays) * 100);
}

