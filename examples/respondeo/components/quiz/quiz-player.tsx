"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Answer {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  imageUrl: string | null;
  answers: Answer[];
  displayOrder: number;
}

interface QuizPlayerProps {
  quizId: string;
  quizTitle: string;
  questions: Question[];
  timeLimitSeconds: number;
  onSubmit: (data: {
    quizId: string;
    answers: { questionId: string; answerId: string; displayOrder: number }[];
    totalTimeMs: number;
    timedOut: boolean;
    startToken?: string;
  }) => Promise<{ attemptId?: string; error?: string }>;
  isGuest?: boolean;
  /**
   * Server-issued start stamp. Returned on submission so the server can derive
   * the elapsed time itself instead of trusting the value below.
   */
  startToken?: string;
  /**
   * Grants the reveal of the first question. The answer key is not sent with
   * the page; correctness comes back one question at a time from `onReveal`,
   * which hands over a token for the next question each time.
   */
  initialProgressToken: string;
  onReveal: (input: {
    quizId: string;
    questionId: string;
    selectedAnswerId: string;
    progressToken: string;
  }) => Promise<{
    correctAnswerId: string | null;
    isCorrect: boolean;
    nextProgressToken?: string;
    error?: string;
  }>;
}

export function QuizPlayer({
  quizId,
  quizTitle,
  questions,
  timeLimitSeconds,
  onSubmit,
  isGuest = false,
  startToken,
  initialProgressToken,
  onReveal,
}: QuizPlayerProps) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, { answerId: string; displayOrder: number }>
  >({});
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  // Revealed by the server for the current question only.
  const [correctAnswerId, setCorrectAnswerId] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [progressToken, setProgressToken] = useState(initialProgressToken);
  // Guests are scored from the server's reveals rather than a local answer key.
  const guestCorrectRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestResult, setGuestResult] = useState<{
    score: number;
    total: number;
    timeMs: number;
  } | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasTimeLimit = timeLimitSeconds > 0;
  const timeRemainingMs = hasTimeLimit ? Math.max(0, timeLimitSeconds * 1000 - elapsedMs) : null;

  // Use a ref to track if we've already triggered a timeout submit
  const hasTimedOutRef = useRef(false);

  // Mirrors elapsedMs for reads inside callbacks. Depending on the state value
  // directly would change handleSubmit's identity on every 100ms tick, which
  // in turn tore down and recreated the timer interval ten times a second —
  // each recreation restarting the 100ms window, so elapsed time drifted low.
  // It is the leaderboard's tiebreaker, so that under-reporting was scored.
  const elapsedMsRef = useRef(0);
  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);

  // Guards every submission path. The timer can fire a timeout submit at the
  // same moment the player clicks through the last question; without this the
  // attempt is submitted twice and the second one burns another of their
  // allowed attempts.
  const hasSubmittedRef = useRef(false);

  const handleSubmit = useCallback(
    async (timedOut: boolean) => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;

      setIsSubmitting(true);
      setError(null);

      // Build answers array including unanswered questions
      const answers = questions.map((q) => ({
        questionId: q.id,
        answerId: selectedAnswers[q.id]?.answerId ?? "",
        displayOrder: q.displayOrder,
      }));

      // Guests are not persisted, so their score is the running total of the
      // server's per-question reveals rather than a local answer key.
      if (isGuest) {
        const score = guestCorrectRef.current;
        setGuestResult({ score, total: questions.length, timeMs: elapsedMsRef.current });
        setIsSubmitting(false);
        return;
      }

      try {
        const result = await onSubmit({
          quizId,
          answers,
          totalTimeMs: elapsedMsRef.current,
          timedOut,
          startToken,
        });

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
          hasSubmittedRef.current = false;
        } else if (result.attemptId) {
          router.push(`/quiz/${quizId}/results/${result.attemptId}`);
        }
      } catch (err) {
        console.error("Failed to submit quiz attempt:", err);
        setError("An unexpected error occurred");
        setIsSubmitting(false);
        hasSubmittedRef.current = false;
      }
    },
    [questions, selectedAnswers, onSubmit, quizId, router, isGuest, startToken],
  );

  // Timer effect - pauses when showing feedback (between confirming answer and clicking next)
  // Also handles auto-submit on timeout
  useEffect(() => {
    if (showFeedback) return; // Pause timer while reviewing answer

    const interval = setInterval(() => {
      setElapsedMs((prev) => {
        const newElapsed = prev + 100;
        // Check if we've just timed out
        if (hasTimeLimit && newElapsed >= timeLimitSeconds * 1000 && !hasTimedOutRef.current) {
          hasTimedOutRef.current = true;
          // Use setTimeout to avoid calling setState during render
          setTimeout(() => handleSubmit(true), 0);
        }
        return newElapsed;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [showFeedback, hasTimeLimit, timeLimitSeconds, handleSubmit]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleConfirmAnswer = async () => {
    if (!currentSelection || isRevealing) return;

    setIsRevealing(true);
    setError(null);

    try {
      const revealed = await onReveal({
        quizId,
        questionId: currentQuestion.id,
        selectedAnswerId: currentSelection,
        progressToken,
      });

      if (revealed.error) {
        setError(revealed.error);
        return;
      }

      if (revealed.isCorrect) guestCorrectRef.current += 1;

      setIsCorrect(revealed.isCorrect);
      setCorrectAnswerId(revealed.correctAnswerId);
      if (revealed.nextProgressToken) setProgressToken(revealed.nextProgressToken);

      setShowFeedback(true);
      setSelectedAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          answerId: currentSelection,
          displayOrder: currentQuestion.displayOrder,
        },
      }));
    } catch (err) {
      console.error("Failed to reveal answer:", err);
      setError("Could not check that answer. Please try again.");
    } finally {
      setIsRevealing(false);
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    setCurrentSelection(null);
    setCorrectAnswerId(null);

    if (isLastQuestion) {
      handleSubmit(false);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const correctAnswer = correctAnswerId
    ? currentQuestion.answers.find((a) => a.id === correctAnswerId)
    : undefined;

  // Show guest result screen
  if (guestResult) {
    const percentage = Math.round((guestResult.score / guestResult.total) * 100);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl sm:text-2xl">Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-6xl font-bold">{percentage}%</p>
              <p className="text-muted-foreground mt-2">
                You got {guestResult.score} out of {guestResult.total} questions correct
              </p>
              <p className="text-muted-foreground mt-1">Time: {formatTime(guestResult.timeMs)}</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => router.push(`/quiz/${quizId}`)}>Close</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-bold sm:text-xl">{quizTitle}</h1>
          <p className="text-muted-foreground text-sm">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {hasTimeLimit && (
            <Badge
              variant={
                timeRemainingMs != null && timeRemainingMs < timeLimitSeconds * 1000 * 0.1
                  ? "destructive"
                  : "secondary"
              }
              className="px-3 py-4 text-lg"
            >
              <Clock className="h-4 w-4" />
              <span className="min-w-[4ch] font-mono">{formatTime(timeRemainingMs!)}</span>
            </Badge>
          )}
          {!hasTimeLimit && (
            <Badge variant="secondary" className="px-3 py-4 text-lg">
              <Clock className="h-4 w-4" />
              <span className="min-w-[4ch] font-mono">{formatTime(elapsedMs)}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="h-2" />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{currentQuestion.text}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {currentQuestion.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src={currentQuestion.imageUrl}
                alt="Question image"
                fill
                className="object-cover"
              />
            </div>
          )}

          {/*
            Selection is locked while a reveal is in flight, not just after it
            lands. handleConfirmAnswer closes over the selection it sent, so
            changing it mid-request would leave the recorded answer and the
            correct/incorrect verdict describing the *old* option while the
            highlight below — driven by the live currentSelection — marked the
            new one. The two would disagree about what the player answered.
          */}
          <RadioGroup
            value={currentSelection ?? ""}
            onValueChange={(value) => setCurrentSelection(value as string)}
            disabled={showFeedback || isSubmitting || isRevealing}
          >
            {currentQuestion.answers.map((answer) => {
              const isSelected = currentSelection === answer.id;
              const showCorrectness = showFeedback;
              // Only known once the server has revealed this question.
              const answerIsCorrect = correctAnswerId === answer.id;

              let className =
                "flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ";

              if (showCorrectness) {
                if (answerIsCorrect) {
                  className += "border-green-500 bg-green-50 dark:bg-green-950";
                } else if (isSelected && !answerIsCorrect) {
                  className += "border-red-500 bg-red-50 dark:bg-red-950";
                } else {
                  className += "opacity-50";
                }
              } else {
                className += isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50";
              }

              return (
                <button
                  type="button"
                  key={answer.id}
                  aria-disabled={showFeedback || isSubmitting || isRevealing}
                  className={className}
                  onClick={() => {
                    if (!showFeedback && !isSubmitting && !isRevealing) {
                      setCurrentSelection(answer.id);
                    }
                  }}
                  disabled={showFeedback || isSubmitting || isRevealing}
                >
                  <RadioGroupItem
                    value={answer.id}
                    id={answer.id}
                    disabled={showFeedback || isSubmitting || isRevealing}
                  />
                  <span className="flex-1 text-left font-normal">{answer.text}</span>
                  {showCorrectness && answerIsCorrect && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {showCorrectness && isSelected && !answerIsCorrect && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </button>
              );
            })}
          </RadioGroup>

          {/* Feedback */}
          {showFeedback && (
            <Alert variant={isCorrect ? "default" : "destructive"}>
              {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{isCorrect ? "Correct!" : "Incorrect"}</AlertTitle>
              {!isCorrect && correctAnswer && (
                <AlertDescription>The correct answer was: {correctAnswer.text}</AlertDescription>
              )}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {!showFeedback ? (
              <Button
                onClick={handleConfirmAnswer}
                disabled={!currentSelection || isSubmitting || isRevealing}
              >
                {isRevealing && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                Confirm Answer
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isSubmitting}>
                {isSubmitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {isLastQuestion ? "Finish Quiz" : "Next Question"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
