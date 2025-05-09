import { type Tournament, type Team, type Schedule, type Disruption, type Match, GameType } from "./types"

// This is a mock implementation that simulates the backend functionality
// In a real application, these functions would make API calls to your Python backend

export async function generateSchedule(tournament: Tournament, teams: Team[]): Promise<Schedule> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Mock implementation to generate a schedule
  const matches: Match[] = []

  // Get teams by game type
  const mlTeams = teams.filter((t) => t.gameType === GameType.MOBILE_LEGENDS)
  const valTeams = teams.filter((t) => t.gameType === GameType.VALORANT)

  // Generate first round matches for Mobile Legends
  for (let i = 0; i < mlTeams.length; i += 2) {
    if (i + 1 < mlTeams.length) {
      // Random duration within specified range
      const duration = Math.floor(
        Math.random() * (tournament.mlDuration[1] - tournament.mlDuration[0] + 1) + tournament.mlDuration[0],
      )

      // Parse venue hours
      const venueStart = new Date()
      const [startHour, startMinute] = tournament.venueHours[0].split(":").map(Number)
      venueStart.setHours(startHour, startMinute, 0, 0)

      // Set match time (simplified for demo)
      const startTime = new Date(venueStart)
      startTime.setMinutes(startTime.getMinutes() + i * 30)

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + duration)

      matches.push({
        id: `M${matches.length + 1}`,
        team1: mlTeams[i],
        team2: mlTeams[i + 1],
        duration,
        gameType: GameType.MOBILE_LEGENDS,
        roundNumber: 1,
        startTime,
        endTime,
      })
    }
  }

  // Generate first round matches for Valorant
  for (let i = 0; i < valTeams.length; i += 2) {
    if (i + 1 < valTeams.length) {
      // Random duration within specified range
      const duration = Math.floor(
        Math.random() * (tournament.valDuration[1] - tournament.valDuration[0] + 1) + tournament.valDuration[0],
      )

      // Parse venue hours
      const venueStart = new Date()
      const [startHour, startMinute] = tournament.venueHours[0].split(":").map(Number)
      venueStart.setHours(startHour, startMinute, 0, 0)

      // Set match time (simplified for demo)
      // Valorant matches start after ML matches
      const startTime = new Date(venueStart)
      startTime.setMinutes(startTime.getMinutes() + mlTeams.length * 30 + i * 60)

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + duration)

      matches.push({
        id: `M${matches.length + 1}`,
        team1: valTeams[i],
        team2: valTeams[i + 1],
        duration,
        gameType: GameType.VALORANT,
        roundNumber: 1,
        startTime,
        endTime,
      })
    }
  }

  // Add semifinal and final matches if we have enough teams
  if (mlTeams.length >= 4) {
    const duration = Math.floor(
      Math.random() * (tournament.mlDuration[1] - tournament.mlDuration[0] + 1) + tournament.mlDuration[0],
    )

    const lastMatch = matches[matches.length - 1]
    const startTime = new Date(lastMatch.endTime)
    startTime.setMinutes(startTime.getMinutes() + 30) // 30 min break

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + duration)

    matches.push({
      id: `M${matches.length + 1}`,
      team1: { ...mlTeams[0], name: "ML Winner 1" },
      team2: { ...mlTeams[1], name: "ML Winner 2" },
      duration,
      gameType: GameType.MOBILE_LEGENDS,
      roundNumber: 2,
      startTime,
      endTime,
    })
  }

  if (valTeams.length >= 4) {
    const duration = Math.floor(
      Math.random() * (tournament.valDuration[1] - tournament.valDuration[0] + 1) + tournament.valDuration[0],
    )

    const lastMatch = matches[matches.length - 1]
    const startTime = new Date(lastMatch.endTime)
    startTime.setMinutes(startTime.getMinutes() + 30) // 30 min break

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + duration)

    matches.push({
      id: `M${matches.length + 1}`,
      team1: { ...valTeams[0], name: "Val Winner 1" },
      team2: { ...valTeams[1], name: "Val Winner 2" },
      duration,
      gameType: GameType.VALORANT,
      roundNumber: 2,
      startTime,
      endTime,
    })
  }

  // Add final match
  const finalDuration =
    Math.floor(
      (tournament.mlDuration[0] + tournament.valDuration[0]) / 2 +
        (tournament.mlDuration[1] + tournament.valDuration[1]) / 2,
    ) / 2

  const lastMatch = matches[matches.length - 1]
  const finalStartTime = new Date(lastMatch.endTime)
  finalStartTime.setMinutes(finalStartTime.getMinutes() + 60) // 60 min break before final

  const finalEndTime = new Date(finalStartTime)
  finalEndTime.setMinutes(finalEndTime.getMinutes() + finalDuration)

  matches.push({
    id: `M${matches.length + 1}`,
    team1: { ...mlTeams[0], name: "ML Champion" },
    team2: { ...valTeams[0], name: "Val Champion" },
    duration: finalDuration,
    gameType: GameType.MOBILE_LEGENDS,
    roundNumber: 3,
    startTime: finalStartTime,
    endTime: finalEndTime,
  })

  return { matches }
}

