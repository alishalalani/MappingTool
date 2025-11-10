// Global state
let leagues = [], teams = [], sports = [], positions = [], players = [];
let leagueMappings = [], teamMappings = [], playerMappings = [];
let leagueTeams = [], teamPlayers = []; // Junction tables
let currentMappingContext = null;
let currentSearchFilter = 'all';
let selectedLeague = null;
let selectedTeam = null;
let selectedPlayer = null;
let selectedLeagueForTeams = null; // Track selected league in Teams tab
let selectedLeagueForPlayers = null; // Track selected league in Players tab
let selectedTeamForPlayers = null; // Track selected team in Players tab
const API_URL = 'api.php';

// Utility function to highlight search terms in text
function highlightText(text, searchTerm) {
    if (!searchTerm || !text) return text;

    // Escape special regex characters in search term
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create case-insensitive regex
    const regex = new RegExp(`(${escapedTerm})`, 'gi');

    // Replace matches with highlighted version
    return text.replace(regex, '<span class="highlight">$1</span>');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadInitialData();
});

function initializeTabs() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            updateSearchFilterLabels(tabName);

            // Clear search input when switching tabs
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.value = '';
            }

            // Show/hide league filter based on tab
            const leagueFilterContainer = document.getElementById('team-league-filter-container');
            const leagueSelectedContainer = document.getElementById('league-selected-filter-container');
            const playerFiltersContainer = document.getElementById('player-filters-container');

            if (tabName === 'teams') {
                leagueFilterContainer.style.display = 'flex';
                leagueSelectedContainer.style.display = 'none';
                playerFiltersContainer.style.display = 'none';
                // Carry over selected league from Leagues tab
                if (selectedLeague) {
                    selectedLeagueForTeams = selectedLeague;
                    updateLeagueFilterInput();
                }
                // Always load teams (will show all if no league selected, or filtered if league is selected)
                loadTeamsForLeague();
            } else if (tabName === 'leagues') {
                leagueFilterContainer.style.display = 'none';
                leagueSelectedContainer.style.display = 'flex';
                playerFiltersContainer.style.display = 'none';
                updateLeagueSelectedDisplay();
            } else if (tabName === 'players') {
                leagueFilterContainer.style.display = 'none';
                leagueSelectedContainer.style.display = 'none';
                playerFiltersContainer.style.display = 'block';
                // Carry over selected league and team from Teams tab
                if (selectedLeagueForTeams) {
                    selectedLeagueForPlayers = selectedLeagueForTeams;
                    updatePlayerLeagueFilterInput();
                }
                if (selectedTeam) {
                    selectedTeamForPlayers = selectedTeam;
                    updatePlayerTeamFilterInput();
                }
                // Always load players (will show all if no filters, or filtered if filters are set)
                loadPlayersForTeam();
            } else {
                leagueFilterContainer.style.display = 'none';
                leagueSelectedContainer.style.display = 'none';
                playerFiltersContainer.style.display = 'none';
            }
        });
    });
    // Initialize labels for the default tab
    updateSearchFilterLabels('leagues');

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            hideLeagueDropdown();
            // Also hide player teams dropdown if it exists
            const playerTeamsDropdown = document.getElementById('player-teams-dropdown');
            if (playerTeamsDropdown) {
                playerTeamsDropdown.style.display = 'none';
            }
        }
    });
}

function updateSearchFilterLabels(tabName) {
    const filterButtons = document.querySelectorAll('.search-filter-btn');

    if (tabName === 'leagues') {
        filterButtons[0].textContent = 'All';
        filterButtons[1].textContent = 'Leagues';
        filterButtons[2].textContent = 'Unmapped';
        filterButtons[3].textContent = 'Mapped';
    } else if (tabName === 'teams') {
        filterButtons[0].textContent = 'All';
        filterButtons[1].textContent = 'Teams';
        filterButtons[2].textContent = 'Unmapped';
        filterButtons[3].textContent = 'Mapped';
    } else if (tabName === 'players') {
        filterButtons[0].textContent = 'All';
        filterButtons[1].textContent = 'Players';
        filterButtons[2].textContent = 'Unmapped';
        filterButtons[3].textContent = 'Mapped';
    }
}

async function loadInitialData() {
    try {
        await Promise.all([
            loadSports(), loadLeagues(), loadTeams(), loadLeagueTeams(), loadPositions(),
            loadPlayers(), loadTeamPlayers(),
            loadLeagueMappings(), loadTeamMappings(), loadPlayerMappings()
        ]);
        populateSportFilters();
    } catch (error) {
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

function populateSportFilters() {
    const sportOpts = sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('global-sport-filter').innerHTML = '<option value="">-- Select a Sport --</option>' + sportOpts;

    // Note: team-league-filter and player-league-filter are now autocomplete inputs, not select dropdowns
    // They don't need to be populated here - they use filterLeagueDropdown() and filterPlayerLeagueDropdown()

    // Load all leagues initially (no sport filter)
    loadLeaguesForSport();
}

function onSportChange() {
    const sportId = document.getElementById('global-sport-filter').value;

    // Clear search bar
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }

    // Update leagues
    loadLeaguesForSport();

    // Clear the team league filter input and refresh the dropdown
    const teamLeagueInput = document.getElementById('team-league-filter');
    if (teamLeagueInput) {
        teamLeagueInput.value = '';
        selectedLeagueForTeams = null;
        filterLeagueDropdown(); // Refresh the dropdown with sport-filtered leagues
    }

    // Clear the player league filter input and refresh the dropdown
    const playerLeagueInput = document.getElementById('player-league-filter');
    if (playerLeagueInput) {
        playerLeagueInput.value = '';
        selectedLeagueForPlayers = null;
        filterPlayerLeagueDropdown(); // Refresh the dropdown with sport-filtered leagues
    }

    // Reload teams filtered by sport
    loadTeamsForLeague();

    // Clear players content
    const playersContent = document.getElementById('players-content');
    if (playersContent) {
        playersContent.innerHTML = '<div class="empty-state"><p>👆 Please select a league and team to view players</p></div>';
    }
}

async function apiCall(action, data = {}) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data })
    });
    if (!response.ok) throw new Error('Network error');
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Unknown error');
    return result.data;
}

async function loadSports() { sports = await apiCall('getSports'); }
async function loadLeagues() { leagues = await apiCall('getLeagues'); }
async function loadTeams() {
    teams = await apiCall('getTeams');
    console.log('Teams loaded:', teams.length);
}
async function loadPlayers() { players = await apiCall('getPlayers'); }
async function loadLeagueTeams() { leagueTeams = await apiCall('getLeagueTeams'); }
async function loadTeamPlayers() { teamPlayers = await apiCall('getTeamPlayers'); }
async function loadPositions() { positions = await apiCall('getPositions'); }
async function loadLeagueMappings() { leagueMappings = await apiCall('getLeagueMappings'); }
async function loadTeamMappings() { teamMappings = await apiCall('getTeamMappings'); }
async function loadPlayerMappings() { playerMappings = await apiCall('getPlayerMappings'); }

