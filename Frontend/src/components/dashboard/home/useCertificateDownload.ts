/**
 * Certificate download flow for the "My courses" tab of /dashboard:
 * confirm-name modal → PDF download, plus the one-download-per-course
 * limit modal. Rendering lives in CertificateModals.tsx.
 */
import { useState } from 'react';
import { User } from '../../../types/auth';
import { downloadCertificate } from '../../../services/courseService';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { DashboardStrings } from './dashboardDict';

export function useCertificateDownload({ user, t }: { user: User | null | undefined; t: DashboardStrings }) {
  const [downloadingCourseId, setDownloadingCourseId] = useState<string | null>(null);
  const [confirmCourseId, setConfirmCourseId] = useState<string | null>(null);
  const [certDownloadError, setCertDownloadError] = useState<string | null>(null);
  const [certLimitMessage, setCertLimitMessage] = useState<string | null>(null);

  useEscapeToClose(confirmCourseId !== null, () => setConfirmCourseId(null));
  useEscapeToClose(certLimitMessage !== null, () => setCertLimitMessage(null));

  // Same legal-name precedence as the certificate generator and learn.tsx's
  // confirmation modal — keeps every "what name prints on the cert" surface
  // in sync with a single rule.
  const certificateNameKa =
    user?.legalFirstNameKa && user?.legalLastNameKa ? `${user.legalFirstNameKa} ${user.legalLastNameKa}` : user?.name ?? '';
  const certificateNameEn =
    user?.legalFirstNameEn && user?.legalLastNameEn ? `${user.legalFirstNameEn} ${user.legalLastNameEn}` : null;

  /** Course card button: opens the confirm modal, or the limit modal if already downloaded once. */
  const requestCertificate = (courseId: string, certificateDownloadCount: number) => {
    if (certificateDownloadCount >= 1) {
      setCertLimitMessage(t.certLimitMessage);
      return;
    }
    setCertDownloadError(null);
    setConfirmCourseId(courseId);
  };

  const handleDownloadCertificate = async (courseId: string, courseTitle: string) => {
    setDownloadingCourseId(courseId);
    setCertDownloadError(null);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${courseTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setConfirmCourseId(null);
    } catch (err: any) {
      // responseType: 'blob' means an error response's JSON body arrives as
      // a Blob too, not parsed data — err.response.data.message would be
      // undefined even when the server sent a real error message. Without
      // this, a failed request (e.g. the one-download-per-course limit)
      // just silently reset the button with no feedback at all.
      const errorBlob = err?.response?.data;
      let serverMessage: string | undefined;
      let serverErrorKey: string | undefined;
      if (errorBlob instanceof Blob) {
        try {
          const parsed = JSON.parse(await errorBlob.text());
          serverMessage = parsed?.message;
          serverErrorKey = parsed?.error;
        } catch {
          // not JSON — ignore, fall back to the generic message below
        }
      }
      if (serverErrorKey === 'DOWNLOAD_LIMIT_REACHED') {
        setConfirmCourseId(null);
        setCertLimitMessage(serverMessage ?? t.certLimitMessage);
      } else {
        setCertDownloadError(serverMessage || t.certDownloadFailed);
      }
    } finally {
      setDownloadingCourseId(null);
    }
  };

  return {
    downloadingCourseId,
    confirmCourseId,
    setConfirmCourseId,
    certDownloadError,
    certLimitMessage,
    setCertLimitMessage,
    certificateNameKa,
    certificateNameEn,
    requestCertificate,
    handleDownloadCertificate,
  };
}

export type CertificateDownload = ReturnType<typeof useCertificateDownload>;
