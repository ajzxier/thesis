"""
Tournament class for creating and managing esports tournaments.
"""

from datetime import datetime, timedelta
import random
from typing import Dict, List, Tuple, Set
import networkx as nx

from models import GameType, Team, Match, Schedule

class Tournament:
    """Represents an esports tournament with teams and matches."""
    
    def __init__(self, id: str, name: str, venue_start, venue_end, rest_period: int):
        """Initialize a tournament with the given parameters."""
        self.id = id
        self.name = name
        self.venue_start = venue_start
        self.venue_end = venue_end
        self.rest_period = rest_period
        
        # Initialize empty lists
        self.teams = []
        self.matches = []
        
        # Create conflict graph
        self.conflict_graph = nx.Graph()
    
    def add_teams(self, teams: List[Team]):
        """Add teams to the tournament."""
        self.teams.extend(teams)
    
    def add_fixed_event(self, event_match: Match):
        """Add a fixed event like lunch break or finals to the tournament."""
        self.matches.append(event_match)
        self._update_conflict_graph()
    
    def mark_finals(self, match_ids: List[str]):
        """Mark specific matches as finals (fixed time)."""
        for match in self.matches:
            if match.id in match_ids:
                match.is_fixed_time = True
                match.description += " (Finals)"
                # Make sure round number is high enough to be considered a final
                if match.round_number < 3:
                    match.round_number = 3
        
        # Update conflict graph to reflect the new constraints
        self._update_conflict_graph()
    
    def _update_conflict_graph(self):
        """Update the conflict graph based on current matches."""
        # Reset the graph
        self.conflict_graph = nx.Graph()
        
        # Add all matches as nodes
        for match in self.matches:
            self.conflict_graph.add_node(match)
        
        # Add edges between matches that have conflicts
        for i, match1 in enumerate(self.matches):
            for match2 in self.matches[i+1:]:
                # Start with no conflict
                conflict = False
                
                # 1. Team-based conflicts: matches with the same teams can't happen simultaneously
                teams1 = {match1.team1.name, match1.team2.name}
                teams2 = {match2.team1.name, match2.team2.name}
                
                if teams1.intersection(teams2) and not (match1.is_break or match2.is_break):
                    conflict = True
                
                # 2. Tournament round dependencies: matches from later rounds must happen after matches from earlier rounds
                # This ensures that round 2 (semifinals) happens after round 1 (quarterfinals),
                # and round 3 (finals) happens after round 2 (semifinals)
                if match1.round_number != match2.round_number:
                    conflict = True  # Different rounds can't be scheduled concurrently
                
                # 3. Handle "Winner of" dependencies
                # If any team name contains "Winner", this match depends on earlier rounds
                for team in [match1.team1, match1.team2, match2.team1, match2.team2]:
                    if "Winner" in team.name:
                        conflict = True  # Ensure proper sequencing for matches with "Winner of" teams
                
                # 4. Fixed-time events and breaks create conflicts with all other matches during their time
                if match1.is_fixed_time or match2.is_fixed_time:
                    # Check if they overlap in time
                    if match1.start_time and match2.start_time:
                        time_overlap = (
                            (match1.start_time <= match2.start_time < match1.end_time) or
                            (match1.start_time < match2.end_time <= match1.end_time) or
                            (match2.start_time <= match1.start_time < match2.end_time) or
                            (match2.start_time < match1.end_time <= match2.end_time)
                        )
                        if time_overlap:
                            conflict = True
                
                # Add an edge to the conflict graph if any conflict was found
                if conflict:
                    self.conflict_graph.add_edge(match1, match2)
    
    def get_timeslots(self, interval_minutes: int = 5) -> List[datetime]:
        """Generate possible timeslots based on venue hours."""
        # Use today's date for simplicity
        today = datetime.today().date()
        
        # Start time
        current_time = datetime.combine(today, self.venue_start)
        end_time = datetime.combine(today, self.venue_end)
        
        timeslots = []
        while current_time <= end_time:
            timeslots.append(current_time)
            current_time += timedelta(minutes=interval_minutes)
        
        return timeslots
    
    def check_rest_period(self, schedule: Schedule, team: Team, start_time: datetime) -> bool:
        """Check if a team has enough rest before a match at the given start time."""
        # Find all previous matches for this team
        team_matches = [m for m in schedule.matches if 
                       m.team1.name == team.name or 
                       m.team2.name == team.name]
        
        # Check if there's enough rest time between matches
        for match in team_matches:
            if match.end_time:
                rest_time = (start_time - match.end_time).total_seconds() / 60
                if rest_time < self.rest_period:
                    return False
        
        return True
    
    def is_valid_time(self, time: datetime) -> bool:
        """Check if the given time is within venue hours."""
        return self.venue_start <= time.time() <= self.venue_end
