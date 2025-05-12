"""
Data models for the esports tournament scheduling system.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Tuple, Optional, Set

class GameType(str, Enum):
    """Types of games in the tournament."""
    MOBILE_LEGENDS = "ML"
    VALORANT = "Val"

@dataclass
class Team:
    """Represents a team participating in the tournament."""
    id: int
    name: str
    game_type: GameType
    matches_played: int = 0
    
    def __hash__(self):
        return hash((self.id, self.name))

@dataclass
class Match:
    """Represents a match between two teams."""
    id: str
    team1: Team
    team2: Team
    duration: int  # in minutes
    game_type: GameType
    round_number: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_fixed_time: bool = False  # If True, start time cannot be moved by the scheduler
    is_break: bool = False       # If True, this is a break (lunch, etc.), not a match
    description: str = ""        # Additional description (e.g., "Lunch Break", "Finals")
    
    def __post_init__(self):
        if self.start_time and not self.end_time:
            self.end_time = self.start_time + timedelta(minutes=self.duration)
    
    def set_time(self, start_time: datetime):
        """Set the start time and calculate the end time."""
        self.start_time = start_time
        self.end_time = start_time + timedelta(minutes=self.duration)
    
    def __hash__(self):
        return hash((self.id, self.team1.id, self.team2.id))
        
    @property
    def is_finals(self) -> bool:
        """Check if this match is a finals match."""
        return self.round_number >= 3 or "final" in self.description.lower()
        
    @property
    def is_important(self) -> bool:
        """Check if this match is considered important (semifinals or finals)."""
        return self.round_number >= 2 or "final" in self.description.lower() or "semi" in self.description.lower()

@dataclass
class Schedule:
    """Represents a tournament schedule."""
    matches: List[Match] = field(default_factory=list)
    
    def add_match(self, match: Match):
        """Add a match to the schedule."""
        self.matches.append(match)
    
    def find_match(self, match_id: str) -> Optional[Match]:
        """Find a match by ID."""
        for match in self.matches:
            if match.id == match_id:
                return match
        return None
    
    def conflicts_with(self, match: Match, other_match: Match) -> bool:
        """Check if two matches conflict with each other."""
        # If either match doesn't have times set, they don't conflict
        if not match.start_time or not other_match.start_time:
            return False
        
        # Check for team overlap
        teams_overlap = (match.team1.name == other_match.team1.name or 
                        match.team1.name == other_match.team2.name or
                        match.team2.name == other_match.team1.name or
                        match.team2.name == other_match.team2.name)
        
        # Check for time overlap (whether the matches happen at the same time)
        time_overlap = (
            (match.start_time <= other_match.start_time < match.end_time) or
            (match.start_time < other_match.end_time <= match.end_time) or
            (other_match.start_time <= match.start_time < other_match.end_time) or
            (other_match.start_time < match.end_time <= other_match.end_time)
        )
        
        # Treat matches of the same game type as using the same venue
        venue_conflict = match.game_type == other_match.game_type and time_overlap
        
        # Return true if either teams overlap and times overlap, or if there's a venue conflict
        return (teams_overlap and time_overlap) or venue_conflict
    
    def get_affected_matches(self, disrupted_match: Match) -> List[Match]:
        """Return all matches affected by a disruption to the given match."""
        if not disrupted_match.start_time or not disrupted_match.end_time:
            return []
        
        affected = []
        for match in self.matches:
            # Skip the disrupted match itself
            if match.id == disrupted_match.id:
                continue
                
            # A match is affected if:
            # 1. It involves the same team(s) and starts after the disrupted match
            teams_affected = (match.team1.name == disrupted_match.team1.name or
                              match.team1.name == disrupted_match.team2.name or
                              match.team2.name == disrupted_match.team1.name or
                              match.team2.name == disrupted_match.team2.name)
            
            # 2. It uses the same venue (same game type) and starts after the disrupted match
            venue_affected = match.game_type == disrupted_match.game_type
            
            # 3. It starts after the disrupted match's end time
            time_affected = match.start_time >= disrupted_match.end_time
            
            if (teams_affected or venue_affected) and time_affected:
                affected.append(match)
                
        # Sort by start time
        affected.sort(key=lambda m: m.start_time)
        return affected
    
    def clone(self) -> 'Schedule':
        """Create a deep copy of the schedule."""
        new_schedule = Schedule()
        for match in self.matches:
            new_match = Match(
                id=match.id,
                team1=match.team1,
                team2=match.team2,
                duration=match.duration,
                game_type=match.game_type,
                round_number=match.round_number,
                start_time=match.start_time,
                end_time=match.end_time,
                is_fixed_time=match.is_fixed_time,
                is_break=match.is_break,
                description=match.description
            )
            new_schedule.add_match(new_match)
        return new_schedule

@dataclass
class Disruption:
    """Represents a disruption to the tournament schedule."""
    type: str  # 'extended_duration', 'late_arrival', 'early_finish', etc.
    match: Match
    extra_minutes: int
    description: str = ""
