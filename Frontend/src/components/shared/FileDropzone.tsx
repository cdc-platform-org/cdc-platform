import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileCheck2 } from 'lucide-react';

interface FileDropzoneProps {
  // Same comma-separated format as a native <input accept>, e.g.
  // ".zip,.pdf,.psd,.mp4,.fig" — used only for the browser's picker filter,
  // NOT for validation (the backend's multer fileFilter is the real gate;
  // see Backend's middleware/productUploads.ts).
  accept: string;
  uploading: boolean;
  // Name of the file currently attached (already uploaded) — null before
  // anything's picked, or once cleared.
  selectedFileName: string | null;
  onFile: (file: File) => void;
  label: string;
  hint: string;
  uploadingLabel: string;
  className?: string;
}

// Generic drag-and-drop single-file dropzone for downloadable product assets
// (ZIP/PDF/PSD/MP4/FIG/etc.) — first real drag-and-drop surface in this app;
// every other upload input here is still a plain click-to-browse <input>.
// Reused by both the admin "Add Product" form and the graduate/freelancer
// submission form in dashboard.tsx, which only differ in which upload
// endpoint the file actually goes to (see productService.ts's
// uploadProductFile vs uploadMyProductFile).
export default function FileDropzone({
  accept,
  uploading,
  selectedFileName,
  onFile,
  label,
  hint,
  uploadingLabel,
  className = '',
}: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so picking the exact same file again still fires onChange.
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => handleDrag(e, true)}
      onDragEnter={(e) => handleDrag(e, true)}
      onDragLeave={(e) => handleDrag(e, false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
        dragActive
          ? 'border-indigo-500 bg-indigo-50'
          : selectedFileName
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
      } ${className}`}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} disabled={uploading} className="hidden" />
      {uploading ? (
        <p className="text-xs font-medium text-gray-500">{uploadingLabel}</p>
      ) : selectedFileName ? (
        <>
          <FileCheck2 className="w-6 h-6 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700 truncate max-w-full">{selectedFileName}</p>
          <p className="text-[11px] text-gray-400">{hint}</p>
        </>
      ) : (
        <>
          <UploadCloud className="w-6 h-6 text-gray-400" />
          <p className="text-xs font-semibold text-gray-600">{label}</p>
          <p className="text-[11px] text-gray-400">{hint}</p>
        </>
      )}
    </div>
  );
}
