CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "answer_question_id_idx" ON "answer" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "attempt_answer_attempt_id_idx" ON "attempt_answer" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "attempt_answer_question_id_idx" ON "attempt_answer" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "attempt_answer_answer_id_idx" ON "attempt_answer" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "question_quiz_id_order_idx" ON "question" USING btree ("quiz_id","order");--> statement-breakpoint
CREATE INDEX "quiz_author_id_idx" ON "quiz" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "quiz_published_at_idx" ON "quiz" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "quiz_created_at_idx" ON "quiz" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quiz_attempt_quiz_id_user_id_idx" ON "quiz_attempt" USING btree ("quiz_id","user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_user_id_idx" ON "quiz_attempt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_quiz_id_score_idx" ON "quiz_attempt" USING btree ("quiz_id","correct_count" desc,"total_time_ms" asc);--> statement-breakpoint
CREATE INDEX "quiz_attempt_completed_at_idx" ON "quiz_attempt" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");