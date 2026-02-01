"use client";

import { Plus, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUrlInput } from "./image-url-input";
import type { QuestionFormData, AnswerFormData } from "@/lib/validations/quiz";

interface QuestionFieldProps {
  index: number;
  question: QuestionFormData;
  onChange: (question: QuestionFormData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function QuestionField({
  index,
  question,
  onChange,
  onRemove,
  canRemove,
}: QuestionFieldProps) {
  const updateAnswer = (answerIndex: number, answer: Partial<AnswerFormData>) => {
    const newAnswers = question.answers.map((a, i) =>
      i === answerIndex ? { ...a, ...answer } : a,
    );
    onChange({ ...question, answers: newAnswers });
  };

  const setCorrectAnswer = (answerIndex: number) => {
    const newAnswers = question.answers.map((a, i) => ({
      ...a,
      isCorrect: i === answerIndex,
    }));
    onChange({ ...question, answers: newAnswers });
  };

  const addAnswer = () => {
    if (question.answers.length >= 6) return;
    onChange({
      ...question,
      answers: [...question.answers, { text: "", isCorrect: false }],
    });
  };

  const removeAnswer = (answerIndex: number) => {
    if (question.answers.length <= 2) return;
    const removingCorrect = question.answers[answerIndex].isCorrect;
    let newAnswers = question.answers.filter((_, i) => i !== answerIndex);

    // If we removed the correct answer, make the first one correct
    if (removingCorrect && newAnswers.length > 0) {
      newAnswers = newAnswers.map((a, i) => ({ ...a, isCorrect: i === 0 }));
    }

    onChange({ ...question, answers: newAnswers });
  };

  const correctAnswerIndex = question.answers.findIndex((a) => a.isCorrect);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Question {index + 1}</CardTitle>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`question-${index}-text`}>Question Text *</Label>
          <Textarea
            id={`question-${index}-text`}
            value={question.text}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Enter your question"
            rows={2}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`question-${index}-image`}>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              Image URL (optional)
            </span>
          </Label>
          <ImageUrlInput
            id={`question-${index}-image`}
            value={question.imageUrl ?? ""}
            onChange={(value) => onChange({ ...question, imageUrl: value })}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Answers (select the correct one) *</Label>
            {question.answers.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addAnswer}>
                <Plus className="h-3 w-3" />
                Add
              </Button>
            )}
          </div>

          <RadioGroup
            value={correctAnswerIndex.toString()}
            onValueChange={(value) => setCorrectAnswer(parseInt(value as string))}
          >
            {question.answers.map((answer, answerIndex) => (
              <div key={answerIndex} className="flex items-center gap-2 rounded-md border p-2">
                <RadioGroupItem
                  value={answerIndex.toString()}
                  id={`question-${index}-answer-${answerIndex}`}
                />
                <Input
                  value={answer.text}
                  onChange={(e) => updateAnswer(answerIndex, { text: e.target.value })}
                  placeholder={`Answer ${answerIndex + 1}`}
                  className="flex-1"
                  required
                />
                {question.answers.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAnswer(answerIndex)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
