// Shared client-side guard for every image-upload input in the app (avatar,
// team/trainer photos, blog/gallery/homepage/studio-case images) — mirrors
// the 10MB limit enforced by the corresponding backend multer configs, so
// oversized files are rejected instantly instead of round-tripping to the
// server first.
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export const IMAGE_SIZE_ERROR = {
  ka: 'ფოტოს ზომა აჭარბებს 10MB-ს. გთხოვთ, აირჩიოთ უფრო მცირე ზომის ფაილი.',
  en: 'The photo exceeds 10MB. Please choose a smaller file.',
};

export function isImageTooLarge(file: File): boolean {
  return file.size > MAX_IMAGE_SIZE_BYTES;
}
