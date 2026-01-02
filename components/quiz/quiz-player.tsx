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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
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
  }) => Promise<{ attemptId?: string; error?: string }>;
}

export function QuizPlayer({
  quizId,
  quizTitle,
  questions,
  timeLimitSeconds,
  onSubmit,
}: QuizPlayerProps) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, { answerId: string; displayOrder: number }>
  >({});
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasTimeLimit = timeLimitSeconds > 0;
  const timeRemainingMs = hasTimeLimit ? Math.max(0, timeLimitSeconds * 1000 - elapsedMs) : null;

  // Use a ref to track if we've already triggered a timeout submit
  const hasTimedOutRef = useRef(false);

  const handleSubmit = useCallback(
    async (timedOut: boolean) => {
      setIsSubmitting(true);
      setError(null);

      // Build answers array including unanswered questions
      const answers = questions.map((q) => ({
        questionId: q.id,
        answerId: selectedAnswers[q.id]?.answerId ?? "",
        displayOrder: q.displayOrder,
      }));

      try {
        const result = await onSubmit({
          quizId,
          answers,
          totalTimeMs: elapsedMs,
          timedOut,
        });

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
        } else if (result.attemptId) {
          router.push(`/quiz/${quizId}/results/${result.attemptId}`);
        }
      } catch (err) {
        console.error("Failed to submit quiz attempt:", err);
        setError("An unexpected error occurred");
        setIsSubmitting(false);
      }
    },
    [questions, selectedAnswers, onSubmit, quizId, elapsedMs, router],
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

  const handleConfirmAnswer = () => {
    if (!currentSelection) return;

    const selectedAnswer = currentQuestion.answers.find((a) => a.id === currentSelection);
    const correct = selectedAnswer?.isCorrect ?? false;

    setIsCorrect(correct);
    setShowFeedback(true);
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        answerId: currentSelection,
        displayOrder: currentQuestion.displayOrder,
      },
    }));
  };

  const handleNext = () => {
    setShowFeedback(false);
    setCurrentSelection(null);

    if (isLastQuestion) {
      handleSubmit(false);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const correctAnswer = currentQuestion.answers.find((a) => a.isCorrect);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{quizTitle}</h1>
          <p className="text-muted-foreground text-sm">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {hasTimeLimit && (
            <Badge
              variant={timeRemainingMs! < 30000 ? "destructive" : "secondary"}
              className="px-3 py-1 text-lg"
            >
              <Clock className="mr-1 h-4 w-4" />
              {formatTime(timeRemainingMs!)}
            </Badge>
          )}
          {!hasTimeLimit && (
            <Badge variant="secondary" className="px-3 py-1 text-lg">
              <Clock className="mr-1 h-4 w-4" />
              {formatTime(elapsedMs)}
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
          <CardTitle className="text-lg">{currentQuestion.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <RadioGroup
            value={currentSelection ?? ""}
            onValueChange={(value) => setCurrentSelection(value as string)}
            disabled={showFeedback || isSubmitting}
          >
            {currentQuestion.answers.map((answer) => {
              const isSelected = currentSelection === answer.id;
              const showCorrectness = showFeedback;

              let className =
                "flex items-center space-x-3 p-4 rounded-lg border transition-colors ";

              if (showCorrectness) {
                if (answer.isCorrect) {
                  className += "border-green-500 bg-green-50 dark:bg-green-950";
                } else if (isSelected && !answer.isCorrect) {
                  className += "border-red-500 bg-red-50 dark:bg-red-950";
                } else {
                  className += "opacity-50";
                }
              } else {
                className += isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50";
              }

              return (
                <div key={answer.id} className={className}>
                  <RadioGroupItem value={answer.id} id={answer.id} />
                  <Label htmlFor={answer.id} className="flex-1 cursor-pointer font-normal">
                    {answer.text}
                  </Label>
                  {showCorrectness && answer.isCorrect && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {showCorrectness && isSelected && !answer.isCorrect && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
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
          <div className="flex justify-end gap-2 pt-4">
            {!showFeedback ? (
              <Button onClick={handleConfirmAnswer} disabled={!currentSelection || isSubmitting}>
                Confirm Answer
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLastQuestion ? "Finish Quiz" : "Next Question"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
