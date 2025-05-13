const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const axios = require("axios")  // Add axios for HTTP requests

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:5000"

// Middleware
app.use(bodyParser.json())

// Serve static files from the root public directory instead of backend/api/public
app.use(express.static(path.join(__dirname, "../../public")))

// Serve scheduler.html as default for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'scheduler.html'))
})

// Add direct route for /scheduler.html to handle direct access
app.get('/scheduler.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'scheduler.html'))
})

// Tournament data store (in-memory for demo)
const tournaments = []
const teams = []
const schedules = {}
const disruptions = {}

// API Routes

// Generate a schedule
app.post("/api/schedule/generate", async (req, res) => {
  try {
    const { tournament, teams: teamsData, fixedEvents = [], finalsMatches = [] } = req.body

    if (!tournament || !teamsData) {
      return res.status(400).json({ error: "Tournament and teams data required" })
    }

    // Store tournament and teams
    const tournamentId = Date.now().toString()
    tournament.id = tournamentId
    tournaments.push(tournament)

    // Store teams with tournament ID
    const teamsWithTournament = teamsData.map((team) => ({
      ...team,
      tournamentId,
    }))
    teams.push(...teamsWithTournament)

    // Call Python API for schedule generation
    try {
      console.log("Calling Python API for schedule generation...")
      const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/python/schedule/generate`, {
        tournament,
        teams: teamsWithTournament,
        fixedEvents,
        finalsMatches
      })
      
      // Get the schedule from Python API
      const schedule = pythonResponse.data
      schedules[tournamentId] = schedule
      
      // Return the schedule with tournament ID
      return res.json({ tournamentId, schedule })
    } catch (pythonError) {
      console.error("Error from Python API:", pythonError.response?.data || pythonError.message)
      
      // Fallback to JavaScript implementation if Python API fails
      console.log("Falling back to JavaScript implementation...")
      const schedule = generateScheduleJs(tournament, teamsWithTournament, fixedEvents, finalsMatches)
    schedules[tournamentId] = schedule

    return res.json({ tournamentId, schedule })
    }
  } catch (error) {
    console.error("Error generating schedule:", error)
    return res.status(500).json({ error: "Failed to generate schedule" })
  }
})

// Adjust a schedule
app.post("/api/schedule/adjust", async (req, res) => {
  try {
    const { tournamentId, disruptions: newDisruptions } = req.body

    if (!tournamentId || !newDisruptions) {
      return res.status(400).json({ error: "Tournament ID and disruptions required" })
    }

    // Get tournament and schedule
    const tournament = tournaments.find((t) => t.id === tournamentId)
    const schedule = schedules[tournamentId]

    if (!tournament || !schedule) {
      return res.status(404).json({ error: "Tournament or schedule not found" })
    }

    // Get current disruptions or initialize empty array
    if (!disruptions[tournamentId]) {
      disruptions[tournamentId] = []
    }
    
    // Add new disruptions to the existing ones (avoid duplicates)
    const allDisruptions = [...disruptions[tournamentId]]
    
    for (const newDisruption of newDisruptions) {
      const exists = allDisruptions.some(d => 
        d.matchId === newDisruption.matchId && 
        d.type === newDisruption.type &&
        d.extraMinutes === newDisruption.extraMinutes
      )
      
      if (!exists) {
        allDisruptions.push(newDisruption)
      }
    }
    
    // Update stored disruptions
    disruptions[tournamentId] = allDisruptions
    
    // Check if all disruptions are late arrivals (for direct handling)
    const allLateArrivals = allDisruptions.every(d => d.type === "late_arrival");
    
    // Call Python API for schedule adjustment
    try {
      console.log("Calling Python API for schedule adjustment...")
      console.log("Sending disruptions:", JSON.stringify(allDisruptions))
      
      const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/python/schedule/adjust`, {
        tournament,
        schedule: schedule,
        disruptions: allDisruptions
      })
      
      // Get the adjusted schedule from Python API
      const adjustedSchedule = pythonResponse.data
      
      // Update the stored schedule
      schedules[tournamentId] = adjustedSchedule
      
      // Return the adjusted schedule with all disruptions for client-side tracking
      return res.json({ 
        adjustedSchedule,
        appliedDisruptions: allDisruptions 
      })
    } catch (pythonError) {
      console.error("Error from Python API:", pythonError.response?.data || pythonError.message)
      
      // Fallback to JavaScript implementation if Python API fails
      console.log("Falling back to JavaScript implementation...")
      
      let adjustedSchedule;
      if (allLateArrivals) {
        // For late arrivals, use direct adjustment
        console.log("Handling late arrivals directly")
        adjustedSchedule = handleLateArrivalsJs(tournament, schedule, allDisruptions);
      } else {
        // For other disruptions, use regular adjustment logic
        adjustedSchedule = adjustScheduleJs(tournament, schedule, allDisruptions);
      }
      
      // Update stored schedule
      schedules[tournamentId] = adjustedSchedule;
      
      return res.json({ 
        adjustedSchedule,
        appliedDisruptions: allDisruptions
      })
    }
  } catch (error) {
    console.error("Error adjusting schedule:", error)
    return res.status(500).json({ error: `Failed to adjust schedule: ${error.message}` })
  }
})

