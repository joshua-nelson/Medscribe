-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounter_id" UUID NOT NULL,
    "full_text" TEXT,
    "segments" JSONB,
    "audio_file_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
