"""
Functions to import real tournament data from various formats.
"""

import csv
import json
from datetime import datetime, timedelta
from typing import List, Dict, Tuple

from backend.models import Team, Match, Schedule
from backend.models.models import GameType

def import_teams_from_csv(filepath: str) -> List[Team]:
    """Import team data from a CSV file."""
    teams = []
    with open(filepath, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            team = Team(
                id=int(row['id']),
                name=row['name'],
                game_type=GameType(row['game_type']),
                matches_played=int(row.get('matches_played', 0))
            )
            teams.append(team)
    return teams

def import_matches_from_csv(filepath: str, teams: Dict[int, Team]) -> List[Match]:
    """Import match data from a CSV file."""
    matches = []
    with open(filepath, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # Get teams by ID
            team1 = teams.get(int(row['team1_id']))
            team2 = teams.get(int(row['team2_id']))
            
            if not team1 or not team2:
                print(f"Warning: Could not find teams for match {row['id']}")
                continue
            
            # Parse times if available
            start_time = None
            end_time = None
            if 'start_time' in row and row['start_time']:
                start_time = datetime.strptime(row['start_time'], '%Y-%m-%d %H:%M:%S')
            if 'end_time' in row and row['end_time']:
                end_time = datetime.strptime(row['end_time'], '%Y-%m-%d %H:%M:%S')
            
            match = Match(
                id=row['id'],
                team1=team1,
                team2=team2,
                duration=int(row['duration']),
                game_type=GameType(row['game_type']),
                round_number=int(row['round_number']),
                start_time=start_time,
                end_time=end_time
            )
            matches.append(match)
    return matches

def import_disruptions_from_csv(filepath: str, matches: Dict[str, Match]) -> List[Dict]:
    """Import disruption data from a CSV file."""
    disruptions = []
    with open(filepath, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            match = matches.get(row['match_id'])
            if not match:
                print(f"Warning: Could not find match for disruption {row['id']}")
                continue
            
            disruption = {
                'type': row['type'],
                'match': match,
                'extra_minutes': int(row['extra_minutes']),
                'description': row['description']
            }
            disruptions.append(disruption)
    return disruptions

def import_tournament_data(teams_file: str, matches_file: str, disruptions_file: str = None):
    """Import all tournament data from files."""
    # Import teams
    teams_list = import_teams_from_csv(teams_file)
    teams_dict = {team.id: team for team in teams_list}
    
    # Import matches
    matches_list = import_matches_from_csv(matches_file, teams_dict)
    matches_dict = {match.id: match for match in matches_list}
    
    # Create schedule
    schedule = Schedule()
    for match in matches_list:
        schedule.add_match(match)
    
    # Import disruptions if file provided
    disruptions = []
    if disruptions_file:
        disruptions = import_disruptions_from_csv(disruptions_file, matches_dict)
    
    return teams_list, schedule, disruptions

def export_schedule_to_csv(schedule: Schedule, filepath: str):
    """Export a schedule to a CSV file."""
    with open(filepath, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['Match ID', 'Game', 'Team 1', 'Team 2', 'Start Time', 'End Time', 'Duration'])
        
        for match in sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max):
            writer.writerow([
                match.id,
                match.game_type,
                match.team1.name,
                match.team2.name,
                match.start_time.strftime('%Y-%m-%d %H:%M:%S') if match.start_time else '',
                match.end_time.strftime('%Y-%m-%d %H:%M:%S') if match.end_time else '',
                match.duration
            ])

def import_data(teams_file: str = None, matches_file: str = None, disruptions_file: str = None):
    """
    Wrapper for import_tournament_data function for backward compatibility.
    Import data from provided files.
    """
    if teams_file and matches_file:
        return import_tournament_data(teams_file, matches_file, disruptions_file)
    else:
        # Return empty data if files not provided
        return [], Schedule(), []
