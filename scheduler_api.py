from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime, time, timedelta
import logging
import re

from models import Match, Team, Schedule, Disruption
from tournament import Tournament
from scheduler import GraphColoringScheduler, GeneticAlgorithmOptimizer

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.FileHandler("scheduler_api.log"),
                             logging.StreamHandler()])
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Helper functions for conversion between Python objects and JSON
def parse_datetime(dt_str):
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        return datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S.%fZ")

def parse_time(time_str):
    if not time_str:
        return None
    # Parse HH:MM format
    hour, minute = map(int, time_str.split(':'))
    return time(hour, minute)

@app.route('/api/python/schedule/generate', methods=['POST'])
def generate_schedule():
    try:
        data = request.json
        logger.info(f"Received generate request with data: {json.dumps(data)}")
        
        # Parse tournament data
        tournament_data = data['tournament']
        venue_start = parse_time(tournament_data['venueHours'][0])
        venue_end = parse_time(tournament_data['venueHours'][1])
        
        # Explicitly log the rest period to verify it's being received
        rest_period = tournament_data.get('restPeriod', 15)
        logger.info(f"Using rest period: {rest_period} minutes")
        
        tournament = Tournament(
            id=tournament_data.get('id', ''),
            name=tournament_data.get('name', ''),
            venue_start=venue_start,
            venue_end=venue_end,
            rest_period=rest_period
        )
        
        # Parse teams
        teams = []
        for team_data in data['teams']:
            team = Team(
                id=team_data.get('id', len(teams) + 1),
                name=team_data.get('name', ''),
                game_type=team_data.get('gameType', '')
            )
            teams.append(team)
        
        # Add teams to tournament
        tournament.add_teams(teams)
        
        # Check for lunch break or fixed-time events in the request
        fixed_events = data.get('fixedEvents', [])
        for event in fixed_events:
            # Parse the fixed event
            event_start = parse_datetime(event.get('startTime'))
            event_duration = event.get('duration', 60)  # Default to 60 minutes
            is_break = event.get('isBreak', False)
            description = event.get('description', 'Fixed Event')
            
            if event_start:
                # Create a placeholder team for the break
                placeholder_team = Team(id=0, name="Placeholder", game_type="")
                
                # Create a match object for the break/fixed event
                fixed_match = Match(
                    id=f"E{len(tournament.matches) + 1}",  # E for Event
                    team1=placeholder_team,
                    team2=placeholder_team,
                    duration=event_duration,
                    game_type=GameType.MOBILE_LEGENDS,  # Doesn't matter for breaks
                    round_number=0,  # Lowest priority
                    is_fixed_time=True,
                    is_break=is_break,
                    description=description
                )
                
                fixed_match.set_time(event_start)
                tournament.add_fixed_event(fixed_match)
                logger.info(f"Added fixed event: {description} at {event_start}")
        
        # Also check for matches marked as finals
        finals_ids = data.get('finalsMatches', [])
        if finals_ids:
            logger.info(f"Marking matches {finals_ids} as fixed-time finals")
            tournament.mark_finals(finals_ids)
        
        # Generate schedule using GraphColoringScheduler
        scheduler = GraphColoringScheduler(tournament)
        schedule = scheduler.generate_schedule()
        
        # Convert schedule to JSON format
        matches_json = []
        for match in schedule.matches:
            matches_json.append({
                'id': match.id,
                'team1': {
                    'id': match.team1.id,
                    'name': match.team1.name,
                    'gameType': match.team1.game_type
                },
                'team2': {
                    'id': match.team2.id,
                    'name': match.team2.name,
                    'gameType': match.team2.game_type
                },
                'duration': match.duration,
                'gameType': match.game_type,
                'roundNumber': match.round_number,
                'startTime': match.start_time.isoformat() if match.start_time else None,
                'endTime': match.end_time.isoformat() if match.end_time else None
            })
        
        response = {'matches': matches_json}
        logger.info(f"Sending response: {json.dumps(response)}")
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error generating schedule: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/python/schedule/adjust', methods=['POST'])
def adjust_schedule():
    try:
        data = request.json
        logger.info(f"Received adjust request with data: {json.dumps(data)}")
        
        # Parse tournament data
        tournament_data = data['tournament']
        venue_start = parse_time(tournament_data['venueHours'][0])
        venue_end = parse_time(tournament_data['venueHours'][1])
        
        # Explicitly log the rest period to verify it's being received
        rest_period = tournament_data.get('restPeriod', 15)
        logger.info(f"Using rest period: {rest_period} minutes")
        
        tournament = Tournament(
            id=tournament_data.get('id', ''),
            name=tournament_data.get('name', ''),
            venue_start=venue_start,
            venue_end=venue_end,
            rest_period=rest_period
        )
        
        # Parse initial schedule
        schedule = Schedule()
        
        # Store original match times (for verification)
        original_start_times = {}
        
        # Create matches from request data
        for match_data in data['schedule']['matches']:
            team1 = Team(
                id=match_data['team1'].get('id', 0),
                name=match_data['team1'].get('name', ''),
                game_type=match_data['team1'].get('gameType', '')
            )
            
            team2 = Team(
                id=match_data['team2'].get('id', 0),
                name=match_data['team2'].get('name', ''),
                game_type=match_data['team2'].get('gameType', '')
            )
            
            match_id = match_data.get('id', '')
            if 'startTime' in match_data and match_data['startTime']:
                original_start_times[match_id] = match_data['startTime']
                logger.info(f"Original time for match {match_id}: {match_data['startTime']}")
            
            match = Match(
                id=match_id,
                team1=team1,
                team2=team2,
                duration=match_data.get('duration', 60),
                game_type=match_data.get('gameType', ''),
                round_number=match_data.get('roundNumber', 1),
                is_fixed_time=match_data.get('isFixedTime', False),
                is_break=match_data.get('isBreak', False),
                description=match_data.get('description', '')
            )
            
            # Set match times
            if 'startTime' in match_data and match_data['startTime']:
                start_time = parse_datetime(match_data['startTime'])
                match.set_time(start_time)
            
            schedule.add_match(match)
        
        # Parse disruptions
        disruptions_list = []
        for disruption_data in data.get('disruptions', []):
            # Find the match that is disrupted
            match_id = disruption_data.get('matchId', '')
            match = schedule.find_match(match_id)
            
            if match:
                disruption = Disruption(
                    match=match,
                    type=disruption_data.get('type', 'extended_duration'),
                    extra_minutes=disruption_data.get('extraMinutes', 0)
                )
                disruptions_list.append(disruption)
        
        # Add teams to tournament
        all_teams = set()
        for match in schedule.matches:
            all_teams.add(match.team1)
            all_teams.add(match.team2)
        tournament.add_teams(list(all_teams))
        
        # Check if all disruptions are late arrivals
        all_late_arrivals = all(d.type == "late_arrival" for d in disruptions_list)
        
        if all_late_arrivals:
            # For late arrivals, use direct adjustment without GA optimization
            logger.info("All disruptions are late arrivals - using direct adjustment")
            adjusted_schedule = handle_late_arrivals(schedule, disruptions_list, tournament.rest_period)
        else:
            # For other disruptions, use GA optimization
            logger.info("Using GA optimizer for complex disruptions")
            optimizer = GeneticAlgorithmOptimizer(tournament, schedule, disruptions_list)
            adjusted_schedule = optimizer.optimize()
        
        # Verify no match starts earlier than its original time
        for match in adjusted_schedule.matches:
            if match.id in original_start_times and match.start_time:
                original_time_str = original_start_times[match.id]
                original_time = parse_datetime(original_time_str)
                
                # Skip checks for matches with late arrivals
                is_late_arrival = any(d.match.id == match.id and d.type == "late_arrival" for d in disruptions_list)
                
                if not is_late_arrival and match.start_time < original_time:
                    logger.error(f"Match {match.id} scheduled earlier than original time: {match.start_time.isoformat()} < {original_time.isoformat()}")
                    # Fix the issue - reset to original time
                    match.set_time(original_time)
        
        # Convert adjusted schedule to JSON
        matches_json = []
        for match in adjusted_schedule.matches:
            matches_json.append({
                'id': match.id,
                'team1': {
                    'id': match.team1.id,
                    'name': match.team1.name,
                    'gameType': match.team1.game_type
                },
                'team2': {
                    'id': match.team2.id,
                    'name': match.team2.name,
                    'gameType': match.team2.game_type
                },
                'duration': match.duration,
                'gameType': match.game_type,
                'roundNumber': match.round_number,
                'startTime': match.start_time.isoformat() if match.start_time else None,
                'endTime': match.end_time.isoformat() if match.end_time else None,
                'isFixedTime': match.is_fixed_time,
                'isBreak': match.is_break,
                'description': match.description
            })
        
        response = {'matches': matches_json}
        logger.info(f"Sending response: {json.dumps(response)}")
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error adjusting schedule: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def handle_late_arrivals(schedule, disruptions, rest_period):
    """
    Direct handler for late arrival disruptions without using GA.
    Simply shifts the affected match by the exact number of minutes.
    
    This is a complete rewrite with enhanced handling for multiple teams and game types.
    """
    # Create a deep copy to avoid modifying the original schedule
    adjusted_schedule = schedule.clone()
    
    logger.info("INTERDEPENDENT LATE ARRIVAL HANDLER ACTIVATED")
    
    # Log all matches before adjustments
    logger.info("ORIGINAL SCHEDULE BEFORE LATE ARRIVAL ADJUSTMENTS:")
    for match in sorted(adjusted_schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max):
        logger.info(f"  Match {match.id}: {match.team1.name} vs {match.team2.name} at {match.start_time.isoformat() if match.start_time else 'None'}")
    
    # Store original schedule data for reference
    original_matches = []
    for match in adjusted_schedule.matches:
        if match.start_time:
            original_matches.append({
                'id': match.id,
                'game_type': match.game_type,
                'team1': match.team1.name,
                'team2': match.team2.name,
                'start_time': match.start_time,
                'end_time': match.end_time,
                'duration': match.duration
            })
    
    # Track which matches have late arrivals
    late_arrival_matches = []
    
    # STEP 1: Apply late arrivals ONLY to the specific match IDs mentioned
    for disruption in disruptions:
        if disruption.match and disruption.match.id:
            match = adjusted_schedule.find_match(disruption.match.id)
            
            if not match:
                logger.error(f"Match ID {disruption.match.id} not found for late arrival!")
                continue
                
            if match.is_fixed_time:
                logger.info(f"Skipping fixed-time match {match.id}")
                continue
                
            if not match.start_time:
                logger.error(f"Match {match.id} has no start time set!")
                continue
            
            # Add to late arrival tracking
            late_arrival_matches.append(match.id)
            
            # Record original time for logging
            original_start = match.start_time
            
            # Apply the exact delay
            logger.info(f"PROCESSING LATE ARRIVAL: Match {match.id} - {match.team1.name} vs {match.team2.name}")
            logger.info(f"  Original time: {original_start.isoformat()}")
            logger.info(f"  Delay minutes: {disruption.extra_minutes}")
            
            # Shift the start time
            new_start = original_start + timedelta(minutes=disruption.extra_minutes)
            match.set_time(new_start)
            
            logger.info(f"  ⏰ DELAYED: Match {match.id} from {original_start.isoformat()} to {match.start_time.isoformat()}")
    
    # STEP 2: Build team schedule map to track all team participations across all game types
    team_schedule = {}
    
    for match in adjusted_schedule.matches:
        if not match.start_time or not match.end_time:
            continue
            
        # Add both teams from this match
        for team in [match.team1.name, match.team2.name]:
            if team not in team_schedule:
                team_schedule[team] = []
                
            team_schedule[team].append({
                'match_id': match.id,
                'game_type': match.game_type,
                'start_time': match.start_time,
                'end_time': match.end_time,
                'opponent': match.team2.name if team == match.team1.name else match.team1.name,
                'has_late_arrival': match.id in late_arrival_matches
            })
    
    # Sort each team's matches by start time
    for team, matches in team_schedule.items():
        matches.sort(key=lambda m: m.get('start_time', datetime.max))
        logger.info(f"{team}'s schedule: " + ", ".join([
            f"{m['match_id']} ({m['game_type']}) vs {m['opponent']} at {m['start_time'].isoformat()}" +
            (" [DELAYED]" if m['has_late_arrival'] else "")
            for m in matches
        ]))
    
    # STEP 3: Process matches chronologically to ensure no team plays in overlapping matches
    all_matches = sorted(adjusted_schedule.matches, 
                         key=lambda m: m.start_time if m.start_time else datetime.max)
    
    # First pass - handle team conflicts across all game types
    for i, current_match in enumerate(all_matches):
        if not current_match.start_time or current_match.is_fixed_time:
            logger.info(f"  Skipping match {current_match.id} (no start time or fixed time)")
            continue
            
        team1 = current_match.team1.name
        team2 = current_match.team2.name
        
        # Check if either team has conflicts with this match time
        team1_conflicts = find_team_conflicts(team1, current_match.id, 
                                             current_match.start_time, current_match.end_time, 
                                             team_schedule)
        team2_conflicts = find_team_conflicts(team2, current_match.id, 
                                             current_match.start_time, current_match.end_time,
                                             team_schedule)
        
        all_conflicts = team1_conflicts + team2_conflicts
        
        if all_conflicts:
            logger.info(f"Found team conflicts for match {current_match.id}: {[c['match_id'] for c in all_conflicts]}")
            
            # If this match has a late arrival, it takes priority
            if current_match.id in late_arrival_matches:
                logger.info(f"Match {current_match.id} has late arrival - prioritizing its time")
                
                # For each conflicting match, try to adjust its time
                for conflict in all_conflicts:
                    conflict_match = adjusted_schedule.find_match(conflict['match_id'])
                    
                    if conflict_match and not conflict_match.is_fixed_time and conflict_match.id not in late_arrival_matches:
                        # Move conflicting match to start after current match (plus rest period)
                        new_start_time = current_match.end_time + timedelta(minutes=rest_period)
                        
                        logger.info(f"Moving conflict match {conflict_match.id} to {new_start_time.isoformat()}")
                        conflict_match.set_time(new_start_time)
                        
                        # Update team schedule
                        update_team_schedule(team_schedule, conflict_match)
            else:
                # This match doesn't have late arrival - check if any conflicting matches do
                conflicts_with_late_arrivals = [c for c in all_conflicts if c['has_late_arrival']]
                
                if conflicts_with_late_arrivals:
                    # A conflicting match has late arrival, so we move the current match
                    logger.info(f"Conflict match has late arrival - moving current match {current_match.id}")
                    
                    # Find the latest end time among conflicting matches with late arrivals
                    latest_end_time = datetime.min
                    for conflict in conflicts_with_late_arrivals:
                        conflict_match = adjusted_schedule.find_match(conflict['match_id'])
                        if conflict_match and conflict_match.end_time > latest_end_time:
                            latest_end_time = conflict_match.end_time
                    
                    # Move current match to start after the latest conflicting match
                    new_start_time = latest_end_time + timedelta(minutes=rest_period)
                    
                    logger.info(f"Moving match {current_match.id} to {new_start_time.isoformat()} (after late arrival conflict)")
                    current_match.set_time(new_start_time)
                    
                    # Update team schedule
                    update_team_schedule(team_schedule, current_match)
                else:
                    # No late arrivals involved, find the earliest we can schedule this match
                    earliest_possible_time = datetime.min
                    for conflict in all_conflicts:
                        conflict_match = adjusted_schedule.find_match(conflict['match_id'])
                        if conflict_match and conflict_match.end_time > earliest_possible_time:
                            earliest_possible_time = conflict_match.end_time
                    
                    # Add rest period
                    new_start_time = earliest_possible_time + timedelta(minutes=rest_period)
                    
                    # Don't schedule earlier than original time
                    original_data = next((m for m in original_matches if m['id'] == current_match.id), None)
                    if original_data and new_start_time < original_data['start_time']:
                        new_start_time = original_data['start_time']
                    
                    logger.info(f"Moving match {current_match.id} to {new_start_time.isoformat()} (resolving team conflict)")
                    current_match.set_time(new_start_time)
                    
                    # Update team schedule
                    update_team_schedule(team_schedule, current_match)
    
    # STEP 4: Group by game type to handle venue constraints (only one match per game type at a time)
    matches_by_game_type = {}
    
    for match in adjusted_schedule.matches:
        game_type = match.game_type or "unknown"
        
        if game_type not in matches_by_game_type:
            matches_by_game_type[game_type] = []
            
        matches_by_game_type[game_type].append(match)
    
    # Process each game type to handle venue constraints
    for game_type, matches in matches_by_game_type.items():
        logger.info(f"Checking venue constraints for {game_type} matches...")
        
        # Sort by start time
        matches.sort(key=lambda m: m.start_time if m.start_time else datetime.max)
        
        # Ensure no overlapping matches within each game type (venue constraint)
        for i in range(1, len(matches)):
            current_match = matches[i]
            prev_match = matches[i-1]
            
            # Skip if either match doesn't have proper times
            if not current_match.start_time or not prev_match.end_time:
                continue
                
            # Skip fixed time matches
            if current_match.is_fixed_time:
                logger.info(f"  Skipping fixed-time match: {current_match.id}")
                continue
            
            # Calculate minimum start time (plus setup time)
            setup_time = 5  # minutes
            min_start = prev_match.end_time + timedelta(minutes=setup_time)
            
            # If current match would start before previous one ends (plus setup)
            if current_match.start_time < min_start:
                # Only adjust if not a match with late arrival
                if current_match.id not in late_arrival_matches:
                    logger.info(f"  Venue conflict: Match {current_match.id} would start at {current_match.start_time.isoformat()} before {prev_match.id} finishes at {prev_match.end_time.isoformat()}")
                    
                    # Save original time for logging
                    original_start = current_match.start_time
                    
                    # Move to minimum start time
                    current_match.set_time(min_start)
                    
                    logger.info(f"  MOVED: Match {current_match.id} from {original_start.isoformat()} to {current_match.start_time.isoformat()} (venue constraint)")
                    
                    # Update team schedule
                    update_team_schedule(team_schedule, current_match)
                else:
                    # This match has a late arrival but would overlap with previous match
                    logger.warning(f"  ⚠️ Venue conflict with late arrival: Match {current_match.id} at {current_match.start_time.isoformat()} conflicts with {prev_match.id} ending at {prev_match.end_time.isoformat()}")
                    
                    # Check if previous match has late arrival too
                    if prev_match.id in late_arrival_matches:
                        logger.warning(f"  Both matches have late arrivals - complex conflict!")
                        # In this complex case, we might need to adjust according to tournament rules
                    else:
                        # See if we can adjust previous match to end earlier
                        needed_adjustment = int((min_start - current_match.start_time).total_seconds() / 60)  # minutes
                        
                        if needed_adjustment > 0 and prev_match.duration > 20:
                            # Limit how much we can shorten a match
                            new_duration = max(20, prev_match.duration - needed_adjustment)
                            
                            if new_duration < prev_match.duration:
                                logger.info(f"  Adjusting previous match {prev_match.id} duration from {prev_match.duration} to {new_duration} min")
                                
                                # Update duration and end time
                                prev_match.duration = new_duration
                                prev_match.end_time = prev_match.start_time + timedelta(minutes=new_duration)
                                
                                # Update team schedule
                                update_team_schedule(team_schedule, prev_match)
    
    # STEP 5: Verify no matches start earlier than original time (unless they had late arrival)
    issues = []
    for match in adjusted_schedule.matches:
        if match.id not in late_arrival_matches and match.start_time:
            # Find original data for this match
            original_data = next((m for m in original_matches if m['id'] == match.id), None)
            
            if original_data and match.start_time < original_data['start_time']:
                error_msg = f"ERROR: Match {match.id} scheduled earlier than original time: {match.start_time.isoformat()} < {original_data['start_time'].isoformat()}"
                logger.error(error_msg)
                issues.append(error_msg)
                
                # Fix the issue - reset to original time
                match.set_time(original_data['start_time'])
                logger.info(f"Fixed: Reset {match.id} to original time {match.start_time.isoformat()}")
                
                # Update team schedule
                update_team_schedule(team_schedule, match)
    
    if issues:
        logger.warning(f"Found and fixed {len(issues)} scheduling issues")
    
    # Log final schedule
    logger.info("FINAL ADJUSTED SCHEDULE:")
    for match in sorted(adjusted_schedule.matches, key=lambda m: m.start_time if m.start_time else datetime.max):
        logger.info(f"  Match {match.id}: {match.team1.name} vs {match.team2.name} at {match.start_time.isoformat() if match.start_time else 'None'}")
    
    return adjusted_schedule
    