export async function adjustSchedule(
  tournament: Tournament,
  schedule: Schedule,
  disruptions: Disruption[],
): Promise<Schedule> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Create a deep copy of the schedule
  const adjustedSchedule: Schedule = {
    matches: JSON.parse(JSON.stringify(schedule.matches)),
  }

  // Convert string dates back to Date objects
  adjustedSchedule.matches = adjustedSchedule.matches.map((match) => ({
    ...match,
    startTime: new Date(match.startTime),
    endTime: new Date(match.endTime),
  }))

  // Apply disruptions
  for (const disruption of disruptions) {
    const matchIndex = adjustedSchedule.matches.findIndex((m) => m.id === disruption.match.id)

    if (matchIndex !== -1) {
      const match = adjustedSchedule.matches[matchIndex]

      if (disruption.type === "extended_duration") {
        // Extend match duration
        match.duration += disruption.extraMinutes
        match.endTime = new Date(match.startTime)
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration)
      } else if (disruption.type === "late_arrival") {
        // Delay match start time
        match.startTime = new Date(match.startTime)
        match.startTime.setMinutes(match.startTime.getMinutes() + disruption.extraMinutes)
        match.endTime = new Date(match.startTime)
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration)
      }
    }
  }

  // Adjust subsequent matches to avoid conflicts
  // Sort matches by start time
  adjustedSchedule.matches.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  // Iterate through matches and adjust if there's overlap
  for (let i = 1; i < adjustedSchedule.matches.length; i++) {
    const prevMatch = adjustedSchedule.matches[i - 1]
    const currentMatch = adjustedSchedule.matches[i]

    // Check if there's a team overlap
    const teamsOverlap =
      prevMatch.team1.id === currentMatch.team1.id ||
      prevMatch.team1.id === currentMatch.team2.id ||
      prevMatch.team2.id === currentMatch.team1.id ||
      prevMatch.team2.id === currentMatch.team2.id

    // If teams overlap and there's a time conflict, adjust the current match
    if (teamsOverlap && prevMatch.endTime > currentMatch.startTime) {
      // Add rest period
      const newStartTime = new Date(prevMatch.endTime)
      newStartTime.setMinutes(newStartTime.getMinutes() + tournament.restPeriod)

      // Update times
      currentMatch.startTime = newStartTime
      currentMatch.endTime = new Date(newStartTime)
      currentMatch.endTime.setMinutes(newStartTime.getMinutes() + currentMatch.duration)
    }
    // If no team overlap but times overlap, just ensure minimum buffer
    else if (prevMatch.endTime > currentMatch.startTime) {
      const newStartTime = new Date(prevMatch.endTime)
      newStartTime.setMinutes(newStartTime.getMinutes() + 5) // 5 min buffer

      // Update times
      currentMatch.startTime = newStartTime
      currentMatch.endTime = new Date(newStartTime)
      currentMatch.endTime.setMinutes(newStartTime.getMinutes() + currentMatch.duration)
    }
  }

  return adjustedSchedule
}
