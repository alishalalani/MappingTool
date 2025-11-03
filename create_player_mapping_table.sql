-- Create player_mapping table
CREATE TABLE IF NOT EXISTS player_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    player_id INT NULL,
    team_mapping_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE SET NULL,
    FOREIGN KEY (team_mapping_id) REFERENCES team_mapping(id) ON DELETE SET NULL,
    INDEX idx_player_id (player_id),
    INDEX idx_team_mapping_id (team_mapping_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

