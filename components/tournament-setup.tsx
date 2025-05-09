"use client"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { Tournament } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const formSchema = z
  .object({
    format: z.enum(["single-elimination", "double-elimination", "upper-bracket", "lower-bracket", "playoffs", "semifinals", "finals"]),
    mlTeams: z.coerce.number().int().min(2).max(16),
    valTeams: z.coerce.number().int().min(2).max(16),
    mlDurationMin: z.coerce.number().int().min(5).max(60),
    mlDurationMax: z.coerce.number().int().min(5).max(60),
    valDurationMin: z.coerce.number().int().min(5).max(120),
    valDurationMax: z.coerce.number().int().min(5).max(120),
    venueStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    venueEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    restPeriod: z.coerce.number().int().min(5).max(60),
    maxMatchesPerDay: z.coerce.number().int().min(1).max(10),
    matchFormat: z.enum(["bo3", "bo5"]),
    enableMobileLegends: z.boolean(),
    enableValorant: z.boolean(),
  })
  .refine((data) => data.mlDurationMin <= data.mlDurationMax, {
    message: "Minimum duration must be less than or equal to maximum duration",
    path: ["mlDurationMin"],
  })
  .refine((data) => data.valDurationMin <= data.valDurationMax, {
    message: "Minimum duration must be less than or equal to maximum duration",
    path: ["valDurationMin"],
  })
  .refine(
    (data) => {
      const start = data.venueStart.split(":").map(Number)
      const end = data.venueEnd.split(":").map(Number)
      const startMinutes = start[0] * 60 + start[1]
      const endMinutes = end[0] * 60 + end[1]
      return startMinutes < endMinutes
    },
    {
      message: "Venue end time must be after start time",
      path: ["venueEnd"],
    },
  )
  .refine(
    (data) => {
      return data.enableMobileLegends || data.enableValorant
    },
    {
      message: "At least one game type must be enabled",
      path: ["enableMobileLegends"],
    },
  )
  .refine(
    (data) => {
      if (!data.enableMobileLegends) return true
      const mlTeams = data.mlTeams
      return mlTeams >= 2 && mlTeams <= 16 && (mlTeams & (mlTeams - 1)) === 0
    },
    {
      message: "Mobile Legends teams must be a power of 2 (2, 4, 8, 16)",
      path: ["mlTeams"],
    },
  )
  .refine(
    (data) => {
      if (!data.enableValorant) return true
      const valTeams = data.valTeams
      return valTeams >= 2 && valTeams <= 16 && (valTeams & (valTeams - 1)) === 0
    },
    {
      message: "Valorant teams must be a power of 2 (2, 4, 8, 16)",
      path: ["valTeams"],
    },
  )

interface TournamentSetupProps {
  onSubmit: (data: Tournament) => void
}

export function TournamentSetup({ onSubmit }: TournamentSetupProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      format: "single-elimination",
      mlTeams: 4,
      valTeams: 4,
      mlDurationMin: 15,
      mlDurationMax: 25,
      valDurationMin: 30,
      valDurationMax: 50,
      venueStart: "09:00",
      venueEnd: "20:00",
      restPeriod: 30,
      maxMatchesPerDay: 3,
      matchFormat: "bo3",
      enableMobileLegends: true,
      enableValorant: true,
    },
  })

  function handleSubmit(values: z.infer<typeof formSchema>) {
    const tournamentData: Tournament = {
      format: values.format,
      mlTeams: values.mlTeams,
      valTeams: values.valTeams,
      mlDuration: [values.mlDurationMin, values.mlDurationMax],
      valDuration: [values.valDurationMin, values.valDurationMax],
      venueHours: [values.venueStart, values.venueEnd],
      restPeriod: values.restPeriod,
      maxMatchesPerDay: values.maxMatchesPerDay,
      matchFormat: values.matchFormat,
      enabledGames: {
        mobileLegends: values.enableMobileLegends,
        valorant: values.enableValorant,
      },
    }

    onSubmit(tournamentData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Setup</CardTitle>
        <CardDescription>Configure the parameters for your esports tournament</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single-elimination">Single Elimination</SelectItem>
                        <SelectItem value="double-elimination">Double Elimination</SelectItem>
                        <SelectItem value="upper-bracket">Upper Bracket</SelectItem>
                        <SelectItem value="lower-bracket">Lower Bracket</SelectItem>
                        <SelectItem value="playoffs">Playoffs</SelectItem>
                        <SelectItem value="semifinals">Semifinals</SelectItem>
                        <SelectItem value="finals">Finals</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>The tournament bracket format</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matchFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select match format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bo3">Best of 3</SelectItem>
                        <SelectItem value="bo5">Best of 5</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Number of games played per match</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="enableMobileLegends"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Mobile Legends</FormLabel>
                        <FormDescription>Enable Mobile Legends tournament</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableValorant"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Valorant</FormLabel>
                        <FormDescription>Enable Valorant tournament</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mlTeams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Legends Teams</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableMobileLegends")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valTeams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valorant Teams</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableValorant")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mlDurationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ML Min Duration (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableMobileLegends")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mlDurationMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ML Max Duration (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableMobileLegends")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valDurationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valorant Min Duration (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableValorant")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valDurationMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valorant Max Duration (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          disabled={!form.watch("enableValorant")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="venueStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="venueEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="restPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rest Period (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>Minimum rest time between matches for teams</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxMatchesPerDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Matches Per Day</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>Maximum number of matches a team can play in one day</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full">
              Continue to Team Setup
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
