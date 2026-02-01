CREATE TABLE "content_suggestions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_content_id" varchar(255) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
DROP TABLE "content_embeddings" CASCADE;--> statement-breakpoint
DROP TABLE "tag_embeddings" CASCADE;--> statement-breakpoint
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_fk_content_id_contents_id_fk" FOREIGN KEY ("fk_content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_suggestions_content_id_unique" ON "content_suggestions" USING btree ("fk_content_id");