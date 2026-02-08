"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Database, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface DatabaseErrorProps {
  message: string;
}

const answers = [
  { id: "database", text: "Database", isCorrect: true },
  { id: "respondeo", text: "Respondeo", isCorrect: false },
  { id: "seaweedfs", text: "SeaweedFS (S3)", isCorrect: false },
];

export function DatabaseError({ message }: DatabaseErrorProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleConfirm = () => {
    if (selectedAnswer) {
      setShowFeedback(true);
    }
  };

  const isCorrect = selectedAnswer === "database";
  const correctAnswer = answers.find((a) => a.isCorrect);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/* Header mimicking quiz player */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Connection Quiz</h1>
          <p className="text-muted-foreground text-sm">Question 1 of 1</p>
        </div>
        <Badge variant="destructive" className="px-3 py-1">
          <Database className="mr-1 h-4 w-4" />
          Disconnected
        </Badge>
      </div>

      <Progress value={100} className="h-2" />

      {/* Error Alert */}
      <Alert variant="destructive">
        <Database className="h-4 w-4" />
        <AlertTitle>Database Connection Failed</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Which of these services do we need to start first?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={selectedAnswer ?? ""}
            onValueChange={(value) => setSelectedAnswer(value as string)}
            disabled={showFeedback}
          >
            {answers.map((answer) => {
              const isSelected = selectedAnswer === answer.id;

              let className =
                "flex items-center space-x-3 p-4 rounded-lg border transition-colors ";

              if (showFeedback) {
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
                  {showFeedback && answer.isCorrect && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {showFeedback && isSelected && !answer.isCorrect && (
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

          {/* Troubleshooting steps after feedback */}
          {showFeedback && (
            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-medium">To fix this:</p>
              <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
                <li>
                  Run: <code className="bg-background rounded px-1">docker compose up -d</code>
                </li>
                <li>Wait a few seconds for PostgreSQL to start</li>
                <li>Then refresh this page</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            {!showFeedback ? (
              <Button onClick={handleConfirm} disabled={!selectedAnswer}>
                Confirm Answer
              </Button>
            ) : (
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
