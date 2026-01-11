CREATE TABLE "contents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_user_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"contentType" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_embeddings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_tag_id" varchar(255) NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tag_suggestions" (
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
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tag_embeddings" ADD CONSTRAINT "tag_embeddings_fk_tag_id_tags_id_fk" FOREIGN KEY ("fk_tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_pagination_idx" ON "contents" USING btree ("fk_user_id","is_deleted","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "embedding_hnsw_idx" ON "tag_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_tag_embedding" ON "tag_embeddings" USING btree ("fk_tag_id");--> statement-breakpoint
CREATE INDEX "tag_suggestions_content_idx" ON "tag_suggestions" USING btree ("fk_content_id");--> statement-breakpoint
CREATE INDEX "tag_suggestions_tag_idx" ON "tag_suggestions" USING btree ("fk_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_tag_active" ON "tags" USING btree ("fk_user_id","name") WHERE "tags"."is_deleted" = false;