function loadLeaguesForSport(searchTerm = '') {
    const sportId = document.getElementById('global-sport-filter').value;
    const leaguesList = document.getElementById('leagues-list');
    const unmappedList = document.getElementById('unmapped-list');
    const mappingsList = document.getElementById('mappings-list');

    // If no sport selected, show all leagues
    let sportLeagues = sportId ? leagues.filter(l => l.sport_id == sportId) : leagues;

    // Apply search filter only if filtering 'all' or 'items' (leagues)
    if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'items')) {
        sportLeagues = sportLeagues.filter(l =>
            l.fullname.toLowerCase().includes(searchTerm) ||
            l.abbr.toLowerCase().includes(searchTerm)
        );
    }

    // Update leagues list
    document.getElementById('leagues-count').textContent = sportLeagues.length;

    // Always show Add League button
    const addLeagueBtn = document.getElementById('add-league-btn');
    if (addLeagueBtn) {
        addLeagueBtn.style.display = 'block';
    }

    if (sportLeagues.length === 0) {
        leaguesList.innerHTML = '<div class="empty-state-small">No leagues found</div>';
    } else {
        const shouldHighlight = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'items');
        leaguesList.innerHTML = sportLeagues.map(league => {
            const highlightedName = shouldHighlight ? highlightText(league.fullname, searchTerm) : league.fullname;
            const highlightedAbbr = shouldHighlight ? highlightText(league.abbr, searchTerm) : league.abbr;
            return `
                <div class="list-item ${selectedLeague && selectedLeague.id === league.id ? 'active' : ''}" onclick="selectLeague(${league.id})">
                    <div class="list-item-content">
                        <div class="list-item-name">${highlightedName}</div>
                        <div class="list-item-abbr">${highlightedAbbr}</div>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn-icon" onclick="showEditLeagueModal(${league.id}); event.stopPropagation();" title="Edit league">✏️</button>
                        <button class="btn-icon" onclick="deleteLeague(${league.id}); event.stopPropagation();" title="Delete league">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to selected league if one is selected
        if (selectedLeague) {
            setTimeout(() => {
                const activeItem = leaguesList.querySelector('.list-item.active');
                if (activeItem) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }

    // Update unmapped list - show ONLY unmapped league names (league_id is NULL)
    let allUnmapped = leagueMappings.filter(m => {
        // Only show if league_id is NULL (unmapped)
        return m.league_id === null || m.league_id === undefined;
    });

    // Apply search filter only if filtering 'all' or 'unmapped'
    if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'unmapped')) {
        allUnmapped = allUnmapped.filter(m =>
            m.name.toLowerCase().includes(searchTerm)
        );
    }

    document.getElementById('unmapped-count').textContent = allUnmapped.length;
    if (allUnmapped.length === 0) {
        unmappedList.innerHTML = '<div class="empty-state-small">No unmapped names</div>';
    } else {
        const shouldHighlightUnmapped = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'unmapped');
        unmappedList.innerHTML = allUnmapped.map(m => {
            const highlightedName = shouldHighlightUnmapped ? highlightText(m.name, searchTerm) : m.name;
            return `
                <div class="list-item unmapped-item" data-mapping-id="${m.id}">
                    <div class="list-item-name">${highlightedName}</div>
                    ${selectedLeague ? `<button class="map-btn" onclick="mapLeagueMapping(${m.id}, ${selectedLeague.id}); event.stopPropagation();">Map to ${selectedLeague.fullname}</button>` : ''}
                </div>
            `;
        }).join('');
    }

    // Clear mappings if no league selected
    if (!selectedLeague) {
        mappingsList.innerHTML = '<div class="empty-state-small">Click a league to view mappings</div>';
        document.getElementById('add-mapping-btn').style.display = 'none';
    }
}

function selectLeague(leagueId) {
    // Toggle selection if clicking the same league
    if (selectedLeague && selectedLeague.id == leagueId) {
        selectedLeague = null;
    } else {
        selectedLeague = leagues.find(l => l.id == leagueId);
    }

    // Clear search bar
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }

    loadLeaguesForSport(); // Refresh to update active state
    updateLeagueSelectedDisplay(); // Update the selected league display

    // Show mappings for this league
    const mappingsList = document.getElementById('mappings-list');
    // Convert both to numbers for comparison
    let mapped = leagueMappings.filter(m => m.league_id !== null && Number(m.league_id) === Number(leagueId));

    document.getElementById('add-mapping-btn').style.display = 'block';

    if (mapped.length === 0) {
        mappingsList.innerHTML = '<div class="empty-state-small">No mappings for this league yet</div>';
    } else {
        mappingsList.innerHTML = mapped.map(m => {
            return `
                <div class="mapping-item-compact" data-mapping-id="${m.id}">
                    <span class="mapping-name">${m.name}</span>
                    <button class="btn btn-danger btn-sm" onclick="unmapLeagueMapping(${m.id})">Unmap</button>
                </div>
            `;
        }).join('');
    }
}

function updateLeagueSelectedDisplay() {
    const display = document.getElementById('league-selected-display');
    if (selectedLeague) {
        display.textContent = selectedLeague.fullname;
    } else {
        display.textContent = 'None';
    }
}

function clearLeagueSelectionInLeagueTab() {
    selectedLeague = null;
    selectedLeagueForTeams = null; // Also clear the league selection for the Teams tab
    updateLeagueSelectedDisplay();
    updateLeagueFilterInput(); // Update the Teams tab display
    loadLeaguesForSport();

    // Clear mappings
    const mappingsList = document.getElementById('mappings-list');
    mappingsList.innerHTML = '<div class="empty-state-small">Click a league to view mappings</div>';
    document.getElementById('add-mapping-btn').style.display = 'none';

    // Clear the global search input
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }
}

function clearAllFilters() {
    // Clear search bar
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }

    // Clear sport filter
    const sportFilter = document.getElementById('global-sport-filter');
    if (sportFilter) {
        sportFilter.value = '';
    }

    // Clear all selections
    selectedLeague = null;
    selectedLeagueForTeams = null;
    selectedLeagueForPlayers = null;
    selectedTeam = null;
    selectedTeamForPlayers = null;
    selectedPlayer = null;

    // Update displays
    updateLeagueSelectedDisplay();
    updateLeagueFilterInput();
    updatePlayerLeagueFilterInput();
    updatePlayerTeamFilterInput();

    // Clear all text filter inputs
    const teamLeagueFilter = document.getElementById('team-league-filter');
    if (teamLeagueFilter) {
        teamLeagueFilter.value = '';
    }

    const playerLeagueFilter = document.getElementById('player-league-filter');
    if (playerLeagueFilter) {
        playerLeagueFilter.value = '';
    }

    const playerTeamFilter = document.getElementById('player-team-filter');
    if (playerTeamFilter) {
        playerTeamFilter.value = '';
    }

    // Hide dropdowns
    const dropdowns = document.querySelectorAll('.autocomplete-dropdown');
    dropdowns.forEach(dropdown => dropdown.classList.remove('show'));

    // Reload current tab with no filters and no highlights
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    if (activeTab === 'leagues') {
        loadLeaguesForSport('');
        const mappingsList = document.getElementById('mappings-list');
        mappingsList.innerHTML = '<div class="empty-state-small">Click a league to view mappings</div>';
        document.getElementById('add-mapping-btn').style.display = 'none';
    } else if (activeTab === 'teams') {
        loadTeamsForLeague('');
        const teamMappingsList = document.getElementById('team-mappings-list');
        teamMappingsList.innerHTML = '<div class="empty-state-small">Click a team to view mappings</div>';
        document.getElementById('add-team-mapping-btn').style.display = 'none';
    } else if (activeTab === 'players') {
        loadPlayersForTeam('');
        const playerMappingsList = document.getElementById('player-mappings-list');
        playerMappingsList.innerHTML = '<div class="empty-state-small">Click a player to view mappings</div>';
        document.getElementById('add-player-mapping-btn').style.display = 'none';
    }

    // Trigger search to remove highlights
    performGlobalSearch();
}

function setSearchFilter(filter) {
    currentSearchFilter = filter;
    document.querySelectorAll('.search-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        }
    });
    performGlobalSearch();
}

function clearSearchInput() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';

        // Clear team selection and mappings
        if (selectedTeam) {
            selectedTeam = null;
        }

        // Clear player selection and mappings
        if (selectedPlayer) {
            selectedPlayer = null;
        }

        performGlobalSearch();
    }
}

function performGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');

    if (activeTab === 'leagues') {
        loadLeaguesForSport(searchTerm);
    } else if (activeTab === 'teams') {
        loadTeamsForLeague(searchTerm);
    } else if (activeTab === 'players') {
        loadPlayersForTeam(searchTerm);
    }
}

function filterLeagues(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadLeaguesForSport(searchTerm);
}

function loadTeamsForLeague(searchTerm = '', applySearchToMappings = true) {
    const sportId = document.getElementById('global-sport-filter').value;
    const leagueId = selectedLeagueForTeams ? selectedLeagueForTeams.id : null;
    const teamsList = document.getElementById('teams-list');
    const unmappedList = document.getElementById('team-unmapped-list');
    const mappingsList = document.getElementById('team-mappings-list');

    // Filter teams based on whether a league is selected
    let filteredTeams;
    if (!leagueId) {
        // No league selected - filter by sport if selected
        if (sportId) {
            // Get all leagues for this sport
            const leaguesForSport = leagues.filter(l => l.sport_id == sportId).map(l => l.id);

            // Get team IDs for these leagues from league_team junction table
            const teamIdsForSport = leagueTeams
                .filter(lt => leaguesForSport.includes(lt.league_id))
                .map(lt => lt.team_id);

            // Filter teams by sport and exclude teams with empty names
            filteredTeams = teams.filter(t =>
                teamIdsForSport.includes(t.id) &&
                ((t.NAME && t.NAME.trim() !== '') || (t.full_name && t.full_name.trim() !== ''))
            );
        } else {
            // No sport selected - show ALL teams with a name
            filteredTeams = teams.filter(t =>
                (t.NAME && t.NAME.trim() !== '') ||
                (t.full_name && t.full_name.trim() !== '')
            );
        }
    } else {
        // Get the main_league_id from the selected league
        const mainLeagueId = selectedLeagueForTeams.main_league_id;

        // Find all leagues that have this main_league_id
        const relatedLeagueIds = leagues
            .filter(l => l.main_league_id == mainLeagueId)
            .map(l => l.id);

        // Get team IDs for all related leagues from league_team junction table
        const teamIdsForLeague = leagueTeams
            .filter(lt => relatedLeagueIds.includes(lt.league_id))
            .map(lt => lt.team_id);

        // Filter teams by those IDs and exclude teams with empty names
        filteredTeams = teams.filter(t =>
            teamIdsForLeague.includes(t.id) &&
            ((t.NAME && t.NAME.trim() !== '') || (t.full_name && t.full_name.trim() !== ''))
        );
    }

    // Apply search filter only if filtering 'all' or 'items' (teams)
    if (searchTerm && searchTerm.trim() !== '' && (currentSearchFilter === 'all' || currentSearchFilter === 'items')) {
        filteredTeams = filteredTeams.filter(t => {
            const teamName = t.NAME || t.full_name || '';
            return teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.abbr && t.abbr.toLowerCase().includes(searchTerm.toLowerCase()));
        });
    }

    // Update teams list
    document.getElementById('teams-count').textContent = filteredTeams.length;
    if (filteredTeams.length === 0) {
        teamsList.innerHTML = '<div class="empty-state-small">No teams found</div>';
    } else {
        const shouldHighlight = searchTerm && searchTerm.trim() !== '' && (currentSearchFilter === 'all' || currentSearchFilter === 'items');
        teamsList.innerHTML = filteredTeams.map(team => {
            const teamName = team.NAME || team.full_name || '';
            const highlightedName = shouldHighlight ? highlightText(teamName, searchTerm) : teamName;
            const highlightedAbbr = shouldHighlight ? highlightText(team.abbr || '', searchTerm) : (team.abbr || '');
            return `
                <div class="list-item ${selectedTeam && selectedTeam.id === team.id ? 'active' : ''}" onclick="selectTeam(${team.id})">
                    <div class="list-item-content">
                        <div class="list-item-name">${highlightedName}</div>
                        <div class="list-item-abbr">${highlightedAbbr}</div>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn-icon" onclick="showEditTeamModal(${team.id}); event.stopPropagation();" title="Edit team">✏️</button>
                        <button class="btn-icon" onclick="deleteTeam(${team.id}); event.stopPropagation();" title="Delete team">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Update unmapped list - show ALL unmapped team names (team_id is NULL)
    // Do NOT filter by league - show all unmapped teams regardless of selected league
    let allUnmapped = teamMappings.filter(m => {
        // Only show if team_id is NULL (unmapped)
        return m.team_id === null || m.team_id === undefined;
    });

    // Apply search filter only if filtering 'all' or 'unmapped'
    if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'unmapped')) {
        allUnmapped = allUnmapped.filter(m =>
            m.name.toLowerCase().includes(searchTerm)
        );
    }

    document.getElementById('team-unmapped-count').textContent = allUnmapped.length;
    if (allUnmapped.length === 0) {
        unmappedList.innerHTML = '<div class="empty-state-small">No unmapped names</div>';
    } else {
        const shouldHighlightUnmapped = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'unmapped');
        unmappedList.innerHTML = allUnmapped.map(m => {
            const highlightedName = shouldHighlightUnmapped ? highlightText(m.name, searchTerm) : m.name;
            const teamName = selectedTeam ? (selectedTeam.NAME || selectedTeam.full_name || '') : '';
            return `
                <div class="list-item unmapped-item" data-mapping-id="${m.id}">
                    <div class="list-item-name">${highlightedName}</div>
                    <div class="list-item-actions">
                        ${selectedTeam ? `<button class="map-btn" onclick="mapTeamMapping(${m.id}, ${selectedTeam.id}); event.stopPropagation();">Map to ${teamName}</button>` : ''}
                        <button class="btn-icon" onclick="deleteTeamMapping(${m.id}); event.stopPropagation();" title="Delete unmapped name">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Update mappings based on selected team
    if (!selectedTeam) {
        mappingsList.innerHTML = '<div class="empty-state-small">Click a team to view mappings</div>';
        document.getElementById('add-team-mapping-btn').style.display = 'none';
    } else {
        // Show mappings for the selected team
        let mapped = teamMappings.filter(m => m.team_id !== null && Number(m.team_id) === Number(selectedTeam.id));

        // Apply search filter only if applySearchToMappings is true and filtering 'all' or 'mappings'
        const mappingsSearchTerm = applySearchToMappings ? document.getElementById('global-search').value.toLowerCase() : '';
        if (mappingsSearchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings')) {
            mapped = mapped.filter(m =>
                m.name.toLowerCase().includes(mappingsSearchTerm)
            );
        }

        document.getElementById('add-team-mapping-btn').style.display = 'block';

        if (mapped.length === 0) {
            mappingsList.innerHTML = '<div class="empty-state-small">No mappings for this team yet</div>';
        } else {
            const shouldHighlightMappings = mappingsSearchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings');
            console.log('Setting HTML with', mapped.length, 'mappings');
            const html = mapped.map(m => {
                const highlightedName = shouldHighlightMappings ? highlightText(m.name, mappingsSearchTerm) : m.name;
                return `
                    <div class="mapping-item-compact" data-mapping-id="${m.id}">
                        <span class="mapping-name">${highlightedName}</span>
                        <button class="btn btn-danger btn-sm" onclick="unmapTeamMapping(${m.id})">Unmap</button>
                    </div>
                `;
            }).join('');
            console.log('Generated HTML:', html);
            mappingsList.innerHTML = html;
            console.log('After setting innerHTML:', mappingsList.innerHTML);
        }
    }
}

function selectTeam(teamId) {
    // Toggle selection if clicking the same team
    if (selectedTeam && selectedTeam.id == teamId) {
        selectedTeam = null;
    } else {
        selectedTeam = teams.find(t => t.id == teamId);
    }

    // Get current search term to maintain filtering on teams and unmapped names
    const searchTerm = document.getElementById('global-search').value.toLowerCase();

    // Refresh with search term but don't apply it to mappings (applySearchToMappings = false)
    loadTeamsForLeague(searchTerm, false);
}

function filterTeams(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadTeamsForLeague(searchTerm);
}

// ===== PLAYER FUNCTIONS =====

function loadPlayersForTeam(searchTerm = '') {
    const leagueId = selectedLeagueForPlayers ? selectedLeagueForPlayers.id : null;
    const teamId = selectedTeamForPlayers ? selectedTeamForPlayers.id : null;
    const playersList = document.getElementById('players-list');
    const unmappedList = document.getElementById('player-unmapped-list');
    const mappingsList = document.getElementById('player-mappings-list');

    let filteredPlayers;

    if (teamId) {
        // Team selected - show players for this specific team
        const teamPlayerIds = teamPlayers
            .filter(tp => tp.team_id == teamId)
            .map(tp => tp.player_id);
        filteredPlayers = players.filter(p => teamPlayerIds.includes(p.id));
    } else if (leagueId) {
        // League selected but no team - show all players for teams in this league
        const leagueTeamIds = leagueTeams
            .filter(lt => lt.league_id == leagueId)
            .map(lt => lt.team_id);
        const leaguePlayerIds = teamPlayers
            .filter(tp => leagueTeamIds.includes(tp.team_id))
            .map(tp => tp.player_id);
        filteredPlayers = players.filter(p => leaguePlayerIds.includes(p.id));
    } else {
        // No filters - show all players
        filteredPlayers = players;
    }

    // Apply search filter
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredPlayers = filteredPlayers.filter(p =>
            (p.display_name && p.display_name.toLowerCase().includes(lowerSearch)) ||
            (p.first_name && p.first_name.toLowerCase().includes(lowerSearch)) ||
            (p.last_name && p.last_name.toLowerCase().includes(lowerSearch))
        );
    }

    // Display players
    if (filteredPlayers.length === 0) {
        playersList.innerHTML = '<div class="empty-state-small">No players found</div>';
        document.getElementById('players-count').textContent = '0';
    } else {
        const playersHtml = filteredPlayers.map(player => {
            const isActive = selectedPlayer && selectedPlayer.id == player.id;
            const displayName = player.display_name || `${player.first_name} ${player.last_name}`;
            const highlightedName = highlightText(displayName, currentSearchFilter === 'all' || currentSearchFilter === 'items' ? searchTerm : '');
            return `
                <div class="list-item ${isActive ? 'active' : ''}" onclick="selectPlayer(${player.id})">
                    <div class="list-item-content">
                        <div class="list-item-name">${highlightedName}</div>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn-icon" onclick="showEditPlayerModal(${player.id}); event.stopPropagation();" title="Edit player">✏️</button>
                        <button class="btn-icon" onclick="deletePlayer(${player.id}); event.stopPropagation();" title="Delete player">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        playersList.innerHTML = playersHtml;
        document.getElementById('players-count').textContent = filteredPlayers.length;
    }

    // Display unmapped names (empty for now as requested)
    unmappedList.innerHTML = '<div class="empty-state-small">No unmapped names</div>';
    document.getElementById('player-unmapped-count').textContent = '0';

    // Display mappings for selected player
    if (selectedPlayer) {
        const mappings = playerMappings.filter(m => m.player_id == selectedPlayer.id);
        if (mappings.length === 0) {
            mappingsList.innerHTML = '<div class="empty-state-small">No mappings yet</div>';
        } else {
            const mappingsHtml = mappings.map(mapping => `
                <div class="list-item">
                    <div class="list-item-main">
                        <div class="list-item-name">${highlightText(mapping.name, currentSearchFilter === 'all' || currentSearchFilter === 'mapped' ? searchTerm : '')}</div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deletePlayerMapping(${mapping.id})">Delete</button>
                </div>
            `).join('');
            mappingsList.innerHTML = mappingsHtml;
        }
        document.getElementById('add-player-mapping-btn').style.display = 'block';
    } else {
        mappingsList.innerHTML = '<div class="empty-state-small">Click a player to view mappings</div>';
        document.getElementById('add-player-mapping-btn').style.display = 'none';
    }
}

