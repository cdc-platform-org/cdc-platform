/**
 * @fileoverview Access guard for Design Studio (Ps/Ai) and Code/SQL Studio.
 * Same rules and paywall as every other AI tool (DigitalToolAccessGate):
 * admin, the 30-day purchase, a course that includes the studio, an admin
 * grant, or the free 3-day trial. Rendered "bare" because the studio pages
 * draw their own site header.
 */
import { ReactNode } from 'react';
import DigitalToolAccessGate from './DigitalToolAccessGate';

interface StudioWorkspaceGuardProps {
  studio: 'design' | 'code';
  lang?: string;
  children: ReactNode;
}

export default function StudioWorkspaceGuard({ studio, children }: StudioWorkspaceGuardProps) {
  return <DigitalToolAccessGate toolKey={`${studio}-studio`} bare>{children}</DigitalToolAccessGate>;
}