def find_team_conflicts(team_name, current_match_id, start_time, end_time, team_schedule):
    """Find scheduling conflicts for a specific team."""
    if team_name not in team_schedule:
        return []
        
    conflicts = []
    for scheduled_match in team_schedule[team_name]:
        # Skip the current match
        if scheduled_match['match_id'] == current_match_id:
            continue
            
        # Check for time overlap
        if ((scheduled_match['start_time'] <= start_time and scheduled_match['end_time'] > start_time) or
            (scheduled_match['start_time'] < end_time and scheduled_match['end_time'] >= end_time) or
            (scheduled_match['start_time'] >= start_time and scheduled_match['end_time'] <= end_time)):
            conflicts.append(scheduled_match)
            
    return conflicts
    
def update_team_schedule(team_schedule, match):
    """Update team schedule after moving a match."""
    # Update for team1
    if match.team1 and match.team1.name in team_schedule:
        for scheduled_match in team_schedule[match.team1.name]:
            if scheduled_match['match_id'] == match.id:
                scheduled_match['start_time'] = match.start_time
                scheduled_match['end_time'] = match.end_time
                break
                
    # Update for team2
    if match.team2 and match.team2.name in team_schedule:
        for scheduled_match in team_schedule[match.team2.name]:
            if scheduled_match['match_id'] == match.id:
                scheduled_match['start_time'] = match.start_time
                scheduled_match['end_time'] = match.end_time
                break
                
    # Re-sort the schedules
    for team in [match.team1.name, match.team2.name]:
        if team in team_schedule:
            team_schedule[team].sort(key=lambda m: m['start_time'])

