import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '../types/auth';

// Same "ka/en pair or already-resolved string" shape as AuthModalContext's
// AuthModalContextMessage — see that file's comment for why.
export type VerificationDrawerContextMessage = { ka: string; en: string } | string;

type VerificationDrawerSuccessHandler = (user: User) => void;

interface OpenVerificationDrawerOptions {
  message?: VerificationDrawerContextMessage;
  // Which tab opens first — a "Submit Proposal" block opens on Individual,
  // a "Post a Job" block opens on Business. Defaults to Individual.
  initialTab?: 'individual' | 'business';
  // Fires once the relevant verification is actually APPROVED (not just
  // submitted) — most callers won't use this since approval is rarely
  // instant; it exists for the same "resume the interrupted action" shape
  // AuthModalContext's onSuccess has, for the auto-approve business KYC path.
  onSuccess?: VerificationDrawerSuccessHandler;
}

interface VerificationDrawerContextValue {
  isOpen: boolean;
  contextMessage: VerificationDrawerContextMessage | null;
  initialTab: 'individual' | 'business';
  onSuccess: VerificationDrawerSuccessHandler | null;
  openVerificationDrawer: (options?: OpenVerificationDrawerOptions) => void;
  closeVerificationDrawer: () => void;
}

const VerificationDrawerContext = createContext<VerificationDrawerContextValue | undefined>(undefined);

export function VerificationDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextMessage, setContextMessage] = useState<VerificationDrawerContextMessage | null>(null);
  const [initialTab, setInitialTab] = useState<'individual' | 'business'>('individual');
  const [onSuccess, setOnSuccess] = useState<VerificationDrawerSuccessHandler | null>(null);

  const openVerificationDrawer = (options?: OpenVerificationDrawerOptions) => {
    setContextMessage(options?.message ?? null);
    setInitialTab(options?.initialTab ?? 'individual');
    setOnSuccess(options?.onSuccess ? () => options.onSuccess! : null);
    setIsOpen(true);
  };

  const closeVerificationDrawer = () => {
    setIsOpen(false);
    setContextMessage(null);
    setOnSuccess(null);
  };

  return (
    <VerificationDrawerContext.Provider
      value={{ isOpen, contextMessage, initialTab, onSuccess, openVerificationDrawer, closeVerificationDrawer }}
    >
      {children}
    </VerificationDrawerContext.Provider>
  );
}

export function useVerificationDrawer(): VerificationDrawerContextValue {
  const context = useContext(VerificationDrawerContext);
  if (context === undefined) {
    throw new Error('useVerificationDrawer must be used within a VerificationDrawerProvider');
  }
  return context;
}
