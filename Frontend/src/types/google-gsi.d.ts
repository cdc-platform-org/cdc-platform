// Minimal typing for Google Identity Services' client-side script
// (https://accounts.google.com/gsi/client), loaded globally in _app.tsx.
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            // ISO 639-1 code (e.g. "en", "ka") — without this, Google
            // auto-detects the button/popup language from the browser's own
            // locale instead of following the site's language.
            locale?: string;
            // Fires for errors during the sign-in flow itself (e.g. a FedCM
            // failure) — NOT for an origin_mismatch, which Google's own
            // script logs to the console directly at script-load time,
            // before this callback (or `callback` above) ever runs.
            error_callback?: (error?: { type?: string; message?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'small' | 'medium' | 'large';
              width?: number;
              text?: 'signin_with' | 'signup_with' | 'continue_with';
            }
          ) => void;
        };
      };
    };
  }
}
