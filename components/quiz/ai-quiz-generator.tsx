"use client";

/**
 * AI Quiz Generator Dialog
 *
 * A dialog component that allows users to generate a quiz using AI.
 * Provides inputs for theme, question count, answer count, difficulty, and language.
 */

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS } from "@/lib/validations/quiz";
import { generateQuizWithAI, type GenerateQuizResult } from "@/app/actions/generate-quiz";
import type { AIQuizInput } from "@/lib/validations/ai-quiz";
import type { QuizFormData } from "@/lib/validations/quiz";

// ============================================================================
// Types
// ============================================================================

interface AIQuizGeneratorProps {
  /** Callback when quiz is successfully generated */
  onGenerated: (data: Partial<QuizFormData>) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIQuizGenerator({ onGenerated }: AIQuizGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [theme, setTheme] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [answerCount, setAnswerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<AIQuizInput["difficulty"]>("medium");
  const [language, setLanguage] = useState("en");

  const handleGenerate = () => {
    if (!theme.trim()) {
      toast.error("Please enter a theme for the quiz");
      return;
    }

    startTransition(async () => {
      const result: GenerateQuizResult = await generateQuizWithAI({
        theme: theme.trim(),
        questionCount,
        answerCount,
        difficulty,
        language,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        // Transform AI output to match QuizFormData structure
        const quizData: Partial<QuizFormData> = {
          title: result.data.title,
          description: result.data.description,
          language: result.data.language,
          difficulty: result.data.difficulty,
          questions: result.data.questions.map((q) => ({
            text: q.text,
            imageUrl: "",
            answers: q.answers.map((a) => ({
              text: a.text,
              isCorrect: a.isCorrect,
            })),
          })),
        };

        onGenerated(quizData);
        toast.success("Quiz generated successfully!");

        // Show remaining rate limit info
        if (result.rateLimit && result.rateLimit.remaining > 0) {
          toast.info(`You have ${result.rateLimit.remaining} AI generation(s) remaining today.`);
        }

        // Reset form and close dialog
        setTheme("");
        setOpen(false);
      }
    });
  };

  const handleCancel = () => {
    if (!isPending) {
      setTheme("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
        }
      />
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Quiz with AI
          </DialogTitle>
          <DialogDescription>
            Describe the theme or topic for your quiz and AI will generate questions for you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Theme Input */}
          <div className="grid gap-2">
            <Label htmlFor="ai-theme">Quiz Theme *</Label>
            <Input
              id="ai-theme"
              placeholder="e.g., World Geography, 90s Pop Music, Space Exploration..."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          {/* Question and Answer Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-question-count">Number of Questions</Label>
              <Input
                id="ai-question-count"
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 10)))
                }
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-answer-count">Answers per Question</Label>
              <Input
                id="ai-answer-count"
                type="number"
                min={2}
                max={6}
                value={answerCount}
                onChange={(e) =>
                  setAnswerCount(Math.min(6, Math.max(2, parseInt(e.target.value) || 4)))
                }
                disabled={isPending}
              />
            </div>
          </div>

          {/* Difficulty and Language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => {
                  if (value) setDifficulty(value as AIQuizInput["difficulty"]);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="ai-difficulty">
                  <SelectValue>
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-language">Language</Label>
              <Select
                value={language}
                onValueChange={(value) => {
                  if (value) setLanguage(value);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="ai-language">
                  <SelectValue>
                    {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || language}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={isPending || !theme.trim()}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
