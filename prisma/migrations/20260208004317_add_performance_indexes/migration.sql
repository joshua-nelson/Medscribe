-- CreateIndex
CREATE INDEX "encounters_provider_id_status_idx" ON "encounters"("provider_id", "status");

-- CreateIndex
CREATE INDEX "encounters_provider_id_started_at_idx" ON "encounters"("provider_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "encounters_status_started_at_idx" ON "encounters"("status", "started_at");

-- CreateIndex
CREATE INDEX "transcripts_encounter_id_idx" ON "transcripts"("encounter_id");
