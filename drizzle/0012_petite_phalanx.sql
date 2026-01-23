DROP INDEX "tags_search_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "tags_search_idx" ON "tags" USING bm25 ("id","name","semantic") WITH (key_field=id);