CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"fk_user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"semantic" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "tags_pagination_idx" ON "tags" USING btree ("fk_user_id","is_deleted","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);