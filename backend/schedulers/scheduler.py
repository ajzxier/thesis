"""
Scheduling algorithms for the esports tournament.
"""

from datetime import datetime, timedelta
import random
from typing import Dict, List, Tuple, Set, Optional
import networkx as nx
import numpy as np
from deap import base, creator, tools, algorithms

from backend.models.models import Match, Team, Schedule, Disruption
from backend.models.tournament import Tournament

class GraphColoringScheduler:
    """Scheduler using graph coloring algorithm for initial scheduling."""
    
    def __init__(self, tournament: Tournament):
        """Initialize with a tournament."""
        self.tournament = tournament
        self.conflict_graph = tournament.conflict_graph
    
    def generate_schedule(self) -> Schedule:
        """Generate a schedule using fixed time slots."""
        # Create a schedule
        schedule = Schedule()
        
        # Define fixed time slots as requested
        morning_time_slots = [
            "09:00",  # 9:00 AM
            "10:00",  # 10:00 AM
            "11:00"   # 11:00 AM
        ]
        
        afternoon_time_slots = [
            "13:00",  # 1:00 PM
            "14:20",  # 2:20 PM
            "15:40"   # 3:40 PM
        ]
        
        # Track current slot indices
        morning_slot_index = 0
        afternoon_slot_index = 0
        
        # Get venue date (using today's date for simplicity)
        venue_date = datetime.today().date()
        
        # First add any fixed events from the tournament
        if hasattr(self.tournament, 'fixed_events') and self.tournament.fixed_events:
            for fixed_event in self.tournament.fixed_events:
                schedule.add_match(fixed_event)
        
        # Get matches by game type
        ml_matches = []
        val_matches = []
        
        for match in self.tournament.matches:
            if match.game_type == "ML":
                ml_matches.append(match)
            elif match.game_type == "Val":
                val_matches.append(match)
        
        # Sort matches by round number
        ml_matches.sort(key=lambda m: m.round_number)
        val_matches.sort(key=lambda m: m.round_number)
        
        # Assign morning slots to Mobile Legends matches
        for match in ml_matches:
            if morning_slot_index < len(morning_time_slots):
                # Parse the time slot
                time_str = morning_time_slots[morning_slot_index]
                hours, minutes = map(int, time_str.split(":"))
                
                # Create datetime for the match start
                start_time = datetime.combine(venue_date, datetime.min.time())
                start_time = start_time.replace(hour=hours, minute=minutes)
                
                # Set match time
                match.set_time(start_time)
                
                # Add to schedule
                schedule.add_match(match)
                
                # Move to next slot
                morning_slot_index += 1
        
        # Assign afternoon slots to Valorant matches
        for match in val_matches:
            if afternoon_slot_index < len(afternoon_time_slots):
                # Parse the time slot
                time_str = afternoon_time_slots[afternoon_slot_index]
                hours, minutes = map(int, time_str.split(":"))
                
                # Create datetime for the match start
                start_time = datetime.combine(venue_date, datetime.min.time())
                start_time = start_time.replace(hour=hours, minute=minutes)
                
                # Set match time
                match.set_time(start_time)
                
                # Add to schedule
                schedule.add_match(match)
                
                # Move to next slot
                afternoon_slot_index += 1
        
        return schedule

