import { SupportedLocale } from './locale';

// Shared client-side guard for every image-upload input in the app (avatar,
// team/trainer photos, blog/gallery/homepage/studio-case images) — mirrors
// the 10MB limit enforced by the corresponding backend multer configs, so
// oversized files are rejected instantly instead of round-tripping to the
// server first.
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const IMAGE_SIZE_ERROR_BASE = {
  ka: 'ფოტოს ზომა აჭარბებს 10MB-ს. გთხოვთ, აირჩიოთ უფრო მცირე ზომის ფაილი.',
  en: 'The photo exceeds 10MB. Please choose a smaller file.',
};

// English fallback for locales without a translation yet, so non-ka/en
// visitors don't silently see Georgian.
export const IMAGE_SIZE_ERROR: Record<SupportedLocale, string> = {
  ...IMAGE_SIZE_ERROR_BASE,
  de: IMAGE_SIZE_ERROR_BASE.en,
  es: IMAGE_SIZE_ERROR_BASE.en,
  fr: IMAGE_SIZE_ERROR_BASE.en,
  uk: IMAGE_SIZE_ERROR_BASE.en,
};

export function isImageTooLarge(file: File): boolean {
  return file.size > MAX_IMAGE_SIZE_BYTES;
}
