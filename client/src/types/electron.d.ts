export {};

declare global {
  interface Window {
    electron?: {
      window: {
        minimize(): Promise<void>;
        maximize(): Promise<void>;
        close(): Promise<void>;
        isMaximized(): Promise<boolean>;
      };
    };
  }
}