def maintain_match_order_by_game_type(schedule, original_order, game_types, rest_period):
    """
    Maintain match order separately for each game type to prevent
    cross-game interactions when adjusting schedules.
    """
    logger.info("Maintaining match order by game type")
    
    # Group matches by game type
    match_groups = {}
    for match_id in original_order:
        game_type = game_types.get(match_id)
        if not game_type:
            continue
            
        if game_type not in match_groups:
            match_groups[game_type] = []
            
        match_groups[game_type].append(match_id)
    
    logger.info(f"Match groups by game type: {match_groups}")
    
    # Process each game type separately
    for game_type, match_ids in match_groups.items():
        logger.info(f"Maintaining order for {game_type} matches: {match_ids}")
        maintain_match_order(schedule, match_ids, rest_period)

def maintain_match_order(schedule, original_order, rest_period):
    """
    Ensure matches maintain their original relative ordering after disruptions.
    This is critical for late arrivals and other disruptions to not reorder matches.
    """
    logger.info(f"Maintaining match order based on original sequence: {original_order}")
    
    # Get current matches by ID
    current_matches = {m.id: m for m in schedule.matches}
    
    # Go through matches in original order
    for i in range(len(original_order)):
        current_id = original_order[i]
        current_match = current_matches.get(current_id)
        
        if not current_match or current_match.is_fixed_time:
            logger.info(f"  Skipping match {current_id} (fixed time or missing)")
            continue  # Skip fixed events or missing matches
        
        # Find the previous match in the original order
        prev_match = None
        for j in range(i-1, -1, -1):
            prev_id = original_order[j]
            if prev_id in current_matches and not current_matches[prev_id].is_fixed_time:
                prev_match = current_matches[prev_id]
                logger.info(f"  Found previous match for {current_id}: {prev_id}")
                break
        
        # If no previous match, continue
        if not prev_match:
            logger.info(f"  No previous match found for {current_id}")
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
                min_start = prev_match.end_time + timedelta(minutes=rest_period)
                logger.info(f"  Teams overlap for {current_id} and {prev_match.id}, using rest period: {rest_period} minutes")
            else:
                min_start = prev_match.end_time + timedelta(minutes=setup_time)
                logger.info(f"  No team overlap for {current_id} and {prev_match.id}, using setup time: {setup_time} minutes")
            
            # Fix ordering if current match would start before previous match ends
            if current_match.start_time < min_start:
                logger.info(f"  FIXING ORDER: Match {current_id} was starting at {current_match.start_time.isoformat()} before {prev_match.id} finished at {prev_match.end_time.isoformat()}")
                
                # Save original time for logging
                original_start = current_match.start_time
                
                # Update the start time
                current_match.set_time(min_start)
                
                logger.info(f"  MOVED: Match {current_id} from {original_start.isoformat()} to {current_match.start_time.isoformat()}")
            else:
                logger.info(f"  Match {current_id} already starts after {prev_match.id} finishes (no adjustment needed)")
                logger.info(f"    {current_id} at {current_match.start_time.isoformat()} >= {prev_match.id} ends at {prev_match.end_time.isoformat()} + buffer")