class GeneticAlgorithmOptimizer:
    """Optimizer using genetic algorithms for dynamic schedule adjustments."""
    
    def __init__(self, tournament: Tournament, initial_schedule: Schedule, disruptions: List[Disruption]):
        """Initialize with a tournament, initial schedule, and disruptions."""
        self.tournament = tournament
        self.initial_schedule = initial_schedule
        self.disruptions = disruptions
        
        # Constraint weights for fitness function
        self.weights = {
            'conflict': 1000,      # Hard constraint: Team/venue conflicts
            'venue_hours': 800,    # Hard constraint: Venue availability hours
            'rest_period': 600,    # Hard constraint: Rest periods between matches
            'round_sequence': 700, # Hard constraint: Round sequencing
            'idle_time': 0.5,      # Soft constraint: Minimize idle time
            'schedule_change': 0.1,# Soft constraint: Minimize changes to original schedule
            'peak_time': 0.3       # Soft constraint: Schedule important matches during peak hours
        }
        
        # Define peak hours (e.g., 6-8 PM is peak viewership)
        self.peak_hours = [(18, 20)]  # List of (start_hour, end_hour) tuples
        
        # Initialize genetic algorithm components
        self._setup_ga()
    
    def _setup_ga(self):
        """Set up the genetic algorithm components."""
        # Define fitness function (minimize)
        # If not already defined elsewhere in the code
        if not hasattr(creator, "FitnessMin"):
            creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
        
        if not hasattr(creator, "Individual"):
            creator.create("Individual", list, fitness=creator.FitnessMin)
        
        # Create toolbox
        self.toolbox = base.Toolbox()
        
        # Register schedule representation and initialization
        self.toolbox.register("schedule", self._create_schedule)
        self.toolbox.register("individual", tools.initIterate, creator.Individual, self.toolbox.schedule)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        
        # Register genetic operators
        self.toolbox.register("evaluate", self._evaluate_schedule)
        self.toolbox.register("mate", self._crossover)
        self.toolbox.register("mutate", self._mutate)
        self.toolbox.register("select", tools.selTournament, tournsize=3)
    
    def _create_schedule(self):
        """Create an individual (schedule representation)."""
        # Apply disruptions to create a "disrupted" schedule with late arrivals handled directly
        disrupted_schedule = self._apply_disruptions(self.initial_schedule.clone())
        
        # Get all matches
        matches = disrupted_schedule.matches
        
        # Sort matches by id to ensure consistent order
        matches.sort(key=lambda m: m.id)
        
        # Track which matches had late arrival disruptions
        late_arrival_matches = [d.match.id for d in self.disruptions if d.type == "late_arrival"]
        
        # Represent the schedule as a list of start times (minutes from venue open)
        venue_open = datetime.combine(datetime.today().date(), self.tournament.venue_start)
        
        # Encode as minutes from venue open
        encoded_schedule = []
        for match in matches:
            if match.start_time:
                minutes = int((match.start_time - venue_open).total_seconds() / 60)
                encoded_schedule.append(minutes)
            else:
                # If no start time, use a default
                encoded_schedule.append(0)
        
        # Store late arrival match indices to avoid optimizing them
        self.late_arrival_indices = [i for i, match in enumerate(matches) if match.id in late_arrival_matches]
        
        return encoded_schedule
    
    def _apply_disruptions(self, schedule: Schedule) -> Schedule:
        """Apply disruptions to the schedule with improved time sequence handling."""
        # Store original match order based on start times
        original_matches = sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        original_match_order = [m.id for m in original_matches]
        
        # Sort disruptions by match order to ensure proper sequencing
        # This ensures earlier matches are disrupted first, allowing proper propagation
        matches_by_id = {m.id: m for m in schedule.matches}
        disruption_sequence = []
        
        for match_id in original_match_order:
            match_disruptions = [d for d in self.disruptions if d.match.id == match_id]
            disruption_sequence.extend(match_disruptions)
        
        # Process disruptions in the order of matches
        for disruption in disruption_sequence:
            match = schedule.find_match(disruption.match.id)
            
            if not match or match.is_fixed_time:
                continue
                
            if disruption.type == "late_arrival":
                # Record original times for logging
                original_start = match.start_time
                original_end = match.end_time
                
                # Apply the exact delay to the match
                new_start = original_start + timedelta(minutes=disruption.extra_minutes)
                match.set_time(new_start)
                
                print(f"Late arrival: Match {match.id} shifted from {original_start} to {match.start_time}")
                
                # Propagate changes to all subsequent matches
                self._propagate_time_changes(schedule, match, original_end)
                
            elif disruption.type == "extended_duration":
                # Record original end time
                original_end = match.end_time
                
                # Extend match duration
                match.duration += disruption.extra_minutes
                match.end_time = match.start_time + timedelta(minutes=match.duration)
                
                print(f"Extended duration: Match {match.id} extended by {disruption.extra_minutes} minutes, now ends at {match.end_time}")
                
                # Propagate changes to all subsequent matches
                self._propagate_time_changes(schedule, match, original_end)
                
            elif disruption.type == "early_finish":
                # Record original end time
                original_end = match.end_time
                
                # Reduce match duration (finished earlier than expected)
                match.duration -= disruption.extra_minutes
                match.end_time = match.start_time + timedelta(minutes=match.duration)
                
                print(f"Early finish: Match {match.id} finished {disruption.extra_minutes} minutes early, now ends at {match.end_time}")
                
                # For early finishes, try to move subsequent matches earlier if possible
                self._handle_early_finish_improved(schedule, match, original_end)
        
        # Final validation pass to ensure no conflicts remain
        self._validate_schedule_sequence(schedule, original_match_order)
                
        return schedule
    
    def _maintain_original_order(self, schedule: Schedule, original_order: List[str]) -> None:
        """
        Ensure matches maintain their original relative ordering after disruptions.
        This is critical for late arrivals and other disruptions to not reorder matches.
        """
        # Get current matches
        current_matches = {m.id: m for m in schedule.matches}
        
        # Go through matches in original order
        for i in range(len(original_order)):
            current_id = original_order[i]
            current_match = current_matches.get(current_id)
            
            if not current_match or current_match.is_fixed_time:
                continue  # Skip fixed events or missing matches
            
            # Find the previous match in the original order
            prev_match = None
            for j in range(i-1, -1, -1):
                prev_id = original_order[j]
                if prev_id in current_matches and not current_matches[prev_id].is_fixed_time:
                    prev_match = current_matches[prev_id]
                    break
            
            # If no previous match, continue
            if not prev_match:
                continue
                
            # If current match now starts before previous match ends (plus rest/setup time)
            setup_time = 5  # Basic setup time
            if prev_match.end_time:
                # Determine if teams overlap (need rest period or just setup time)
                teams_overlap = (
                    prev_match.team1.name == current_match.team1.name or
                    prev_match.team1.name == current_match.team2.name or
                    prev_match.team2.name == current_match.team1.name or
                    prev_match.team2.name == current_match.team2.name
                )
                
                # Calculate minimum start time
                if teams_overlap:
                    min_start = prev_match.end_time + timedelta(minutes=self.tournament.rest_period)
                else:
                    min_start = prev_match.end_time + timedelta(minutes=setup_time)
                
                # Fix ordering if current match would start before previous match ends
                if current_match.start_time < min_start:
                    print(f"Fixing order: {current_match.id} was starting before {prev_match.id} finished")
                    print(f"Moving {current_match.id} from {current_match.start_time} to {min_start}")
                    current_match.set_time(min_start)
    
    def _adjust_affected_matches(self, schedule: Schedule, disrupted_match: Match, original_time: datetime) -> None:
        """Adjust affected matches after a disruption while maintaining chronological order."""
        # Sort matches by start time to maintain chronological order
        sorted_matches = sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        
        # Find index of disrupted match
        disrupted_index = next((i for i, m in enumerate(sorted_matches) if m.id == disrupted_match.id), None)
        
        if disrupted_index is None:
            return  # Match not found
            
        # Process matches in chronological order
        for i in range(disrupted_index + 1, len(sorted_matches)):
            match = sorted_matches[i]
            
            # Skip fixed-time matches and breaks
            if match.is_fixed_time or match.is_break:
                continue
                
            # Previous match (chronologically)
            prev_match = sorted_matches[i - 1]
            
            # Calculate minimum start time based on previous match end time
            setup_time = 5  # Default minimum setup time between matches
            
            # Check if teams overlap (need rest period)
            teams_overlap = (prev_match.team1.name == match.team1.name or
                          prev_match.team1.name == match.team2.name or
                          prev_match.team2.name == match.team1.name or
                          prev_match.team2.name == match.team2.name)
            
            # Determine minimum start time with appropriate buffer
            if teams_overlap:
                # Apply rest period constraint
                min_start_time = prev_match.end_time + timedelta(minutes=self.tournament.rest_period)
            else:
                # Apply setup time constraint
                min_start_time = prev_match.end_time + timedelta(minutes=setup_time)
            
            # If match needs to be shifted later
            if match.start_time < min_start_time:
                # Update the start and end times
                shift_minutes = (min_start_time - match.start_time).total_seconds() / 60
                
                match.set_time(min_start_time)
                
                # Log the shift for debugging
                print(f"Shifting match {match.id} by {shift_minutes} minutes due to disruption in match {disrupted_match.id}")
                
        # Additional check for fixed-time events
        for match in schedule.matches:
            if match.is_fixed_time and match.id != disrupted_match.id:
                # If any match overlaps with a fixed-time event, adjust that match
                for other_match in [m for m in schedule.matches if not m.is_fixed_time and m.id != match.id]:
                    if (other_match.start_time <= match.start_time < other_match.end_time or
                        other_match.start_time < match.end_time <= other_match.end_time):
                        # Shift the non-fixed match to after the fixed event
                        new_start = match.end_time + timedelta(minutes=setup_time)
                        other_match.set_time(new_start)

    def _handle_early_finish(self, schedule: Schedule, early_match: Match, original_end_time: datetime) -> None:
        """Handle the case where a match finishes earlier than expected."""
        # Find the next match that starts after this match
        all_matches = sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        
        # Find the next match chronologically
        next_match_idx = None
        for i, match in enumerate(all_matches):
            if match.id == early_match.id:
                if i < len(all_matches) - 1:
                    next_match_idx = i + 1
                break
                
        if next_match_idx is None:
            return  # No next match found
            
        next_match = all_matches[next_match_idx]
        
        # If next match is fixed-time (lunch, finals), don't move it
        if next_match.is_fixed_time or next_match.is_break:
            return
            
        # Check if any fixed-time events between early_match and next_match
        has_fixed_event_between = False
        for match in all_matches:
            if (match.is_fixed_time or match.is_break) and \
               early_match.end_time <= match.start_time < next_match.start_time:
                has_fixed_event_between = True
                break
                
        if has_fixed_event_between:
            return  # Can't move next match earlier due to fixed event in between
            
        # Calculate the time gained
        time_gained = (original_end_time - early_match.end_time).total_seconds() / 60
        
        # Calculate setup time needed
        setup_time = 5  # 5 minutes minimum setup time
        
        # If time gained is significant (more than setup time), move next match earlier
        if time_gained > setup_time and not next_match.is_fixed_time:
            # New start time for next match
            new_start_time = early_match.end_time + timedelta(minutes=setup_time)
            
            # Ensure the team has enough rest if it's the same team
            teams_overlap = (next_match.team1.name == early_match.team1.name or 
                           next_match.team1.name == early_match.team2.name or 
                           next_match.team2.name == early_match.team1.name or 
                           next_match.team2.name == early_match.team2.name)
                           
            if teams_overlap:
                rest_time = (next_match.start_time - early_match.end_time).total_seconds() / 60
                if rest_time < self.tournament.rest_period:
                    # Need to respect rest period
                    new_start_time = early_match.end_time + timedelta(minutes=self.tournament.rest_period)
            
            # Update next match time if it's earlier than current start time
            if new_start_time < next_match.start_time:
                next_match.set_time(new_start_time)
                
                # Recursively handle the ripple effect - this match is now earlier
                self._handle_early_finish(schedule, next_match, next_match.start_time + timedelta(minutes=time_gained))

    def _propagate_time_changes(self, schedule: Schedule, changed_match: Match, original_end_time: datetime) -> None:
        """Propagate time changes to all subsequent matches to maintain proper sequence."""
        # Get all matches sorted by start time
        sorted_matches = sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        
        # Find matches that start after the changed match's new end time
        subsequent_matches = []
        found_current = False
        
        for match in sorted_matches:
            if match.id == changed_match.id:
                found_current = True
                continue
                
            if found_current and not match.is_fixed_time:
                subsequent_matches.append(match)
        
        # Process subsequent matches in order
        for next_match in subsequent_matches:
            # Calculate minimum start time with appropriate buffer
            setup_time = 5  # 5 minutes minimum setup time
            rest_period = self.tournament.rest_period
            
            # Check if teams overlap (need rest period)
            teams_overlap = (
                changed_match.team1.name == next_match.team1.name or
                changed_match.team1.name == next_match.team2.name or
                changed_match.team2.name == next_match.team1.name or
                changed_match.team2.name == next_match.team2.name
            )
            
            if teams_overlap:
                buffer = rest_period
            else:
                buffer = setup_time
                
            min_start_time = changed_match.end_time + timedelta(minutes=buffer)
            
            # If next match would start before the minimum start time, adjust it
            if next_match.start_time < min_start_time:
                original_start = next_match.start_time
                next_match.set_time(min_start_time)
                print(f"  → Shifted {next_match.id} from {original_start} to {next_match.start_time} (after {changed_match.id})")
                
                # This match is now changed, so update for the next iteration
                changed_match = next_match
            else:
                # If this match doesn't need adjustment, we're done propagating changes
                break
                
    def _handle_early_finish_improved(self, schedule: Schedule, early_match: Match, original_end_time: datetime) -> None:
        """Improved handling of early finish disruptions to move subsequent matches earlier when possible."""
        # Sort all matches by start time
        all_matches = sorted(schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        
        # Find the index of the early finishing match
        early_match_idx = next((i for i, m in enumerate(all_matches) if m.id == early_match.id), None)
        
        if early_match_idx is None or early_match_idx >= len(all_matches) - 1:
            return  # No subsequent matches to adjust
            
        # Identify the next match after the early finishing one
        next_match = all_matches[early_match_idx + 1]
        
        # Skip if next match is fixed-time
        if next_match.is_fixed_time or next_match.is_break:
            return
            
        # Check if any fixed events would prevent moving the next match earlier
        has_fixed_event_between = any(
            m.is_fixed_time and early_match.end_time <= m.start_time < next_match.start_time
            for m in all_matches
        )
        
        if has_fixed_event_between:
            return  # Can't move next match earlier due to fixed event
            
        # Calculate how much earlier the match can start
        setup_time = 5  # Minimum setup time
        rest_period = self.tournament.rest_period
        
        # Check if teams overlap (need rest period)
        teams_overlap = (
            early_match.team1.name == next_match.team1.name or
            early_match.team1.name == next_match.team2.name or
            early_match.team2.name == next_match.team1.name or
            early_match.team2.name == next_match.team2.name
        )
        
        if teams_overlap:
            buffer = rest_period
        else:
            buffer = setup_time
            
        # Calculate the new start time for the next match
        new_start_time = early_match.end_time + timedelta(minutes=buffer)
        
        # Only move the match earlier if it's actually earlier than currently scheduled
        if new_start_time < next_match.start_time:
            original_start = next_match.start_time
            next_match.set_time(new_start_time)
            print(f"  → Moving {next_match.id} earlier from {original_start} to {next_match.start_time} (after early finish of {early_match.id})")
            
            # Recursively try to move subsequent matches earlier
            self._handle_early_finish_improved(schedule, next_match, original_start + (next_match.end_time - next_match.start_time))
    
    def _validate_schedule_sequence(self, schedule: Schedule, original_match_order: List[str]) -> None:
        """Final validation to ensure no scheduling conflicts remain."""
        # Get current matches by ID
        matches_by_id = {m.id: m for m in schedule.matches}
        
        # Check each match in the original order
        for i, current_id in enumerate(original_match_order):
            current_match = matches_by_id.get(current_id)
            
            if not current_match or current_match.is_fixed_time:
                continue
                
            # Check that this match doesn't start before previous matches end
            for prev_id in original_match_order[:i]:
                prev_match = matches_by_id.get(prev_id)
                
                if not prev_match or prev_match.is_fixed_time:
                    continue
                    
                # Check if teams overlap (need rest period)
                teams_overlap = (
                    prev_match.team1.name == current_match.team1.name or
                    prev_match.team1.name == current_match.team2.name or
                    prev_match.team2.name == current_match.team1.name or
                    prev_match.team2.name == current_match.team2.name
                )
                
                # Calculate minimum buffer
                buffer = self.tournament.rest_period if teams_overlap else 5  # 5 min min setup time
                min_start = prev_match.end_time + timedelta(minutes=buffer)
                
                # Fix any remaining sequence issues
                if current_match.start_time < prev_match.end_time:
                    print(f"VALIDATION: Fixed sequence issue - {current_id} was starting at {current_match.start_time} before {prev_id} ended at {prev_match.end_time}")
                    current_match.set_time(min_start)
                elif teams_overlap and current_match.start_time < min_start:
                    print(f"VALIDATION: Fixed rest period issue - {current_id} needs {buffer} min after {prev_id}")
                    current_match.set_time(min_start)

    def _decode_schedule(self, encoded_schedule: List[int]) -> Schedule:
        """Decode an encoded schedule back to a Schedule object."""
        schedule = Schedule()
        venue_open = datetime.combine(datetime.today().date(), self.tournament.venue_start)
        
        # Sort matches by id to ensure consistent order
        matches = sorted(self.initial_schedule.matches, key=lambda m: m.id)
        
        # Store original schedule ordering by start time for reference
        original_schedule = self.initial_schedule.clone()
        original_matches = sorted(original_schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max)
        original_match_order = [m.id for m in original_matches]
        
        # Get matches with late arrivals to preserve their exact times
        late_arrival_matches = [d.match.id for d in self.disruptions if d.type == "late_arrival"]
        
        # Apply all late arrival disruptions first to track original times
        if late_arrival_matches:
            temp_schedule = self.initial_schedule.clone()
            
            # Apply only late arrival disruptions to get their exact times
            for disruption in [d for d in self.disruptions if d.type == "late_arrival"]:
                match = temp_schedule.find_match(disruption.match.id)
                if match and not match.is_fixed_time and match.start_time:
                    new_start = match.start_time + timedelta(minutes=disruption.extra_minutes)
                    match.set_time(new_start)
            
            # Store the exact late arrival times to preserve them
            late_arrival_times = {match.id: match.start_time for match in temp_schedule.matches 
                                  if match.id in late_arrival_matches}
        else:
            late_arrival_times = {}
        
        for i, match in enumerate(matches):
            # Create a new match with the same properties
            new_match = Match(
                id=match.id,
                team1=match.team1,
                team2=match.team2,
                duration=match.duration,
                game_type=match.game_type,
                round_number=match.round_number,
                is_fixed_time=match.is_fixed_time,
                is_break=match.is_break,
                description=match.description
            )
            
            # Apply disruptions if applicable
            for disruption in self.disruptions:
                if disruption.match.id == new_match.id:
                    if disruption.type == "extended_duration":
                        new_match.duration += disruption.extra_minutes
                    elif disruption.type == "early_finish":
                        new_match.duration -= disruption.extra_minutes
            
            # Set start time - with special handling for different cases
            if new_match.is_fixed_time and match.start_time:
                # Fixed-time events use the original start time
                new_match.set_time(match.start_time)
            elif new_match.id in late_arrival_times:
                # Late arrival matches use their exact shifted time
                new_match.set_time(late_arrival_times[new_match.id])
            else:
                # For regular matches, use the GA-calculated time
                minutes = max(0, int(encoded_schedule[i]))
                start_time = venue_open + timedelta(minutes=minutes)
                new_match.set_time(start_time)
            
            schedule.add_match(new_match)
        
        # Ensure original match ordering is preserved (crucial for late arrivals)
        self._maintain_original_order(schedule, original_match_order)
        
        return schedule
    
    def _evaluate_schedule(self, individual: List[int]) -> Tuple[float,]:
        """Evaluate a schedule's fitness with weighted constraints."""
        schedule = self._decode_schedule(individual)
        
        # Penalty score starts at 0, higher is worse
        penalty = 0
        
        # ---------- HARD CONSTRAINTS ----------
        
        # 1. Check for team and venue conflicts (no overlapping matches for same team or venue)
        team_venue_penalty = self._check_conflicts(schedule)
        penalty += team_venue_penalty * self.weights['conflict']
        
        # 2. Check venue hours (all matches must be within venue operating hours)
        venue_hours_penalty = self._check_venue_hours(schedule)
        penalty += venue_hours_penalty * self.weights['venue_hours']
        
        # 3. Check rest periods (teams must have sufficient rest between matches)
        rest_period_penalty = self._check_rest_periods(schedule)
        penalty += rest_period_penalty * self.weights['rest_period']
        
        # 4. Check round sequencing (later rounds must happen after earlier rounds)
        round_sequence_penalty = self._check_round_sequence(schedule)
        penalty += round_sequence_penalty * self.weights['round_sequence']
        
        # 5. Check fixed-time events (they must not be moved)
        fixed_time_penalty = self._check_fixed_time_events(schedule)
        penalty += fixed_time_penalty * 2000  # Very high penalty for moving fixed events
        
        # ---------- SOFT CONSTRAINTS ----------
        
        # 6. Minimize idle time between matches
        idle_time_penalty = self._calculate_idle_time(schedule)
        penalty += idle_time_penalty * self.weights['idle_time']
        
        # 7. Minimize schedule changes from original (stability)
        schedule_change_penalty = self._calculate_schedule_changes(schedule)
        penalty += schedule_change_penalty * self.weights['schedule_change']
        
        # 8. Schedule important matches during peak hours
        peak_time_penalty = self._check_peak_time_scheduling(schedule)
        penalty += peak_time_penalty * self.weights['peak_time']
        
        return (penalty,)
    
    def _check_conflicts(self, schedule: Schedule) -> float:
        """Check for team and venue conflicts."""
        conflicts = 0
        for i, match1 in enumerate(schedule.matches):
            for match2 in schedule.matches[i+1:]:
                if schedule.conflicts_with(match1, match2):
                    conflicts += 1
        return conflicts
    
    def _check_venue_hours(self, schedule: Schedule) -> float:
        """Check if all matches are within venue hours."""
        violations = 0
        for match in schedule.matches:
            if (match.start_time.time() < self.tournament.venue_start or 
                match.end_time.time() > self.tournament.venue_end):
                violations += 1
        return violations
    
    def _check_rest_periods(self, schedule: Schedule) -> float:
        """Check if all teams have sufficient rest between matches."""
        violations = 0
        team_matches = {}
        
        # Group matches by team
        for match in schedule.matches:
            for team in [match.team1, match.team2]:
                if team.name not in team_matches:
                    team_matches[team.name] = []
                team_matches[team.name].append(match)
        
        # Check rest periods for each team
        for team, matches in team_matches.items():
            sorted_matches = sorted(matches, key=lambda m: m.start_time)
            for i in range(1, len(sorted_matches)):
                rest_time = (sorted_matches[i].start_time - sorted_matches[i-1].end_time).total_seconds() / 60
                required_rest = self.tournament.rest_period
                if rest_time < required_rest:
                    # Calculate proportional violation
                    rest_violation = required_rest - rest_time
                    violations += rest_violation / required_rest
        
        return violations
    
    def _check_round_sequence(self, schedule: Schedule) -> float:
        """Check if matches are scheduled in correct round sequence."""
        violations = 0
        # Group matches by round
        round_matches = {}
        for match in schedule.matches:
            if match.round_number not in round_matches:
                round_matches[match.round_number] = []
            round_matches[match.round_number].append(match)
        
        # Check if higher rounds start after lower rounds end
        for round_num in sorted(round_matches.keys()):
            for higher_round in range(round_num + 1, max(round_matches.keys()) + 1):
                for match_lower in round_matches[round_num]:
                    for match_higher in round_matches[higher_round]:
                        if match_higher.start_time < match_lower.end_time:
                            violations += 1
        
        return violations
    
    def _calculate_idle_time(self, schedule: Schedule) -> float:
        """Calculate total idle time between matches."""
        idle_time = 0
        sorted_matches = sorted(schedule.matches, key=lambda m: m.start_time)
        
        for i in range(1, len(sorted_matches)):
            gap = (sorted_matches[i].start_time - sorted_matches[i-1].end_time).total_seconds() / 60
            if gap > 10:  # More than 10 minutes is considered idle time
                idle_time += gap
        
        return idle_time
    
    def _calculate_schedule_changes(self, schedule: Schedule) -> float:
        """Calculate how much the schedule changed from the original."""
        total_shift = 0
        for match in schedule.matches:
            orig_match = self.initial_schedule.find_match(match.id)
            if orig_match and orig_match.start_time and match.start_time:
                time_diff = abs((match.start_time - orig_match.start_time).total_seconds() / 60)
                total_shift += time_diff
        
        return total_shift
    
    def _check_peak_time_scheduling(self, schedule: Schedule) -> float:
        """Check if important matches (finals, semifinals) are during peak hours."""
        peak_time_score = 0
        
        # Define important matches (higher round number = more important)
        important_matches = [m for m in schedule.matches if m.round_number > 1]
        
        for match in important_matches:
            match_hour = match.start_time.hour
            in_peak_time = False
            
            # Check if match is in peak hours
            for peak_start, peak_end in self.peak_hours:
                if peak_start <= match_hour < peak_end:
                    in_peak_time = True
                    break
            
            if not in_peak_time:
                # Penalty for important matches not in peak time
                # Weight by round number - finals (higher rounds) are more important
                peak_time_score += match.round_number
        
        return peak_time_score
    
    def _check_fixed_time_events(self, schedule: Schedule) -> float:
        """Check if fixed-time events are scheduled at their original times."""
        violations = 0
        
        for match in schedule.matches:
            if match.is_fixed_time or match.is_break:
                orig_match = self.initial_schedule.find_match(match.id)
                if orig_match and orig_match.start_time and match.start_time:
                    time_diff = abs((match.start_time - orig_match.start_time).total_seconds())
                    if time_diff > 0:
                        violations += 1
        
        return violations
    
    def _crossover(self, ind1: List[int], ind2: List[int]) -> Tuple[List[int], List[int]]:
        """Perform crossover between two schedules using two-point crossover."""
        return tools.cxTwoPoint(ind1, ind2)
    
    def _mutate(self, individual: List[int]) -> Tuple[List[int],]:
        """Mutate a schedule with adaptive mutation based on disruptions."""
        # Get tournament rest period for use in mutations
        rest_period = self.tournament.rest_period
        
        # Use different mutation strategies based on the type of disruptions
        has_extended_duration = any(d.type == "extended_duration" for d in self.disruptions)
        has_late_arrival = any(d.type == "late_arrival" for d in self.disruptions)
        has_early_finish = any(d.type == "early_finish" for d in self.disruptions)
        
        # Get positions to avoid mutating (fixed-time events and late arrivals)
        protected_positions = []
        matches = sorted(self.initial_schedule.matches, key=lambda m: m.id)
        
        # Fixed-time matches are always protected
        for i, match in enumerate(matches):
            if match.is_fixed_time or match.is_break:
                protected_positions.append(i)
        
        # Late arrival matches are also protected
        late_arrival_matches = [d.match.id for d in self.disruptions if d.type == "late_arrival"]
        for i, match in enumerate(matches):
            if match.id in late_arrival_matches:
                protected_positions.append(i)
        
        # Remove duplicates
        protected_positions = list(set(protected_positions))
        
        # For all mutations, respect protected positions
        for i in range(len(individual)):
            # Skip protected positions
            if i in protected_positions:
                continue
                
            # Regular mutation for all other matches
            if random.random() < 0.2:  # 20% chance of mutation per gene
                if has_extended_duration:
                    # With extended durations, we need larger shifts forward
                    shift_unit = max(10, rest_period / 2)
                    shift = int(random.randint(0, 4) * shift_unit)  # Only shift forward
                    individual[i] = max(0, individual[i] + shift)
                elif has_early_finish:
                    # With early finishes, we can shift matches earlier
                    shift_unit = max(5, rest_period / 4)
                    shift = int(random.randint(-3, 1) * shift_unit)  # Mostly shift backward
                    individual[i] = max(0, individual[i] + shift)
                else:
                    # Normal case - mix of forward and backward shifts
                    shift_unit = max(5, rest_period / 4)
                    shift = int(random.randint(-2, 2) * shift_unit)
                    individual[i] = max(0, individual[i] + shift)
        
        # Only allow swaps of non-protected matches
        if random.random() < 0.1 and len(individual) > 1:
            # Find eligible positions to swap (non-protected matches)
            eligible_positions = [i for i in range(len(individual)) if i not in protected_positions]
            
            if len(eligible_positions) >= 2:
                # Select two adjacent eligible positions
                pos1 = random.choice(eligible_positions)
                adjacent = [p for p in eligible_positions if abs(p - pos1) == 1]
                
                if adjacent:
                    pos2 = random.choice(adjacent)
                    individual[pos1], individual[pos2] = individual[pos2], individual[pos1]
        
        return (individual,)
    
    def optimize(self) -> Schedule:
        """Run the genetic algorithm to optimize the schedule."""
        # Create initial population
        pop_size = 100  # Increased population size for better exploration
        pop = self.toolbox.population(n=pop_size)
        
        # Setup Hall of Fame to preserve the best individual
        hof = tools.HallOfFame(1)
        
        # Set up statistics to track
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("min", np.min)
        stats.register("avg", np.mean)
        stats.register("max", np.max)
        
        # Parameters for the GA
        crossover_prob = 0.8    # Higher crossover probability
        mutation_prob = 0.3     # Higher mutation rate for better exploration
        generations = 100       # More generations for better convergence
        
        # Define elitism - preserve the top 10% individuals
        elite_size = int(pop_size * 0.1)
        
        # Run the algorithm with elitism using eaMuPlusLambda
        pop, logbook = algorithms.eaMuPlusLambda(
            pop, 
            self.toolbox,
            mu=pop_size,          # Number of individuals to select
            lambda_=pop_size,     # Number of children to produce
            cxpb=crossover_prob,  # Crossover probability
            mutpb=mutation_prob,  # Mutation probability
            ngen=generations,     # Number of generations
            stats=stats,
            halloffame=hof,
            verbose=True
        )
        
        # Get the best individual from the Hall of Fame
        best = hof[0]
        
        # Decode and return the best schedule
        return self._decode_schedule(best)
