import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../utils/imageUpload';
import { onImageErrorFallback } from '../../utils/imageFallback';

interface ImageGalleryUploaderProps {
  coverUrl: string;
  onCoverChange: (url: string) => void;
  previewImages: string[];
  onPreviewImagesChange: (urls: string[]) => void;
  // Injected so admin/products.tsx and dashboard.tsx's graduate submission
  // form can point at their own upload endpoint (SUPER_ADMIN/MANAGER-only
  // vs verified-graduate — see productService.ts's uploadProductImage vs
  // uploadMyProductImage) without this component knowing which caller it is.
  uploadImage: (file: File) => Promise<string>;
  maxGalleryImages?: number;
  labels: {
    coverLabel: string;
    coverHint: string;
    galleryLabel: string;
    addMore: string;
    uploading: string;
    remove: string;
    // Fallback only for errors with no server-provided message (e.g. a
    // network failure) — a real server message (413 too large, 403 not
    // permitted, etc.) always takes priority, see handleCoverFile/
    // handleGalleryFiles below.
    uploadFailed: string;
  };
  lang: 'ka' | 'en';
  disabled?: boolean;
}

// 1 main cover + up to `maxGalleryImages` (default 4 — Gumroad/Amazon-style
// "5 images total") showcase screenshots, both drag-and-drop capable. Cover
// and gallery slots share the same isImageTooLarge/10MB guard already used
// elsewhere in the app (see admin/studio-cases.tsx).
export default function ImageGalleryUploader({
  coverUrl,
  onCoverChange,
  previewImages,
  onPreviewImagesChange,
  uploadImage,
  maxGalleryImages = 4,
  labels,
  lang,
  disabled = false,
}: ImageGalleryUploaderProps) {
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [galleryDragActive, setGalleryDragActive] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = Math.max(0, maxGalleryImages - previewImages.length);

  const handleCoverFile = async (file: File) => {
    if (isImageTooLarge(file)) return setError(IMAGE_SIZE_ERROR[lang]);
    setError(null);
    setUploadingCover(true);
    try {
      onCoverChange(await uploadImage(file));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? labels.uploadFailed);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryFiles = async (files: File[]) => {
    if (files.length === 0 || remainingSlots === 0) return;
    const accepted = files.slice(0, remainingSlots);
    if (accepted.some(isImageTooLarge)) return setError(IMAGE_SIZE_ERROR[lang]);
    setError(null);
    setUploadingGallery(true);
    try {
      const urls = await Promise.all(accepted.map(uploadImage));
      onPreviewImagesChange([...previewImages, ...urls]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? labels.uploadFailed);
    } finally {
      setUploadingGallery(false);
    }
  };

  const removePreviewImage = (url: string) => {
    onPreviewImagesChange(previewImages.filter((u) => u !== url));
  };

  const dragHandlers = (setActive: (v: boolean) => void) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setActive(true);
    },
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setActive(true);
    },
    onDragLeave: (e: DragEvent) => {
      e.preventDefault();
      setActive(false);
    },
  });

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* COVER — main product image, required by the forms that use this. */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{labels.coverLabel}</label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && coverInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) coverInputRef.current?.click();
          }}
          {...dragHandlers(setCoverDragActive)}
          onDrop={(e) => {
            e.preventDefault();
            setCoverDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleCoverFile(file);
          }}
          className={`relative flex items-center gap-3 rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors ${
            coverDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
          }`}
        >
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploadingCover}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) handleCoverFile(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" onError={onImageErrorFallback} className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
              <ImagePlus className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <p className="text-xs text-gray-500">{uploadingCover ? labels.uploading : labels.coverHint}</p>
        </div>
      </div>

      {/* GALLERY — up to maxGalleryImages additional screenshots. */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {labels.galleryLabel} <span className="text-gray-400 font-normal">({previewImages.length}/{maxGalleryImages})</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {previewImages.map((url) => (
            <div key={url} className="relative w-20 h-20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" onError={onImageErrorFallback} className="w-full h-full rounded-lg object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => removePreviewImage(url)}
                aria-label={labels.remove}
                disabled={disabled}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center border-none cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {remainingSlots > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => !disabled && galleryInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) galleryInputRef.current?.click();
              }}
              {...dragHandlers(setGalleryDragActive)}
              onDrop={(e) => {
                e.preventDefault();
                setGalleryDragActive(false);
                handleGalleryFiles(Array.from(e.dataTransfer.files ?? []));
              }}
              className={`w-20 h-20 shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                galleryDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
              }`}
            >
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={disabled || uploadingGallery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  handleGalleryFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
                className="hidden"
              />
              {uploadingGallery ? (
                <span className="text-[10px] text-gray-500 text-center px-1">{labels.uploading}</span>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-gray-400" />
                  <span className="text-[9px] font-medium text-gray-400">{labels.addMore}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
