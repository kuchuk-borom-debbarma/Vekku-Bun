DROP INDEX "contents_pagination_idx";--> statement-breakpoint
DROP INDEX "tags_pagination_idx";--> statement-breakpoint
DROP INDEX "unique_user_tag_active";--> statement-breakpoint
CREATE INDEX "contents_pagination_idx" ON "contents" USING btree ("fk_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tags_pagination_idx" ON "tags" USING btree ("fk_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_tag_active" ON "tags" USING btree ("fk_user_id","name");--> statement-breakpoint
ALTER TABLE "content_tag_suggestions" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "content_tag_suggestions" DROP COLUMN "is_deleted";--> statement-breakpoint
ALTER TABLE "contents" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "contents" DROP COLUMN "is_deleted";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "is_deleted";