// Global state
const state = {
  tournament: null,
  teams: [],
  mlTeamCount: 0,
  valTeamCount: 0,
  schedule: null,
  disruptions: [],
  adjustedSchedule: null,
  activeTab: "setup",
  scheduleView: "table",
  adjustedView: "table",
  isGenerating: false,
  isAdjusting: false,
}

// DOM Elements
const tabButtons = document.querySelectorAll(".tab-button")
const tabPanes = document.querySelectorAll(".tab-pane")
const tournamentForm = document.getElementById("tournament-form")
const teamForm = document.getElementById("team-form")
const teamTableBody = document.getElementById("team-table-body")
const noTeamsMessage = document.getElementById("no-teams-message")
const teamCounts = document.getElementById("team-counts")
const continueToScheduleBtn = document.getElementById("continue-to-schedule")
const generateScheduleBtn = document.getElementById("generate-schedule")
const scheduleContainer = document.getElementById("schedule-container")
const noScheduleMessage = document.getElementById("no-schedule-message")
const scheduleTableView = document.getElementById("schedule-table-view")
const scheduleTimelineView = document.getElementById("schedule-timeline-view")
const scheduleViewButtons = document.querySelectorAll("#schedule-view-controls .view-button")
const disruptionForm = document.getElementById("disruption-form")
const matchIdSelect = document.getElementById("matchId")
const disruptionTypeSelect = document.getElementById("disruptionType")
const extraMinutesHelp = document.getElementById("extraMinutesHelp")
const disruptionTableBody = document.getElementById("disruption-table-body")
const noDisruptionsMessage = document.getElementById("no-disruptions-message")
const disruptionCount = document.getElementById("disruption-count")
const adjustScheduleBtn = document.getElementById("adjust-schedule")
const noScheduleForDisruptions = document.getElementById("no-schedule-for-disruptions")
const adjustedScheduleContainer = document.getElementById("adjusted-schedule-container")
const noAdjustedScheduleMessage = document.getElementById("no-adjusted-schedule-message")
const adjustedTableView = document.getElementById("adjusted-table-view")
const adjustedTimelineView = document.getElementById("adjusted-timeline-view")
const adjustedViewButtons = document.querySelectorAll("#adjusted-view-controls .view-button")
const errorContainer = document.getElementById("error-container")
const errorText = document.getElementById("error-text")
const closeErrorBtn = document.getElementById("close-error")
const loadingOverlay = document.getElementById("loading-overlay")
const loadingText = document.getElementById("loading-text")

// Metrics elements
const originalIdleTime = document.getElementById("original-idle-time")
const adjustedIdleTime = document.getElementById("adjusted-idle-time")
const idleTimeDiff = document.getElementById("idle-time-diff")
const disruptionScore = document.getElementById("disruption-score")
const originalDuration = document.getElementById("original-duration")
const adjustedDuration = document.getElementById("adjusted-duration")
const durationDiff = document.getElementById("duration-diff")

// Initialize the application
function init() {
  // Hide loading overlay on init
  hideLoading();
  
  console.log("Application initialized");
  
  // Set up event listeners
  setupEventListeners();

  // Show the first tab
  showTab("setup");
  
  // Extra safety measure - force hide loading after a short delay
  setTimeout(() => {
    hideLoading();
  }, 500);
}

// Set up event listeners
function setupEventListeners() {
  // Tab navigation
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.disabled) {
        showTab(button.dataset.tab)
      }
    })
  })

  // Tournament form submission
  tournamentForm.addEventListener("submit", handleTournamentSubmit)

  // Team form submission
  teamForm.addEventListener("submit", handleTeamSubmit)

  // Continue to schedule button
  continueToScheduleBtn.addEventListener("click", handleContinueToSchedule)

  // Generate schedule button
  generateScheduleBtn.addEventListener("click", handleGenerateSchedule)

  // Schedule view buttons
  scheduleViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.scheduleView = button.dataset.view
      updateScheduleView()
    })
  })

  // Disruption type change
  disruptionTypeSelect.addEventListener("change", updateDisruptionForm)

  // Disruption form submission
  disruptionForm.addEventListener("submit", handleDisruptionSubmit)

  // Adjust schedule button
  adjustScheduleBtn.addEventListener("click", handleAdjustSchedule)

  // Adjusted view buttons
  adjustedViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.adjustedView = button.dataset.view
      updateAdjustedView()
    })
  })

  // Close error button
  closeErrorBtn.addEventListener("click", () => {
    errorContainer.classList.add("hidden")
  })

  // Game type toggle switches
  const enableMobileLegends = document.getElementById("enableMobileLegends");
  const enableValorant = document.getElementById("enableValorant");
  
  if (enableMobileLegends) {
    enableMobileLegends.addEventListener("change", updateFormFields);
  }
  
  if (enableValorant) {
    enableValorant.addEventListener("change", updateFormFields);
  }

  // Initial form fields state
  updateFormFields();
}

// Show a specific tab
function showTab(tabId) {
  state.activeTab = tabId

  // Update tab buttons
  tabButtons.forEach((button) => {
    if (button.dataset.tab === tabId) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })

  // Update tab panes
  tabPanes.forEach((pane) => {
    if (pane.id === tabId) {
      pane.classList.add("active")
    } else {
      pane.classList.remove("active")
    }
  })

  // Special handling for disruptions tab
  if (tabId === "disruptions") {
    if (state.schedule) {
      disruptionForm.style.display = "block"
      noScheduleForDisruptions.style.display = "none"
      populateMatchSelect()
    } else {
      disruptionForm.style.display = "none"
      noScheduleForDisruptions.style.display = "block"
    }
  }
}

// Handle tournament form submission
function handleTournamentSubmit(e) {
  e.preventDefault()

  const formData = new FormData(tournamentForm)
  const mlTeams = Number.parseInt(formData.get("mlTeams"))
  const valTeams = Number.parseInt(formData.get("valTeams"))
  const mlDurationMin = Number.parseInt(formData.get("mlDurationMin"))
  const mlDurationMax = Number.parseInt(formData.get("mlDurationMax"))
  const valDurationMin = Number.parseInt(formData.get("valDurationMin"))
  const valDurationMax = Number.parseInt(formData.get("valDurationMax"))
  const enableMobileLegends = formData.get("enableMobileLegends") === "on"
  const enableValorant = formData.get("enableValorant") === "on"
  const matchFormat = formData.get("matchFormat")
  const mlTimeSlot = formData.get("mlTimeSlot") || "morning"
  const valTimeSlot = formData.get("valTimeSlot") || "afternoon"

  // Validate form data
  if (mlDurationMin > mlDurationMax) {
    showError("ML minimum duration must be less than or equal to maximum duration")
    return
  }

  if (valDurationMin > valDurationMax) {
    showError("Valorant minimum duration must be less than or equal to maximum duration")
    return
  }

  if (!enableMobileLegends && !enableValorant) {
    showError("At least one game type must be enabled")
    return
  }

  // Validate that if both games are enabled, they're not in the same time slot
  // Skip validation if either game uses "wholeday" slot
  if (enableMobileLegends && enableValorant && 
      mlTimeSlot !== "wholeday" && valTimeSlot !== "wholeday" && 
      mlTimeSlot === valTimeSlot) {
    showError("Mobile Legends and Valorant cannot both be scheduled in the same time slot. Please choose different time slots for each game or use the Whole Day option.")
    return
  }

  let totalTeamsValid = true
  
  if (enableMobileLegends) {
    if (mlTeams < 2 || mlTeams > 16 || (mlTeams & (mlTeams - 1)) !== 0) {
      showError("Mobile Legends teams must be a power of 2 (2, 4, 8, 16)")
      totalTeamsValid = false
    }
  }
  
  if (enableValorant && totalTeamsValid) {
    if (valTeams < 2 || valTeams > 16 || (valTeams & (valTeams - 1)) !== 0) {
      showError("Valorant teams must be a power of 2 (2, 4, 8, 16)")
      totalTeamsValid = false
    }
  }
  
  if (!totalTeamsValid) return

  // Validate tournament format (remove "playoffs" if selected)
  const format = formData.get("format");
  if (format === "playoffs") {
    showError("Playoffs format is no longer available. Please select a different format.")
    return;
  }

  // Create tournament object
  state.tournament = {
    format: format,
    mlTeams: enableMobileLegends ? mlTeams : 0,
    valTeams: enableValorant ? valTeams : 0,
    mlDuration: [mlDurationMin, mlDurationMax],
    valDuration: [valDurationMin, valDurationMax],
    venueHours: [formData.get("venueStart"), formData.get("venueEnd")],
    restPeriod: Number.parseInt(formData.get("restPeriod")),
    maxMatchesPerDay: Number.parseInt(formData.get("maxMatchesPerDay")),
    matchFormat: matchFormat,
    enabledGames: {
      mobileLegends: enableMobileLegends,
      valorant: enableValorant,
    },
    timeSlots: {
      mobileLegends: mlTimeSlot,
      valorant: valTimeSlot
    }
  }

  // Update team counts display
  updateTeamCounts()

  // Enable teams tab
  enableTab("teams")

  // Switch to teams tab
  showTab("teams")
}