// Helper functions (keeping JavaScript implementation as fallback)
// Rename original function to indicate it's the JS version
function generateScheduleJs(tournament, teams, fixedEvents = [], finalsMatches = []) {
  // Get teams by game type
  const mlTeams = teams.filter((t) => t.gameType === "ML")
  const valTeams = teams.filter((t) => t.gameType === "Val")

  const matches = []

  // Parse venue hours for reference
  const venueStart = new Date()
  const [startHour, startMinute] = tournament.venueHours[0].split(":").map(Number)
  venueStart.setHours(startHour, startMinute, 0, 0)

  // Define fixed time slots as requested
  const morningTimeSlots = [
    {hours: 9, minutes: 0},   // 9:00 AM
    {hours: 10, minutes: 0},  // 10:00 AM
    {hours: 11, minutes: 0}   // 11:00 AM
  ];
  
  const afternoonTimeSlots = [
    {hours: 13, minutes: 0},  // 1:00 PM
    {hours: 14, minutes: 20}, // 2:20 PM
    {hours: 15, minutes: 40}  // 3:40 PM
  ];

  // Get time slot preferences
  const mlTimeSlot = tournament.timeSlots?.mobileLegends || "morning";
  const valTimeSlot = tournament.timeSlots?.valorant || "afternoon";
  
  // Track used slots for each time period
  let usedMorningSlots = 0;
  let usedAfternoonSlots = 0;

  // Add fixed events first (like lunch breaks)
  for (const event of fixedEvents) {
    const startTime = new Date(event.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + event.duration)

    matches.push({
      id: `E${matches.length + 1}`,
      team1: { id: 0, name: "Break", gameType: "None" },
      team2: { id: 0, name: "Break", gameType: "None" },
      duration: event.duration,
      gameType: "Break",
      roundNumber: 0,
      startTime,
      endTime,
      isFixedTime: true,
      isBreak: true,
      description: event.description || "Fixed Event"
    })
  }

  // Generate matches for Mobile Legends and Valorant based on time preferences
  function createMatchesForGameType(teams, gameType, preferredTimeSlot, durationRange) {
    // Create match pairs
    const matchPairs = [];
    
    // Create regular matches
    for (let i = 0; i < teams.length; i += 2) {
      if (i + 1 < teams.length) {
        matchPairs.push({
          team1: teams[i],
          team2: teams[i + 1],
          roundNumber: 1
        });
      }
    }
    
    // Add semifinals if enough teams
    if (teams.length >= 4) {
      matchPairs.push({
        team1: { ...teams[0], name: `${gameType} Winner 1` },
        team2: { ...teams[1], name: `${gameType} Winner 2` },
        roundNumber: 2,
        description: `${gameType === "ML" ? "ML" : "Valorant"} Semifinal`
      });
    }
    
    // Select appropriate time slots based on preference
    const timeSlots = preferredTimeSlot === "morning" ? morningTimeSlots : afternoonTimeSlots;
    let slotIndex = preferredTimeSlot === "morning" ? usedMorningSlots : usedAfternoonSlots;
    
    // Assign time slots to matches
    for (const matchPair of matchPairs) {
      if (slotIndex < timeSlots.length) {
        // Get the time slot
        const timeSlot = timeSlots[slotIndex];
        
        // Create the start time
        const startTime = new Date(venueStart);
        startTime.setHours(timeSlot.hours, timeSlot.minutes, 0, 0);
        
        // Duration based on tournament settings
    const duration = Math.floor(
          (durationRange[0] + durationRange[1]) / 2
        );
        
        // Calculate end time
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + duration);
        
        // Create match ID
        const matchId = `M${matches.length + 1}`;
        const isFixedTime = finalsMatches.includes(matchId);
        
        // Add match to schedule
    matches.push({
          id: matchId,
          team1: matchPair.team1,
          team2: matchPair.team2,
      duration,
          gameType,
          roundNumber: matchPair.roundNumber,
      startTime,
      endTime,
          isFixedTime,
          isBreak: false,
          description: matchPair.description || (isFixedTime ? "Finals" : "")
        });
        
        // Increment the appropriate slot counter
        if (preferredTimeSlot === "morning") {
          usedMorningSlots++;
        } else {
          usedAfternoonSlots++;
        }
        slotIndex++;
      }
    }
  }
  
  // Create matches according to preferences
  if (mlTeams.length > 1) {
    createMatchesForGameType(mlTeams, "ML", mlTimeSlot, tournament.mlDuration);
  }
  
  if (valTeams.length > 1) {
    createMatchesForGameType(valTeams, "Val", valTimeSlot, tournament.valDuration);
  }

  // Return the schedule
  return { matches }
}

