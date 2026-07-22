import { createContext, useContext, useState, ReactNode } from 'react';

export interface AuthModalContextMessage {
  ka: string;
  en: string;
}

interface OpenAuthModalOptions {
  message?: AuthModalContextMessage;
  mode?: 'login' | 'register';
}

interface AuthModalContextValue {
  isOpen: boolean;
  contextMessage: AuthModalContextMessage | null;
  initialMode: 'login' | 'register';
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextMessage, setContextMessage] = useState<AuthModalContextMessage | null>(null);
  const [initialMode, setInitialMode] = useState<'login' | 'register'>('login');

  const openAuthModal = (options?: OpenAuthModalOptions) => {
    setContextMessage(options?.message ?? null);
    setInitialMode(options?.mode ?? 'login');
    setIsOpen(true);
  };

  const closeAuthModal = () => {
    setIsOpen(false);
    setContextMessage(null);
  };

  return (
    <AuthModalContext.Provider value={{ isOpen, contextMessage, initialMode, openAuthModal, closeAuthModal }}>
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
