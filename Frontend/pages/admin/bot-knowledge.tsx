import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import Head from 'next/head';
import { FileText, UploadCloud, Trash2, RefreshCw } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getKnowledgeSources, uploadKnowledgeSource, deleteKnowledgeSource, KnowledgeSource } from '../../src/services/adminKnowledgeService';

const ALLOWED_EXT = /\.(pdf|docx|md|txt)$/i;

function formatBytes(chars: number): string {
  // Rough size proxy (character count, not the original file's byte size —
  // this is the stored Markdown's length, which is what actually matters
  // for prompt/token cost).
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function AdminBotKnowledgeDashboard() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSources(await getKnowledgeSources());
    } catch {
      setError('ცოდნის ბაზის ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleFile = async (file: File) => {
    if (!ALLOWED_EXT.test(file.name)) {
      setUploadError('დაშვებულია მხოლოდ PDF, DOCX ან Markdown (.md) ფაილები.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadKnowledgeSource(file);
      await loadSources();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (sourceFilename: string) => {
    if (!window.confirm(`წაიშალოს "${sourceFilename}"?`)) return;
    setError(null);
    try {
      await deleteKnowledgeSource(sourceFilename);
      setSources((prev) => prev.filter((s) => s.sourceFilename !== sourceFilename));
    } catch {
      setError('წაშლა ვერ მოხერხდა.');
    }
  };

  return (
    <>
      <Head>
        <title>AI Assistant Knowledge Base | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">AI ასისტენტის ცოდნის ბაზა</h1>
          <p className="text-sm text-gray-500 mt-1">
            ატვირთეთ დოკუმენტები (PDF, DOCX, Markdown) — ავტომატურად გარდაიქმნება სუფთა Markdown-ად და გამოიყენება CDC-ის
            მთავარი AI ასისტენტის (მთავარ გვერდზე) პასუხებში.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors mb-4 ${
            dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'
          }`}
        >
          <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-indigo-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 mb-3">
            ჩააგდეთ ფაილი აქ, ან
            <label className="text-indigo-600 font-medium cursor-pointer hover:text-indigo-800 ml-1">
              აირჩიეთ ფაილი
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.md,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </p>
          <p className="text-xs text-gray-400">PDF, DOCX, ან Markdown (.md) — მაქს. 20MB</p>
          {uploading && <p className="text-xs font-medium text-indigo-600 mt-3">იტვირთება და მუშავდება…</p>}
        </div>
        {uploadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{uploadError}</div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-sm text-gray-900 mb-4">აქტიური დოკუმენტები ({sources.length})</h2>
          {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <p className="text-sm text-gray-400">იტვირთება…</p>
          ) : sources.length === 0 ? (
            <p className="text-xs text-gray-400">ჯერ არცერთი დოკუმენტი არ არის ატვირთული.</p>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.sourceFilename}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{source.sourceFilename}</p>
                      <p className="text-xs text-gray-400">
                        {source.totalChunks} ნაწილი · {formatBytes(source.totalChars)} · განახლდა{' '}
                        {new Date(source.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      title="ხელახლა სინქრონიზაცია — ატვირთეთ იგივე ფაილის ახალი ვერსია"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      რესინქრონიზაცია
                      <input
                        type="file"
                        accept=".pdf,.docx,.md,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(source.sourceFilename)}
                      className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminBotKnowledgePage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminBotKnowledgeDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
