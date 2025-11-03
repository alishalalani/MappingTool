// Global state
let leagues = [], teams = [], sports = [], positions = [];
let leagueMappings = [], teamMappings = [], playerMappings = [];
let leagueTeams = []; // Junction table for league-team relationships
let currentMappingContext = null;
let currentSearchFilter = 'all';
let selectedLeague = null;
let selectedTeam = null;
let selectedLeagueForTeams = null; // Track selected league in Teams tab
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

            if (tabName === 'teams') {
                leagueFilterContainer.style.display = 'flex';
                leagueSelectedContainer.style.display = 'none';
                // Carry over selected league from Leagues tab
                if (selectedLeague) {
                    selectedLeagueForTeams = selectedLeague;
                    updateLeagueFilterInput();
                    loadTeamsForLeague();
                }
            } else if (tabName === 'leagues') {
                leagueFilterContainer.style.display = 'none';
                leagueSelectedContainer.style.display = 'flex';
                updateLeagueSelectedDisplay();
            } else {
                leagueFilterContainer.style.display = 'none';
                leagueSelectedContainer.style.display = 'none';
            }
        });
    });
    // Initialize labels for the default tab
    updateSearchFilterLabels('leagues');

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            hideLeagueDropdown();
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
    }
}

async function loadInitialData() {
    try {
        await Promise.all([
            loadSports(), loadLeagues(), loadTeams(), loadLeagueTeams(), loadPositions(),
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

    const leagueOpts = leagues.map(l => `<option value="${l.id}">${l.fullname} (${l.abbr})</option>`).join('');
    document.getElementById('team-league-filter').innerHTML = '<option value="">-- Select a League --</option>' + leagueOpts;

    // Load all positions immediately since they don't have sport filtering
    loadAllPositions();
}

function onSportChange() {
    const sportId = document.getElementById('global-sport-filter').value;

    // Update leagues
    loadLeaguesForSport();

    // Update team league filter to only show leagues from selected sport
    if (sportId) {
        const sportLeagues = leagues.filter(l => l.sport_id == sportId);
        const leagueOpts = sportLeagues.map(l => `<option value="${l.id}">${l.fullname} (${l.abbr})</option>`).join('');
        document.getElementById('team-league-filter').innerHTML = '<option value="">-- Select a League --</option>' + leagueOpts;
    } else {
        const leagueOpts = leagues.map(l => `<option value="${l.id}">${l.fullname} (${l.abbr})</option>`).join('');
        document.getElementById('team-league-filter').innerHTML = '<option value="">-- Select a League --</option>' + leagueOpts;
    }

    // Clear teams content
    document.getElementById('teams-content').innerHTML = '<div class="empty-state"><p>👆 Please select a league to view teams</p></div>';
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
async function loadTeams() { teams = await apiCall('getTeams'); }
async function loadLeagueTeams() { leagueTeams = await apiCall('getLeagueTeams'); }
async function loadPositions() { positions = await apiCall('getPositions'); }
async function loadLeagueMappings() { leagueMappings = await apiCall('getLeagueMappings'); }
async function loadTeamMappings() { teamMappings = await apiCall('getTeamMappings'); }
async function loadPlayerMappings() { playerMappings = await apiCall('getPlayerMappings'); }

function loadLeaguesForSport(searchTerm = '') {
    const sportId = document.getElementById('global-sport-filter').value;
    const leaguesList = document.getElementById('leagues-list');
    const unmappedList = document.getElementById('unmapped-list');
    const mappingsList = document.getElementById('mappings-list');

    if (!sportId) {
        leaguesList.innerHTML = '<div class="empty-state-small">Select a sport</div>';
        unmappedList.innerHTML = '<div class="empty-state-small">No unmapped names</div>';
        mappingsList.innerHTML = '<div class="empty-state-small">Click a league to view mappings</div>';
        document.getElementById('leagues-count').textContent = '0';
        document.getElementById('unmapped-count').textContent = '0';
        return;
    }

    let sportLeagues = leagues.filter(l => l.sport_id == sportId);

    // Apply search filter only if filtering 'all' or 'items' (leagues)
    if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'items')) {
        sportLeagues = sportLeagues.filter(l =>
            l.fullname.toLowerCase().includes(searchTerm) ||
            l.abbr.toLowerCase().includes(searchTerm)
        );
    }

    // Update leagues list
    document.getElementById('leagues-count').textContent = sportLeagues.length;
    if (sportLeagues.length === 0) {
        leaguesList.innerHTML = '<div class="empty-state-small">No leagues found</div>';
    } else {
        const shouldHighlight = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'items');
        leaguesList.innerHTML = sportLeagues.map(league => {
            const highlightedName = shouldHighlight ? highlightText(league.fullname, searchTerm) : league.fullname;
            const highlightedAbbr = shouldHighlight ? highlightText(league.abbr, searchTerm) : league.abbr;
            return `
                <div class="list-item ${selectedLeague && selectedLeague.id === league.id ? 'active' : ''}" onclick="selectLeague(${league.id})">
                    <div class="list-item-name">${highlightedName}</div>
                    <div class="list-item-abbr">${highlightedAbbr}</div>
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
    selectedLeague = leagues.find(l => l.id == leagueId);
    loadLeaguesForSport(); // Refresh to update active state
    updateLeagueSelectedDisplay(); // Update the selected league display

    // Show mappings for this league
    const mappingsList = document.getElementById('mappings-list');
    // Convert both to numbers for comparison
    let mapped = leagueMappings.filter(m => m.league_id !== null && Number(m.league_id) === Number(leagueId));

    // Apply search filter only if filtering 'all' or 'mappings'
    const searchTerm = document.getElementById('global-search').value.toLowerCase();
    if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings')) {
        mapped = mapped.filter(m =>
            m.name.toLowerCase().includes(searchTerm)
        );
    }

    document.getElementById('add-mapping-btn').style.display = 'block';

    if (mapped.length === 0) {
        mappingsList.innerHTML = '<div class="empty-state-small">No mappings for this league yet</div>';
    } else {
        const shouldHighlightMappings = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings');
        mappingsList.innerHTML = mapped.map(m => {
            const highlightedName = shouldHighlightMappings ? highlightText(m.name, searchTerm) : m.name;
            return `
                <div class="mapping-item-compact" data-mapping-id="${m.id}">
                    <span class="mapping-name">${highlightedName}</span>
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

function performGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');

    if (activeTab === 'leagues') {
        loadLeaguesForSport(searchTerm);
    } else if (activeTab === 'teams') {
        loadTeamsForLeague(searchTerm);
    }
}

function filterLeagues(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadLeaguesForSport(searchTerm);
}

function loadTeamsForLeague(searchTerm = '') {
    const leagueId = selectedLeagueForTeams ? selectedLeagueForTeams.id : null;
    const teamsList = document.getElementById('teams-list');
    const unmappedList = document.getElementById('team-unmapped-list');
    const mappingsList = document.getElementById('team-mappings-list');

    // Filter teams based on whether a league is selected
    let filteredTeams;
    if (!leagueId) {
        // No league selected - show ALL teams
        filteredTeams = teams.filter(t =>
            t.full_name &&
            t.full_name.trim() !== ''
        );
    } else {
        // Get team IDs for this league from league_team junction table
        const teamIdsForLeague = leagueTeams
            .filter(lt => lt.league_id == leagueId)
            .map(lt => lt.team_id);

        // Filter teams by those IDs and exclude teams with empty names
        filteredTeams = teams.filter(t =>
            teamIdsForLeague.includes(t.id) &&
            t.full_name &&
            t.full_name.trim() !== ''
        );
    }

    // Apply search filter only if filtering 'all' or 'items' (teams)
    if (searchTerm && searchTerm.trim() !== '' && (currentSearchFilter === 'all' || currentSearchFilter === 'items')) {
        filteredTeams = filteredTeams.filter(t =>
            t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.abbr && t.abbr.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }

    // Update teams list
    document.getElementById('teams-count').textContent = filteredTeams.length;
    if (filteredTeams.length === 0) {
        teamsList.innerHTML = '<div class="empty-state-small">No teams found</div>';
    } else {
        const shouldHighlight = searchTerm && searchTerm.trim() !== '' && (currentSearchFilter === 'all' || currentSearchFilter === 'items');
        teamsList.innerHTML = filteredTeams.map(team => {
            const highlightedName = shouldHighlight ? highlightText(team.full_name, searchTerm) : team.full_name;
            const highlightedAbbr = shouldHighlight ? highlightText(team.abbr || '', searchTerm) : (team.abbr || '');
            return `
                <div class="list-item ${selectedTeam && selectedTeam.id === team.id ? 'active' : ''}" onclick="selectTeam(${team.id})">
                    <div class="list-item-name">${highlightedName}</div>
                    <div class="list-item-abbr">${highlightedAbbr}</div>
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
            return `
                <div class="list-item unmapped-item" data-mapping-id="${m.id}">
                    <div class="list-item-name">${highlightedName}</div>
                    ${selectedTeam ? `<button class="map-btn" onclick="mapTeamMapping(${m.id}, ${selectedTeam.id}); event.stopPropagation();">Map to ${selectedTeam.full_name}</button>` : ''}
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

        // Apply search filter only if filtering 'all' or 'mappings'
        const searchTerm = document.getElementById('global-search').value.toLowerCase();
        if (searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings')) {
            mapped = mapped.filter(m =>
                m.name.toLowerCase().includes(searchTerm)
            );
        }

        document.getElementById('add-team-mapping-btn').style.display = 'block';

        if (mapped.length === 0) {
            mappingsList.innerHTML = '<div class="empty-state-small">No mappings for this team yet</div>';
        } else {
            const shouldHighlightMappings = searchTerm && (currentSearchFilter === 'all' || currentSearchFilter === 'mappings');
            console.log('Setting HTML with', mapped.length, 'mappings');
            const html = mapped.map(m => {
                const highlightedName = shouldHighlightMappings ? highlightText(m.name, searchTerm) : m.name;
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
    selectedTeam = teams.find(t => t.id == teamId);
    loadTeamsForLeague(); // Refresh to update active state and show mappings

    // Scroll to selected team if one is selected
    setTimeout(() => {
        const activeItem = document.querySelector('#teams-list .list-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function filterTeams(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadTeamsForLeague(searchTerm);
}

function loadAllPositions(searchTerm = '') {
    const container = document.getElementById('players-content');

    if (positions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No positions found</p></div>';
        return;
    }

    let filteredPositions = positions;
    if (searchTerm) {
        filteredPositions = positions.filter(p => p.name.toLowerCase().includes(searchTerm));
    }

    if (filteredPositions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No positions match your search</p></div>';
        return;
    }

    let html = '';
    filteredPositions.forEach(position => {
        const unmapped = playerMappings.filter(m => m.position_id == position.id);
        html += `<div class="entity-card"><div class="entity-header"><div class="entity-info"><h3>${position.name}</h3><p>Position ID: ${position.id}</p></div><div class="entity-badge">${unmapped.length} mapped</div></div><div class="entity-body"><div class="section-title"><span>Unmapped Position Names</span><button class="btn btn-add-unmapped" onclick="showAddPlayerMapping(${position.id}, '${position.name.replace(/'/g, "\\'")}')">+ Add Unmapped Name</button></div>${unmapped.length > 0 ? `<div class="unmapped-list">${unmapped.map(m => `<div class="unmapped-item"><div><div class="unmapped-item-name">"${m.name}"</div><div class="unmapped-item-id">Mapping ID: ${m.id}</div></div><button class="btn btn-danger" onclick="deletePlayerMapping(${m.id})">Delete</button></div>`).join('')}</div>` : '<div class="no-unmapped">✅ No unmapped names yet. Click "+ Add Unmapped Name" to add alternative position names.</div>'}</div></div>`;
    });
    container.innerHTML = html;
}

function filterPlayers(searchTerm = null) {
    if (searchTerm === null) {
        searchTerm = document.getElementById('global-search').value.toLowerCase();
    }
    loadAllPositions(searchTerm);
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

    // Find the league_mapping_id for the selected league
    let leagueMappingId = null;
    if (selectedLeagueForTeams) {
        // Find any league_mapping that has this league_id
        const leagueMapping = leagueMappings.find(lm => lm.league_id === selectedLeagueForTeams.id);
        leagueMappingId = leagueMapping ? leagueMapping.id : null;
    }

    currentMappingContext = {
        type: 'team',
        id: selectedTeam.id,
        name: selectedTeam.full_name,
        leagueMappingId: leagueMappingId
    };
    document.getElementById('modal-title').textContent = 'Add Team Mapping';
    document.getElementById('modal-selected-label').textContent = 'Selected Team:';
    document.getElementById('modal-selected-item').textContent = selectedTeam.full_name;
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
            await apiCall('addTeamMapping', { name, league_mapping_id: currentMappingContext.leagueMappingId, team_id: currentMappingContext.id });
            await loadTeamMappings();
            loadTeamsForLeague();
        } else if (currentMappingContext.type === 'player') {
            await apiCall('addPlayerMapping', { name, position_id: currentMappingContext.id });
            await loadPlayerMappings();
            loadAllPositions();
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

async function deletePlayerMapping(id) {
    if (!confirm('Delete this position mapping?')) return;
    try {
        await apiCall('deletePlayerMapping', { id });
        await loadPlayerMappings();
        loadAllPositions();
        showNotification('Mapping deleted', 'success');
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
    const sportId = document.getElementById('global-sport-filter').value;
    if (!sportId) {
        showNotification('Please select a sport first', 'error');
        return;
    }
    filterLeagueDropdown();
}

function filterLeagueDropdown() {
    const sportId = document.getElementById('global-sport-filter').value;
    if (!sportId) return;

    const input = document.getElementById('team-league-filter');
    const dropdown = document.getElementById('league-dropdown');
    const searchTerm = input.value.toLowerCase();

    let filteredLeagues = leagues.filter(l => l.sport_id == sportId);

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

    dropdown.classList.add('show');
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
        loadTeamsForLeague();
        selectTeam(teamId);

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

