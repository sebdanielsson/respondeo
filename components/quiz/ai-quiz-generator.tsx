"use client";

/**
 * AI Quiz Generator Dialog
 *
 * A dialog component that allows users to generate a quiz using AI.
 * Provides a rich text area for detailed theme descriptions (up to 2000 characters)
 * with a character counter, optional image uploads for vision analysis (up to 4 images),
 * and configurable options for question count, answer count, difficulty, and language.
 * Supports vision-capable AI models for analyzing reference images.
 */

import { useState, useTransition, useRef, useCallback } from "react";
import { Sparkles, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
// Constants
// ============================================================================

const MAX_PROMPT_LENGTH = 2000;
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = ".png,.jpg,.jpeg,.webp";

// ============================================================================
// Types
// ============================================================================

interface AIQuizGeneratorProps {
  /** Callback when quiz is successfully generated */
  onGenerated: (data: Partial<QuizFormData>) => void;
  /** Whether web search feature is enabled (controlled by env variable) */
  webSearchEnabled?: boolean;
}

interface ImageData {
  id: string;
  base64: string;
  file: File;
  mimeType: string;
}

// ============================================================================
// Component
// ============================================================================

export function AIQuizGenerator({ onGenerated, webSearchEnabled = false }: AIQuizGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [theme, setTheme] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [answerCount, setAnswerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<AIQuizInput["difficulty"]>("medium");
  const [language, setLanguage] = useState("en");
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [images, setImages] = useState<ImageData[]>([]);

  // Character counter styling
  const getCharacterCountColor = () => {
    const percentage = (theme.length / MAX_PROMPT_LENGTH) * 100;
    if (percentage >= 100) return "text-destructive";
    if (percentage >= 90) return "text-warning";
    return "text-muted-foreground";
  };

  // Helper to convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to read file as data URL"));
          return;
        }
        // Extract base64 data without the data URL prefix
        const parts = result.split(",");
        const base64 = parts.length > 1 ? parts[1] : "";
        if (!base64) {
          reject(new Error("Invalid file data: missing base64 payload"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error("Failed to process image in AI Quiz Generator", {
          fileName: file.name,
          error,
        });
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Image handling
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const newImages: ImageData[] = [];
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        // Check file type (with fallback to extension check)
        const isValidMimeType = ALLOWED_IMAGE_TYPES.includes(file.type);
        const fileExtension = file.name.toLowerCase().split(".").pop();
        const isValidExtension = ["png", "jpg", "jpeg", "webp"].includes(fileExtension || "");

        if (!isValidMimeType && !isValidExtension) {
          errors.push(`${file.name}: Only PNG, JPEG, and WEBP images are allowed`);
          continue;
        }

        // Infer MIME type from extension if missing or invalid
        let mimeType = file.type;
        if (!isValidMimeType && isValidExtension) {
          const extToMime: Record<string, string> = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            webp: "image/webp",
          };
          mimeType = extToMime[fileExtension!] || "";
          console.warn(`File ${file.name} has no MIME type, inferred ${mimeType} from extension`);
        }

        // Check file size
        if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
          errors.push(`${file.name}: Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB`);
          continue;
        }

        try {
          const base64 = await fileToBase64(file);
          newImages.push({
            id: crypto.randomUUID(),
            base64,
            file,
            mimeType,
          });
        } catch (error) {
          console.error("Failed to process image in AI Quiz Generator", {
            fileName: file.name,
            error,
          });
          errors.push(`${file.name}: Failed to process image`);
        }
      }

      if (errors.length > 0) {
        if (errors.length === 1) {
          toast.error(errors[0], { duration: 5000 });
        } else {
          toast.error("Some images couldn't be added", {
            description: errors.join("\n"),
            duration: 10000,
          });
        }
      }

      if (newImages.length > 0) {
        setImages((prev) => {
          // Final check against current state to prevent race conditions
          const finalImages = newImages.filter((_, index) => prev.length + index < MAX_IMAGES);
          return [...prev, ...finalImages];
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [fileToBase64],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleGenerate = () => {
    if (!theme.trim()) {
      toast.error("Please enter a theme for the quiz", {
        duration: Infinity,
      });
      return;
    }

    if (theme.length > MAX_PROMPT_LENGTH) {
      toast.error(`Theme is too long (max ${MAX_PROMPT_LENGTH} characters)`, {
        duration: Infinity,
      });
      return;
    }

    startTransition(async () => {
      const result: GenerateQuizResult = await generateQuizWithAI({
        theme: theme.trim(),
        questionCount,
        answerCount,
        difficulty,
        language,
        useWebSearch: webSearchEnabled && useWebSearch,
        images: images.length > 0 ? images.map((img) => img.base64) : undefined,
        imageMimeTypes:
          images.length > 0
            ? (images.map((img) => img.mimeType) as ("image/png" | "image/jpeg" | "image/webp")[])
            : undefined,
      });

      if (!result.success) {
        toast.error(result.error, {
          duration: Infinity,
        });
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
        toast.success("Quiz generated successfully!", {
          duration: Infinity,
        });

        // Show remaining rate limit info
        if (result.rateLimit && result.rateLimit.remaining > 0) {
          toast.info(`You have ${result.rateLimit.remaining} AI generation(s) remaining today.`, {
            duration: Infinity,
          });
        }

        // Reset form and close dialog
        setTheme("");
        setImages([]);
        setOpen(false);
      }
    });
  };

  const handleCancel = () => {
    if (!isPending) {
      setTheme("");
      setImages([]);
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
            Describe the theme or topic for your quiz. You can also upload images for reference.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Theme Input - Textarea with character counter */}
          <div className="grid gap-2">
            <Label htmlFor="ai-theme">Quiz Theme *</Label>
            <Textarea
              id="ai-theme"
              placeholder="e.g., World Geography, 90s Pop Music, Space Exploration... Describe what you want the quiz to be about. You can include details like specific topics, target audience, or key concepts to cover."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={isPending}
              autoFocus
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end" aria-live="polite">
              <span className={`text-xs ${getCharacterCountColor()} flex items-center gap-1`}>
                <span>
                  {theme.length} / {MAX_PROMPT_LENGTH}
                </span>
                {theme.length > MAX_PROMPT_LENGTH ? (
                  <span className="font-medium">– Over limit</span>
                ) : theme.length >= MAX_PROMPT_LENGTH * 0.9 ? (
                  <span>– Near limit</span>
                ) : null}
              </span>
            </div>
          </div>

          {/* Image Upload */}
          <div className="grid gap-2">
            <Label htmlFor="ai-image-upload">Reference Images (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="group relative h-16 w-16 overflow-hidden rounded-md border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${image.mimeType};base64,${image.base64}`}
                    alt={`Preview of uploaded reference image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    disabled={isPending}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-16 w-16"
                  disabled={isPending}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload images"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="ai-image-upload"
              type="file"
              accept={ALLOWED_IMAGE_EXTENSIONS}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-muted-foreground text-xs">
              Upload up to {MAX_IMAGES} images (PNG, JPEG, WEBP, max {MAX_IMAGE_SIZE_MB}MB each).
              Images will be analyzed by the AI.
            </p>
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

          {/* Web Search Toggle - only shown when enabled via env variable */}
          {webSearchEnabled && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="ai-web-search" className="text-sm font-medium">
                  Use web search
                </Label>
                <p className="text-muted-foreground text-xs">
                  Search the web for up-to-date information about recent topics
                </p>
              </div>
              <Switch
                id="ai-web-search"
                checked={useWebSearch}
                onCheckedChange={setUseWebSearch}
                disabled={isPending}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || !theme.trim() || theme.length > MAX_PROMPT_LENGTH}
          >
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