// Rename original function to indicate it's the JS version
function adjustScheduleJs(tournament, schedule, disruptions) {
  // Ensure we're working with a deep copy to avoid modifying the original
  const adjustedSchedule = {
    matches: JSON.parse(JSON.stringify(schedule.matches))
      .map(match => ({
    ...match,
        // Ensure these properties exist to avoid classList-related errors
        isFixedTime: match.isFixedTime || false,
        isBreak: match.isBreak || false,
        description: match.description || "",
        // Convert string dates back to Date objects for calculations
    startTime: new Date(match.startTime),
        endTime: new Date(match.endTime)
      }))
  };

  // Store original match order based on start times
  const originalOrder = [...adjustedSchedule.matches]
    .sort((a, b) => a.startTime - b.startTime)
    .map(match => match.id);
    
  console.log("Original match order:", originalOrder);

  // Track matches with different disruption types
  const disruptedMatches = {
    lateArrival: [],
    extendedDuration: [],
    earlyFinish: []
  };

  // Sort disruptions by match order (process earlier matches first)
  const sortedDisruptions = [];
  for (const matchId of originalOrder) {
    const matchDisruptions = disruptions.filter(d => d.matchId === matchId);
    sortedDisruptions.push(...matchDisruptions);
  }
  
  console.log("Processing disruptions in order:", sortedDisruptions.map(d => `${d.matchId} - ${d.type}`));

  // Apply disruptions in order of match sequence
  for (const disruption of sortedDisruptions) {
    const matchIndex = adjustedSchedule.matches.findIndex(m => m.id === disruption.matchId);

    if (matchIndex >= 0) {
      const match = adjustedSchedule.matches[matchIndex];
      
      // Skip fixed-time events
      if (match.isFixedTime || match.isBreak) {
        console.log(`Skipping fixed-time match ${match.id}`);
        continue;
      }

      // Apply disruption based on type
      if (disruption.type === "extended_duration") {
        console.log(`Match ${match.id} original end: ${match.endTime}`);
        const originalEndTime = new Date(match.endTime);
        
        // Extend match duration
        match.duration += disruption.extraMinutes;
        match.endTime = new Date(match.startTime);
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration);
        
        console.log(`Match ${match.id} extended by ${disruption.extraMinutes} minutes. New end: ${match.endTime}`);
        
        // Track this disruption
        disruptedMatches.extendedDuration.push(match.id);
        
        // Propagate impact to subsequent matches
        propagateTimeChanges(adjustedSchedule, match, originalEndTime, tournament.restPeriod || 15);
      } else if (disruption.type === "late_arrival") {
        console.log(`Match ${match.id} original start: ${match.startTime}`);
        const originalStartTime = new Date(match.startTime);
        const originalEndTime = new Date(match.endTime);
        
        // Delay match start time
        match.startTime = new Date(match.startTime);
        match.startTime.setMinutes(match.startTime.getMinutes() + disruption.extraMinutes);
        match.endTime = new Date(match.startTime);
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration);
        
        console.log(`Match ${match.id} delayed by ${disruption.extraMinutes} minutes. New start: ${match.startTime}`);
        
        // Track this disruption
        disruptedMatches.lateArrival.push(match.id);
        
        // Propagate impact to subsequent matches
        propagateTimeChanges(adjustedSchedule, match, originalEndTime, tournament.restPeriod || 15);
      } else if (disruption.type === "early_finish") {
        console.log(`Match ${match.id} original end: ${match.endTime}`);
        const originalEndTime = new Date(match.endTime);
        
        // Reduce match duration
        match.duration -= disruption.extraMinutes;
        if (match.duration < 10) match.duration = 10; // minimum duration
        match.endTime = new Date(match.startTime);
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration);
        
        console.log(`Match ${match.id} finished ${disruption.extraMinutes} minutes early. New end: ${match.endTime}`);
        
        // Track this disruption
        disruptedMatches.earlyFinish.push(match.id);
        
        // Handle early finish specially - try to move next match earlier
        handleEarlyFinishImproved(adjustedSchedule, match, originalEndTime, tournament.restPeriod || 15);
      }
    }
  }

  // Final validation pass to ensure sequence consistency
  validateScheduleSequence(adjustedSchedule, originalOrder, tournament.restPeriod || 15);

  return adjustedSchedule;
}

