import { createContext, useContext, useState, ReactNode } from 'react';

export interface AuthModalContextMessage {
  ka: string;
  en: string;
}

interface OpenAuthModalOptions {
  message?: AuthModalContextMessage;
  mode?: 'login' | 'register';
  // Fires once login succeeds (email/password or Google) instead of the
  // default role-based redirect — used to resume an interrupted action, e.g.
  // "sign in to enroll" continuing straight into BOG checkout for the exact
  // course the guest was trying to buy.
  onSuccess?: () => void;
}

interface AuthModalContextValue {
  isOpen: boolean;
  contextMessage: AuthModalContextMessage | null;
  initialMode: 'login' | 'register';
  onSuccess: (() => void) | null;
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextMessage, setContextMessage] = useState<AuthModalContextMessage | null>(null);
  const [initialMode, setInitialMode] = useState<'login' | 'register'>('login');
  const [onSuccess, setOnSuccess] = useState<(() => void) | null>(null);

  const openAuthModal = (options?: OpenAuthModalOptions) => {
    setContextMessage(options?.message ?? null);
    setInitialMode(options?.mode ?? 'login');
    // Wrapped in an arrow function — useState's setter treats a bare function
    // value as an updater, not a value to store.
    setOnSuccess(options?.onSuccess ? () => options.onSuccess! : null);
    setIsOpen(true);
  };

  const closeAuthModal = () => {
    setIsOpen(false);
    setContextMessage(null);
    setOnSuccess(null);
  };

  return (
    <AuthModalContext.Provider value={{ isOpen, contextMessage, initialMode, onSuccess, openAuthModal, closeAuthModal }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
