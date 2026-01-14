CREATE TABLE "content_tag_suggestions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_content_id" varchar(255) NOT NULL,
	"fk_tag_id" varchar(255) NOT NULL,
	"fk_user_id" varchar(255) NOT NULL,
	"score" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tag_suggestions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tag_suggestions" CASCADE;--> statement-breakpoint
DROP INDEX "unique_tag_concept";--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "fk_embedding_id" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "content_tag_suggestions_content_idx" ON "content_tag_suggestions" USING btree ("fk_content_id");--> statement-breakpoint
CREATE INDEX "content_tag_suggestions_tag_idx" ON "content_tag_suggestions" USING btree ("fk_tag_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_fk_embedding_id_tag_embeddings_id_fk" FOREIGN KEY ("fk_embedding_id") REFERENCES "public"."tag_embeddings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_tag_concept" ON "tag_embeddings" USING btree ("semantic");--> statement-breakpoint
ALTER TABLE "tag_embeddings" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "semantic";