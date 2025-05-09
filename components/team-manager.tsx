"use client"

import { useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { type Tournament, type Team, GameType } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2 } from "lucide-react"

const teamFormSchema = z.object({
  name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
  gameType: z.enum(["ML", "Val"]),
})

interface TeamManagerProps {
  tournament: Tournament | null
  teams: Team[]
  setTeams: (teams: Team[]) => void
  onSubmit: (teams: Team[]) => void
}

export function TeamManager({ tournament, teams, setTeams, onSubmit }: TeamManagerProps) {
  const [mlTeamCount, setMlTeamCount] = useState(0)
  const [valTeamCount, setValTeamCount] = useState(0)

  const form = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      gameType: "ML",
    },
  })

  function handleAddTeam(values: z.infer<typeof teamFormSchema>) {
    const gameType = values.gameType as GameType

    // Check if we've reached the limit for this game type
    if (gameType === GameType.MOBILE_LEGENDS && tournament && mlTeamCount >= tournament.mlTeams) {
      form.setError("gameType", {
        message: `Maximum of ${tournament.mlTeams} Mobile Legends teams allowed`,
      })
      return
    }

    if (gameType === GameType.VALORANT && tournament && valTeamCount >= tournament.valTeams) {
      form.setError("gameType", {
        message: `Maximum of ${tournament.valTeams} Valorant teams allowed`,
      })
      return
    }

    // Add the team
    const newTeam: Team = {
      id: teams.length + 1,
      name: values.name,
      gameType: gameType,
      matchesPlayed: 0,
    }

    const updatedTeams = [...teams, newTeam]
    setTeams(updatedTeams)

    // Update counters
    if (gameType === GameType.MOBILE_LEGENDS) {
      setMlTeamCount(mlTeamCount + 1)
    } else {
      setValTeamCount(valTeamCount + 1)
    }

    // Reset the form
    form.reset({
      name: "",
      gameType: values.gameType,
    })
  }

  function handleRemoveTeam(index: number) {
    const teamToRemove = teams[index]
    const updatedTeams = teams.filter((_, i) => i !== index)
    setTeams(updatedTeams)

    // Update counters
    if (teamToRemove.gameType === GameType.MOBILE_LEGENDS) {
      setMlTeamCount(mlTeamCount - 1)
    } else {
      setValTeamCount(valTeamCount - 1)
    }
  }

  function handleSubmitTeams() {
    if (!tournament) return

    // Validate team counts
    if (mlTeamCount !== tournament.mlTeams) {
      alert(`You need exactly ${tournament.mlTeams} Mobile Legends teams. Currently have ${mlTeamCount}.`)
      return
    }

    if (valTeamCount !== tournament.valTeams) {
      alert(`You need exactly ${tournament.valTeams} Valorant teams. Currently have ${valTeamCount}.`)
      return
    }

    onSubmit(teams)
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>Add teams for your tournament</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddTeam)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter team name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gameType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select game" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ML">Mobile Legends</SelectItem>
                          <SelectItem value="Val">Valorant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit">Add Team</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team List</CardTitle>
          <CardDescription>
            {tournament && (
              <>
                Mobile Legends: {mlTeamCount}/{tournament.mlTeams} teams | Valorant: {valTeamCount}/
                {tournament.valTeams} teams
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team, index) => (
                  <TableRow key={index}>
                    <TableCell>{team.id}</TableCell>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>{team.gameType === GameType.MOBILE_LEGENDS ? "Mobile Legends" : "Valorant"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTeam(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No teams added yet. Add teams using the form above.
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSubmitTeams}
              disabled={!tournament || mlTeamCount !== tournament.mlTeams || valTeamCount !== tournament.valTeams}
            >
              Continue to Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
