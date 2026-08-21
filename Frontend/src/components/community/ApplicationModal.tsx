import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useTranslation } from 'next-i18next';
import { FileText, Upload } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useAuth } from '../../context/AuthContext';
import { uploadCv } from '../../services/authService';
import { classifyApiError, ApiErrorReason } from '../../utils/apiErrorMessages';
import PermissionDeniedModal from '../shared/PermissionDeniedModal';

interface ApplicationModalProps {
  title: string;
  includeBid: boolean;
  onSubmit: (data: { note: string; bidAmount?: number }) => Promise<void>;
  onClose: () => void;
}

export default function ApplicationModal({ title, includeBid, onSubmit, onClose }: ApplicationModalProps) {
  const { t } = useTranslation('proposals');
  const { user, refreshUser } = useAuth();
  const [note, setNote] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionErrorReason, setPermissionErrorReason] = useState<ApiErrorReason | null>(null);

  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  useEscapeToClose(true, onClose);

  const handleCvChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    setCvError(null);
    try {
      await uploadCv(file);
      await refreshUser();
    } catch (err: any) {
      setCvError(err?.response?.data?.message ?? t('proposalModal.cvUploadError'));
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPermissionErrorReason(null);
    setSubmitting(true);
    try {
      await onSubmit({
        note,
        bidAmount: includeBid ? Math.round(parseFloat(bidAmount) * 100) : undefined, // გადაჰყავს თეთრებში/ცენტებში
      });
      onClose();
    } catch (err: any) {
      const reason = classifyApiError(err?.response?.data?.message);
      if (reason) {
        setPermissionErrorReason(reason);
      } else {
        setError(t('marketplace.applicationError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {includeBid ? t('marketplace.proposalLabel') : t('marketplace.coverNoteLabel')}
            </label>
            <textarea
              required
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={includeBid ? t('marketplace.proposalPlaceholder') : t('marketplace.coverNotePlaceholder')}
            />
          </div>

          {includeBid && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('marketplace.yourBid')}</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('proposalModal.cvLabel')}</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                {uploadingCv ? t('proposalModal.cvUploading') : user?.cvUrl ? t('proposalModal.cvReplace') : t('proposalModal.cvUpload')}
                <input
                  ref={cvInputRef}
                  type="file"
                  accept="application/pdf,.doc,.docx"
                  onChange={handleCvChange}
                  className="hidden"
                  disabled={uploadingCv}
                />
              </label>
              {user?.cvUrl && (
                <a
                  href={user.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('proposalModal.cvView')}
                </a>
              )}
            </div>
            {cvError && <p className="text-xs text-red-600 mt-1.5">{cvError}</p>}
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">{t('marketplace.hrConsentNotice')}</p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('marketplace.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? t('marketplace.submitting') : t('marketplace.submit')}
            </button>
          </div>
        </form>
      </div>

      {permissionErrorReason && (
        <PermissionDeniedModal reason={permissionErrorReason} context="applying" onClose={() => setPermissionErrorReason(null)} />
      )}
    </div>
  );
}