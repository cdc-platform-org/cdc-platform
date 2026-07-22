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