// Propagate time changes to subsequent matches
function propagateTimeChanges(schedule, changedMatch, originalEndTime, restPeriod) {
  // Get all matches sorted by start time
  const sortedMatches = [...schedule.matches].sort((a, b) => 
    a.startTime - b.startTime
  );
  
  // Find matches that start after the changed match
  let subsequentMatches = [];
  let foundCurrent = false;
  
  for (const match of sortedMatches) {
    if (match.id === changedMatch.id) {
      foundCurrent = true;
      continue;
    }
    
    if (foundCurrent && !match.isFixedTime && !match.isBreak) {
      subsequentMatches.push(match);
    }
  }
  
  // Process subsequent matches in order
  for (const nextMatch of subsequentMatches) {
    // Calculate minimum start time with appropriate buffer
    const setupTime = 5; // 5 minutes minimum setup time
    
    // Check if teams overlap (need rest period)
    const teamsOverlap =
      changedMatch.team1.name === nextMatch.team1.name || 
      changedMatch.team1.name === nextMatch.team2.name || 
      changedMatch.team2.name === nextMatch.team1.name || 
      changedMatch.team2.name === nextMatch.team2.name;
    
    const buffer = teamsOverlap ? restPeriod : setupTime;
    
    const minStartTime = new Date(changedMatch.endTime);
    minStartTime.setMinutes(minStartTime.getMinutes() + buffer);
    
    // If next match would start before minimum allowed time, adjust it
    if (nextMatch.startTime < minStartTime) {
      const originalStart = new Date(nextMatch.startTime);

      // Update times
      nextMatch.startTime = new Date(minStartTime);
      nextMatch.endTime = new Date(minStartTime);
      nextMatch.endTime.setMinutes(minStartTime.getMinutes() + nextMatch.duration);
      
      console.log(`  → Shifted ${nextMatch.id} from ${originalStart} to ${nextMatch.startTime} (after ${changedMatch.id})`);
      
      // This match is now the changed match for the next iteration
      changedMatch = nextMatch;
    } else {
      // If this match doesn't need adjustment, we're done propagating changes
      break;
    }
  }
}

// Improved handler for early finish scenarios
function handleEarlyFinishImproved(schedule, earlyMatch, originalEndTime, restPeriod) {
  // Sort all matches by start time
  const sortedMatches = [...schedule.matches].sort((a, b) => 
    a.startTime - b.startTime
  );
  
  // Find the index of the early match
  const earlyMatchIndex = sortedMatches.findIndex(m => m.id === earlyMatch.id);
  
  if (earlyMatchIndex === -1 || earlyMatchIndex === sortedMatches.length - 1) {
    return; // Not found or last match
  }
  
  // Get the next match after the early one
  const nextMatch = sortedMatches[earlyMatchIndex + 1];
  
  // Skip if next match is fixed-time
  if (nextMatch.isFixedTime || nextMatch.isBreak) {
    return;
  }
  
  // Check if any fixed event between early match and next match
  const hasFixedEventBetween = sortedMatches.some(match => 
    (match.isFixedTime || match.isBreak) && 
    earlyMatch.endTime <= match.startTime && 
    match.startTime < nextMatch.startTime
  );
  
  if (hasFixedEventBetween) {
    return; // Can't move next match earlier
  }
  
  // Calculate minimum buffer
  const setupTime = 5; // Basic setup time
  
  // Check if teams overlap (need rest period)
  const teamsOverlap = 
    earlyMatch.team1.name === nextMatch.team1.name || 
    earlyMatch.team1.name === nextMatch.team2.name || 
    earlyMatch.team2.name === nextMatch.team1.name || 
    earlyMatch.team2.name === nextMatch.team2.name;
    
  const buffer = teamsOverlap ? restPeriod : setupTime;
  
  // Calculate new start time
  const newStartTime = new Date(earlyMatch.endTime);
  newStartTime.setMinutes(newStartTime.getMinutes() + buffer);
  
  // Only move earlier if it's actually earlier than current time
  if (newStartTime < nextMatch.startTime) {
    const originalStart = new Date(nextMatch.startTime);
    
    nextMatch.startTime = new Date(newStartTime);
    nextMatch.endTime = new Date(newStartTime);
    nextMatch.endTime.setMinutes(newStartTime.getMinutes() + nextMatch.duration);
    
    console.log(`  → Moving ${nextMatch.id} earlier from ${originalStart} to ${nextMatch.startTime} (after early finish of ${earlyMatch.id})`);
    
    // Recursively try to move subsequent matches earlier
    const timeDiff = originalStart.getTime() - nextMatch.startTime.getTime();
    const originalNextEnd = new Date(nextMatch.endTime.getTime() + timeDiff);
    handleEarlyFinishImproved(schedule, nextMatch, originalNextEnd, restPeriod);
  }
}