// Handle team form submission
function handleTeamSubmit(e) {
  e.preventDefault()

  const formData = new FormData(teamForm)
  const teamName = formData.get("teamName")
  const gameType = formData.get("gameType")

  // Validate team counts
  if (gameType === "ML" && state.mlTeamCount >= state.tournament.mlTeams) {
    showError(`Maximum of ${state.tournament.mlTeams} Mobile Legends teams allowed`)
    return
  }

  if (gameType === "Val" && state.valTeamCount >= state.tournament.valTeams) {
    showError(`Maximum of ${state.tournament.valTeams} Valorant teams allowed`)
    return
  }

  // Create team object
  const team = {
    id: state.teams.length + 1,
    name: teamName,
    gameType,
    matchesPlayed: 0,
  }

  // Add team to state
  state.teams.push(team)

  // Update team counts
  if (gameType === "ML") {
    state.mlTeamCount++
  } else {
    state.valTeamCount++
  }

  // Update UI
  updateTeamTable()
  updateTeamCounts()

  // Remember current game type
  const currentGameType = gameType

  // Reset form (only clear team name, keep game selection)
  document.getElementById("teamName").value = ""
  
  // Keep the same game type selected instead of resetting to ML
  document.getElementById("gameType").value = currentGameType

  // Check if we can continue to schedule
  checkContinueToSchedule()
}

