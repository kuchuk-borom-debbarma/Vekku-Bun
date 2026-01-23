DROP INDEX "tags_search_idx";--> statement-breakpoint
CREATE INDEX "tags_search_idx" ON "tags" USING bm25 ("name","semantic") WITH (key_field=id);