// Validate final schedule to ensure no conflicts remain
function validateScheduleSequence(schedule, originalOrder, restPeriod) {
  console.log("Final validation to ensure schedule sequence integrity");
  
  // Create a lookup for matches by ID
  const matchesById = {};
  schedule.matches.forEach(match => {
    matchesById[match.id] = match;
  });
  
  // Process matches in original order
  for (let i = 0; i < originalOrder.length; i++) {
    const currentId = originalOrder[i];
    const currentMatch = matchesById[currentId];
    
    if (!currentMatch || currentMatch.isFixedTime || currentMatch.isBreak) {
      continue;
    }
    
    // Check for conflicts with all previous matches
    for (let j = 0; j < i; j++) {
      const prevId = originalOrder[j];
      const prevMatch = matchesById[prevId];
      
      if (!prevMatch || prevMatch.isFixedTime || prevMatch.isBreak) {
        continue;
      }
      
      // Check if teams overlap (need rest period)
      const teamsOverlap = 
        prevMatch.team1.name === currentMatch.team1.name || 
        prevMatch.team1.name === currentMatch.team2.name || 
        prevMatch.team2.name === currentMatch.team1.name || 
        prevMatch.team2.name === currentMatch.team2.name;
      
      // Calculate minimum buffer
      const setupTime = 5;
      const buffer = teamsOverlap ? restPeriod : setupTime;
      
      const minStartTime = new Date(prevMatch.endTime);
      minStartTime.setMinutes(minStartTime.getMinutes() + buffer);
      
      // Fix sequence issues
      if (currentMatch.startTime < prevMatch.endTime) {
        console.log(`VALIDATION: Fixed sequence issue - ${currentId} was starting at ${currentMatch.startTime} before ${prevId} ended at ${prevMatch.endTime}`);
        
        currentMatch.startTime = new Date(minStartTime);
        currentMatch.endTime = new Date(minStartTime);
        currentMatch.endTime.setMinutes(minStartTime.getMinutes() + currentMatch.duration);
      } else if (teamsOverlap && currentMatch.startTime < minStartTime) {
        console.log(`VALIDATION: Fixed rest period issue - ${currentId} needs ${buffer} min after ${prevId}`);
        
        currentMatch.startTime = new Date(minStartTime);
        currentMatch.endTime = new Date(minStartTime);
        currentMatch.endTime.setMinutes(minStartTime.getMinutes() + currentMatch.duration);
      }
    }
  }
}

