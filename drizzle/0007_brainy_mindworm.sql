CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "content_tags" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_user_id" varchar(255) NOT NULL,
	"fk_content_id" varchar(255) NOT NULL,
	"fk_tag_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" RENAME COLUMN "fk_embedding_id" TO "semantic";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_fk_embedding_id_tag_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "tag_embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
CREATE UNIQUE INDEX "content_tags_idx_user_content_tag" ON "content_tags" USING btree ("fk_user_id","fk_content_id","fk_tag_id");--> statement-breakpoint
CREATE INDEX "tags_semantic_idx" ON "tags" USING btree ("semantic");