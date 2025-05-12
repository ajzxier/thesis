"""
Tests for evaluating the optimization performance of the schedulers.
"""

import time
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime, time as dt_time, timedelta

from backend.models.models import Team, Match, Schedule, Disruption, GameType
from backend.models.tournament import Tournament
from backend.schedulers.scheduler import GraphColoringScheduler, GeneticAlgorithmOptimizer


def setup_tournament():
    """Set up a test tournament with teams and matches."""
    # Create a tournament
    tournament = Tournament(
        id="test_tournament",
        name="Test Tournament",
        venue_start=dt_time(9, 0),  # 9:00 AM
        venue_end=dt_time(18, 0),   # 6:00 PM
        rest_period=30              # 30 minutes rest
    )
    
    # Create teams
    teams = [
        Team(id=f"team{i}", name=f"Team {i}", game_type=GameType.MOBILE_LEGENDS if i < 5 else GameType.VALORANT) 
        for i in range(1, 9)
    ]
    tournament.add_teams(teams)
    
    # Create matches
    matches = []
    # Round 1 (quarterfinals)
    for i in range(0, 8, 2):
        match = Match(
            id=f"match{len(matches)+1}",
            team1=teams[i],
            team2=teams[i+1],
            duration=60,
            game_type=GameType.MOBILE_LEGENDS if i < 4 else GameType.VALORANT,
            round_number=1
        )
        matches.append(match)
    
    tournament.matches = matches
    return tournament


def evaluate_optimization():
    """Evaluate optimization performance with various disruption scenarios."""
    tournament = setup_tournament()
    
    # Generate initial schedule
    scheduler = GraphColoringScheduler(tournament)
    initial_schedule = scheduler.generate_schedule()
    
    # Define disruption scenarios
    disruption_scenarios = [
        [],  # No disruptions (baseline)
        [Disruption(match=tournament.matches[0], type="late_arrival", extra_minutes=15)],
        [Disruption(match=tournament.matches[0], type="extended_duration", extra_minutes=20)],
        [
            Disruption(match=tournament.matches[0], type="late_arrival", extra_minutes=15),
            Disruption(match=tournament.matches[1], type="extended_duration", extra_minutes=20)
        ]
    ]
    
    scenario_names = [
        "Baseline",
        "Late Arrival",
        "Extended Duration", 
        "Multiple Disruptions"
    ]
    
    results = []
    
    # Run optimizer for each scenario
    for disruptions in disruption_scenarios:
        # Create a genetic algorithm optimizer
        optimizer = GeneticAlgorithmOptimizer(tournament, initial_schedule, disruptions)
        
        # Measure execution time
        start_time = time.time()
        optimized_schedule = optimizer.optimize()
        execution_time = time.time() - start_time
        
        # Get fitness metrics
        # We'll run the evaluation function once more on the final result
        fitness = optimizer._evaluate_schedule(optimizer._create_schedule())
        
        results.append({
            "execution_time": execution_time,
            "fitness": fitness[0],  # The fitness is returned as a tuple
            "conflicts": optimizer._check_conflicts(optimized_schedule),
            "venue_hours": optimizer._check_venue_hours(optimized_schedule),
            "rest_periods": optimizer._check_rest_periods(optimized_schedule),
            "idle_time": optimizer._calculate_idle_time(optimized_schedule),
            "schedule_changes": optimizer._calculate_schedule_changes(optimized_schedule)
        })
    
    return scenario_names, results


def plot_results(scenario_names, results):
    """Plot the optimization results."""
    # Create figure with multiple subplots
    fig, axs = plt.subplots(3, 2, figsize=(15, 15))
    
    # Extract metrics
    execution_times = [r["execution_time"] for r in results]
    fitness_values = [r["fitness"] for r in results]
    conflicts = [r["conflicts"] for r in results]
    venue_hours = [r["venue_hours"] for r in results]
    rest_periods = [r["rest_periods"] for r in results]
    idle_times = [r["idle_time"] for r in results]
    
    # Plot execution time
    axs[0, 0].bar(scenario_names, execution_times)
    axs[0, 0].set_title('Execution Time (seconds)')
    axs[0, 0].set_ylabel('Seconds')
    
    # Plot fitness values
    axs[0, 1].bar(scenario_names, fitness_values)
    axs[0, 1].set_title('Fitness Values (lower is better)')
    axs[0, 1].set_ylabel('Fitness')
    
    # Plot constraint violations
    axs[1, 0].bar(scenario_names, conflicts)
    axs[1, 0].set_title('Conflict Violations')
    axs[1, 0].set_ylabel('Count')
    
    # Plot venue hour violations
    axs[1, 1].bar(scenario_names, venue_hours)
    axs[1, 1].set_title('Venue Hours Violations')
    axs[1, 1].set_ylabel('Count')
    
    # Plot rest period violations
    axs[2, 0].bar(scenario_names, rest_periods)
    axs[2, 0].set_title('Rest Period Violations')
    axs[2, 0].set_ylabel('Count')
    
    # Plot idle time
    axs[2, 1].bar(scenario_names, idle_times)
    axs[2, 1].set_title('Idle Time')
    axs[2, 1].set_ylabel('Minutes')
    
    plt.tight_layout()
    plt.savefig('optimization_results.png')
    plt.close()


if __name__ == "__main__":
    scenario_names, results = evaluate_optimization()
    plot_results(scenario_names, results)
    
    print("Optimization Test Results:")
    print("========================")
    
    for i, scenario in enumerate(scenario_names):
        print(f"\nScenario: {scenario}")
        print(f"Execution Time: {results[i]['execution_time']:.2f} seconds")
        print(f"Fitness Value: {results[i]['fitness']:.2f}")
        print(f"Constraint Violations:")
        print(f"  - Conflicts: {results[i]['conflicts']}")
        print(f"  - Venue Hours: {results[i]['venue_hours']}")
        print(f"  - Rest Periods: {results[i]['rest_periods']}")
        print(f"Other Metrics:")
        print(f"  - Idle Time: {results[i]['idle_time']:.2f}")
        print(f"  - Schedule Changes: {results[i]['schedule_changes']:.2f}") 