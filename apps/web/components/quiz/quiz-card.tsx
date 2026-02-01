import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, HelpCircle, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_LANGUAGES } from "@/lib/validations/quiz";
import type { Quiz, User as UserType } from "@/lib/db/schema";

interface QuizCardProps {
  quiz: Quiz & {
    questionCount: number;
    author: UserType | null;
  };
}

export function QuizCard({ quiz }: QuizCardProps) {
  const languageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === (quiz.language as string))?.name ??
    (quiz.language as string);

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "No limit";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {quiz.heroImageUrl && (
        <Image
          src={quiz.heroImageUrl}
          alt={quiz.title}
          width={800}
          height={450}
          className="aspect-video w-full object-cover"
        />
      )}
      <CardHeader className="flex-1">
        <Link href={`/quiz/${quiz.id}`} className="no-underline hover:underline">
          <CardTitle className="line-clamp-2">{quiz.title}</CardTitle>
        </Link>
        {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-4 w-4" />
            {quiz.questionCount} questions
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTime(quiz.timeLimitSeconds)}
          </span>
        </div>
        {quiz.author && (
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <User className="h-4 w-4" />
            {quiz.author.displayName || quiz.author.name || "Unknown"}
          </div>
        )}
        {quiz.publishedAt && (
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <Calendar className="h-4 w-4" />
            {quiz.publishedAt.toLocaleDateString()}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {quiz.maxAttempts === 1 ? "1 attempt" : `${quiz.maxAttempts} attempts`}
          </Badge>
          {quiz.randomizeQuestions && <Badge variant="outline">Randomized</Badge>}
          <Badge variant="outline" className="capitalize">
            {quiz.difficulty}
          </Badge>
          <Badge variant="outline">{languageName}</Badge>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={`/quiz/${quiz.id}`}>
          <Button className="w-full">View Quiz</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
