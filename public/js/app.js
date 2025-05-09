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
  
  // Create Mobile Legends match pairs
  if (tournament.enabledGames.mobileLegends) {
    for (let i = 0; i < mlTeams.length; i += 2) {
      if (i + 1 < mlTeams.length) {
        mlMatchPairs.push({
          team1: mlTeams[i],
          team2: mlTeams[i + 1],
          roundNumber: 1
        })
      }
    }
    
    // Add semifinals if enough teams
    if (mlTeams.length >= 4) {
      mlMatchPairs.push({
        team1: { ...mlTeams[0], name: "ML Winner 1" },
        team2: { ...mlTeams[1], name: "ML Winner 2" },
        roundNumber: 2,
        description: "ML Semifinal"
      })
    }
  }
  
  // Create Valorant match pairs
  if (tournament.enabledGames.valorant) {
    for (let i = 0; i < valTeams.length; i += 2) {
      if (i + 1 < valTeams.length) {
        valMatchPairs.push({
          team1: valTeams[i],
          team2: valTeams[i + 1],
          roundNumber: 1
        })
      }
    }
    
    // Add semifinals if enough teams
    if (valTeams.length >= 4) {
      valMatchPairs.push({
        team1: { ...valTeams[0], name: "Val Winner 1" },
        team2: { ...valTeams[1], name: "Val Winner 2" },
        roundNumber: 2,
        description: "Valorant Semifinal"
      })
    }
  }
  
  // Generate matches using time slot preferences
  function createMatchesForGameType(matchPairs, gameType, preferredTimeSlot, duration) {
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
    
    // Start times for all matches
    let lastEndTime = null;
    
    for (const matchPair of matchPairs) {
      if (timeSlots && slotIndex < timeSlots.length) {
        // Create start time based on previous match or time slot
        let startTime;
        
        if (matches.length === 0 || lastEndTime === null) {
          // For first match, use the predefined time slot
          const timeSlot = timeSlots[slotIndex];
          startTime = new Date(venueStart);
          startTime.setHours(timeSlot.hours, timeSlot.minutes, 0, 0);
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
          gameType: gameType,
          roundNumber: matchPair.roundNumber,
          startTime: startTime,
          endTime: endTime,
          description: matchPair.description || ""
        };
        
        matches.push(match);
        
        // Update lastEndTime for the next match
        lastEndTime = new Date(endTime);
        
        // Increment the appropriate slot counter
        if (preferredTimeSlot === "morning") {
          usedMorningSlots++;
        } else if (preferredTimeSlot === "afternoon") {
          usedAfternoonSlots++;
        } else if (preferredTimeSlot === "wholeday") {
          usedWholeDaySlots++;
        }
        
        slotIndex++;
      }
    }
  }
  
  // Create matches according to preferences
  if (tournament.enabledGames.mobileLegends) {
    createMatchesForGameType(mlMatchPairs, "ML", mlTimeSlot, mlMatchDuration);
  }
  
  if (tournament.enabledGames.valorant) {
    createMatchesForGameType(valMatchPairs, "Val", valTimeSlot, valMatchDuration);
  }
  
  console.log("Generated schedule with dynamic time slots:", matches);
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
      // Adjust schedule
      state.adjustedSchedule = adjustSchedule(state.tournament, state.schedule, state.disruptions)

      // Update UI
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
  // Create a deep copy of the schedule
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
        match.endTime = new Date(match.startTime)
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration)
        
        console.log(`Match ${match.id} extended from ${originalEndTime.toLocaleTimeString()} to ${match.endTime.toLocaleTimeString()}`);
        console.log(`This match now runs ${disruption.extraMinutes} minutes longer (${match.duration} total)`);
      } else if (disruption.type === "late_arrival") {
        // Save original times
        const originalStartTime = new Date(match.startTime);
        const originalEndTime = new Date(match.endTime);
        
        // Delay match start time
        match.startTime = new Date(match.startTime)
        match.startTime.setMinutes(match.startTime.getMinutes() + disruption.extraMinutes)
        match.endTime = new Date(match.startTime)
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration)
        
        console.log(`Match ${match.id} delayed from ${originalStartTime.toLocaleTimeString()} to ${match.startTime.toLocaleTimeString()}`);
        console.log(`This results in end time changing from ${originalEndTime.toLocaleTimeString()} to ${match.endTime.toLocaleTimeString()}`);
      } else if (disruption.type === "early_finish") {
        // Save original end time
        const originalEndTime = new Date(match.endTime);
        
        // Reduce match duration (finished earlier than expected)
        match.duration -= disruption.extraMinutes
        if (match.duration < 10) match.duration = 10 // minimum duration
        match.endTime = new Date(match.startTime)
        match.endTime.setMinutes(match.endTime.getMinutes() + match.duration)
        
        console.log(`Match ${match.id} finished early at ${match.endTime.toLocaleTimeString()} instead of ${originalEndTime.toLocaleTimeString()}`);
        console.log(`This match is now ${disruption.extraMinutes} minutes shorter (${match.duration} total)`);
        
        // Store the match id that finished early so we can optimize
        // subsequent matches to start earlier when possible
        match.finishedEarly = true
      }
    }
  }

  // First adjust teams with disruptions (late arrivals)
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
    
    // Calculate minimum start time
    const minStartTime = new Date(currentMatch.endTime);
    minStartTime.setMinutes(minStartTime.getMinutes() + bufferMinutes);
    
    console.log(`Match ${nextMatch.id} current start: ${nextMatch.startTime.toLocaleTimeString()}, min start: ${minStartTime.toLocaleTimeString()}`);
    
    // Check if next match needs to be adjusted (slide forward to minimize idle time)
    if (minStartTime > nextMatch.startTime) {
      // Slide the match as early as possible (use minStartTime)
      const newStartTime = new Date(minStartTime);
      console.log(`Moving match ${nextMatch.id} from ${nextMatch.startTime.toLocaleTimeString()} to ${newStartTime.toLocaleTimeString()}`);
      // Update match times
      nextMatch.startTime = newStartTime;
      nextMatch.endTime = new Date(newStartTime);
      nextMatch.endTime.setMinutes(nextMatch.startTime.getMinutes() + nextMatch.duration);
    }
    // Handle early finish - try to move match earlier if possible
    else if (currentMatch.finishedEarly) {
      // Only move if it respects the required buffer
      if (minStartTime < nextMatch.startTime) {
        // Slide the match as early as possible rather than using time slots
        const newStartTime = new Date(minStartTime);
        
        console.log(`Due to early finish, moving match ${nextMatch.id} earlier from ${nextMatch.startTime.toLocaleTimeString()} to ${newStartTime.toLocaleTimeString()}`);
        
        // Update match times
        nextMatch.startTime = newStartTime;
        nextMatch.endTime = new Date(newStartTime);
        nextMatch.endTime.setMinutes(nextMatch.startTime.getMinutes() + nextMatch.duration);
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
  if (!state.adjustedSchedule) {
    noAdjustedScheduleMessage.style.display = "block"
    adjustedScheduleContainer.style.display = "none"
    document.getElementById("metrics-container").style.display = "none"
    return
  }

  noAdjustedScheduleMessage.style.display = "none"
  adjustedScheduleContainer.style.display = "block"
  document.getElementById("metrics-container").style.display = "grid"

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
  adjustedViewButtons.forEach((button) => {
    if (button.dataset.view === state.adjustedView) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })

  if (state.adjustedView === "table") {
    adjustedTableView.classList.add("active")
    adjustedTimelineView.classList.remove("active")
  } else {
    adjustedTableView.classList.remove("active")
    adjustedTimelineView.classList.add("active")
  }
}

// Update metrics
function updateMetrics() {
  // Calculate idle time
  const originalIdleTimeValue = calculateIdleTime(state.schedule)
  const adjustedIdleTimeValue = calculateIdleTime(state.adjustedSchedule)
  const idleTimeDiffValue = adjustedIdleTimeValue - originalIdleTimeValue

  originalIdleTime.textContent = `${originalIdleTimeValue} min`
  adjustedIdleTime.textContent = `${adjustedIdleTimeValue} min`
  idleTimeDiff.textContent = `${Math.abs(idleTimeDiffValue)} min`

  if (idleTimeDiffValue < 0) {
    idleTimeDiff.parentElement.classList.add("improvement")
    idleTimeDiff.parentElement.classList.remove("warning")
    idleTimeDiff.parentElement.textContent = `Improvement: ${Math.abs(idleTimeDiffValue)} min`
  } else {
    idleTimeDiff.parentElement.classList.remove("improvement")
    idleTimeDiff.parentElement.classList.add("warning")
    idleTimeDiff.parentElement.textContent = `Increase: ${idleTimeDiffValue} min`
  }

  // Calculate disruption score
  const disruptionScoreValue = ((state.disruptions.length / state.schedule.matches.length) * 100).toFixed(1)
  disruptionScore.textContent = `${disruptionScoreValue}% of matches were rescheduled`

  // Calculate total duration
  const originalDurationValue = calculateTotalDuration(state.schedule)
  const adjustedDurationValue = calculateTotalDuration(state.adjustedSchedule)
  const durationDiffValue = adjustedDurationValue - originalDurationValue

  originalDuration.textContent = formatDuration(originalDurationValue)
  adjustedDuration.textContent = formatDuration(adjustedDurationValue)
  durationDiff.textContent = `${Math.abs(durationDiffValue)} min`

  if (durationDiffValue < 0) {
    durationDiff.parentElement.classList.add("improvement")
    durationDiff.parentElement.classList.remove("warning")
    durationDiff.parentElement.textContent = `Improvement: ${Math.abs(durationDiffValue)} min`
  } else {
    durationDiff.parentElement.classList.remove("improvement")
    durationDiff.parentElement.classList.add("warning")
    durationDiff.parentElement.textContent = `Increase: ${durationDiffValue} min`
  }
}

// Calculate idle time in minutes
function calculateIdleTime(schedule) {
  const sortedMatches = [...schedule.matches].sort((a, b) => a.startTime - b.startTime)
  let totalIdle = 0

  for (let i = 1; i < sortedMatches.length; i++) {
    const currentStart = sortedMatches[i].startTime
    const prevEnd = sortedMatches[i - 1].endTime
    if (currentStart > prevEnd) {
      const idleMinutes = Math.floor((currentStart - prevEnd) / 60000)
      totalIdle += idleMinutes
    }
  }

  return totalIdle
}

// Calculate total duration in minutes
function calculateTotalDuration(schedule) {
  const sortedMatches = [...schedule.matches].sort((a, b) => a.startTime - b.startTime)
  const firstMatch = sortedMatches[0]
  const lastMatch = sortedMatches[sortedMatches.length - 1]

  return Math.floor((lastMatch.endTime - firstMatch.startTime) / 60000)
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


