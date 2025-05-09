"use client"

import { useState } from "react"
import { type Schedule, type Match, GameType } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface ScheduleDisplayProps {
  schedule: Schedule
}

export function ScheduleDisplay({ schedule }: ScheduleDisplayProps) {
  const [view, setView] = useState<"table" | "timeline">("table")

  // Format date for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Group matches by round
  const matchesByRound = schedule.matches.reduce(
    (acc, match) => {
      if (!acc[match.roundNumber]) {
        acc[match.roundNumber] = []
      }
      acc[match.roundNumber].push(match)
      return acc
    },
    {} as Record<number, Match[]>,
  )

  // Sort rounds
  const sortedRounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Tournament Schedule</CardTitle>
            <CardDescription>{schedule.matches.length} matches scheduled</CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "timeline")}>
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {view === "table" ? (
          <div className="space-y-8">
            {sortedRounds.map((round) => (
              <div key={round}>
                <h3 className="text-lg font-medium mb-4">
                  {round === 1
                    ? "First Round"
                    : round === 2
                      ? "Semi-Finals"
                      : round === 3
                        ? "Finals"
                        : `Round ${round}`}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Teams</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchesByRound[round]
                      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                      .map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{match.id}</TableCell>
                          <TableCell>
                            <Badge variant={match.gameType === GameType.MOBILE_LEGENDS ? "default" : "destructive"}>
                              {match.gameType === GameType.MOBILE_LEGENDS ? "ML" : "Val"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {match.team1.name} vs {match.team2.name}
                          </TableCell>
                          <TableCell>{formatTime(match.startTime)}</TableCell>
                          <TableCell>{formatTime(match.endTime)}</TableCell>
                          <TableCell>{match.duration} min</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative mt-6">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div>

            {schedule.matches
              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
              .map((match, index) => {
                // Calculate position based on time
                const firstMatchTime = schedule.matches[0].startTime.getTime()
                const lastMatchTime = schedule.matches[schedule.matches.length - 1].endTime.getTime()
                const totalTimespan = lastMatchTime - firstMatchTime

                const startPosition = ((match.startTime.getTime() - firstMatchTime) / totalTimespan) * 100
                const duration = ((match.endTime.getTime() - match.startTime.getTime()) / totalTimespan) * 100

                return (
                  <div
                    key={match.id}
                    className="relative ml-6 mb-8"
                    style={{ marginTop: index === 0 ? "0" : `${startPosition / 5}px` }}
                  >
                    <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-primary"></div>
                    <div
                      className={`p-4 rounded-lg border ${
                        match.gameType === GameType.MOBILE_LEGENDS
                          ? "bg-primary/10 border-primary/20"
                          : "bg-destructive/10 border-destructive/20"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant={match.gameType === GameType.MOBILE_LEGENDS ? "default" : "destructive"}>
                            {match.gameType === GameType.MOBILE_LEGENDS ? "Mobile Legends" : "Valorant"}
                          </Badge>
                          <h4 className="text-base font-medium mt-2">
                            Match {match.id}: {match.team1.name} vs {match.team2.name}
                          </h4>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(match.startTime)} - {formatTime(match.endTime)}
                        </div>
                      </div>
                      <div className="text-sm mt-2">
                        Duration: {match.duration} minutes
                        {match.roundNumber > 1 && (
                          <span className="ml-2 text-muted-foreground">
                            ({match.roundNumber === 2 ? "Semi-Final" : "Final"})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
