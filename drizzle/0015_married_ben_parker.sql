CREATE TABLE "content_embeddings" (
	"fk_content_id" varchar(255) PRIMARY KEY NOT NULL,
	"embedding" vector(384),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_embeddings" ADD CONSTRAINT "content_embeddings_fk_content_id_contents_id_fk" FOREIGN KEY ("fk_content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_embedding_hnsw_idx" ON "content_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "content_tags_tag_id_idx" ON "content_tags" USING btree ("fk_tag_id");--> statement-breakpoint
CREATE INDEX "content_tags_content_id_idx" ON "content_tags" USING btree ("fk_content_id");