import os from "node:os";
import crypto from "node:crypto";

export function getDeviceName() {
  return process.env.DEVICE_NAME?.trim() || os.hostname();
}

export function getDeviceId() {
  const raw = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
  ].join("|");

  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);

  return `device_${hash}`;
}