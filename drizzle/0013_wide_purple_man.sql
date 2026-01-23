CREATE TABLE "content_keyword_suggestions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_content_id" varchar(255) NOT NULL,
	"fk_user_id" varchar(255) NOT NULL,
	"keyword" text NOT NULL,
	"score" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_keyword_suggestions" ADD CONSTRAINT "content_keyword_suggestions_fk_content_id_contents_id_fk" FOREIGN KEY ("fk_content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_keyword_suggestions" ADD CONSTRAINT "content_keyword_suggestions_fk_user_id_users_id_fk" FOREIGN KEY ("fk_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_keyword_suggestions_content_idx" ON "content_keyword_suggestions" USING btree ("fk_content_id");