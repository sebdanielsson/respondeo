import { invalidateCache, deleteCache } from "./client";
import { CACHE_KEYS } from "./config";

/**
 * Cache invalidation for quiz mutations.
 *
 * `cachedFetch` stores quiz reads under the `CACHE_KEYS` prefixes with TTLs of
 * 5-10 minutes. Without eager invalidation an edit stays invisible for up to
 * ten minutes — and, more seriously, `POST /api/quizzes/[id]/attempts` grades
 * against `getQuizById`, so a corrected answer key keeps grading by the old one
 * until the entry expires.
 *
 * Leaderboards are deliberately *not* invalidated on attempt submission: they
 * are written on every play, so eager invalidation there would defeat the
 * cache. They keep their TTL-based expiry. Quiz deletion is the exception —
 * a leaderboard for a quiz that no longer exists should go immediately.
 *
 * All of these are best-effort: `invalidateCache`/`deleteCache` no-op when
 * caching is disabled and swallow Redis errors, so callers need not guard.
 */

/**
 * Invalidate every cached quiz list page.
 *
 * List keys are `quizzes:list:{admin|public}:{page}:{limit}`, so a create or
 * delete can shift entries across every page and all of them must go.
 */
export async function invalidateQuizLists(): Promise<void> {
  await invalidateCache(`${CACHE_KEYS.QUIZ_LIST}:*`);
}

/**
 * Invalidate a single quiz's detail entry and all list pages.
 *
 * @param quizId The quiz that changed
 */
export async function invalidateQuiz(quizId: string): Promise<void> {
  await Promise.all([deleteCache(`${CACHE_KEYS.QUIZ_DETAIL}:${quizId}`), invalidateQuizLists()]);
}

/**
 * Invalidate everything belonging to a deleted quiz, including its leaderboard
 * pages and the global leaderboard that aggregated its attempts.
 *
 * @param quizId The quiz that was deleted
 */
export async function invalidateDeletedQuiz(quizId: string): Promise<void> {
  await Promise.all([
    deleteCache(`${CACHE_KEYS.QUIZ_DETAIL}:${quizId}`),
    invalidateQuizLists(),
    invalidateCache(`${CACHE_KEYS.LEADERBOARD}:${quizId}:*`),
    invalidateCache(`${CACHE_KEYS.GLOBAL_LEADERBOARD}:*`),
  ]);
}
