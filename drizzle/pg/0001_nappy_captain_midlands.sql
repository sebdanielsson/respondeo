ALTER TABLE "quiz" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz" ADD COLUMN "difficulty" text DEFAULT 'medium' NOT NULL;
