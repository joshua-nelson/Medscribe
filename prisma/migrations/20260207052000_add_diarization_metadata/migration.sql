-- AlterTable
ALTER TABLE "encounters"
ADD COLUMN "speaker_assignments" JSONB;

-- AlterTable
ALTER TABLE "transcripts"
ADD COLUMN "speaker_corrections" JSONB;
