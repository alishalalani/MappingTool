# Mapping Tool - Phoenix Global

A professional and modern web-based mapping tool for managing team, league, and player position mappings.

## Features

- **League Mapping**: Map alternative league names (e.g., "CFB", "College Football") to the correct league entities
- **Team Mapping**: Map alternative team names (e.g., "LA", "NY Giants") to the correct team entities
- **Player Position Mapping**: Map alternative position names to standardized positions
- **Filtering & Search**: Filter by sport, league, and search across all mappings
- **Modern UI**: Clean, responsive interface with smooth animations

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: PHP 7.4+
- **Database**: MySQL (scheduledb)

## Database Structure

The tool works with the following tables:

- `sport` - Sports (Football, Basketball, Hockey, Baseball, Soccer, etc.)
- `league` - Leagues with their full names and abbreviations
- `team` - Teams with their full names and abbreviations
- `position` - Player positions for each sport
- `league_mapping` - Maps alternative league names to league IDs
- `team_mapping` - Maps alternative team names to team IDs
- `player_mapping` - Maps alternative position names to position IDs (auto-created)

## Setup Instructions

### Prerequisites

- PHP 7.4 or higher
- MySQL database access
- Web server (Apache, Nginx, or PHP built-in server)

### Installation

1. **Clone or download the files** to your web server directory

2. **Database Configuration**
   - The database connection is already configured in `api.php`:
     - Host: 172.16.0.26
     - Username: alishalalani
     - Password: alisha
     - Database: scheduledb

3. **Start the application**

   **Option A: Using PHP Built-in Server (Recommended for testing)**
   ```bash
   cd Mapping_Tool
   php -S localhost:8000
   ```
   Then open your browser to: http://localhost:8000

   **Option B: Using Apache/Nginx**
   - Place the files in your web server's document root
   - Access via your web server URL

4. **First Run**
   - The `player_mapping` table will be automatically created on first use if it doesn't exist
   - All other tables should already exist in your database

## Usage

### League Mapping

1. Click on the **Leagues** tab
2. Click **+ Add League Mapping**
3. Enter the unmapped league name (e.g., "CFB")
4. Select the correct league from the dropdown (e.g., "College Football")
5. Click **Save Mapping**

### Team Mapping

1. Click on the **Teams** tab
2. Click **+ Add Team Mapping**
3. Enter the unmapped team name (e.g., "LA")
4. Select the league the team belongs to
5. Select the correct team from the dropdown (e.g., "Los Angeles Dodgers")
6. Click **Save Mapping**

### Player Position Mapping

1. Click on the **Players** tab
2. Click **+ Add Player Mapping**
3. Enter the unmapped position name (e.g., "QB")
4. Select the sport
5. Select the correct position from the dropdown (e.g., "Quarterback")
6. Click **Save Mapping**

### Filtering and Search

- Use the **Sport** dropdown to filter by sport
- Use the **League** dropdown to filter by league (for teams)
- Use the **Search** box to search for specific names
- All filters work in real-time

### Deleting Mappings

- Click the **Delete** button next to any mapping
- Confirm the deletion in the popup dialog

## File Structure

```
Mapping_Tool/
├── index.html          # Main HTML structure
├── styles.css          # Modern CSS styling
├── app.js             # Frontend JavaScript logic
├── api.php            # Backend API for database operations
└── README.md          # This file
```

## API Endpoints

All API calls are made to `api.php` with POST requests containing JSON data:

- `getSports` - Get all sports
- `getLeagues` - Get all leagues
- `getTeams` - Get all teams
- `getPositions` - Get all positions
- `getLeagueMappings` - Get all league mappings
- `getTeamMappings` - Get all team mappings
- `getPlayerMappings` - Get all player position mappings
- `addLeagueMapping` - Add a new league mapping
- `addTeamMapping` - Add a new team mapping
- `addPlayerMapping` - Add a new player position mapping
- `deleteLeagueMapping` - Delete a league mapping
- `deleteTeamMapping` - Delete a team mapping
- `deletePlayerMapping` - Delete a player position mapping

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Database Connection Issues

If you see "Connection failed" errors:
1. Verify the database credentials in `api.php`
2. Ensure the MySQL server is accessible from your machine
3. Check that the database `scheduledb` exists
4. Verify your user has proper permissions

### PHP Errors

If you see PHP errors:
1. Check that PHP is installed: `php -v`
2. Ensure PHP mysqli extension is enabled
3. Check PHP error logs for detailed information

### No Data Showing

If tables are empty:
1. Open browser developer console (F12)
2. Check the Network tab for API call responses
3. Verify the database tables contain data
4. Check for JavaScript errors in the Console tab

## Future Enhancements

- Bulk import/export functionality
- Edit existing mappings
- Mapping history and audit trail
- User authentication and permissions
- Advanced search with regex support
- Duplicate detection

## Support

For issues or questions, please contact the development team.