// Update team table
function updateTeamTable() {
  if (state.teams.length === 0) {
    teamTableBody.innerHTML = ""
    noTeamsMessage.style.display = "block"
    return
  }

  noTeamsMessage.style.display = "none"

  teamTableBody.innerHTML = state.teams
    .map(
      (team, index) => `
        <tr>
            <td>${team.id}</td>
            <td>${team.name}</td>
            <td>${team.gameType === "ML" ? "Mobile Legends" : "Valorant"}</td>
            <td>
                <button class="btn" onclick="removeTeam(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

// Remove a team
function removeTeam(index) {
  const team = state.teams[index]

  // Update team counts
  if (team.gameType === "ML") {
    state.mlTeamCount--
  } else {
    state.valTeamCount--
  }

  // Remove team from state
  state.teams.splice(index, 1)

  // Update UI
  updateTeamTable()
  updateTeamCounts()

  // Check if we can continue to schedule
  checkContinueToSchedule()
}

// Update team counts display
function updateTeamCounts() {
  teamCounts.textContent = `Mobile Legends: ${state.mlTeamCount}/${state.tournament.mlTeams} teams | Valorant: ${state.valTeamCount}/${state.tournament.valTeams} teams`
}

// Check if we can continue to schedule
function checkContinueToSchedule() {
  if (state.mlTeamCount === state.tournament.mlTeams && state.valTeamCount === state.tournament.valTeams) {
    continueToScheduleBtn.disabled = false
  } else {
    continueToScheduleBtn.disabled = true
  }
}

// Handle continue to schedule button
function handleContinueToSchedule() {
  // Enable schedule tab
  enableTab("schedule")

  // Switch to schedule tab
  showTab("schedule")
}

// Handle generate schedule button
function handleGenerateSchedule() {
  if (state.isGenerating) return

  state.isGenerating = true
  generateScheduleBtn.disabled = true
  generateScheduleBtn.textContent = "Generating..."

  showLoading("Generating schedule...")

  // Simulate API call delay
  setTimeout(() => {
    try {
      // Generate schedule
      state.schedule = generateSchedule(state.tournament, state.teams)

      // Update UI
      updateScheduleDisplay()

      // Enable disruptions tab
      enableTab("disruptions")
    } catch (error) {
      showError("Failed to generate schedule: " + error.message)
    } finally {
      state.isGenerating = false
      generateScheduleBtn.disabled = false
      generateScheduleBtn.textContent = "Generate Schedule"
      hideLoading()
    }
  }, 1500)
}

// Generate a schedule (mock implementation)
function generateSchedule(tournament, teams) {
  // Get teams by game type
  const mlTeams = teams.filter((t) => t.gameType === "ML")
  const valTeams = teams.filter((t) => t.gameType === "Val")

  const matches = []

  // Parse venue hours for reference
  const venueStart = new Date()
  const [startHour, startMinute] = tournament.venueHours[0].split(":").map(Number)
  venueStart.setHours(startHour, startMinute, 0, 0)

  const venueEnd = new Date()
  const [endHour, endMinute] = tournament.venueHours[1].split(":").map(Number)
  venueEnd.setHours(endHour, endMinute, 0, 0)
  
  // Calculate morning and afternoon boundaries
  const morningStart = new Date(venueStart);
  const midDay = new Date(venueStart);
  midDay.setHours(12, 0, 0, 0);
  const afternoonEnd = new Date(venueEnd);
  
  // Define dynamic time slots based on venue hours
  const morningHours = (midDay - morningStart) / (60 * 60 * 1000);
  const afternoonHours = (afternoonEnd - midDay) / (60 * 60 * 1000);
  
  // Create morning slots - divide morning hours into 3 slots
  const morningTimeSlots = [];
  if (morningHours > 0) {
    const morningSlotInterval = morningHours / 3;
    for (let i = 0; i < 3; i++) {
      const slotTime = new Date(morningStart);
      slotTime.setHours(slotTime.getHours() + (morningSlotInterval * i));
      morningTimeSlots.push({ 
        hours: slotTime.getHours(), 
        minutes: slotTime.getMinutes() 
      });
    }
  }
  
  // Create afternoon slots - divide afternoon hours into 3 slots
  const afternoonTimeSlots = [];
  if (afternoonHours > 0) {
    const afternoonSlotInterval = afternoonHours / 3;
    for (let i = 0; i < 3; i++) {
      const slotTime = new Date(midDay);
      slotTime.setHours(slotTime.getHours() + (afternoonSlotInterval * i));
      afternoonTimeSlots.push({ 
        hours: slotTime.getHours(), 
        minutes: slotTime.getMinutes() 
      });
    }
  }
  
  // For whole day option, combine all slots
  const wholeDayTimeSlots = [...morningTimeSlots, ...afternoonTimeSlots];

  // Track slot indices based on user preference
  const mlTimeSlot = tournament.timeSlots?.mobileLegends || "morning";
  const valTimeSlot = tournament.timeSlots?.valorant || "afternoon";
  
  // Track slot usage
  let usedMorningSlots = 0;
  let usedAfternoonSlots = 0;
  let usedWholeDaySlots = 0;

  // Determine average durations
  const mlSingleMatchDuration = (tournament.mlDuration[0] + tournament.mlDuration[1]) / 2
  const valSingleMatchDuration = (tournament.valDuration[0] + tournament.valDuration[1]) / 2
  
  // Calculate durations based on match format
  let mlMatchDuration, valMatchDuration
  if (tournament.matchFormat === "bo1") {
    mlMatchDuration = mlSingleMatchDuration
    valMatchDuration = valSingleMatchDuration
  } else if (tournament.matchFormat === "bo3") {
    mlMatchDuration = mlSingleMatchDuration * 2 // Assuming avg 2 games (2-0 or 2-1)
    valMatchDuration = valSingleMatchDuration * 2
  } else if (tournament.matchFormat === "bo5") {
    mlMatchDuration = mlSingleMatchDuration * 3 // Assuming avg 3 games
    valMatchDuration = valSingleMatchDuration * 3
  } else if (tournament.matchFormat === "bo7") {
    mlMatchDuration = mlSingleMatchDuration * 4 // Assuming avg 4 games
    valMatchDuration = valSingleMatchDuration * 4
  }
  
  // Generate match pairs for each game type
  const mlMatchPairs = []
  const valMatchPairs = []
  
  // Create match pairs based on tournament format
  if (tournament.enabledGames.mobileLegends) {
    createMatchesBasedOnFormat(mlMatchPairs, mlTeams, "ML", tournament.format);
  }
  
  if (tournament.enabledGames.valorant) {
    createMatchesBasedOnFormat(valMatchPairs, valTeams, "Val", tournament.format);
  }
  
  // Function to create matches based on tournament format
  function createMatchesBasedOnFormat(matchPairs, teams, gameType, format) {
    if (format === "single-elimination") {
      createSingleEliminationMatches(matchPairs, teams, gameType);
    } else if (format === "double-elimination") {
      createDoubleEliminationMatches(matchPairs, teams, gameType);
    } else {
      // Fallback to simple bracket if format not supported
      createSimpleBracket(matchPairs, teams, gameType);
    }
  }
  
  // Create single elimination tournament
  function createSingleEliminationMatches(matchPairs, teams, gameType) {
    const teamCount = teams.length;
    
    if (teamCount < 2) return;
    
    // Determine rounds based on team count
    // For 4 teams: 2 rounds (semifinals, finals)
    // For 8 teams: 3 rounds (quarterfinals, semifinals, finals)
    // For 16 teams: 4 rounds (round of 16, quarterfinals, semifinals, finals)
    // For 32 teams: 5 rounds (round of 32, round of 16, quarterfinals, semifinals, finals)
    const rounds = Math.log2(teamCount);
    
    console.log(`Creating ${gameType} Single Elimination bracket with ${teamCount} teams, ${rounds} rounds`);
    
    // First round matches
    for (let i = 0; i < teamCount; i += 2) {
      if (i + 1 < teamCount) {
        matchPairs.push({
          team1: teams[i],
          team2: teams[i + 1],
          roundNumber: 1,
          bracketType: getRoundNameByTeamCount(teamCount, 1),
          gameType: gameType
        });
      }
    }
    
    // Generate subsequent rounds based on team count
    if (teamCount >= 4) {
      // Create additional rounds
      for (let round = 2; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        
        for (let match = 0; match < matchesInRound; match++) {
          const winnerName1 = `${gameType} R${round-1} W${match*2 + 1}`;
          const winnerName2 = `${gameType} R${round-1} W${match*2 + 2}`;
          
          matchPairs.push({
            team1: { ...teams[0], name: winnerName1 },
            team2: { ...teams[0], name: winnerName2 },
            roundNumber: round,
            bracketType: getRoundNameByTeamCount(teamCount, round),
            gameType: gameType
          });
        }
      }
    }
  }
  
  // Create double elimination tournament
  function createDoubleEliminationMatches(matchPairs, teams, gameType) {
    const teamCount = teams.length;
    
    if (teamCount < 2) return;
    
    // Determine rounds based on team count
    const upperRounds = Math.log2(teamCount);
    let totalMatches = 0;
    
    console.log(`Creating ${gameType} Double Elimination bracket with ${teamCount} teams, upperRounds: ${upperRounds}`);
    
    // Upper bracket first round matches
    console.log(`Creating ${teamCount/2} Upper Bracket First Round matches`);
    for (let i = 0; i < teamCount; i += 2) {
      if (i + 1 < teamCount) {
        matchPairs.push({
          team1: teams[i],
          team2: teams[i + 1],
          roundNumber: 1,
          bracketType: "Upper Bracket First Round",
          gameType: gameType
        });
        totalMatches++;
      }
    }
    
    // Upper bracket subsequent rounds
    for (let round = 2; round <= upperRounds; round++) {
      const matchesInRound = Math.pow(2, upperRounds - round);
      
      console.log(`Creating ${matchesInRound} Upper Bracket Round ${round} matches`);
      
      for (let match = 0; match < matchesInRound; match++) {
        const winnerName1 = `${gameType} UB R${round-1} W${match*2 + 1}`;
        const winnerName2 = `${gameType} UB R${round-1} W${match*2 + 2}`;
        
        let bracketType;
        if (round === 2 && upperRounds === 2) { // 4 teams
          bracketType = "Upper Bracket Finals";
        } else if (round === 2 && upperRounds === 3) { // 8 teams
          bracketType = "Upper Bracket Semifinals";
        } else if (round === 3 && upperRounds === 3) { // 8 teams
          bracketType = "Upper Bracket Finals";
        } else if (round === 2 && upperRounds === 4) { // 16 teams
          bracketType = "Upper Bracket Quarterfinals";
        } else if (round === 3 && upperRounds === 4) { // 16 teams
          bracketType = "Upper Bracket Semifinals";
        } else if (round === 4 && upperRounds === 4) { // 16 teams
          bracketType = "Upper Bracket Finals";
        } else {
          bracketType = `Upper Bracket Round ${round}`;
        }
        
        matchPairs.push({
          team1: { ...teams[0], name: winnerName1 },
          team2: { ...teams[0], name: winnerName2 },
          roundNumber: round,
          bracketType: bracketType,
          gameType: gameType
        });
        totalMatches++;
      }
    }
    
    // Lower bracket matches
    // For 4 teams: 2 lower bracket matches (loser's round 1, lower bracket finals)
    // For 8 teams: 6 lower bracket matches (2 LR1, 2 LR2, 1 semifinals, 1 LBF)
    // For 16 teams: 11 lower bracket matches (4 LR1, 4 LR2, 2 LR3, 1 LBF)
    
    // First lower bracket round (losers from first upper bracket)
    let lowerRound1Matches = teamCount / 4; // Default calculation
    
    // For 8 teams, we need exactly 2 matches in LR1
    if (teamCount === 8) {
      lowerRound1Matches = 2;
    } else if (teamCount === 16) {
      lowerRound1Matches = 4;
    }
    
    console.log(`Creating ${lowerRound1Matches} Lower Bracket Losers' Round 1 matches`);
    for (let i = 0; i < lowerRound1Matches; i++) {
      matchPairs.push({
        team1: { ...teams[0], name: `${gameType} UB R1 L${i*2 + 1}` },
        team2: { ...teams[0], name: `${gameType} UB R1 L${i*2 + 2}` },
        roundNumber: upperRounds + 1, // Put after upper bracket rounds
        bracketType: "Lower Bracket Losers' Round 1",
        gameType: gameType
      });
      totalMatches++;
    }
    
    // Initialize lower round 2 matches variable with a default value of 0
    let lowerRound2Matches = 0;
    
    // Additional lower bracket rounds vary by team count
    if (teamCount >= 8) {
      // Lower bracket round 2
      lowerRound2Matches = lowerRound1Matches;
      
      // For 8 teams, we need exactly 2 matches in LR2
      if (teamCount === 8) {
        lowerRound2Matches = 2;
      }
      
      console.log(`Creating ${lowerRound2Matches} Lower Bracket Losers' Round 2 matches`);
      for (let i = 0; i < lowerRound2Matches; i++) {
        matchPairs.push({
          team1: { ...teams[0], name: `${gameType} LB R1 W${i+1}` },
          team2: { ...teams[0], name: `${gameType} UB R2 L${i+1}` },
          roundNumber: upperRounds + 2,
          bracketType: "Lower Bracket Losers' Round 2",
          gameType: gameType
        });
        totalMatches++;
      }
      
      // For 8 teams, add Loser's Semifinals (match between the two losers' round 2 winners)
      if (teamCount === 8) {
        console.log(`Creating Loser's Semifinals match`);
        matchPairs.push({
          team1: { ...teams[0], name: `${gameType} LB R2 W1` },
          team2: { ...teams[0], name: `${gameType} LB R2 W2` },
          roundNumber: upperRounds + 3,
          bracketType: "Losers' Semifinals",
          gameType: gameType
        });
        totalMatches++;
      }
      
      // Continue with additional lower bracket rounds for 16+ teams
      if (teamCount >= 16) {
        // Lower bracket round 3
        const lowerRound3Matches = lowerRound2Matches / 2;
        console.log(`Creating ${lowerRound3Matches} Lower Bracket Losers' Round 3 matches`);
        for (let i = 0; i < lowerRound3Matches; i++) {
          matchPairs.push({
            team1: { ...teams[0], name: `${gameType} LB R2 W${i*2 + 1}` },
            team2: { ...teams[0], name: `${gameType} LB R2 W${i*2 + 2}` },
            roundNumber: upperRounds + 3,
            bracketType: "Lower Bracket Losers' Round 3",
            gameType: gameType
          });
          totalMatches++;
        }
      }
    }
    
    // Lower bracket finals
    console.log('Creating Lower Bracket Finals match');
    
    // Determine the correct opponent for Lower Bracket Finals based on team count
    let lbFinalsOpponent1;
    if (teamCount === 4) {
      lbFinalsOpponent1 = `${gameType} LB R1 W1`;
    } else if (teamCount === 8) {
      lbFinalsOpponent1 = `${gameType} LB Semifinals W`;
    } else if (teamCount >= 16) {
      lbFinalsOpponent1 = `${gameType} LB Last Round W`;
    }
    
    matchPairs.push({
      team1: { ...teams[0], name: lbFinalsOpponent1 },
      team2: { ...teams[0], name: `${gameType} UB Finals L` },
      roundNumber: upperRounds + (teamCount >= 16 ? 4 : (teamCount >= 8 ? 4 : 2)),
      bracketType: "Lower Bracket Finals",
      gameType: gameType
    });
    totalMatches++;
    
    // Grand finals
    console.log('Creating Grand Finals match');
    matchPairs.push({
      team1: { ...teams[0], name: `${gameType} UB Finals W` },
      team2: { ...teams[0], name: `${gameType} LB Finals W` },
      roundNumber: upperRounds + (teamCount >= 16 ? 5 : (teamCount >= 8 ? 5 : 3)),
      bracketType: "Grand Finals",
      gameType: gameType
    });
    totalMatches++;
    
    // Verify expected matches
    let expectedMatches = 0;
    if (teamCount === 4) {
      expectedMatches = 6; // 2 upper first round + 1 upper finals + 1 lower round 1 + 1 lower finals + 1 grand finals
    } else if (teamCount === 8) {
      expectedMatches = 14; // 4 upper first round + 2 upper semifinals + 1 upper finals + 2 lower round 1 + 2 lower round 2 + 1 losers semifinals + 1 lower finals + 1 grand finals
    } else if (teamCount === 16) {
      expectedMatches = 27; // 8 upper bracket + 18 lower bracket + 1 grand finals
    }
    
    console.log(`Created ${totalMatches} matches for ${gameType} Double Elimination, expected: ${expectedMatches}`);
    if (totalMatches !== expectedMatches) {
      console.warn(`MISMATCH: Created ${totalMatches} matches but expected ${expectedMatches}`);
      
      // For 8 teams, explicitly count each category
      if (teamCount === 8) {
        const ub1 = 4; // Always 4 for 8 teams
        const ub2 = 2; // Always 2 for 8 teams
        const ub3 = 1; // Always 1 for 8 teams
        const lb1 = lowerRound1Matches; // Should be 2
        const lb2 = lowerRound2Matches; // Should be 2
        const lbSemis = 1; // Should be 1
        const lbf = 1; // Always 1
        const gf = 1; // Always 1
        console.log(`8-team breakdown: UB1(${ub1}) + UB2(${ub2}) + UB3(${ub3}) + LB1(${lb1}) + LB2(${lb2}) + LBSemis(${lbSemis}) + LBF(${lbf}) + GF(${gf}) = ${ub1+ub2+ub3+lb1+lb2+lbSemis+lbf+gf}`);
      }
    }
  }
  
  // Simple bracket creation (fallback)
  function createSimpleBracket(matchPairs, teams, gameType) {
    for (let i = 0; i < teams.length; i += 2) {
      if (i + 1 < teams.length) {
        matchPairs.push({
          team1: teams[i],
          team2: teams[i + 1],
          roundNumber: 1,
          gameType: gameType
        });
      }
    }
    
    // Add semifinals if enough teams
    if (teams.length >= 4) {
      matchPairs.push({
        team1: { ...teams[0], name: `${gameType} Winner 1` },
        team2: { ...teams[0], name: `${gameType} Winner 2` },
        roundNumber: 2,
        description: `${gameType} Semifinal`,
        gameType: gameType
      });
    }
  }
  
  // Get round name based on team count and round number
  function getRoundNameByTeamCount(teamCount, round) {
    const totalRounds = Math.log2(teamCount);
    const roundsFromFinal = totalRounds - round;
    
    if (roundsFromFinal === 0) return "Finals";
    if (roundsFromFinal === 1) return "Semifinals";
    if (roundsFromFinal === 2) return "Quarterfinals";
    if (roundsFromFinal === 3) return "Round of 16";
    if (roundsFromFinal === 4) return "Round of 32";
    
    return `Round ${round}`;
  }
  
  // Generate matches using time slot preferences
  function createMatchesForGameType(matchPairs, gameType, preferredTimeSlot, duration) {
    console.log(`Starting createMatchesForGameType for ${gameType} with ${matchPairs.length} match pairs`);
    
    // Select the appropriate time slots based on preference
    let timeSlots;
    let slotIndex;
    
    if (preferredTimeSlot === "morning") {
      timeSlots = morningTimeSlots;
      slotIndex = usedMorningSlots;
    } else if (preferredTimeSlot === "afternoon") {
      timeSlots = afternoonTimeSlots;
      slotIndex = usedAfternoonSlots;
    } else if (preferredTimeSlot === "wholeday") {
      timeSlots = wholeDayTimeSlots;
      slotIndex = usedWholeDaySlots;
    }
    
    // Create dynamic number of time slots if needed
    if (matchPairs.length > (timeSlots ? timeSlots.length : 0)) {
      console.log(`Need more time slots: ${matchPairs.length} matches but only ${timeSlots ? timeSlots.length : 0} slots`);
      
      // Create more slots dynamically
      if (preferredTimeSlot === "morning" || preferredTimeSlot === "wholeday") {
        const extraSlots = matchPairs.length - morningTimeSlots.length;
        if (extraSlots > 0) {
          for (let i = 0; i < extraSlots; i++) {
            const baseTime = morningTimeSlots.length > 0 
              ? new Date(venueStart.getTime() + (morningTimeSlots.length * 30 * 60000))
              : new Date(venueStart);
            const newSlot = {
              hours: baseTime.getHours(),
              minutes: baseTime.getMinutes()
            };
            morningTimeSlots.push(newSlot);
            if (preferredTimeSlot === "wholeday") {
              wholeDayTimeSlots.push(newSlot);
            }
          }
          console.log(`Added ${extraSlots} extra morning slots, total now: ${morningTimeSlots.length}`);
        }
      }
      
      if (preferredTimeSlot === "afternoon" || preferredTimeSlot === "wholeday") {
        const extraSlots = matchPairs.length - afternoonTimeSlots.length;
        if (extraSlots > 0) {
          for (let i = 0; i < extraSlots; i++) {
            const baseTime = afternoonTimeSlots.length > 0 
              ? new Date(midDay.getTime() + (afternoonTimeSlots.length * 30 * 60000))
              : new Date(midDay);
            const newSlot = {
              hours: baseTime.getHours(),
              minutes: baseTime.getMinutes()
            };
            afternoonTimeSlots.push(newSlot);
            if (preferredTimeSlot === "wholeday") {
              wholeDayTimeSlots.push(newSlot);
            }
          }
          console.log(`Added ${extraSlots} extra afternoon slots, total now: ${afternoonTimeSlots.length}`);
        }
      }
      
      // Update the time slots reference
      if (preferredTimeSlot === "morning") {
        timeSlots = morningTimeSlots;
      } else if (preferredTimeSlot === "afternoon") {
        timeSlots = afternoonTimeSlots;
      } else if (preferredTimeSlot === "wholeday") {
        timeSlots = wholeDayTimeSlots;
      }
    }
    
    // Start times for all matches
    let lastEndTime = null;
    let processedCount = 0;
    
    // Make sure we process all matches regardless of time slot availability
    for (const matchPair of matchPairs) {
      // Create start time based on previous match or time slot
      let startTime;
      
      if (matches.length === 0 || lastEndTime === null) {
        // For first match, use the predefined time slot or default to venue start
        if (timeSlots && slotIndex < timeSlots.length) {
          const timeSlot = timeSlots[slotIndex];
          startTime = new Date(venueStart);
          startTime.setHours(timeSlot.hours, timeSlot.minutes, 0, 0);
        } else {
          startTime = new Date(venueStart);
          // Add 30 minutes for each match we've already created
          startTime.setMinutes(startTime.getMinutes() + (processedCount * 30));
        }
      } else {
        // For subsequent matches, use minimum buffer time after previous match
        startTime = new Date(lastEndTime);
        startTime.setMinutes(startTime.getMinutes() + 5); // 5-minute minimum buffer
      }
      
      // Calculate end time
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);
      
      // Create match
      const match = {
        id: `M${matches.length + 1}`,
        team1: matchPair.team1,
        team2: matchPair.team2,
        duration: duration,
        gameType: matchPair.gameType || gameType,
        roundNumber: matchPair.roundNumber,
        bracketType: matchPair.bracketType || "",
        startTime: startTime,
        endTime: endTime,
        description: matchPair.description || ""
      };
      
      matches.push(match);
      processedCount++;
      
      // Update lastEndTime for the next match
      lastEndTime = new Date(endTime);
      
      // Increment the appropriate slot counter
      if (preferredTimeSlot === "morning" && slotIndex < morningTimeSlots.length) {
        usedMorningSlots++;
        slotIndex++;
      } else if (preferredTimeSlot === "afternoon" && slotIndex < afternoonTimeSlots.length) {
        usedAfternoonSlots++;
        slotIndex++;
      } else if (preferredTimeSlot === "wholeday" && slotIndex < wholeDayTimeSlots.length) {
        usedWholeDaySlots++;
        slotIndex++;
      }
    }
    
    console.log(`Created ${processedCount} matches for ${gameType}`);
  }
  
  // Create matches according to preferences
  if (tournament.enabledGames.mobileLegends) {
    console.log("ML Match Pairs before createMatchesForGameType:", mlMatchPairs.length);
    createMatchesForGameType(mlMatchPairs, "ML", mlTimeSlot, mlMatchDuration);
    console.log("Final ML matches generated:", matches.filter(m => m.gameType === "ML").length);
  }
  
  if (tournament.enabledGames.valorant) {
    console.log("Val Match Pairs before createMatchesForGameType:", valMatchPairs.length);
    createMatchesForGameType(valMatchPairs, "Val", valTimeSlot, valMatchDuration);
    console.log("Final Val matches generated:", matches.filter(m => m.gameType === "Val").length);
  }
  
  console.log("All match pairs created:", mlMatchPairs.length + valMatchPairs.length);
  console.log("Total matches generated:", matches.length);
  console.log("Tournament format:", tournament.format);
  return { matches };
}

