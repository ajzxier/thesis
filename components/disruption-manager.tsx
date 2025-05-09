"use client"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Schedule, Disruption, DisruptionType } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const disruptionFormSchema = z.object({
  matchId: z.string(),
  type: z.enum(["extended_duration", "late_arrival", "early_finish"]),
  extraMinutes: z.coerce.number().int().min(1).max(60),
  description: z.string().optional(),
})

interface DisruptionManagerProps {
  schedule: Schedule | null
  disruptions: Disruption[]
  onAddDisruption: (disruption: Disruption) => void
  onRemoveDisruption: (index: number) => void
  onAdjustSchedule: () => void
  isAdjusting: boolean
}

export function DisruptionManager({
  schedule,
  disruptions,
  onAddDisruption,
  onRemoveDisruption,
  onAdjustSchedule,
  isAdjusting,
}: DisruptionManagerProps) {
  const form = useForm<z.infer<typeof disruptionFormSchema>>({
    resolver: zodResolver(disruptionFormSchema),
    defaultValues: {
      matchId: "",
      type: "extended_duration",
      extraMinutes: 15,
      description: "",
    },
  })

  function handleAddDisruption(values: z.infer<typeof disruptionFormSchema>) {
    if (!schedule) return

    const match = schedule.matches.find((m) => m.id === values.matchId)
    if (!match) return

    const disruption: Disruption = {
      id: `D${disruptions.length + 1}`,
      type: values.type as DisruptionType,
      match: match,
      extraMinutes: values.extraMinutes,
      description:
        values.description || getDefaultDescription(values.type as DisruptionType, match.id, values.extraMinutes),
    }

    onAddDisruption(disruption)

    // Reset the form
    form.reset({
      matchId: "",
      type: "extended_duration",
      extraMinutes: 15,
      description: "",
    })
  }

  function getDefaultDescription(type: DisruptionType, matchId: string, minutes: number): string {
    switch (type) {
      case "extended_duration":
        return `Match ${matchId} ran ${minutes} minutes longer than expected.`
      case "late_arrival":
        return `Team arrived ${minutes} minutes late for match ${matchId}.`
      case "early_finish":
        return `Match ${matchId} finished ${minutes} minutes earlier than expected.`
      default:
        return ""
    }
  }

  // Check if a match already has a disruption
  function matchHasDisruption(matchId: string): boolean {
    return disruptions.some((d) => d.match.id === matchId)
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Manage Disruptions</CardTitle>
          <CardDescription>Add tournament disruptions to test dynamic rescheduling</CardDescription>
        </CardHeader>
        <CardContent>
          {schedule ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddDisruption)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="matchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select match" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {schedule.matches.map((match) => (
                              <SelectItem key={match.id} value={match.id} disabled={matchHasDisruption(match.id)}>
                                {match.id}: {match.team1.name} vs {match.team2.name}
                                {matchHasDisruption(match.id) && " (already disrupted)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disruption Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="extended_duration">Extended Duration</SelectItem>
                            <SelectItem value="late_arrival">Late Team Arrival</SelectItem>
                            <SelectItem value="early_finish">Early Finish</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="extraMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extra Minutes</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        {form.watch("type") === "extended_duration"
                          ? "How many minutes longer the match ran than expected"
                          : form.watch("type") === "late_arrival"
                          ? "How many minutes late the team arrived"
                          : "How many minutes earlier the match finished"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={getDefaultDescription(
                            form.watch("type") as DisruptionType,
                            form.watch("matchId") || "X",
                            form.watch("extraMinutes") || 0,
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit">Add Disruption</Button>
              </form>
            </Form>
          ) : (
            <div className="flex items-center justify-center p-6 text-center">
              <div>
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Schedule Available</h3>
                <p className="text-muted-foreground mt-2">
                  You need to generate a schedule before you can add disruptions.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disruption List</CardTitle>
          <CardDescription>
            {disruptions.length} disruption{disruptions.length !== 1 ? "s" : ""} added
          </CardDescription>
        </CardHeader>
        <CardContent>
          {disruptions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Extra Minutes</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disruptions.map((disruption, index) => (
                  <TableRow key={index}>
                    <TableCell>{disruption.id}</TableCell>
                    <TableCell>{disruption.match.id}</TableCell>
                    <TableCell>
                      <Badge variant={disruption.type === "extended_duration" ? "default" : disruption.type === "late_arrival" ? "secondary" : "destructive"}>
                        {disruption.type === "extended_duration" ? "Extended Duration" : disruption.type === "late_arrival" ? "Late Arrival" : "Early Finish"}
                      </Badge>
                    </TableCell>
                    <TableCell>{disruption.extraMinutes} min</TableCell>
                    <TableCell className="max-w-xs truncate">{disruption.description}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRemoveDisruption(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No disruptions added yet. Add disruptions using the form above.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onAdjustSchedule} disabled={disruptions.length === 0 || isAdjusting}>
            {isAdjusting ? "Adjusting Schedule..." : "Adjust Schedule"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