// Direct handler for late arrivals (JavaScript implementation)
function handleLateArrivalsJs(tournament, schedule, disruptions) {
  console.log("INTERDEPENDENT LATE ARRIVAL HANDLER ACTIVATED");
  console.log("Disruptions to process:", JSON.stringify(disruptions));
  
  // Create a deep copy of the schedule to avoid modifying the original
  const adjustedSchedule = { 
    matches: JSON.parse(JSON.stringify(schedule.matches))
      .map(match => ({
        ...match,
        // Ensure these properties exist
        isFixedTime: match.isFixedTime || false,
        isBreak: match.isBreak || false,
        description: match.description || "",
        // Convert string dates back to Date objects
        startTime: new Date(match.startTime),
        endTime: new Date(match.endTime)
      }))
  };

  // Store original schedule data for reference
  const originalMatches = adjustedSchedule.matches.map(match => ({
    id: match.id,
    gameType: match.gameType,
    team1: match.team1.name,
    team2: match.team2.name,
    startTime: new Date(match.startTime),
    endTime: new Date(match.endTime),
    duration: match.duration
  }));
  
  console.log("Original schedule:", originalMatches.map(m => 
    `${m.id}: ${m.team1} vs ${m.team2} (${m.gameType}) at ${m.startTime}`
  ));
  
  // Track which matches have late arrivals
  const lateArrivalMatches = [];
  
  // STEP 1: Apply late arrivals ONLY to the specific match ID mentioned
  for (const disruption of disruptions) {
    if (disruption.type === "late_arrival") {
      // Find EXACT match by ID
      const matchIndex = adjustedSchedule.matches.findIndex(m => m.id === disruption.matchId);
      
      if (matchIndex === -1) {
        console.error(`Match ID ${disruption.matchId} not found for late arrival!`);
        continue;
      }
      
      const match = adjustedSchedule.matches[matchIndex];
      console.log(`Found match for late arrival: ${match.id} ${match.gameType} - ${match.team1.name} vs ${match.team2.name}`);
      
      if (match.isFixedTime) {
        console.log(`Skipping fixed-time match ${match.id}`);
        continue;
      }
      
      // Record that this match has a late arrival
      lateArrivalMatches.push(match.id);
      
      // Store original time for verification later
      const originalStartTime = new Date(match.startTime);
      console.log(`Original time for match ${match.id}: ${originalStartTime}`);
      
      // Apply exact delay
      match.startTime = new Date(originalStartTime);
      match.startTime.setMinutes(match.startTime.getMinutes() + disruption.extraMinutes);
      
      // Update end time based on new start time
      match.endTime = new Date(match.startTime);
      match.endTime.setMinutes(match.endTime.getMinutes() + match.duration);
      
      console.log(`⏰ DELAYED MATCH: ${match.id} ${match.gameType} - ${match.team1.name} vs ${match.team2.name}`);
      console.log(`   FROM: ${originalStartTime} TO: ${match.startTime} (delay: ${disruption.extraMinutes} min)`);
    }
  }
  
  // STEP 2: Create team schedule map to track when teams are playing in ANY game type
  const teamSchedule = {};
  
  // First, populate with original schedule
  adjustedSchedule.matches.forEach(match => {
    // For each team in the match
    [match.team1.name, match.team2.name].forEach(teamName => {
      if (!teamSchedule[teamName]) {
        teamSchedule[teamName] = [];
      }
      
      teamSchedule[teamName].push({
        matchId: match.id,
        gameType: match.gameType,
        startTime: new Date(match.startTime),
        endTime: new Date(match.endTime),
        opponent: teamName === match.team1.name ? match.team2.name : match.team1.name,
        hasLateArrival: lateArrivalMatches.includes(match.id)
      });
    });
  });
  
  // Sort each team's matches by start time
  Object.keys(teamSchedule).forEach(teamName => {
    teamSchedule[teamName].sort((a, b) => a.startTime - b.startTime);
    console.log(`${teamName}'s schedule:`, 
      teamSchedule[teamName].map(m => 
        `${m.matchId} (${m.gameType}) vs ${m.opponent} at ${m.startTime}${m.hasLateArrival ? ' [DELAYED]' : ''}`
      )
    );
  });
  
  // STEP 3: Process matches in chronological order to ensure no team plays in overlapping matches
  const allMatches = [...adjustedSchedule.matches].sort((a, b) => a.startTime - b.startTime);
  
  // First pass - process matches in time order to ensure no teams are double-booked
  for (let i = 0; i < allMatches.length; i++) {
    const currentMatch = allMatches[i];
    
    // Skip fixed-time matches
    if (currentMatch.isFixedTime) {
      console.log(`Skipping fixed-time match: ${currentMatch.id}`);
      continue;
    }
    
    const team1 = currentMatch.team1.name;
    const team2 = currentMatch.team2.name;
    
    // Check if either team is already playing in another match that overlaps
    const team1Conflicts = findTeamConflicts(team1, currentMatch.id, currentMatch.startTime, currentMatch.endTime, teamSchedule);
    const team2Conflicts = findTeamConflicts(team2, currentMatch.id, currentMatch.startTime, currentMatch.endTime, teamSchedule);
    
    const allConflicts = [...team1Conflicts, ...team2Conflicts];
    
    if (allConflicts.length > 0) {
      console.log(`Found conflicts for match ${currentMatch.id}:`, allConflicts);
      
      // If this match has a late arrival, it has priority - we need to move the other match
      if (lateArrivalMatches.includes(currentMatch.id)) {
        console.log(`Match ${currentMatch.id} has late arrival - prioritizing its time`);
        
        // For each conflicting match, adjust its time if possible
        for (const conflict of allConflicts) {
          const conflictMatch = adjustedSchedule.matches.find(m => m.id === conflict.matchId);
          
          if (conflictMatch && !conflictMatch.isFixedTime && !lateArrivalMatches.includes(conflictMatch.id)) {
            // Move conflicting match to start after current match (plus rest period)
            const newStartTime = new Date(currentMatch.endTime);
            newStartTime.setMinutes(newStartTime.getMinutes() + (tournament.restPeriod || 15));
            
            console.log(`Moving conflict match ${conflictMatch.id} to ${newStartTime}`);
            conflictMatch.startTime = newStartTime;
            conflictMatch.endTime = new Date(newStartTime);
            conflictMatch.endTime.setMinutes(newStartTime.getMinutes() + conflictMatch.duration);
            
            // Update team schedule
            updateTeamSchedule(teamSchedule, conflictMatch);
          }
        }
      } else {
        // This match doesn't have late arrival - check if any conflicting matches do
        const conflictsWithLateArrivals = allConflicts.filter(c => 
          lateArrivalMatches.includes(c.matchId)
        );
        
        if (conflictsWithLateArrivals.length > 0) {
          // A conflicting match has late arrival, so we move current match
          console.log(`Conflict match has late arrival - moving current match ${currentMatch.id}`);
          
          // Find the latest end time among conflicting matches with late arrivals
          const latestEndTime = conflictsWithLateArrivals.reduce((latest, conflict) => {
            const conflictMatch = adjustedSchedule.matches.find(m => m.id === conflict.matchId);
            return conflictMatch && conflictMatch.endTime > latest ? conflictMatch.endTime : latest;
          }, new Date(0));
          
          // Move current match to start after the latest conflicting match
          const newStartTime = new Date(latestEndTime);
          newStartTime.setMinutes(newStartTime.getMinutes() + (tournament.restPeriod || 15));
          
          console.log(`Moving match ${currentMatch.id} to ${newStartTime} (after late arrival conflict)`);
          currentMatch.startTime = newStartTime;
          currentMatch.endTime = new Date(newStartTime);
          currentMatch.endTime.setMinutes(newStartTime.getMinutes() + currentMatch.duration);
          
          // Update team schedule
          updateTeamSchedule(teamSchedule, currentMatch);
        } else {
          // No late arrivals involved, find the earliest we can schedule this match
          const earliestPossibleTime = allConflicts.reduce((earliest, conflict) => {
            const conflictMatch = adjustedSchedule.matches.find(m => m.id === conflict.matchId);
            return conflictMatch && conflictMatch.endTime > earliest ? conflictMatch.endTime : earliest;
          }, new Date(0));
          
          // Add rest period
          const newStartTime = new Date(earliestPossibleTime);
          newStartTime.setMinutes(newStartTime.getMinutes() + (tournament.restPeriod || 15));
          
          // Don't schedule earlier than original time
          const originalMatch = originalMatches.find(m => m.id === currentMatch.id);
          if (originalMatch && newStartTime < originalMatch.startTime) {
            newStartTime.setTime(originalMatch.startTime.getTime());
          }
          
          console.log(`Moving match ${currentMatch.id} to ${newStartTime} (resolving team conflict)`);
          currentMatch.startTime = newStartTime;
          currentMatch.endTime = new Date(newStartTime);
          currentMatch.endTime.setMinutes(newStartTime.getMinutes() + currentMatch.duration);
          
          // Update team schedule
          updateTeamSchedule(teamSchedule, currentMatch);
        }
      }
    }
  }
  
  // STEP 4: Now group by game type to handle venue constraints (only one match per game type at a time)
  const matchesByGameType = {};
  
  adjustedSchedule.matches.forEach(match => {
    if (!matchesByGameType[match.gameType]) {
      matchesByGameType[match.gameType] = [];
    }
    matchesByGameType[match.gameType].push(match);
  });
  
  // Sort each game type's matches by start time
  for (const [gameType, matches] of Object.entries(matchesByGameType)) {
    console.log(`Checking venue constraints for ${gameType} matches...`);
    
    // Sort by start time
    matches.sort((a, b) => a.startTime - b.startTime);
    
    // Now ensure no overlapping matches within each game type (venue constraint)
    for (let i = 1; i < matches.length; i++) {
      const currentMatch = matches[i];
      const prevMatch = matches[i-1];
      
      // Skip fixed time matches
      if (currentMatch.isFixedTime) {
        console.log(`Skipping fixed-time match: ${currentMatch.id}`);
        continue;
      }
      
      // Calculate minimum start time (plus setup time)
      const setupTime = 5; // minutes
      const minStartTime = new Date(prevMatch.endTime);
      minStartTime.setMinutes(minStartTime.getMinutes() + setupTime);
      
      // If current match would start before previous one ends (plus setup)
      if (currentMatch.startTime < minStartTime) {
        // Only adjust if not a match with late arrival
        if (!lateArrivalMatches.includes(currentMatch.id)) {
          console.log(`Venue conflict: Match ${currentMatch.id} would start at ${currentMatch.startTime} before ${prevMatch.id} finishes at ${prevMatch.endTime}`);
          
          // Save original time for logging
          const originalStart = new Date(currentMatch.startTime);
          
          // Move to minimum start time
          currentMatch.startTime = new Date(minStartTime);
          currentMatch.endTime = new Date(minStartTime);
          currentMatch.endTime.setMinutes(minStartTime.getMinutes() + currentMatch.duration);
          
          console.log(`Moved match ${currentMatch.id} from ${originalStart} to ${currentMatch.startTime} (venue constraint)`);
          
          // Also update team schedule to reflect this change
          updateTeamSchedule(teamSchedule, currentMatch);
        } else {
          // This match has a late arrival but would overlap with previous match
          console.log(`⚠️ Venue conflict with late arrival: Match ${currentMatch.id} at ${currentMatch.startTime} conflicts with ${prevMatch.id} ending at ${prevMatch.endTime}`);
          
          // Check if previous match has late arrival too
          if (lateArrivalMatches.includes(prevMatch.id)) {
            console.log(`Both matches have late arrivals - complex conflict!`);
            // In this complex case, we might need to reduce duration of one match
            // or handle specially based on tournament rules
          } else {
            // See if we can adjust previous match to end earlier
            const neededAdjustment = Math.ceil((minStartTime - currentMatch.startTime) / (1000 * 60)); // minutes
            
            if (neededAdjustment > 0 && prevMatch.duration > 20) {
              // Limit how much we can shorten a match
              const newDuration = Math.max(20, prevMatch.duration - neededAdjustment);
              
              if (newDuration < prevMatch.duration) {
                console.log(`Adjusting previous match ${prevMatch.id} duration from ${prevMatch.duration} to ${newDuration} min`);
                
                // Update duration and end time
                prevMatch.duration = newDuration;
                prevMatch.endTime = new Date(prevMatch.startTime);
                prevMatch.endTime.setMinutes(prevMatch.startTime.getMinutes() + newDuration);
                
                // Update team schedule
                updateTeamSchedule(teamSchedule, prevMatch);
              }
            }
          }
        }
      }
    }
  }
  
  // STEP 5: Double-check no matches start earlier than original time (unless they had late arrival)
  for (const match of adjustedSchedule.matches) {
    // Find original time for this match
    const originalMatch = originalMatches.find(m => m.id === match.id);
    
    if (originalMatch && !lateArrivalMatches.includes(match.id)) {
      if (match.startTime < originalMatch.startTime) {
        console.error(`ERROR: Match ${match.id} scheduled earlier than original time: ${match.startTime} < ${originalMatch.startTime}`);
        
        // Fix the issue - reset to original time
        match.startTime = new Date(originalMatch.startTime);
        match.endTime = new Date(match.startTime);
        match.endTime.setMinutes(match.startTime.getMinutes() + match.duration);
        
        console.log(`Fixed: Reset ${match.id} to original time ${match.startTime}`);
        
        // Update team schedule
        updateTeamSchedule(teamSchedule, match);
      }
    }
  }
  
  console.log("Final adjusted schedule:");
  for (const match of adjustedSchedule.matches.sort((a, b) => a.startTime - b.startTime)) {
    console.log(`${match.id}: ${match.team1.name} vs ${match.team2.name} (${match.gameType}) at ${match.startTime}`);
  }
  
  return adjustedSchedule;
}