def handle_early_finish(schedule, early_match, rest_period):
    """
    When a match finishes early, try to move the next match's start time earlier
    to optimize the schedule.
    """
    logger.info(f"Handling early finish for match {early_match.id}")
    
    # Find the next match chronologically within the same game type
    same_game_matches = [m for m in schedule.matches 
                        if m.game_type == early_match.game_type and m.id != early_match.id]
    
    # Sort by start time
    same_game_matches.sort(key=lambda m: m.start_time if m.start_time else datetime.max)
    
    # Find the next match after the early finishing one
    next_match = None
    for match in same_game_matches:
        if match.start_time and match.start_time > early_match.start_time:
            next_match = match
            break
    
    if not next_match:
        logger.info(f"No next match found after {early_match.id} to move earlier")
        return
    
    # Skip if next match is fixed-time
    if next_match.is_fixed_time:
        logger.info(f"Next match {next_match.id} is fixed-time, cannot move earlier")
        return
    
    # Check if there's any fixed event between the early match and next match
    fixed_events_between = any(
        m.is_fixed_time and early_match.end_time <= m.start_time < next_match.start_time
        for m in schedule.matches if m.start_time
    )
    
    if fixed_events_between:
        logger.info(f"Fixed events exist between {early_match.id} and {next_match.id}, cannot move next match earlier")
        return
    
    # Calculate new start time (add rest period to early match end time)
    new_start_time = early_match.end_time + timedelta(minutes=rest_period)
    
    # Only move earlier if it's actually earlier
    if new_start_time < next_match.start_time:
        logger.info(f"Moving match {next_match.id} earlier from {next_match.start_time.isoformat()} to {new_start_time.isoformat()}")
        next_match.set_time(new_start_time)
    else:
        logger.info(f"No need to move match {next_match.id} earlier")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 