// Update schedule display
function updateScheduleDisplay() {
  if (!state.schedule) {
    noScheduleMessage.style.display = "block"
    scheduleTableView.style.display = "none"
    scheduleTimelineView.style.display = "none"
    document.getElementById("schedule-view-controls").style.display = "none"
    return
  }

  noScheduleMessage.style.display = "none"
  document.getElementById("schedule-view-controls").style.display = "flex"

  // Group matches by game type, round, and bracket
  const groupedMatches = {};
  
  state.schedule.matches.forEach(match => {
    const { gameType, roundNumber, bracketType } = match;
    
    if (!groupedMatches[gameType]) {
      groupedMatches[gameType] = {};
    }
    
    if (!groupedMatches[gameType][roundNumber]) {
      groupedMatches[gameType][roundNumber] = {};
    }
    
    if (!groupedMatches[gameType][roundNumber][bracketType]) {
      groupedMatches[gameType][roundNumber][bracketType] = [];
    }
    
    groupedMatches[gameType][roundNumber][bracketType].push(match);
  });

  // Get match format info
  let matchFormatLabel;
  switch(state.tournament.matchFormat) {
    case "bo1":
      matchFormatLabel = "Best of 1";
      break;
    case "bo3":
      matchFormatLabel = "Best of 3";
      break;
    case "bo5":
      matchFormatLabel = "Best of 5";
      break;
    case "bo7":
      matchFormatLabel = "Best of 7";
      break;
    default:
      matchFormatLabel = "Best of 3";
  }

  // Generate HTML for all matches grouped by game, round, and bracket
  let tableViewHTML = '';
  
  // First Mobile Legends matches
  if (groupedMatches["ML"]) {
    tableViewHTML += `<div class="game-section"><h2>Mobile Legends Matches</h2>`;
    
    Object.keys(groupedMatches["ML"]).sort((a, b) => Number(a) - Number(b)).forEach(roundNumber => {
      Object.keys(groupedMatches["ML"][roundNumber]).forEach(bracketType => {
        const matches = groupedMatches["ML"][roundNumber][bracketType];
        
        if (matches.length > 0) {
          tableViewHTML += `
        <div class="round-section">
                <h3 class="round-title">${getRoundName(Number(roundNumber), bracketType)}</h3>
            <table>
                <thead>
                    <tr>
                        <th>Match</th>
                        <th>Teams</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Duration</th>
                            <th>Format</th>
                    </tr>
                </thead>
                <tbody>
                        ${matches
                      .sort((a, b) => a.startTime - b.startTime)
                      .map(
                        (match) => `
                            <tr>
                                <td>${match.id}</td>
                                <td>${match.team1.name} vs ${match.team2.name}</td>
                                <td>${formatTime(match.startTime)}</td>
                                <td>${formatTime(match.endTime)}</td>
                                <td>${match.duration} min</td>
                                    <td>${matchFormatLabel}</td>
                            </tr>
                        `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
          `;
        }
      });
    });
    
    tableViewHTML += `</div>`;
  }
  
  // Then Valorant matches
  if (groupedMatches["Val"]) {
    tableViewHTML += `<div class="game-section"><h2>Valorant Matches</h2>`;
    
    Object.keys(groupedMatches["Val"]).sort((a, b) => Number(a) - Number(b)).forEach(roundNumber => {
      Object.keys(groupedMatches["Val"][roundNumber]).forEach(bracketType => {
        const matches = groupedMatches["Val"][roundNumber][bracketType];
        
        if (matches.length > 0) {
          tableViewHTML += `
            <div class="round-section">
                <h3 class="round-title">${getRoundName(Number(roundNumber), bracketType)}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Match</th>
                            <th>Teams</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                            <th>Format</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matches
                          .sort((a, b) => a.startTime - b.startTime)
                          .map(
                            (match) => `
                                <tr>
                                    <td>${match.id}</td>
                                    <td>${match.team1.name} vs ${match.team2.name}</td>
                                    <td>${formatTime(match.startTime)}</td>
                                    <td>${formatTime(match.endTime)}</td>
                                    <td>${match.duration} min</td>
                                    <td>${matchFormatLabel}</td>
                                </tr>
                            `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
          `;
        }
      });
    });
    
    tableViewHTML += `</div>`;
  }
  
  // Update the table view
  scheduleTableView.innerHTML = tableViewHTML;

  // Update timeline view - shows all matches sorted by time
  const sortedMatches = [...state.schedule.matches].sort((a, b) => a.startTime - b.startTime);

  scheduleTimelineView.innerHTML = `
        <div class="timeline">
            ${sortedMatches
              .map(
                (match) => `
                <div class="timeline-item ${match.gameType === "ML" ? "mobile-legends" : "valorant"}">
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="badge ${match.gameType === "ML" ? "badge-primary" : "badge-danger"}">
                                ${match.gameType === "ML" ? "Mobile Legends" : "Valorant"}
                            </span>
                            <span>${formatTime(match.startTime)} - ${formatTime(match.endTime)}</span>
                        </div>
                        <h4>Match ${match.id}: ${match.team1.name} vs ${match.team2.name}</h4>
                        <div>
                      Duration: ${match.duration} minutes (${matchFormatLabel})
                      ${
                        match.bracketType
                          ? `<span class="badge ${match.bracketType.includes('Upper') ? 'badge-primary' : 'badge-secondary'}">${match.bracketType}</span>`
                          : match.roundNumber === 3
                          ? `<span class="badge badge-secondary">Finals</span>`
                          : ''
                            }
                        </div>
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>
  `;

  // Update view
  updateScheduleView()
}

// Update schedule view based on selected view
function updateScheduleView() {
  scheduleViewButtons.forEach((button) => {
    if (button.dataset.view === state.scheduleView) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })

  if (state.scheduleView === "table") {
    scheduleTableView.classList.add("active")
    scheduleTimelineView.classList.remove("active")
  } else {
    scheduleTableView.classList.remove("active")
    scheduleTimelineView.classList.add("active")
  }
}

// Update disruption form based on selected type
function updateDisruptionForm() {
  const type = disruptionTypeSelect.value
  const extraMinutesHelp = document.getElementById("extraMinutesHelp")

  if (type === "extended_duration") {
    extraMinutesHelp.textContent = "How many minutes longer the match ran than expected"
  } else if (type === "late_arrival") {
    extraMinutesHelp.textContent = "How many minutes late the team arrived"
  } else if (type === "early_finish") {
    extraMinutesHelp.textContent = "How many minutes earlier the match finished than expected"
  }
}

// Populate match select dropdown
function populateMatchSelect() {
  if (!state.schedule) return

  matchIdSelect.innerHTML = '<option value="">Select match</option>'

  state.schedule.matches.forEach((match) => {
    // Check if this match already has a disruption
    const hasDisruption = state.disruptions.some((d) => d.match.id === match.id)

    const option = document.createElement("option")
    option.value = match.id
    option.textContent = `${match.id}: ${match.team1.name} vs ${match.team2.name}`

    if (hasDisruption) {
      option.disabled = true
      option.textContent += " (already disrupted)"
    }

    matchIdSelect.appendChild(option)
  })
}

// Handle disruption form submission
function handleDisruptionSubmit(e) {
  e.preventDefault()

  const formData = new FormData(disruptionForm)
  const matchId = formData.get("matchId")
  const type = formData.get("disruptionType")
  const extraMinutes = Number.parseInt(formData.get("extraMinutes"))
  let description = formData.get("description")

  // Find the match
  const match = state.schedule.matches.find((m) => m.id === matchId)
  if (!match) {
    showError("Match not found")
    return
  }

  // Generate default description if not provided
  if (!description) {
    if (type === "extended_duration") {
      description = `Match ${matchId} ran ${extraMinutes} minutes longer than expected.`
    } else if (type === "late_arrival") {
      description = `Team arrived ${extraMinutes} minutes late for match ${matchId}.`
    } else if (type === "early_finish") {
      description = `Match ${matchId} finished ${extraMinutes} minutes earlier than expected.`
    }
  }

  // Create disruption object
  const disruption = {
    id: `D${state.disruptions.length + 1}`,
    type,
    match,
    extraMinutes,
    description,
  }

  // Add disruption to state
  state.disruptions.push(disruption)

  // Update UI
  updateDisruptionTable()
  updateDisruptionCount()

  // Reset form
  disruptionForm.reset()
  disruptionTypeSelect.value = "extended_duration"
  document.getElementById("extraMinutes").value = "15"
  updateDisruptionForm()

  // Repopulate match select
  populateMatchSelect()

  // Enable adjust schedule button
  adjustScheduleBtn.disabled = false
}

// Update disruption table
function updateDisruptionTable() {
  if (state.disruptions.length === 0) {
    disruptionTableBody.innerHTML = ""
    noDisruptionsMessage.style.display = "block"
    return
  }

  noDisruptionsMessage.style.display = "none"

  disruptionTableBody.innerHTML = state.disruptions
    .map(
      (disruption, index) => `
        <tr>
            <td>${disruption.id}</td>
            <td>${disruption.match.id}</td>
            <td>
                <span class="badge ${disruption.type === "extended_duration" ? "badge-primary" : disruption.type === "early_finish" ? "badge-success" : "badge-secondary"}">
                    ${disruption.type === "extended_duration" ? "Extended Duration" : disruption.type === "early_finish" ? "Early Finish" : "Late Arrival"}
                </span>
            </td>
            <td>${disruption.extraMinutes} min</td>
            <td>${disruption.description}</td>
            <td>
                <button class="btn" onclick="removeDisruption(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

// Remove a disruption
function removeDisruption(index) {
  // Remove disruption from state
  state.disruptions.splice(index, 1)

  // Update UI
  updateDisruptionTable()
  updateDisruptionCount()

  // Repopulate match select
  populateMatchSelect()

  // Disable adjust schedule button if no disruptions
  if (state.disruptions.length === 0) {
    adjustScheduleBtn.disabled = true
    
    // Reset adjusted schedule if all disruptions are removed
    state.adjustedSchedule = null;
    
    // If we're on the adjusted tab, switch back to disruptions tab
    if (state.activeTab === "adjusted") {
      showTab("disruptions");
    }
  }
}

// Update disruption count
function updateDisruptionCount() {
  disruptionCount.textContent = `${state.disruptions.length} disruption${state.disruptions.length !== 1 ? "s" : ""} added`
}

// Handle adjust schedule button
function handleAdjustSchedule() {
  if (state.isAdjusting) return

  state.isAdjusting = true
  adjustScheduleBtn.disabled = true
  adjustScheduleBtn.textContent = "Adjusting Schedule..."

  showLoading("Adjusting schedule...")

  // Simulate API call delay
  setTimeout(() => {
    try {
      // Reset the adjusted schedule completely before recalculating
      state.adjustedSchedule = null;
      
      // Adjust schedule fresh from the original schedule and current disruptions
      state.adjustedSchedule = adjustSchedule(state.tournament, state.schedule, state.disruptions)

      // Update UI with recalculated metrics
      updateAdjustedScheduleDisplay()

      // Enable adjusted tab
      enableTab("adjusted")

      // Switch to adjusted tab
      showTab("adjusted")
    } catch (error) {
      showError("Failed to adjust schedule: " + error.message)
    } finally {
      state.isAdjusting = false
      adjustScheduleBtn.disabled = false
      adjustScheduleBtn.textContent = "Adjust Schedule"
      hideLoading()
    }
  }, 2000)
}

// Adjust schedule (mock implementation)
function adjustSchedule(tournament, schedule, disruptions) {
  console.log("Starting fresh schedule adjustment with", disruptions.length, "disruptions");
  
  // Create a deep copy of the original schedule
  const adjustedSchedule = {
    matches: JSON.parse(JSON.stringify(schedule.matches)),
  }

  // Convert string dates back to Date objects
  adjustedSchedule.matches = adjustedSchedule.matches.map((match) => ({
    ...match,
    startTime: new Date(match.startTime),
    endTime: new Date(match.endTime),
    // Store original times for reference
    originalStartTime: new Date(match.startTime),
    originalEndTime: new Date(match.endTime)
  }))

  // Parse venue hours for reference
  const venueStart = new Date()
  const [startHour, startMinute] = tournament.venueHours[0].split(":").map(Number)
  venueStart.setHours(startHour, startMinute, 0, 0)
  
  const venueEnd = new Date()
  const [endHour, endMinute] = tournament.venueHours[1].split(":").map(Number)
  venueEnd.setHours(endHour, endMinute, 0, 0)
  
  // Calculate morning and afternoon boundaries
  const morningStart = new Date(venueStart);
  const midDay = new Date(venueStart);
  midDay.setHours(12, 0, 0, 0);
  const afternoonEnd = new Date(venueEnd);
  
  // Define dynamic time slots based on venue hours
  const morningHours = (midDay - morningStart) / (60 * 60 * 1000);
  const afternoonHours = (afternoonEnd - midDay) / (60 * 60 * 1000);
  
  // Create morning slots - divide morning hours into 3 slots
  const morningTimeSlots = [];
  if (morningHours > 0) {
    const morningSlotInterval = morningHours / 3;
    for (let i = 0; i < 3; i++) {
      const slotTime = new Date(morningStart);
      slotTime.setHours(slotTime.getHours() + (morningSlotInterval * i));
      morningTimeSlots.push(slotTime);
    }
  }
  
  // Create afternoon slots - divide afternoon hours into 3 slots
  const afternoonTimeSlots = [];
  if (afternoonHours > 0) {
    const afternoonSlotInterval = afternoonHours / 3;
    for (let i = 0; i < 3; i++) {
      const slotTime = new Date(midDay);
      slotTime.setHours(slotTime.getHours() + (afternoonSlotInterval * i));
      afternoonTimeSlots.push(slotTime);
    }
  }
  
  // For whole day option, combine all slots
  const allTimeSlots = [...morningTimeSlots, ...afternoonTimeSlots].sort((a, b) => a - b); // Sort chronologically

  // Store original match order for reference
  const originalMatchOrder = [...adjustedSchedule.matches]
    .sort((a, b) => a.startTime - b.startTime)
    .map(match => match.id);

  console.log("Original match order:", originalMatchOrder);

  // Apply disruptions
  for (const disruption of disruptions) {
    const matchIndex = adjustedSchedule.matches.findIndex((m) => m.id === disruption.match.id)

    if (matchIndex !== -1) {
      const match = adjustedSchedule.matches[matchIndex]
      console.log(`Applying ${disruption.type} to match ${match.id}`);

      if (disruption.type === "extended_duration") {
        // Save original end time
        const originalEndTime = new Date(match.endTime);
        
        // Extend match duration
        match.duration += disruption.extraMinutes
        
        // Recalculate end time precisely from start time plus duration
        match.endTime = new Date(match.startTime.getTime() + (match.duration * 60000))
        
        console.log(`Match ${match.id} extended from ${originalEndTime.toLocaleTimeString()} to ${match.endTime.toLocaleTimeString()}`);
        console.log(`This match now runs ${disruption.extraMinutes} minutes longer (${match.duration} total)`);
      } else if (disruption.type === "late_arrival") {
        // Save original times
        const originalStartTime = new Date(match.startTime);
        const originalEndTime = new Date(match.endTime);
        
        // Delay match start time
        match.startTime = new Date(originalStartTime.getTime() + (disruption.extraMinutes * 60000))
        
        // Recalculate end time precisely from new start time plus duration
        match.endTime = new Date(match.startTime.getTime() + (match.duration * 60000))
        
        console.log(`Match ${match.id} delayed from ${originalStartTime.toLocaleTimeString()} to ${match.startTime.toLocaleTimeString()}`);
        console.log(`This results in end time changing from ${originalEndTime.toLocaleTimeString()} to ${match.endTime.toLocaleTimeString()}`);
      } else if (disruption.type === "early_finish") {
        // Save original end time
        const originalEndTime = new Date(match.endTime);
        const originalDuration = match.duration;
        
        // Reduce match duration (finished earlier than expected)
        match.duration = Math.max(9, originalDuration - disruption.extraMinutes);
        
        // Recalculate end time precisely from start time plus new duration
        match.endTime = new Date(match.startTime.getTime() + (match.duration * 60000))
        
        console.log(`Match ${match.id} finished early at ${match.endTime.toLocaleTimeString()} instead of ${originalEndTime.toLocaleTimeString()}`);
        console.log(`This match is now ${disruption.extraMinutes} minutes shorter (${match.duration} total)`);
        
        // Store the match id that finished early so we can optimize
        // subsequent matches to start earlier when possible
        match.finishedEarly = true
      }
    }
  }

  // First adjust teams with disruptions
  // Sort matches by start time (original schedule order)
  adjustedSchedule.matches.sort((a, b) => a.originalStartTime - b.originalStartTime)

  // Propagate changes through the schedule
  for (let i = 0; i < adjustedSchedule.matches.length - 1; i++) {
    const currentMatch = adjustedSchedule.matches[i];
    const nextMatch = adjustedSchedule.matches[i + 1];
    
    // Calculate minimum start time for next match based on current match end time + rest period
    const teamsOverlap =
      currentMatch.team1.id === nextMatch.team1.id ||
      currentMatch.team1.id === nextMatch.team2.id ||
      currentMatch.team2.id === nextMatch.team1.id ||
      currentMatch.team2.id === nextMatch.team2.id;
    
    // Calculate required buffer time
    const bufferMinutes = teamsOverlap ? tournament.restPeriod : 5; // 5 min minimum buffer if no team overlap
    
    // Calculate minimum start time precisely
    const minStartTime = new Date(currentMatch.endTime.getTime() + (bufferMinutes * 60000));
    
    console.log(`Match ${nextMatch.id} current start: ${nextMatch.startTime.toLocaleTimeString()}, min start: ${minStartTime.toLocaleTimeString()}`);
    
    // Check if next match needs to be adjusted (slide forward to minimize idle time)
    if (minStartTime > nextMatch.startTime) {
      // Slide the match as early as possible (use minStartTime)
      const newStartTime = new Date(minStartTime);
      console.log(`Moving match ${nextMatch.id} from ${nextMatch.startTime.toLocaleTimeString()} to ${newStartTime.toLocaleTimeString()}`);
      
      // Update match times precisely using milliseconds
      nextMatch.startTime = newStartTime;
      nextMatch.endTime = new Date(newStartTime.getTime() + (nextMatch.duration * 60000));
    }
    // Handle early finish - try to move match earlier if possible
    else if (currentMatch.finishedEarly) {
      // Only move if it respects the required buffer
      if (minStartTime < nextMatch.startTime) {
        // Slide the match as early as possible rather than using time slots
        const newStartTime = new Date(minStartTime);
        
        console.log(`Due to early finish, moving match ${nextMatch.id} earlier from ${nextMatch.startTime.toLocaleTimeString()} to ${newStartTime.toLocaleTimeString()}`);
        
        // Update match times precisely using milliseconds
        nextMatch.startTime = newStartTime;
        nextMatch.endTime = new Date(newStartTime.getTime() + (nextMatch.duration * 60000));
      }
    }
  }
  
  // Helper function to find the next available time slot (keeping for compatibility)
  function findNextTimeSlot(minTime, timeSlots) {
    // Find the next slot that is at or after minTime
    const nextSlot = timeSlots.find(slot => slot >= minTime);
    return nextSlot ? new Date(nextSlot) : null;
  }
  
  // Helper function to find the previous available time slot
  function findPreviousTimeSlot(currentTime, minTime, timeSlots) {
    // Sort from latest to earliest
    const reversedSlots = [...timeSlots].sort((a, b) => b - a);
    
    // Find the latest slot that is before currentTime but at or after minTime
    const prevSlot = reversedSlots.find(slot => slot < currentTime && slot >= minTime);
    return prevSlot ? new Date(prevSlot) : null;
  }

  return adjustedSchedule
}

// Update adjusted schedule display
function updateAdjustedScheduleDisplay() {
  // Check if the required DOM elements exist
  if (!adjustedScheduleContainer || !noAdjustedScheduleMessage || !adjustedTableView || !adjustedTimelineView) {
    console.error("Required DOM elements for adjusted schedule display are missing");
    return;
  }

  // Check if adjusted schedule exists
  if (!state.adjustedSchedule) {
    noAdjustedScheduleMessage.style.display = "block";
    adjustedScheduleContainer.style.display = "none";
    const metricsContainer = document.getElementById("metrics-container");
    if (metricsContainer) {
      metricsContainer.style.display = "none";
    }
    return;
  }

  noAdjustedScheduleMessage.style.display = "none";
  adjustedScheduleContainer.style.display = "block";
  
  const metricsContainer = document.getElementById("metrics-container");
  if (metricsContainer) {
    metricsContainer.style.display = "grid";
  }

  // Group matches by game type, round, and bracket
  const groupedMatches = {};
  
  state.adjustedSchedule.matches.forEach(match => {
    const { gameType, roundNumber, bracketType } = match;
    
    if (!groupedMatches[gameType]) {
      groupedMatches[gameType] = {};
    }
    
    if (!groupedMatches[gameType][roundNumber]) {
      groupedMatches[gameType][roundNumber] = {};
    }
    
    if (!groupedMatches[gameType][roundNumber][bracketType]) {
      groupedMatches[gameType][roundNumber][bracketType] = [];
    }
    
    groupedMatches[gameType][roundNumber][bracketType].push(match);
  });

  // Get match format info
  let matchFormatLabel;
  switch(state.tournament.matchFormat) {
    case "bo1":
      matchFormatLabel = "Best of 1";
      break;
    case "bo3":
      matchFormatLabel = "Best of 3";
      break;
    case "bo5":
      matchFormatLabel = "Best of 5";
      break;
    case "bo7":
      matchFormatLabel = "Best of 7";
      break;
    default:
      matchFormatLabel = "Best of 3";
  }

  // Generate HTML for all matches grouped by game, round, and bracket
  let tableViewHTML = '';
  
  // First Mobile Legends matches
  if (groupedMatches["ML"]) {
    tableViewHTML += `<div class="game-section"><h2>Mobile Legends Matches</h2>`;
    
    Object.keys(groupedMatches["ML"]).sort((a, b) => Number(a) - Number(b)).forEach(roundNumber => {
      Object.keys(groupedMatches["ML"][roundNumber]).forEach(bracketType => {
        const matches = groupedMatches["ML"][roundNumber][bracketType];
        
        if (matches.length > 0) {
          tableViewHTML += `
        <div class="round-section">
                <h3 class="round-title">${getRoundName(Number(roundNumber), bracketType)}</h3>
            <table>
                <thead>
                    <tr>
                        <th>Match</th>
                        <th>Teams</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Duration</th>
                            <th>Format</th>
                    </tr>
                </thead>
                <tbody>
                        ${matches
                      .sort((a, b) => a.startTime - b.startTime)
                      .map(
                        (match) => `
                            <tr>
                                <td>${match.id}</td>
                                <td>${match.team1.name} vs ${match.team2.name}</td>
                                <td>${formatTime(match.startTime)}</td>
                                <td>${formatTime(match.endTime)}</td>
                                <td>${match.duration} min</td>
                                    <td>${matchFormatLabel}</td>
                            </tr>
                        `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
          `;
        }
      });
    });
    
    tableViewHTML += `</div>`;
  }
  
  // Then Valorant matches
  if (groupedMatches["Val"]) {
    tableViewHTML += `<div class="game-section"><h2>Valorant Matches</h2>`;
    
    Object.keys(groupedMatches["Val"]).sort((a, b) => Number(a) - Number(b)).forEach(roundNumber => {
      Object.keys(groupedMatches["Val"][roundNumber]).forEach(bracketType => {
        const matches = groupedMatches["Val"][roundNumber][bracketType];
        
        if (matches.length > 0) {
          tableViewHTML += `
            <div class="round-section">
                <h3 class="round-title">${getRoundName(Number(roundNumber), bracketType)}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Match</th>
                            <th>Teams</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                            <th>Format</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matches
                          .sort((a, b) => a.startTime - b.startTime)
                          .map(
                            (match) => `
                                <tr>
                                    <td>${match.id}</td>
                                    <td>${match.team1.name} vs ${match.team2.name}</td>
                                    <td>${formatTime(match.startTime)}</td>
                                    <td>${formatTime(match.endTime)}</td>
                                    <td>${match.duration} min</td>
                                    <td>${matchFormatLabel}</td>
                                </tr>
                            `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
          `;
        }
      });
    });
    
    tableViewHTML += `</div>`;
  }
  
  // Update the table view
  adjustedTableView.innerHTML = tableViewHTML;

  // Update timeline view - shows all matches sorted by time
  const sortedMatches = [...state.adjustedSchedule.matches].sort((a, b) => a.startTime - b.startTime);

  adjustedTimelineView.innerHTML = `
        <div class="timeline">
            ${sortedMatches
              .map(
                (match) => `
                <div class="timeline-item ${match.gameType === "ML" ? "mobile-legends" : "valorant"}">
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="badge ${match.gameType === "ML" ? "badge-primary" : "badge-danger"}">
                                ${match.gameType === "ML" ? "Mobile Legends" : "Valorant"}
                            </span>
                            <span>${formatTime(match.startTime)} - ${formatTime(match.endTime)}</span>
                        </div>
                        <h4>Match ${match.id}: ${match.team1.name} vs ${match.team2.name}</h4>
                        <div>
                      Duration: ${match.duration} minutes (${matchFormatLabel})
                      ${
                        match.bracketType
                          ? `<span class="badge ${match.bracketType.includes('Upper') ? 'badge-primary' : 'badge-secondary'}">${match.bracketType}</span>`
                          : match.roundNumber === 3
                          ? `<span class="badge badge-secondary">Finals</span>`
                          : ''
                            }
                        </div>
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>
  `;

  // Update metrics
  updateMetrics()

  // Update view
  updateAdjustedView()
}

// Update adjusted view based on selected view
function updateAdjustedView() {
  // First check if the buttons exist
  if (adjustedViewButtons) {
    adjustedViewButtons.forEach((button) => {
      if (button.dataset.view === state.adjustedView) {
        button.classList.add("active")
      } else {
        button.classList.remove("active")
      }
    })
  }

  // Check if the views exist before accessing classList
  if (adjustedTableView && adjustedTimelineView) {
    if (state.adjustedView === "table") {
      adjustedTableView.classList.add("active")
      adjustedTimelineView.classList.remove("active")
    } else {
      adjustedTableView.classList.remove("active")
      adjustedTimelineView.classList.add("active")
    }
  }
}

// Update metrics
function updateMetrics() {
  console.log("Updating metrics with current state:", { 
    hasSchedule: !!state.schedule, 
    hasAdjustedSchedule: !!state.adjustedSchedule, 
    disruptionCount: state.disruptions.length 
  });

  // Check if required DOM elements exist
  if (!originalIdleTime || !adjustedIdleTime || !idleTimeDiff || 
      !disruptionScore || !originalDuration || !adjustedDuration || !durationDiff) {
    console.error("Required metric DOM elements are missing");
    return;
  }

  // Check if both schedule and adjustedSchedule exist
  if (!state.schedule || !state.adjustedSchedule) {
    console.error("Schedule or adjusted schedule is missing for metrics calculation");
    return;
  }

  // Calculate idle time
  const originalIdleTimeValue = calculateIdleTime(state.schedule)
  const adjustedIdleTimeValue = calculateIdleTime(state.adjustedSchedule)
  const idleTimeDiffValue = adjustedIdleTimeValue - originalIdleTimeValue

  originalIdleTime.textContent = `${originalIdleTimeValue} min`
  adjustedIdleTime.textContent = `${adjustedIdleTimeValue} min`

  console.log(`Metrics calculation:
    Original idle time: ${originalIdleTimeValue} min
    Adjusted idle time: ${adjustedIdleTimeValue} min
    Difference: ${idleTimeDiffValue} min (${idleTimeDiffValue < 0 ? 'Decreased' : 'Increased'})
  `)

  const idleTimeParent = idleTimeDiff.parentElement;
  if (idleTimeParent) {
    // Clear existing text first to avoid stale content
    while (idleTimeParent.firstChild) {
      idleTimeParent.removeChild(idleTimeParent.firstChild);
    }
    
    if (idleTimeDiffValue < 0) {
      // Idle time decreased (improvement)
      idleTimeParent.classList.add("improvement")
      idleTimeParent.classList.remove("warning")
      idleTimeParent.textContent = `Decreased by: ${Math.abs(idleTimeDiffValue)} min`
    } else if (idleTimeDiffValue > 0) {
      // Idle time increased (warning)
      idleTimeParent.classList.remove("improvement")
      idleTimeParent.classList.add("warning")
      idleTimeParent.textContent = `Increased by: ${idleTimeDiffValue} min`
    } else {
      // No change in idle time
      idleTimeParent.classList.remove("improvement")
      idleTimeParent.classList.remove("warning")
      idleTimeParent.textContent = `No change`
    }
  }

  // Calculate disruption score
  const disruptionScoreValue = ((state.disruptions.length / state.schedule.matches.length) * 100).toFixed(1)
  disruptionScore.textContent = `${disruptionScoreValue}% of matches were rescheduled`

  // Calculate total duration
  const originalDurationValue = calculateTotalDuration(state.schedule)
  const adjustedDurationValue = calculateTotalDuration(state.adjustedSchedule)
  const durationDiffValue = adjustedDurationValue - originalDurationValue

  // Debugging output to validate exact difference
  console.log(`Exact duration calculation:
    Original duration in minutes: ${originalDurationValue}
    Adjusted duration in minutes: ${adjustedDurationValue}
    Raw difference: ${durationDiffValue}
  `)

  originalDuration.textContent = formatDuration(originalDurationValue)
  adjustedDuration.textContent = formatDuration(adjustedDurationValue)

  const durationParent = durationDiff.parentElement;
  if (durationParent) {
    // Clear existing text first to avoid stale content
    while (durationParent.firstChild) {
      durationParent.removeChild(durationParent.firstChild);
    }
    
    if (durationDiffValue < 0) {
      // Duration decreased (improvement)
      durationParent.classList.add("improvement")
      durationParent.classList.remove("warning")
      durationParent.textContent = `Shortened by: ${Math.abs(durationDiffValue)} min`
    } else if (durationDiffValue > 0) {
      // Duration increased (warning)
      durationParent.classList.remove("improvement")
      durationParent.classList.add("warning")
      durationParent.textContent = `Increased by: ${durationDiffValue} min`
    } else {
      // No change in duration
      durationParent.classList.remove("improvement")
      durationParent.classList.remove("warning")
      durationParent.textContent = `No change`
    }
  }
}

// Calculate idle time in minutes
function calculateIdleTime(schedule) {
  if (!schedule || !schedule.matches || schedule.matches.length === 0) {
    console.error("Invalid schedule or empty matches for idle time calculation")
    return 0
  }

  // Sort by start time so we have chronological order
  const sortedMatches = [...schedule.matches].sort((a, b) => {
    // Ensure we're working with Date objects
    const aStart = a.startTime instanceof Date ? a.startTime : new Date(a.startTime)
    const bStart = b.startTime instanceof Date ? b.startTime : new Date(b.startTime)
    return aStart - bStart
  })

  let totalIdle = 0
  let idleBreakdown = []

  for (let i = 1; i < sortedMatches.length; i++) {
    // Ensure we're working with Date objects
    const currentStart = sortedMatches[i].startTime instanceof Date ? 
                        sortedMatches[i].startTime : 
                        new Date(sortedMatches[i].startTime)
    
    const prevEnd = sortedMatches[i - 1].endTime instanceof Date ? 
                   sortedMatches[i - 1].endTime : 
                   new Date(sortedMatches[i - 1].endTime)
    
    if (currentStart > prevEnd) {
      const idleMinutes = Math.floor((currentStart - prevEnd) / 60000)
      totalIdle += idleMinutes
      
      // Track individual idle periods for debugging
      idleBreakdown.push({
        between: `${sortedMatches[i-1].id} and ${sortedMatches[i].id}`,
        minutes: idleMinutes,
        prevEnd: formatTime(prevEnd),
        currentStart: formatTime(currentStart),
        rawMs: currentStart - prevEnd
      })
    }
  }

  console.log(`Idle time calculation:
    Total idle time: ${totalIdle} minutes
    Breakdown:`, idleBreakdown)

  return totalIdle
}

// Calculate total duration in minutes
function calculateTotalDuration(schedule) {
  if (!schedule || !schedule.matches || schedule.matches.length === 0) {
    console.error("Invalid schedule or empty matches for duration calculation")
    return 0
  }

  // Sort by start time so we have chronological order
  const sortedMatches = [...schedule.matches].sort((a, b) => {
    // Ensure we're working with Date objects
    const aStart = a.startTime instanceof Date ? a.startTime : new Date(a.startTime)
    const bStart = b.startTime instanceof Date ? b.startTime : new Date(b.startTime)
    return aStart - bStart
  })

  // Get first and last match
  const firstMatch = sortedMatches[0]
  const lastMatch = sortedMatches[sortedMatches.length - 1]

  // Get start time of first match and end time of last match, ensuring they're Date objects
  const startTime = firstMatch.startTime instanceof Date ? firstMatch.startTime : new Date(firstMatch.startTime)
  const endTime = lastMatch.endTime instanceof Date ? lastMatch.endTime : new Date(lastMatch.endTime)

  // Calculate duration in milliseconds, then convert to minutes
  const durationMs = endTime - startTime
  const durationInMinutes = Math.floor(durationMs / 60000)

  console.log(`Total duration calculation:
    First match: ${firstMatch.id} starts at ${formatTime(startTime)}
    Last match: ${lastMatch.id} ends at ${formatTime(endTime)}
    Duration: ${durationInMinutes} minutes (${formatDuration(durationInMinutes)})
    Raw ms difference: ${durationMs}
  `)
  
  return durationInMinutes
}

// Format duration in hours and minutes
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return `${hours}h ${mins}m`
}

// Enable a tab
function enableTab(tabId) {
  const button = document.querySelector(`.tab-button[data-tab="${tabId}"]`)
  if (button) {
    button.disabled = false
  }
}

// Format time for display
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Show error message
function showError(message) {
  errorText.textContent = message
  errorContainer.classList.remove("hidden")

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorContainer.classList.add("hidden")
  }, 5000)
}

// Show loading overlay
function showLoading(message) {
  console.log("Show loading:", message);
  if (!loadingOverlay) {
    console.error("Loading overlay not found");
    return;
  }
  
  if (loadingText) {
    loadingText.textContent = message || "Loading...";
  }
  
  loadingOverlay.classList.remove("hidden");
  loadingOverlay.style.display = "flex";
}

// Hide loading overlay
function hideLoading() {
  console.log("Hide loading");
  if (!loadingOverlay) {
    console.error("Loading overlay not found");
    return;
  }
  
  loadingOverlay.classList.add("hidden");
  loadingOverlay.style.display = "none";
}

// Update form fields based on game type toggles
function updateFormFields() {
  const enableMobileLegends = document.getElementById("enableMobileLegends");
  const enableValorant = document.getElementById("enableValorant");
  
  if (!enableMobileLegends || !enableValorant) return;
  
  const mlTeams = document.getElementById("mlTeams");
  const mlDurationMin = document.getElementById("mlDurationMin");
  const mlDurationMax = document.getElementById("mlDurationMax");
  const valTeams = document.getElementById("valTeams");
  const valDurationMin = document.getElementById("valDurationMin");
  const valDurationMax = document.getElementById("valDurationMax");
  const mlTimeSlot = document.getElementById("mlTimeSlot");
  const valTimeSlot = document.getElementById("valTimeSlot");
  
  if (mlTeams && mlDurationMin && mlDurationMax) {
    const isMLEnabled = enableMobileLegends.checked;
    mlTeams.disabled = !isMLEnabled;
    mlDurationMin.disabled = !isMLEnabled;
    mlDurationMax.disabled = !isMLEnabled;
    if (mlTimeSlot) {
      mlTimeSlot.disabled = !isMLEnabled;
    }
  }
  
  if (valTeams && valDurationMin && valDurationMax) {
    const isValEnabled = enableValorant.checked;
    valTeams.disabled = !isValEnabled;
    valDurationMin.disabled = !isValEnabled;
    valDurationMax.disabled = !isValEnabled;
    if (valTimeSlot) {
      valTimeSlot.disabled = !isValEnabled;
    }
  }
  
  // Ensure at least one game type is enabled
  if (enableMobileLegends && enableValorant) {
    if (!enableMobileLegends.checked && !enableValorant.checked) {
      // If both are unchecked, force one to be checked
      enableMobileLegends.checked = true;
      updateFormFields();
    }
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", init)

// Expose functions to global scope for onclick handlers
window.removeTeam = removeTeam
window.removeDisruption = removeDisruption

// Get format-specific round names
function getRoundName(round, bracketType) {
  // Handle Double Elimination bracket naming
  if (bracketType && bracketType.includes("Upper Bracket")) {
    if (bracketType.includes("First Round")) return "First Round";
    if (bracketType.includes("Quarterfinals")) return "Quarterfinals";
    if (bracketType.includes("Semifinals")) return "Semifinals";
    if (bracketType.includes("Finals")) return "Upper Bracket Finals";
  } else if (bracketType && bracketType.includes("Lower Bracket")) {
    if (bracketType.includes("Losers' Round 1")) return "Losers' Round 1";
    if (bracketType.includes("Losers' Round 2")) return "Losers' Round 2";
    if (bracketType.includes("Finals")) return "Lower Bracket Finals";
  } else if (bracketType && bracketType.includes("Grand Finals")) {
    return "Grand Finals";
  }
  
  // Single Elimination naming - directly return the bracketType if it's one of our standard names
  if (bracketType) {
    if (bracketType === "First Round") return "First Round";
    if (bracketType === "Second Round") return "Second Round";
    if (bracketType === "Quarterfinals") return "Quarterfinals";
    if (bracketType === "Semifinals") return "Semifinals";
    if (bracketType === "Finals") return "Finals";
  }
  
  // Fallback - should rarely be used as we're setting explicit names
  if (round === 1) return "First Round";
  if (round === 2) {
    // For 4-team tournaments, round 2 is Finals
    // For 8-team tournaments, round 2 is Semifinals
    // For 16/32-team tournaments, round 2 could be Second Round/Quarterfinals
    return "Round " + round;
  }
  if (round === 3) {
    // Could be Semifinals or Finals depending on tournament size
    return "Round " + round;
  }
  if (round === 4) return "Semifinals";
  if (round === 5) return "Finals";
  
  return "Round " + round;
}


