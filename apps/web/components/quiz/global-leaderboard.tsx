import { Trophy, Medal, Clock, Gamepad2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/db/schema";

interface GlobalLeaderboardEntry {
  rank: number;
  user: User;
  totalCorrect: number;
  totalTimeMs: number;
  quizzesPlayed: number;
}

interface GlobalLeaderboardProps {
  entries: GlobalLeaderboardEntry[];
  currentUserId?: string;
}

export function GlobalLeaderboard({ entries, currentUserId }: GlobalLeaderboardProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  const getInitials = (user: User) => {
    return (
      user.displayName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) ??
      user.name?.slice(0, 2).toUpperCase() ??
      "U"
    );
  };

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No quiz attempts yet. Be the first to play!
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Correct Answers</TableHead>
          <TableHead className="text-right">Quizzes</TableHead>
          <TableHead className="text-right">Total Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const isCurrentUser = entry.user.id === currentUserId;
          return (
            <TableRow key={entry.user.id} className={isCurrentUser ? "bg-primary/5" : ""}>
              <TableCell>{getRankIcon(entry.rank)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={entry.user.image ?? undefined} />
                    <AvatarFallback>{getInitials(entry.user)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{entry.user.displayName || entry.user.name}</span>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-lg font-medium">{entry.totalCorrect}</span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Gamepad2 className="text-muted-foreground h-4 w-4" />
                  {entry.quizzesPlayed}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  {formatTime(entry.totalTimeMs)}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
