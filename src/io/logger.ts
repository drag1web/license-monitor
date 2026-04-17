import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type Logger = {
  info: (msg: string) => Promise<void>;
  warn: (msg: string) => Promise<void>;
  error: (msg: string) => Promise<void>;
};

function timestamp(): string {
  return new Date().toISOString();
}

export async function createLogger(logPath: string): Promise<Logger> {
  await mkdir(dirname(logPath), { recursive: true });

  async function write(
    level: "INFO" | "WARN" | "ERROR",
    msg: string
  ): Promise<void> {
    await appendFile(
      logPath,
      `[${timestamp()}] ${level}: ${msg}\n`,
      "utf-8"
    );
  }

  return {
    info: (m) => write("INFO", m),
    warn: (m) => write("WARN", m),
    error: (m) => write("ERROR", m),
  };
}
