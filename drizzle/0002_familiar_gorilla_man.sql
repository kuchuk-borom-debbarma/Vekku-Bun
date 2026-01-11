ALTER TABLE "tag_embeddings" DROP CONSTRAINT "tag_embeddings_fk_tag_id_tags_id_fk";
--> statement-breakpoint
DROP INDEX "unique_tag_embedding";--> statement-breakpoint
ALTER TABLE "tag_embeddings" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tag_embeddings" ADD COLUMN "semantic" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_tag_concept" ON "tag_embeddings" USING btree ("name","semantic");--> statement-breakpoint
ALTER TABLE "tag_embeddings" DROP COLUMN "fk_tag_id";