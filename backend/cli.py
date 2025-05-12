#!/usr/bin/env python3
"""
Dynamic Scheduling Optimization for Cebu-Based Esports Tournaments
A command-line tool implementing graph coloring and genetic algorithms
for real-time tournament schedule adjustments.

Author: Amielle Jaezxier Perez
Based on thesis: "Dynamic Scheduling Optimization for Cebu-Based Esports Tournaments"
"""

import argparse
import sys
import time
from typing import Dict, List, Tuple
import random
import pandas as pd
import networkx as nx
from deap import base, creator, tools, algorithms
import os
from data_importer import import_tournament_data, export_schedule_to_csv
from tournament import Tournament
from scheduler import GraphColoringScheduler, GeneticAlgorithmOptimizer
from models import Match, Team, Schedule, Disruption, GameType

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Dynamic Scheduling Optimization for Esports Tournaments",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "--format", 
        type=str, 
        choices=["single-elimination", "double-elimination"],
        default="single-elimination",
        help="Tournament format"
    )
    
    parser.add_argument(
        "--teams", 
        type=int, 
        default=8,
        help="Number of teams (must be a power of 2, between 8 and 16)"
    )
    
    parser.add_argument(
        "--ml-teams", 
        type=int, 
        default=4,
        help="Number of Mobile Legends teams"
    )
    
    parser.add_argument(
        "--val-teams", 
        type=int, 
        default=4,
        help="Number of Valorant teams"
    )
    
    parser.add_argument(
        "--ml-duration", 
        type=str, 
        default="15-25",
        help="Duration range for Mobile Legends matches in minutes (min-max)"
    )
    
    parser.add_argument(
        "--val-duration", 
        type=str, 
        default="30-50",
        help="Duration range for Valorant matches in minutes (min-max)"
    )
    
    parser.add_argument(
        "--venue-hours", 
        type=str, 
        default="9:00-20:00",
        help="Venue operating hours (24-hour format, HH:MM-HH:MM)"
    )
    
    parser.add_argument(
        "--rest-period", 
        type=int, 
        default=30,
        help="Minimum rest period between matches for teams (minutes)"
    )
    
    parser.add_argument(
        "--max-matches", 
        type=int, 
        default=3,
        help="Maximum matches per team per day"
    )
    
    parser.add_argument(
        "--seed", 
        type=int, 
        default=None,
        help="Random seed for reproducibility"
    )
    
    parser.add_argument(
        "--simulate-disruption", 
        action="store_true",
        help="Simulate disruptions to test dynamic rescheduling"
    )
    
    parser.add_argument(
        "--import-data", 
        action="store_true",
        help="Import real tournament data from CSV files"
    )
    
    parser.add_argument(
        "--teams-file", 
        type=str, 
        default="teams.csv",
        help="CSV file containing team data"
    )
    
    parser.add_argument(
        "--matches-file", 
        type=str, 
        default="matches.csv",
        help="CSV file containing match data"
    )
    
    parser.add_argument(
        "--disruptions-file", 
        type=str, 
        default=None,
        help="CSV file containing disruption data"
    )
    
    parser.add_argument(
        "--export-schedule", 
        type=str, 
        default=None,
        help="Export the final schedule to a CSV file"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.teams < 8 or args.teams > 16 or (args.teams & (args.teams - 1) != 0):
        parser.error("Number of teams must be a power of 2, between 8 and 16")
    
    if args.ml_teams + args.val_teams != args.teams:
        parser.error("Sum of ML and Valorant teams must equal total teams")
    
    return args

def main():
    """Main function to run the scheduler."""
    # Parse command line arguments
    args = parse_arguments()
    
    # Set random seed if provided
    if args.seed is not None:
        random.seed(args.seed)
    
    print("\n╔════════════════════════════════════════════════════════════════╗")
    print("║  Dynamic Scheduling Optimization for Esports Tournaments        ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    
    # Handle real data import if requested
    if args.import_data:
        print("\nImporting tournament data from CSV files...")
        
        if not os.path.exists(args.teams_file):
            print(f"Error: Teams file '{args.teams_file}' not found.")
            return
            
        if not os.path.exists(args.matches_file):
            print(f"Error: Matches file '{args.matches_file}' not found.")
            return
            
        if args.disruptions_file and not os.path.exists(args.disruptions_file):
            print(f"Warning: Disruptions file '{args.disruptions_file}' not found. No disruptions will be imported.")
            args.disruptions_file = None
            
        teams, initial_schedule, disruptions = import_tournament_data(
            args.teams_file, 
            args.matches_file, 
            args.disruptions_file
        )
        
        print(f"Imported {len(teams)} teams and {len(initial_schedule.matches)} matches.")
        
        if args.disruptions_file:
            print(f"Imported {len(disruptions)} disruptions.")
            
        print("\nImported Tournament Schedule:")
        display_schedule(initial_schedule)
        
        if disruptions:
            print("\nApplying Genetic Algorithm to adjust schedule...")
            start_time = time.time()
            
            # Create a tournament object with parameters from the data
            # For simplicity, we'll use some default values
            tournament = Tournament(
                format="custom",  # Custom format for imported data
                ml_teams=len([t for t in teams if t.game_type == GameType.MOBILE_LEGENDS]),
                val_teams=len([t for t in teams if t.game_type == GameType.VALORANT]),
                ml_duration=(15, 25),  # Default values
                val_duration=(30, 50),  # Default values
                venue_hours=args.venue_hours.split('-'),
                rest_period=args.rest_period,
                max_matches_per_day=args.max_matches
            )
            
            optimizer = GeneticAlgorithmOptimizer(tournament, initial_schedule, disruptions)
            adjusted_schedule = optimizer.optimize()
            ga_time = time.time() - start_time
            
            print(f"Schedule adjusted in {ga_time:.2f} seconds.")
            print("\nAdjusted Tournament Schedule:")
            display_schedule(adjusted_schedule)
            
            # Calculate and display metrics
            print("\nPerformance Metrics:")
            calculate_metrics(initial_schedule, adjusted_schedule, disruptions)
            
            # Export schedule if requested
            if args.export_schedule:
                export_schedule_to_csv(adjusted_schedule, args.export_schedule)
                print(f"\nAdjusted schedule exported to {args.export_schedule}")
        
        elif args.export_schedule:
            export_schedule_to_csv(initial_schedule, args.export_schedule)
            print(f"\nSchedule exported to {args.export_schedule}")
            
        return
    
    # Parse duration ranges
    ml_min, ml_max = map(int, args.ml_duration.split('-'))
    val_min, val_max = map(int, args.val_duration.split('-'))
    
    # Parse venue hours
    venue_start, venue_end = args.venue_hours.split('-')
    
    # Create tournament
    print(f"Creating {args.format} tournament with {args.teams} teams...")
    print(f"  - {args.ml_teams} Mobile Legends teams")
    print(f"  - {args.val_teams} Valorant teams")
    print(f"  - Mobile Legends match duration: {ml_min}-{ml_max} minutes")
    print(f"  - Valorant match duration: {val_min}-{val_max} minutes")
    print(f"  - Venue hours: {venue_start} to {venue_end}")
    print(f"  - Minimum rest period: {args.rest_period} minutes")
    print(f"  - Maximum matches per team per day: {args.max_matches}")
    
    tournament = Tournament(
        format=args.format,
        ml_teams=args.ml_teams,
        val_teams=args.val_teams,
        ml_duration=(ml_min, ml_max),
        val_duration=(val_min, val_max),
        venue_hours=(venue_start, venue_end),
        rest_period=args.rest_period,
        max_matches_per_day=args.max_matches
    )
    
    # Generate initial schedule using graph coloring
    print("\nGenerating initial schedule using graph coloring algorithm...")
    start_time = time.time()
    scheduler = GraphColoringScheduler(tournament)
    initial_schedule = scheduler.generate_schedule()
    gc_time = time.time() - start_time
    
    print(f"Initial schedule generated in {gc_time:.2f} seconds.")
    print("\nInitial Tournament Schedule:")
    display_schedule(initial_schedule)
    
    # Check if we should simulate disruptions
    if args.simulate_disruption:
        print("\nSimulating tournament disruptions...")
        disruptions = simulate_disruptions(tournament, initial_schedule)
        
        print("\nApplying Genetic Algorithm to adjust schedule...")
        start_time = time.time()
        optimizer = GeneticAlgorithmOptimizer(tournament, initial_schedule, disruptions)
        adjusted_schedule = optimizer.optimize()
        ga_time = time.time() - start_time
        
        print(f"Schedule adjusted in {ga_time:.2f} seconds.")
        print("\nAdjusted Tournament Schedule:")
        display_schedule(adjusted_schedule)
        
        # Calculate and display metrics
        print("\nPerformance Metrics:")
        calculate_metrics(initial_schedule, adjusted_schedule, disruptions)
    
    print("\nScheduling complete!")

def display_schedule(schedule: Schedule):
    """Display a schedule in a readable format."""
    df = pd.DataFrame([
        {
            "Match": match.id,
            "Game": match.game_type,
            "Teams": f"{match.team1.name} vs {match.team2.name}",
            "Start": match.start_time.strftime("%H:%M"),
            "End": match.end_time.strftime("%H:%M"),
            "Duration": f"{match.duration} min"
        }
        for match in schedule.matches
    ])
    
    # Sort by start time
    df = df.sort_values(by=["Start"])
    
    # Reset index for clean display
    df = df.reset_index(drop=True)
    
    print(df.to_string(index=False))

def simulate_disruptions(tournament: Tournament, schedule: Schedule) -> List[Disruption]:
    """Simulate random disruptions to test the dynamic scheduling capability."""
    disruptions = []
    
    # Simulate extended match duration for a random early match
    early_matches = [m for m in schedule.matches if m.id.startswith("M1") or m.id.startswith("M2")]
    if early_matches:
        match = random.choice(early_matches)
        extra_time = random.randint(10, 20)
        disruptions.append(Disruption(
            type="extended_duration",
            match=match,
            extra_minutes=extra_time,
            description=f"Match {match.id} ({match.team1.name} vs {match.team2.name}) ran {extra_time} minutes longer than expected."
        ))
    
    # Simulate late team arrival
    later_matches = [m for m in schedule.matches if not (m.id.startswith("M1") or m.id.startswith("M2"))]
    if later_matches:
        match = random.choice(later_matches)
        delay = random.randint(10, 15)
        disruptions.append(Disruption(
            type="late_arrival",
            match=match,
            extra_minutes=delay,
            description=f"Team {match.team2.name} arrived {delay} minutes late for match {match.id}."
        ))
    
    # Display disruption information
    for i, d in enumerate(disruptions, 1):
        print(f"Disruption {i}: {d.description}")
    
    return disruptions

def calculate_metrics(initial_schedule: Schedule, adjusted_schedule: Schedule, disruptions: List[Disruption]):
    """Calculate and display performance metrics comparing schedules."""
    # Calculate idle time (gaps between matches)
    initial_idle = calculate_idle_time(initial_schedule)
    adjusted_idle = calculate_idle_time(adjusted_schedule)
    
    # Calculate schedule disruption (how many matches were moved from original time)
    moved_matches = sum(1 for m1 in initial_schedule.matches 
                      for m2 in adjusted_schedule.matches 
                      if m1.id == m2.id and m1.start_time != m2.start_time)
    disruption_score = (moved_matches / len(initial_schedule.matches)) * 100
    
    # Calculate total tournament duration
    initial_duration = (max(m.end_time for m in initial_schedule.matches) - 
                      min(m.start_time for m in initial_schedule.matches)).total_seconds() / 60
    adjusted_duration = (max(m.end_time for m in adjusted_schedule.matches) - 
                       min(m.start_time for m in adjusted_schedule.matches)).total_seconds() / 60
    
    # Display metrics
    print(f"Idle Time (mins): Initial: {initial_idle:.1f}, Adjusted: {adjusted_idle:.1f}, Change: {adjusted_idle - initial_idle:+.1f}")
    print(f"Total Duration (mins): Initial: {initial_duration:.1f}, Adjusted: {adjusted_duration:.1f}, Change: {adjusted_duration - initial_duration:+.1f}")
    print(f"Disruption Score: {disruption_score:.1f}% of matches were rescheduled")
    
    # Check for constraint violations
    check_constraint_violations(adjusted_schedule)

def calculate_idle_time(schedule: Schedule) -> float:
    """Calculate total idle time in a schedule (in minutes)."""
    sorted_matches = sorted(schedule.matches, key=lambda m: m.start_time)
    total_idle = 0
    
    for i in range(1, len(sorted_matches)):
        current_start = sorted_matches[i].start_time
        prev_end = sorted_matches[i-1].end_time
        if current_start > prev_end:
            idle_minutes = (current_start - prev_end).total_seconds() / 60
            total_idle += idle_minutes
    
    return total_idle

def check_constraint_violations(schedule: Schedule):
    """Check and report any constraint violations in the schedule."""
    violations = []
    
    # Check for team playing multiple matches at once
    team_matches = {}
    for match in schedule.matches:
        for team in [match.team1, match.team2]:
            if team.name not in team_matches:
                team_matches[team.name] = []
            team_matches[team.name].append(match)
    
    for team, matches in team_matches.items():
        sorted_matches = sorted(matches, key=lambda m: m.start_time)
        for i in range(1, len(sorted_matches)):
            if sorted_matches[i].start_time < sorted_matches[i-1].end_time:
                violations.append(f"Overlap: {team} is scheduled in overlapping matches")
    
    # Report violations
    if violations:
        print("\nConstraint Violations:")
        for v in violations:
            print(f"- {v}")
    else:
        print("\nNo constraint violations detected in the adjusted schedule.")

if __name__ == "__main__":
    main()
