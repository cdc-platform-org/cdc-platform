-- AlterTable
ALTER TABLE "live_trainings" ADD COLUMN     "synopsisEn" TEXT,
ADD COLUMN     "synopsisError" TEXT,
ADD COLUMN     "synopsisKa" TEXT,
ADD COLUMN     "synopsisRu" TEXT,
ADD COLUMN     "synopsisStatus" "SubtitlesStatus";