// Helper to find conflicts for a team
function findTeamConflicts(teamName, currentMatchId, startTime, endTime, teamSchedule) {
  if (!teamSchedule[teamName]) return [];
  
  return teamSchedule[teamName]
    .filter(scheduledMatch => 
      // Different match than current
      scheduledMatch.matchId !== currentMatchId &&
      // Overlapping time periods
      ((scheduledMatch.startTime <= startTime && scheduledMatch.endTime > startTime) ||
       (scheduledMatch.startTime < endTime && scheduledMatch.endTime >= endTime) ||
       (scheduledMatch.startTime >= startTime && scheduledMatch.endTime <= endTime))
    );
}

// Helper to update the team schedule after moving a match
function updateTeamSchedule(teamSchedule, match) {
  // Update team1's schedule
  if (teamSchedule[match.team1.name]) {
    const matchIndex = teamSchedule[match.team1.name].findIndex(m => m.matchId === match.id);
    if (matchIndex >= 0) {
      teamSchedule[match.team1.name][matchIndex].startTime = new Date(match.startTime);
      teamSchedule[match.team1.name][matchIndex].endTime = new Date(match.endTime);
    }
  }
  
  // Update team2's schedule
  if (teamSchedule[match.team2.name]) {
    const matchIndex = teamSchedule[match.team2.name].findIndex(m => m.matchId === match.id);
    if (matchIndex >= 0) {
      teamSchedule[match.team2.name][matchIndex].startTime = new Date(match.startTime);
      teamSchedule[match.team2.name][matchIndex].endTime = new Date(match.endTime);
    }
  }
  
  // Re-sort schedules
  if (teamSchedule[match.team1.name]) {
    teamSchedule[match.team1.name].sort((a, b) => a.startTime - b.startTime);
  }
  if (teamSchedule[match.team2.name]) {
    teamSchedule[match.team2.name].sort((a, b) => a.startTime - b.startTime);
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

