export enum GameType {
  MOBILE_LEGENDS = "ML",
  VALORANT = "Val",
}

export interface Team {
  id: number
  name: string
  gameType: GameType
  matchesPlayed?: number
}

export interface Match {
  id: string
  team1: Team
  team2: Team
  duration: number // in minutes
  gameType: GameType
  roundNumber: number
  startTime: Date
  endTime: Date
}

export interface Schedule {
  matches: Match[]
}

export interface Tournament {
  format: "single-elimination" | "double-elimination" | "custom" | "upper-bracket" | "lower-bracket" | "playoffs" | "semifinals" | "finals"
  mlTeams: number
  valTeams: number
  mlDuration: [number, number] // [min, max] in minutes
  valDuration: [number, number] // [min, max] in minutes
  venueHours: [string, string] // ["HH:MM", "HH:MM"]
  restPeriod: number // in minutes
  maxMatchesPerDay: number
  matchFormat: "bo3" | "bo5" // best of 3 or best of 5
  enabledGames: {
    mobileLegends: boolean
    valorant: boolean
  }
}

export type DisruptionType = "extended_duration" | "late_arrival" | "early_finish"

export interface Disruption {
  id: string
  type: DisruptionType
  match: Match
  extraMinutes: number
  description: string
}
