const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database configuration
const dbConfig = {
    host: '172.16.0.26',
    user: 'alishalalani',
    password: 'alisha',
    database: 'scheduledb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

// API Routes

// Get all sports
app.post('/api.php', async (req, res) => {
    try {
        const { action } = req.body;

        switch (action) {
            case 'getSports':
                const [sports] = await pool.query('SELECT * FROM sport WHERE active = 1 ORDER BY name');
                res.json({ success: true, data: sports });
                break;

            case 'getLeagues':
                const [leagues] = await pool.query(`
                    SELECT l.*, s.name as sport_name 
                    FROM league l 
                    LEFT JOIN sport s ON l.sport_id = s.id 
                    ORDER BY l.fullname
                `);
                res.json({ success: true, data: leagues });
                break;

            case 'getTeams':
                const [teams] = await pool.query('SELECT * FROM team ORDER BY full_name');
                res.json({ success: true, data: teams });
                break;

            case 'getLeagueTeams':
                const [leagueTeams] = await pool.query('SELECT * FROM league_team');
                res.json({ success: true, data: leagueTeams });
                break;

            case 'getPositions':
                const [positions] = await pool.query(`
                    SELECT * FROM position ORDER BY name
                `);
                res.json({ success: true, data: positions });
                break;

            case 'getLeagueMappings':
                const [leagueMappings] = await pool.query(`
                    SELECT lm.*, l.fullname, l.abbr, l.sport_id, s.name as sport_name 
                    FROM league_mapping lm 
                    LEFT JOIN league l ON lm.league_id = l.id 
                    LEFT JOIN sport s ON l.sport_id = s.id 
                    ORDER BY lm.name
                `);
                res.json({ success: true, data: leagueMappings });
                break;

            case 'getTeamMappings':
                const [teamMappings] = await pool.query(`
                    SELECT tm.*, t.full_name, t.abbr, lm.name as league_name, lm.league_id
                    FROM team_mapping tm
                    LEFT JOIN team t ON tm.team_id = t.id
                    LEFT JOIN league_mapping lm ON tm.league_mapping_id = lm.id
                    ORDER BY tm.name
                `);
                res.json({ success: true, data: teamMappings });
                break;

            case 'getPlayers':
                const [players] = await pool.query('SELECT * FROM player ORDER BY display_name');
                res.json({ success: true, data: players });
                break;

            case 'getTeamPlayers':
                const [teamPlayers] = await pool.query('SELECT * FROM team_player');
                res.json({ success: true, data: teamPlayers });
                break;

            case 'getPlayerMappings':
                // Player mapping table not implemented yet - return empty array
                res.json({ success: true, data: [] });
                break;

            case 'addLeagueMapping':
                const { name: leagueName, league_id } = req.body;
                const [leagueResult] = await pool.query(
                    'INSERT INTO league_mapping (name, league_id) VALUES (?, ?)',
                    [leagueName, league_id]
                );
                res.json({
                    success: true,
                    data: { id: leagueResult.insertId },
                    message: 'League mapping added successfully'
                });
                break;

            case 'addTeamMapping':
                const { name: teamName, league_mapping_id, team_id } = req.body;
                const [teamResult] = await pool.query(
                    'INSERT INTO team_mapping (name, league_mapping_id, team_id) VALUES (?, ?, ?)',
                    [teamName, league_mapping_id, team_id]
                );
                res.json({
                    success: true,
                    data: { id: teamResult.insertId },
                    message: 'Team mapping added successfully'
                });
                break;

            case 'addPlayerMapping':
                const { name: playerName, team_mapping_id, player_id } = req.body;
                const [playerResult] = await pool.query(
                    'INSERT INTO player_mapping (name, team_mapping_id, player_id) VALUES (?, ?, ?)',
                    [playerName, team_mapping_id, player_id]
                );
                res.json({
                    success: true,
                    data: { id: playerResult.insertId },
                    message: 'Player mapping added successfully'
                });
                break;

            case 'updateLeagueMapping':
                const { id: updateLeagueMappingId, league_id: updateLeagueId } = req.body;
                await pool.query('UPDATE league_mapping SET league_id = ? WHERE id = ?', [updateLeagueId, updateLeagueMappingId]);
                res.json({
                    success: true,
                    message: 'League mapping updated successfully'
                });
                break;

            case 'updateTeamMapping':
                const { id: updateTeamMappingId, team_id: updateTeamId } = req.body;
                await pool.query('UPDATE team_mapping SET team_id = ? WHERE id = ?', [updateTeamId, updateTeamMappingId]);
                res.json({
                    success: true,
                    message: 'Team mapping updated successfully'
                });
                break;

            case 'deleteLeagueMapping':
                const { id: leagueMappingId } = req.body;
                await pool.query('DELETE FROM league_mapping WHERE id = ?', [leagueMappingId]);
                res.json({
                    success: true,
                    message: 'League mapping deleted successfully'
                });
                break;

            case 'deleteTeamMapping':
                const { id: teamMappingId } = req.body;
                await pool.query('DELETE FROM team_mapping WHERE id = ?', [teamMappingId]);
                res.json({
                    success: true,
                    message: 'Team mapping deleted successfully'
                });
                break;

            case 'updatePlayerMapping':
                const { id: updatePlayerMappingId, player_id: updatePlayerId } = req.body;
                await pool.query('UPDATE player_mapping SET player_id = ? WHERE id = ?', [updatePlayerId, updatePlayerMappingId]);
                res.json({
                    success: true,
                    message: 'Player mapping updated successfully'
                });
                break;

            case 'deletePlayerMapping':
                const { id: playerMappingId } = req.body;
                await pool.query('DELETE FROM player_mapping WHERE id = ?', [playerMappingId]);
                res.json({
                    success: true,
                    message: 'Player mapping deleted successfully'
                });
                break;

            default:
                res.status(400).json({
                    success: false,
                    message: 'Invalid action: ' + action
                });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log('🚀 Mapping Tool Server Started');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🌐 Open your browser to: http://localhost:${PORT}`);
    console.log('');
    await testConnection();
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await pool.end();
    process.exit(0);
});

