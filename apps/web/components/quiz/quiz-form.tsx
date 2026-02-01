"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronDownIcon, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QuestionField } from "./question-field";
import { AIQuizGenerator } from "./ai-quiz-generator";
import { ImageUrlInput } from "./image-url-input";
import {
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  type QuizFormData,
  type QuestionFormData,
} from "@/lib/validations/quiz";

interface QuizFormProps {
  initialData?: QuizFormData & { id?: string };
  onSubmit: (data: QuizFormData) => Promise<{ error?: string }>;
  submitLabel?: string;
  /** Whether to show the "Generate with AI" button */
  canGenerateWithAI?: boolean;
  /** Whether web search feature is enabled for AI generation */
  webSearchEnabled?: boolean;
}

const defaultQuestion: QuestionFormData = {
  text: "",
  imageUrl: "",
  answers: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
};

export function QuizForm({
  initialData,
  onSubmit,
  submitLabel = "Create Quiz",
  canGenerateWithAI = false,
  webSearchEnabled = false,
}: QuizFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<QuizFormData>({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    heroImageUrl: initialData?.heroImageUrl ?? "",
    language: initialData?.language ?? "en",
    difficulty: initialData?.difficulty ?? "medium",
    maxAttempts: initialData?.maxAttempts ?? 1,
    timeLimitSeconds: initialData?.timeLimitSeconds ?? 0,
    randomizeQuestions: initialData?.randomizeQuestions ?? true,
    randomizeAnswers: initialData?.randomizeAnswers ?? true,
    publishedAt: initialData?.publishedAt ?? null,
    questions: initialData?.questions ?? [{ ...defaultQuestion }],
  });

  const updateField = <K extends keyof QuizFormData>(field: K, value: QuizFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAIGenerated = (data: Partial<QuizFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          ...defaultQuestion,
          answers: [
            { text: "", isCorrect: true },
            { text: "", isCorrect: false },
          ],
        },
      ],
    }));
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const updateQuestion = (index: number, question: QuestionFormData) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? question : q)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(formData);
      if (result?.error) {
        setError(result.error);
        console.error("Quiz form error:", result.error);
      }
    } catch (err) {
      // Log detailed error for debugging
      console.error("Quiz form submission error:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quiz Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quiz Details</CardTitle>
              <CardDescription>Basic information about your quiz</CardDescription>
            </div>
            {canGenerateWithAI && (
              <AIQuizGenerator
                onGenerated={handleAIGenerated}
                webSearchEnabled={webSearchEnabled}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Enter quiz title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe what this quiz is about"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="heroImageUrl">Hero Image URL *</Label>
            <ImageUrlInput
              id="heroImageUrl"
              value={formData.heroImageUrl ?? ""}
              onChange={(value) => updateField("heroImageUrl", value)}
              placeholder="https://example.com/image.jpg"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => value && updateField("language", value)}
              >
                <SelectTrigger id="language">
                  <SelectValue>
                    {SUPPORTED_LANGUAGES.find((l) => l.code === formData.language)?.name ||
                      formData.language}
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

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) =>
                  value && updateField("difficulty", value as typeof formData.difficulty)
                }
              >
                <SelectTrigger id="difficulty">
                  <SelectValue>
                    {formData.difficulty.charAt(0).toUpperCase() + formData.difficulty.slice(1)}
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxAttempts">Max Attempts</Label>
              <Input
                id="maxAttempts"
                type="number"
                min={1}
                value={formData.maxAttempts}
                onChange={(e) => updateField("maxAttempts", parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeLimitSeconds">Time Limit (seconds, 0 = unlimited)</Label>
              <Input
                id="timeLimitSeconds"
                type="number"
                min={0}
                value={formData.timeLimitSeconds}
                onChange={(e) => updateField("timeLimitSeconds", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="randomizeQuestions"
              checked={formData.randomizeQuestions}
              onCheckedChange={(checked) => updateField("randomizeQuestions", checked)}
            />
            <Label htmlFor="randomizeQuestions">Randomize question order</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="randomizeAnswers"
              checked={formData.randomizeAnswers}
              onCheckedChange={(checked) => updateField("randomizeAnswers", checked)}
            />
            <Label htmlFor="randomizeAnswers">Randomize answer order</Label>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="publish-date-picker" className="px-1">
                Publish Date (optional)
              </Label>
              <Popover>
                <PopoverTrigger
                  id="publish-date-picker"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-32 justify-between font-normal",
                  )}
                >
                  {formData.publishedAt
                    ? new Date(formData.publishedAt).toLocaleDateString()
                    : "Select date"}
                  <ChevronDownIcon />
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={formData.publishedAt ? new Date(formData.publishedAt) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const existing = formData.publishedAt
                          ? new Date(formData.publishedAt)
                          : new Date();
                        date.setHours(existing.getHours(), existing.getMinutes());
                        updateField("publishedAt", date);
                      } else {
                        updateField("publishedAt", null);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="publish-time-picker" className="px-1">
                Time
              </Label>
              <Input
                type="time"
                id="publish-time-picker"
                className="bg-background w-28 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                value={
                  formData.publishedAt
                    ? `${String(new Date(formData.publishedAt).getHours()).padStart(2, "0")}:${String(new Date(formData.publishedAt).getMinutes()).padStart(2, "0")}`
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value && formData.publishedAt) {
                    const [hours, minutes] = e.target.value.split(":").map(Number);
                    const newDate = new Date(formData.publishedAt);
                    newDate.setHours(hours, minutes);
                    updateField("publishedAt", newDate);
                  }
                }}
                disabled={!formData.publishedAt}
              />
            </div>
            {formData.publishedAt && (
              <div className="flex flex-col gap-3">
                <Label className="px-1 opacity-0">Clear</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateField("publishedAt", null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            If set to a future date, the published date won&apos;t be displayed until then.
          </p>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Questions</h2>
          <Button type="button" onClick={addQuestion} variant="outline">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>

        {formData.questions.map((question, index) => (
          <QuestionField
            key={index}
            index={index}
            question={question}
            onChange={(q) => updateQuestion(index, q)}
            onRemove={() => removeQuestion(index)}
            canRemove={formData.questions.length > 1}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