function selectPlayer(playerId) {
    // Toggle selection if clicking the same player
    if (selectedPlayer && selectedPlayer.id == playerId) {
        selectedPlayer = null;
    } else {
        selectedPlayer = players.find(p => p.id == playerId);
    }

    // Clear search bar
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }

    loadPlayersForTeam(); // Refresh to update active state and show mappings

    // Scroll to selected player if one is selected
    setTimeout(() => {
        const activeItem = document.querySelector('#players-list .list-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function filterPlayers(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadPlayersForTeam(searchTerm);
}

function showAddLeagueMappingModal() {
    if (!selectedLeague) return;
    currentMappingContext = { type: 'league', id: selectedLeague.id, name: selectedLeague.fullname };
    document.getElementById('modal-title').textContent = 'Add League Mapping';
    document.getElementById('modal-selected-label').textContent = 'Selected League:';
    document.getElementById('modal-selected-item').textContent = selectedLeague.fullname;
    document.getElementById('modal-selected-item-group').style.display = 'block';
    document.getElementById('modal-label').textContent = 'Mapped League Name:';
    document.getElementById('modal-unmapped-name').value = '';
    document.getElementById('modal-target-group').style.display = 'none';
    document.getElementById('mapping-modal').classList.add('active');
}

function showAddTeamMappingModal() {
    if (!selectedTeam) return;

    // Get the league_id for the selected league
    let leagueId = null;
    if (selectedLeagueForTeams) {
        leagueId = selectedLeagueForTeams.id;
    }

    currentMappingContext = {
        type: 'team',
        id: selectedTeam.id,
        name: selectedTeam.NAME || selectedTeam.full_name,
        leagueId: leagueId
    };
    document.getElementById('modal-title').textContent = 'Add Team Mapping';
    document.getElementById('modal-selected-label').textContent = 'Selected Team:';
    document.getElementById('modal-selected-item').textContent = selectedTeam.NAME || selectedTeam.full_name;
    document.getElementById('modal-selected-item-group').style.display = 'block';
    document.getElementById('modal-label').textContent = 'Mapped Team Name:';
    document.getElementById('modal-unmapped-name').value = '';
    document.getElementById('modal-target-group').style.display = 'none';
    document.getElementById('mapping-modal').classList.add('active');
}

function showAddPlayerMapping(positionId, positionName) {
    currentMappingContext = { type: 'player', id: positionId, name: positionName };
    document.getElementById('modal-title').textContent = 'Add Player Mapping';
    document.getElementById('modal-selected-label').textContent = 'Selected Position:';
    document.getElementById('modal-selected-item').textContent = positionName;
    document.getElementById('modal-selected-item-group').style.display = 'block';
    document.getElementById('modal-label').textContent = 'Mapped Position Name:';
    document.getElementById('modal-unmapped-name').value = '';
    document.getElementById('modal-target-group').style.display = 'none';
    document.getElementById('mapping-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('mapping-modal').classList.remove('active');
    currentMappingContext = null;
}

// ===== LEAGUE ADD/EDIT MODAL FUNCTIONS =====
let currentEditingLeague = null;

function showAddLeagueModal() {
    currentEditingLeague = null;
    document.getElementById('league-modal-title').textContent = 'Add League';
    document.getElementById('league-name').value = '';
    document.getElementById('league-fullname').value = '';
    document.getElementById('league-abbr').value = '';
    document.getElementById('league-active').checked = true;

    // Get currently selected sport from the filter
    const selectedSportId = document.getElementById('global-sport-filter').value;

    // Populate sports dropdown
    const sportSelect = document.getElementById('league-sport-id');
    sportSelect.innerHTML = '<option value="">Select sport...</option>' +
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    // Pre-select the sport if one is selected
    if (selectedSportId) {
        sportSelect.value = selectedSportId;
    }

    document.getElementById('league-modal').classList.add('active');
}

function showEditLeagueModal(leagueId) {
    const league = leagues.find(l => l.id == leagueId);
    if (!league) return;

    currentEditingLeague = league;
    document.getElementById('league-modal-title').textContent = 'Edit League';
    document.getElementById('league-name').value = league.name || '';
    document.getElementById('league-fullname').value = league.fullname || '';
    document.getElementById('league-abbr').value = league.abbr || '';
    document.getElementById('league-sport-id').value = league.sport_id || '';
    document.getElementById('league-active').checked = league.active == 1;

    // Populate sports dropdown
    const sportSelect = document.getElementById('league-sport-id');
    sportSelect.innerHTML = '<option value="">Select sport...</option>' +
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    document.getElementById('league-modal').classList.add('active');
}

function closeLeagueModal() {
    document.getElementById('league-modal').classList.remove('active');
    currentEditingLeague = null;
}

async function saveLeague() {
    const name = document.getElementById('league-name').value.trim();
    const fullname = document.getElementById('league-fullname').value.trim();
    const abbr = document.getElementById('league-abbr').value.trim();
    const sport_id = document.getElementById('league-sport-id').value;
    const active = document.getElementById('league-active').checked ? 1 : 0;

    if (!name || !fullname || !abbr || !sport_id) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        let newLeagueId = null;
        if (currentEditingLeague) {
            // Update existing league
            await apiCall('updateLeague', {
                id: currentEditingLeague.id,
                name,
                fullname,
                abbr,
                sport_id,
                active
            });
            showNotification('League updated successfully', 'success');
        } else {
            // Add new league
            const result = await apiCall('addLeague', {
                name,
                fullname,
                abbr,
                sport_id,
                active
            });
            newLeagueId = result.id;
            showNotification('League added successfully', 'success');
        }

        await loadLeagues();
        loadLeaguesForSport();
        closeLeagueModal();

        // Highlight and scroll to newly added league
        if (newLeagueId) {
            setTimeout(() => {
                highlightAndScrollToRow('leagues-list', newLeagueId);
            }, 100);
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteLeague(leagueId) {
    if (!confirm('Are you sure you want to delete this league? This action cannot be undone.')) return;

    try {
        await apiCall('deleteLeague', { id: leagueId });
        await loadLeagues();
        loadLeaguesForSport();

        // Clear selection if the deleted league was selected
        if (selectedLeague && selectedLeague.id == leagueId) {
            selectedLeague = null;
            updateLeagueSelectedDisplay();
        }

        showNotification('League deleted successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// ===== TEAM ADD/EDIT MODAL FUNCTIONS =====
let currentEditingTeam = null;
let selectedTeamLeagueIds = [];

function showAddTeamModal() {
    currentEditingTeam = null;
    selectedTeamLeagueIds = [];

    document.getElementById('team-modal-title').textContent = 'Add Team';
    document.getElementById('team-name').value = '';
    document.getElementById('team-first-name').value = '';
    document.getElementById('team-nickname').value = '';
    document.getElementById('team-abbr').value = '';
    document.getElementById('team-full-name').value = '';
    document.getElementById('team-leagues-search').value = '';

    // Populate sport dropdown
    const sportSelect = document.getElementById('team-sport-filter');
    sportSelect.innerHTML = '<option value="">All Sports</option>' +
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    // Set to currently selected sport if any
    const selectedSportId = document.getElementById('global-sport-filter').value;
    if (selectedSportId) {
        sportSelect.value = selectedSportId;
    }

    // Setup league search
    setupLeagueSearch();
    updateSelectedLeaguesTags();

    document.getElementById('team-modal').classList.add('active');
}

function showEditTeamModal(teamId) {
    const team = teams.find(t => t.id == teamId);
    if (!team) return;

    currentEditingTeam = team;

    // Get leagues this team belongs to
    selectedTeamLeagueIds = leagueTeams.filter(lt => lt.team_id == teamId).map(lt => lt.league_id);

    document.getElementById('team-modal-title').textContent = 'Edit Team';
    document.getElementById('team-name').value = team.name || '';
    document.getElementById('team-first-name').value = team.first_name || '';
    document.getElementById('team-nickname').value = team.nickname || '';
    document.getElementById('team-abbr').value = team.abbr || '';
    document.getElementById('team-full-name').value = team.full_name || '';
    document.getElementById('team-leagues-search').value = '';

    // Populate sport dropdown
    const sportSelect = document.getElementById('team-sport-filter');
    sportSelect.innerHTML = '<option value="">All Sports</option>' +
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    // Set to currently selected sport if any
    const selectedSportId = document.getElementById('global-sport-filter').value;
    if (selectedSportId) {
        sportSelect.value = selectedSportId;
    }

    // Setup league search
    setupLeagueSearch();
    updateSelectedLeaguesTags();

    document.getElementById('team-modal').classList.add('active');
}

function setupLeagueSearch() {
    const searchInput = document.getElementById('team-leagues-search');
    const dropdown = document.getElementById('team-leagues-dropdown');

    // Show dropdown on focus
    searchInput.addEventListener('focus', () => {
        filterAndShowLeagues('');
    });

    // Filter as user types
    searchInput.addEventListener('input', (e) => {
        filterAndShowLeagues(e.target.value);
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#team-leagues-search') && !e.target.closest('#team-leagues-dropdown')) {
            dropdown.style.display = 'none';
        }
    });
}

function filterAndShowLeagues(searchTerm) {
    const dropdown = document.getElementById('team-leagues-dropdown');
    const lowerSearch = searchTerm.toLowerCase();

    // Get selected sport filter
    const selectedSportId = document.getElementById('team-sport-filter').value;

    // Group leagues by sport
    const leaguesBySport = {};
    leagues.forEach(league => {
        // Skip already selected leagues
        if (selectedTeamLeagueIds.includes(league.id)) return;

        // Filter by sport if selected
        if (selectedSportId && league.sport_id != selectedSportId) {
            return;
        }

        // Filter by search term
        if (searchTerm && !league.fullname.toLowerCase().includes(lowerSearch) &&
            !league.abbr.toLowerCase().includes(lowerSearch)) {
            return;
        }

        const sport = sports.find(s => s.id == league.sport_id);
        const sportName = sport ? sport.name : 'Unknown';
        if (!leaguesBySport[sportName]) {
            leaguesBySport[sportName] = [];
        }
        leaguesBySport[sportName].push(league);
    });

    // Build HTML
    let html = '';
    const sortedSports = Object.keys(leaguesBySport).sort();

    if (sortedSports.length === 0) {
        html = '<div class="leagues-dropdown-item" style="color: var(--text-secondary);">No leagues found</div>';
    } else {
        sortedSports.forEach(sportName => {
            html += `<div class="leagues-dropdown-sport-header">${sportName}</div>`;
            leaguesBySport[sportName].forEach(league => {
                html += `
                    <div class="leagues-dropdown-item" onclick="addLeagueToTeam(${league.id})">
                        ${league.fullname} (${league.abbr})
                    </div>
                `;
            });
        });
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

function addLeagueToTeam(leagueId) {
    if (!selectedTeamLeagueIds.includes(leagueId)) {
        selectedTeamLeagueIds.push(leagueId);
        updateSelectedLeaguesTags();

        // Clear search and refresh dropdown
        const searchInput = document.getElementById('team-leagues-search');
        searchInput.value = '';
        filterAndShowLeagues('');
        searchInput.focus();
    }
}

function removeLeagueFromTeam(leagueId) {
    selectedTeamLeagueIds = selectedTeamLeagueIds.filter(id => id !== leagueId);
    updateSelectedLeaguesTags();

    // Refresh dropdown if it's open
    const dropdown = document.getElementById('team-leagues-dropdown');
    if (dropdown.style.display === 'block') {
        const searchInput = document.getElementById('team-leagues-search');
        filterAndShowLeagues(searchInput.value);
    }
}

function filterTeamLeaguesBySport() {
    // Refresh the leagues dropdown when sport filter changes
    const searchInput = document.getElementById('team-leagues-search');
    const dropdown = document.getElementById('team-leagues-dropdown');

    // If dropdown is visible, refresh it
    if (dropdown.style.display === 'block') {
        filterAndShowLeagues(searchInput.value);
    }
}

function updateSelectedLeaguesTags() {
    const container = document.getElementById('team-selected-leagues');

    if (selectedTeamLeagueIds.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.75rem;">No leagues selected</div>';
        return;
    }

    const html = selectedTeamLeagueIds.map(leagueId => {
        const league = leagues.find(l => l.id == leagueId);
        if (!league) return '';

        return `
            <div class="league-tag">
                ${league.abbr}
                <span class="league-tag-remove" onclick="removeLeagueFromTeam(${leagueId})">&times;</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function closeTeamModal() {
    document.getElementById('team-modal').classList.remove('active');
    document.getElementById('team-leagues-dropdown').style.display = 'none';
    currentEditingTeam = null;
    selectedTeamLeagueIds = [];
}

async function saveTeam() {
    const name = document.getElementById('team-name').value.trim();
    const first_name = document.getElementById('team-first-name').value.trim();
    const nickname = document.getElementById('team-nickname').value.trim();
    const abbr = document.getElementById('team-abbr').value.trim();
    const full_name = document.getElementById('team-full-name').value.trim();

    // Get selected league IDs
    const checkboxes = document.querySelectorAll('#team-leagues-checkboxes input[type="checkbox"]:checked');
    const league_ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (!name || !abbr) {
        showNotification('Please fill in at least Name and Abbreviation', 'error');
        return;
    }

    try {
        let newTeamId = null;
        if (currentEditingTeam) {
            // Update existing team
            await apiCall('updateTeam', {
                id: currentEditingTeam.id,
                name,
                first_name,
                nickname,
                abbr,
                abbr_parser: '',
                full_name,
                location_id: null,
                league_ids
            });
            showNotification('Team updated successfully', 'success');
        } else {
            // Add new team
            const result = await apiCall('addTeam', {
                name,
                first_name,
                nickname,
                abbr,
                abbr_parser: '',
                full_name,
                location_id: null,
                league_ids
            });
            newTeamId = result.id;
            showNotification('Team added successfully', 'success');
        }

        await loadTeams();
        await loadLeagueTeams();
        loadTeamsForLeague();
        closeTeamModal();

        // Highlight and scroll to newly added team
        if (newTeamId) {
            setTimeout(() => {
                highlightAndScrollToRow('teams-list', newTeamId);
            }, 100);
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteTeam(teamId) {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) return;

    try {
        await apiCall('deleteTeam', { id: teamId });
        await loadTeams();
        await loadLeagueTeams();
        loadTeamsForLeague();

        // Clear selection if the deleted team was selected
        if (selectedTeam && selectedTeam.id == teamId) {
            selectedTeam = null;
        }

        showNotification('Team deleted successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// ===== PLAYER ADD/EDIT MODAL FUNCTIONS =====
let currentEditingPlayer = null;
let selectedPlayerTeamIds = [];

function showAddPlayerModal() {
    currentEditingPlayer = null;
    selectedPlayerTeamIds = [];

    document.getElementById('player-modal-title').textContent = 'Add Player';
    document.getElementById('player-first-name').value = '';
    document.getElementById('player-last-name').value = '';
    document.getElementById('player-left-handed').checked = false;

    // Populate position dropdown
    const positionSelect = document.getElementById('player-position-id');
    positionSelect.innerHTML = '<option value="">Select position...</option>' +
        positions.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Pre-select the currently selected team if any
    if (selectedTeamForPlayers) {
        selectedPlayerTeamIds = [selectedTeamForPlayers.id];
        // Show the team name in the search field
        document.getElementById('player-teams-search').value = selectedTeamForPlayers.full_name;
    } else {
        document.getElementById('player-teams-search').value = '';
    }

    document.getElementById('player-modal').classList.add('active');
}

function showEditPlayerModal(playerId) {
    const player = players.find(p => p.id == playerId);
    if (!player) return;

    currentEditingPlayer = player;
    document.getElementById('player-modal-title').textContent = 'Edit Player';
    document.getElementById('player-first-name').value = player.first_name || '';
    document.getElementById('player-last-name').value = player.last_name || '';
    document.getElementById('player-left-handed').checked = player.left_handed == 1;
    document.getElementById('player-teams-search').value = '';

    // Populate position dropdown
    const positionSelect = document.getElementById('player-position-id');
    positionSelect.innerHTML = '<option value="">Select position...</option>' +
        positions.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (player.position_id) {
        positionSelect.value = player.position_id;
    }

    // Load player's teams
    selectedPlayerTeamIds = teamPlayers
        .filter(tp => tp.player_id == playerId)
        .map(tp => tp.team_id);

    // Show team names in search field
    if (selectedPlayerTeamIds.length > 0) {
        const teamNames = selectedPlayerTeamIds.map(teamId => {
            const team = teams.find(t => t.id == teamId);
            return team ? team.full_name : '';
        }).filter(name => name).join(', ');
        document.getElementById('player-teams-search').value = teamNames;
    }

    document.getElementById('player-modal').classList.add('active');
}

function closePlayerModal() {
    document.getElementById('player-modal').classList.remove('active');
    document.getElementById('player-teams-dropdown').style.display = 'none';
    currentEditingPlayer = null;
    selectedPlayerTeamIds = [];
}

function filterPlayerTeamsDropdown() {
    const searchTerm = document.getElementById('player-teams-search').value.toLowerCase();
    const dropdown = document.getElementById('player-teams-dropdown');

    // Filter teams by selected league if one is selected - show teams with NAME OR full_name
    let availableTeams = teams.filter(t =>
        (t.NAME && t.NAME.trim() !== '') || (t.full_name && t.full_name.trim() !== '')
    );
    if (selectedLeagueForPlayers) {
        const leagueTeamIds = leagueTeams
            .filter(lt => lt.league_id == selectedLeagueForPlayers.id)
            .map(lt => lt.team_id);
        availableTeams = availableTeams.filter(t => leagueTeamIds.includes(t.id));
    }

    // Apply search filter
    const filteredTeams = availableTeams.filter(t => {
        const teamName = t.NAME || t.full_name || '';
        return teamName.toLowerCase().includes(searchTerm) ||
            (t.abbr && t.abbr.toLowerCase().includes(searchTerm));
    });

    if (filteredTeams.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">No teams found</div>';
    } else {
        dropdown.innerHTML = filteredTeams.map(t => {
            const teamName = t.NAME || t.full_name || '';
            return `
                <div class="autocomplete-item ${selectedPlayerTeamIds.includes(t.id) ? 'selected' : ''}"
                     onclick="togglePlayerTeam(${t.id})">
                    ${teamName}
                    ${selectedPlayerTeamIds.includes(t.id) ? '<span style="float: right;">✓</span>' : ''}
                </div>
            `;
        }).join('');
    }
    dropdown.style.display = 'block';
}

function showPlayerTeamsDropdown() {
    filterPlayerTeamsDropdown();
}

function togglePlayerTeam(teamId) {
    const index = selectedPlayerTeamIds.indexOf(teamId);
    if (index > -1) {
        selectedPlayerTeamIds.splice(index, 1);
    } else {
        selectedPlayerTeamIds.push(teamId);
    }

    // Update the search field with selected team names
    if (selectedPlayerTeamIds.length > 0) {
        const teamNames = selectedPlayerTeamIds.map(id => {
            const team = teams.find(t => t.id == id);
            return team ? team.full_name : '';
        }).filter(name => name).join(', ');
        document.getElementById('player-teams-search').value = teamNames;
    } else {
        document.getElementById('player-teams-search').value = '';
    }

    // Hide the dropdown after selection
    document.getElementById('player-teams-dropdown').style.display = 'none';
}

function clearPlayerTeamsSelection() {
    selectedPlayerTeamIds = [];
    document.getElementById('player-teams-search').value = '';
    // Show the dropdown after clearing
    filterPlayerTeamsDropdown();
}

async function savePlayer() {
    const first_name = document.getElementById('player-first-name').value.trim();
    const last_name = document.getElementById('player-last-name').value.trim();
    const position_id = document.getElementById('player-position-id').value;
    const left_handed = document.getElementById('player-left-handed').checked ? 1 : 0;

    // Get selected team IDs
    const team_ids = selectedPlayerTeamIds;

    if (!first_name || !last_name) {
        showNotification('Please fill in at least First Name and Last Name', 'error');
        return;
    }

    if (!team_ids || team_ids.length === 0) {
        showNotification('Please select at least one team', 'error');
        return;
    }

    try {
        let newPlayerId = null;
        if (currentEditingPlayer) {
            // Update existing player
            await apiCall('updatePlayer', {
                id: currentEditingPlayer.id,
                first_name,
                last_name,
                position_id: position_id || null,
                left_handed,
                team_ids
            });
            showNotification('Player updated successfully', 'success');
        } else {
            // Add new player
            const result = await apiCall('addPlayer', {
                first_name,
                last_name,
                position_id: position_id || null,
                left_handed,
                team_ids
            });
            newPlayerId = result.id;
            showNotification('Player added successfully', 'success');
        }

        await loadPlayers();
        await loadTeamPlayers();
        loadPlayersForTeam();
        closePlayerModal();

        // Highlight and scroll to newly added player
        if (newPlayerId) {
            setTimeout(() => {
                highlightAndScrollToRow('players-list', newPlayerId);
            }, 100);
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deletePlayer(playerId) {
    if (!confirm('Are you sure you want to delete this player? This action cannot be undone.')) return;

    try {
        await apiCall('deletePlayer', { id: playerId });
        await loadPlayers();
        await loadTeamPlayers();
        loadPlayersForTeam();

        // Clear selection if the deleted player was selected
        if (selectedPlayer && selectedPlayer.id == playerId) {
            selectedPlayer = null;
        }

        showNotification('Player deleted successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function saveMapping() {
    const name = document.getElementById('modal-unmapped-name').value.trim();
    if (!name) {
        showNotification('Please enter a mapped name', 'error');
        return;
    }
    try {
        if (currentMappingContext.type === 'league') {
            await apiCall('addLeagueMapping', { name, league_id: currentMappingContext.id });
            await loadLeagueMappings();
            loadLeaguesForSport();
        } else if (currentMappingContext.type === 'team') {
            await apiCall('addTeamMapping', { name, league_id: currentMappingContext.leagueId, team_id: currentMappingContext.id });
            await loadTeamMappings();
            loadTeamsForLeague();
        } else if (currentMappingContext.type === 'player') {
            await apiCall('addPlayerMapping', { name, team_mapping_id: currentMappingContext.teamMappingId, player_id: currentMappingContext.id });
            await loadPlayerMappings();
            loadPlayersForTeam();
        }
        showNotification('Mapping added successfully', 'success');
        closeModal();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteLeagueMapping(id) {
    if (!confirm('Delete this league mapping?')) return;
    try {
        await apiCall('deleteLeagueMapping', { id });
        await loadLeagueMappings();
        loadLeaguesForSport();
        if (selectedLeague) {
            selectLeague(selectedLeague.id);
        }
        showNotification('Mapping deleted', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function unmapLeagueMapping(id) {
    if (!confirm('Unmap this league mapping?')) return;
    try {
        await apiCall('updateLeagueMapping', { id, league_id: null });
        await loadLeagueMappings();
        loadLeaguesForSport();

        // Highlight and scroll to the unmapped item
        setTimeout(() => {
            const unmappedItem = document.querySelector(`[data-mapping-id="${id}"]`);
            if (unmappedItem) {
                unmappedItem.classList.add('highlight-success');
                unmappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    unmappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);

        showNotification('Mapping unmapped successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteTeamMapping(id) {
    if (!confirm('Delete this team mapping?')) return;
    try {
        await apiCall('deleteTeamMapping', { id });
        await loadTeamMappings();
        loadTeamsForLeague();
        if (selectedTeam) {
            selectTeam(selectedTeam.id);
        }
        showNotification('Mapping deleted', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function unmapTeamMapping(id) {
    if (!confirm('Unmap this team mapping?')) return;
    try {
        await apiCall('updateTeamMapping', { id, team_id: null });
        await loadTeamMappings();
        loadTeamsForLeague();

        // Highlight and scroll to the unmapped item
        setTimeout(() => {
            const unmappedItem = document.querySelector(`[data-mapping-id="${id}"]`);
            if (unmappedItem) {
                unmappedItem.classList.add('highlight-success');
                unmappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    unmappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);

        showNotification('Mapping unmapped successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// ===== PLAYER MAPPING FUNCTIONS =====

function showAddPlayerMappingModal() {
    if (!selectedPlayer) return;

    // Find the team_mapping_id for the selected team
    let teamMappingId = null;
    if (selectedTeamForPlayers) {
        // Find any team_mapping that has this team_id
        const teamMapping = teamMappings.find(tm => tm.team_id === selectedTeamForPlayers.id);
        teamMappingId = teamMapping ? teamMapping.id : null;
    }

    currentMappingContext = {
        type: 'player',
        id: selectedPlayer.id,
        name: selectedPlayer.display_name || `${selectedPlayer.first_name} ${selectedPlayer.last_name}`,
        teamMappingId: teamMappingId
    };
    document.getElementById('modal-title').textContent = 'Add Player Mapping';
    document.getElementById('modal-selected-label').textContent = 'Selected Player:';
    document.getElementById('modal-selected-item').textContent = selectedPlayer.display_name || `${selectedPlayer.first_name} ${selectedPlayer.last_name}`;
    document.getElementById('modal-selected-item-group').style.display = 'block';
    document.getElementById('mapping-modal').style.display = 'flex';
    document.getElementById('mapping-name').value = '';
    document.getElementById('mapping-name').focus();
}

async function deletePlayerMapping(id) {
    if (!confirm('Delete this player mapping?')) return;
    try {
        await apiCall('deletePlayerMapping', { id });
        await loadPlayerMappings();
        loadPlayersForTeam();
        if (selectedPlayer) {
            selectPlayer(selectedPlayer.id);
        }
        showNotification('Mapping deleted', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function unmapPlayerMapping(id) {
    if (!confirm('Unmap this player mapping?')) return;
    try {
        await apiCall('updatePlayerMapping', { id, player_id: null });
        await loadPlayerMappings();
        loadPlayersForTeam();

        // Highlight and scroll to the unmapped item
        setTimeout(() => {
            const unmappedItem = document.querySelector(`[data-mapping-id="${id}"]`);
            if (unmappedItem) {
                unmappedItem.classList.add('highlight-success');
                unmappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    unmappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);

        showNotification('Mapping unmapped successfully', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Autocomplete functions for league filter
function showLeagueDropdown() {
    filterLeagueDropdown();
}

function filterLeagueDropdown() {
    const sportId = document.getElementById('global-sport-filter').value;
    const input = document.getElementById('team-league-filter');
    const dropdown = document.getElementById('league-dropdown');
    const searchTerm = input.value.toLowerCase();

    // Filter by sport if selected, otherwise show all leagues
    let filteredLeagues = sportId ? leagues.filter(l => l.sport_id == sportId) : leagues;

    if (searchTerm) {
        filteredLeagues = filteredLeagues.filter(l =>
            l.fullname.toLowerCase().includes(searchTerm) ||
            l.abbr.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredLeagues.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item" style="cursor: default; color: var(--text-secondary);">No leagues found</div>';
    } else {
        dropdown.innerHTML = filteredLeagues.map(league => `
            <div class="autocomplete-item ${selectedLeagueForTeams && selectedLeagueForTeams.id === league.id ? 'selected' : ''}"
                 onclick="selectLeagueFromDropdown(${league.id}, event)">
                <div class="autocomplete-item-name">${league.fullname}</div>
                <div class="autocomplete-item-abbr">${league.abbr}</div>
            </div>
        `).join('');
    }

    // Only show dropdown if input is focused (user is actively interacting)
    if (document.activeElement === input) {
        dropdown.classList.add('show');
    }
}

function selectLeagueFromDropdown(leagueId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    selectedLeagueForTeams = leagues.find(l => l.id == leagueId);
    updateLeagueFilterInput();
    hideLeagueDropdown();
    loadTeamsForLeague();

    // Don't blur the input to prevent page jump
    const input = document.getElementById('team-league-filter');
    if (input) {
        input.blur();
    }
}

function updateLeagueFilterInput() {
    const input = document.getElementById('team-league-filter');
    if (selectedLeagueForTeams) {
        input.value = selectedLeagueForTeams.fullname;
    } else {
        input.value = '';
    }
}

function hideLeagueDropdown() {
    const dropdown = document.getElementById('league-dropdown');
    dropdown.classList.remove('show');
}

function clearLeagueSelection() {
    selectedLeagueForTeams = null;
    selectedLeague = null; // Also clear the league selection for the Leagues tab
    updateLeagueFilterInput();
    updateLeagueSelectedDisplay(); // Update the Leagues tab display
    hideLeagueDropdown();
    loadTeamsForLeague();

    // Clear the global search input
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }
}

// ===== PLAYER LEAGUE FILTER FUNCTIONS =====

function showPlayerLeagueDropdown() {
    const sportId = document.getElementById('global-sport-filter').value;
    if (!sportId) {
        showNotification('Please select a sport first', 'error');
        return;
    }
    filterPlayerLeagueDropdown();
}

function filterPlayerLeagueDropdown() {
    const sportId = document.getElementById('global-sport-filter').value;
    if (!sportId) return;

    const input = document.getElementById('player-league-filter');
    const dropdown = document.getElementById('player-league-dropdown');
    const searchTerm = input.value.toLowerCase();

    let filteredLeagues = leagues.filter(l => l.sport_id == sportId);

    if (searchTerm) {
        filteredLeagues = filteredLeagues.filter(l =>
            l.fullname.toLowerCase().includes(searchTerm) ||
            l.abbr.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredLeagues.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">No leagues found</div>';
    } else {
        dropdown.innerHTML = filteredLeagues.map(l =>
            `<div class="autocomplete-item" onclick="selectPlayerLeagueFromDropdown(${l.id}, event)">${l.fullname} (${l.abbr})</div>`
        ).join('');
    }

    // Only show dropdown if input is focused (user is actively interacting)
    if (document.activeElement === input) {
        dropdown.classList.add('show');
    }
}

function selectPlayerLeagueFromDropdown(leagueId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    selectedLeagueForPlayers = leagues.find(l => l.id == leagueId);
    updatePlayerLeagueFilterInput();
    hidePlayerLeagueDropdown();

    // Clear team selection when league changes
    selectedTeamForPlayers = null;
    updatePlayerTeamFilterInput();
    loadPlayersForTeam();

    const input = document.getElementById('player-league-filter');
    if (input) {
        input.blur();
    }
}

function updatePlayerLeagueFilterInput() {
    const input = document.getElementById('player-league-filter');
    if (selectedLeagueForPlayers) {
        input.value = selectedLeagueForPlayers.fullname;
    } else {
        input.value = '';
    }
}

function hidePlayerLeagueDropdown() {
    const dropdown = document.getElementById('player-league-dropdown');
    dropdown.classList.remove('show');
}

function clearPlayerLeagueSelection() {
    selectedLeagueForPlayers = null;
    selectedTeamForPlayers = null;
    updatePlayerLeagueFilterInput();
    updatePlayerTeamFilterInput();
    hidePlayerLeagueDropdown();
    hidePlayerTeamDropdown();
    loadPlayersForTeam();

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }
}

// ===== PLAYER TEAM FILTER FUNCTIONS =====

function showPlayerTeamDropdown() {
    const leagueId = selectedLeagueForPlayers ? selectedLeagueForPlayers.id : null;
    if (!leagueId) {
        showNotification('Please select a league first', 'error');
        return;
    }
    filterPlayerTeamDropdown();
}

function filterPlayerTeamDropdown() {
    const leagueId = selectedLeagueForPlayers ? selectedLeagueForPlayers.id : null;
    if (!leagueId) return;

    const input = document.getElementById('player-team-filter');
    const dropdown = document.getElementById('player-team-dropdown');
    const searchTerm = input.value.toLowerCase();

    // Get team IDs for this league from league_team junction table
    const leagueTeamIds = leagueTeams
        .filter(lt => lt.league_id == leagueId)
        .map(lt => lt.team_id);

    let filteredTeams = teams.filter(t => leagueTeamIds.includes(t.id));

    if (searchTerm) {
        filteredTeams = filteredTeams.filter(t => {
            const teamName = t.NAME || t.full_name || '';
            return teamName.toLowerCase().includes(searchTerm) ||
                (t.abbr && t.abbr.toLowerCase().includes(searchTerm));
        });
    }

    if (filteredTeams.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">No teams found</div>';
    } else {
        dropdown.innerHTML = filteredTeams.map(t => {
            const teamName = t.NAME || t.full_name || '';
            return `<div class="autocomplete-item" onclick="selectPlayerTeamFromDropdown(${t.id}, event)">${teamName} (${t.abbr || ''})</div>`;
        }).join('');
    }

    // Only show dropdown if input is focused (user is actively interacting)
    if (document.activeElement === input) {
        dropdown.classList.add('show');
    }
}

function selectPlayerTeamFromDropdown(teamId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    selectedTeamForPlayers = teams.find(t => t.id == teamId);
    updatePlayerTeamFilterInput();
    hidePlayerTeamDropdown();
    loadPlayersForTeam();

    const input = document.getElementById('player-team-filter');
    if (input) {
        input.blur();
    }
}

function updatePlayerTeamFilterInput() {
    const input = document.getElementById('player-team-filter');
    if (selectedTeamForPlayers) {
        input.value = selectedTeamForPlayers.NAME || selectedTeamForPlayers.full_name || selectedTeamForPlayers.fullname || '';
    } else {
        input.value = '';
    }
}

function hidePlayerTeamDropdown() {
    const dropdown = document.getElementById('player-team-dropdown');
    dropdown.classList.remove('show');
}

function clearPlayerTeamSelection() {
    selectedTeamForPlayers = null;
    updatePlayerTeamFilterInput();
    hidePlayerTeamDropdown();
    loadPlayersForTeam();

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.value = '';
    }
}

async function mapLeagueMapping(mappingId, leagueId) {
    try {
        await apiCall('updateLeagueMapping', { id: mappingId, league_id: leagueId });

        // Reload mappings data and refresh the view
        await loadLeagueMappings();
        loadLeaguesForSport();
        selectLeague(leagueId);

        // Highlight the item in the mapped section after reload
        setTimeout(() => {
            const mappedItem = document.querySelector(`[data-mapping-id="${mappingId}"]`);
            if (mappedItem) {
                mappedItem.classList.add('highlight-success');
                mappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    mappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);

        showNotification('Mapping updated successfully', 'success');
    } catch (error) {
        showNotification('Failed to update mapping: ' + error.message, 'error');
    }
}

async function mapTeamMapping(mappingId, teamId) {
    try {
        await apiCall('updateTeamMapping', { id: mappingId, team_id: teamId });

        // Reload mappings data and refresh the view
        await loadTeamMappings();

        // Set selected team
        selectedTeam = teams.find(t => t.id == teamId);

        // Get current search term to maintain filtering
        const searchTerm = document.getElementById('global-search').value.toLowerCase();

        // Refresh view with search term but don't apply it to mappings
        loadTeamsForLeague(searchTerm, false);

        // Highlight the item in the mapped section after reload
        setTimeout(() => {
            // Only search within the mappings list, not the unmapped list
            const mappingsList = document.getElementById('team-mappings-list');
            const mappedItem = mappingsList.querySelector(`[data-mapping-id="${mappingId}"]`);
            if (mappedItem) {
                mappedItem.classList.add('highlight-success');
                mappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    mappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);
    } catch (error) {
        showNotification('Failed to update mapping: ' + error.message, 'error');
    }
}

async function mapPlayerMapping(mappingId, playerId) {
    try {
        await apiCall('updatePlayerMapping', { id: mappingId, player_id: playerId });

        // Reload mappings data and refresh the view
        await loadPlayerMappings();
        loadPlayersForTeam();
        selectPlayer(playerId);

        // Highlight the item in the mapped section after reload
        setTimeout(() => {
            // Only search within the mappings list, not the unmapped list
            const mappingsList = document.getElementById('player-mappings-list');
            const mappedItem = mappingsList.querySelector(`[data-mapping-id="${mappingId}"]`);
            if (mappedItem) {
                mappedItem.classList.add('highlight-success');
                mappedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    mappedItem.classList.remove('highlight-success');
                }, 2000);
            }
        }, 100);
    } catch (error) {
        showNotification('Failed to update mapping: ' + error.message, 'error');
    }
}

// Utility function to highlight and scroll to a newly added item
function highlightAndScrollToRow(containerId, itemId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Find the item with the matching data-id attribute or onclick with the ID
    let item = container.querySelector(`[data-id="${itemId}"]`);

    // If not found by data-id, try finding by onclick attribute
    if (!item) {
        const items = container.querySelectorAll('.list-item');
        for (const listItem of items) {
            const onclickAttr = listItem.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(`(${itemId})`)) {
                item = listItem;
                break;
            }
        }
    }

    if (!item) return;

    // Add highlight class
    item.classList.add('row-highlight');

    // Scroll the item into view
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove highlight after 3 seconds
    setTimeout(() => {
        item.classList.remove('row-highlight');
    }, 3000);
}

