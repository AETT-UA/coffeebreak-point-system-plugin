# CoffeeBreak Point System Plugin

This is a plugin for [coffeeBreak](https://github.com/PI-coffeeBreak) (Modular Event Management
System) that aims to integrate with [Point System](https://github.com/AETT-UA/point-system) (a transaction system for gamified event entry).
The Point System exposes a set of HTTP endpoints for performing transactions and managing multiple leaderboards.
The plugin allows not only for administrator management of the system but also for automatic execution of transitions by listening for events asynchronously.

## Features

- **Leaderboard Management**: Retrieve general and activity-specific leaderboards
- **Points Tracking**: Get current points balance for users
- **Transaction History**: View detailed transaction history for users
- **Points Management**: Add or remove points from users
- **Activity Integration**: Track points within specific activities

## UI Components

- **StaffPage**: Staff QR scanner and manual point attribution flow.
- **LeaderboardPage**: Event-app leaderboard view with optional activity filter, rank display, row limit, and auto-refresh.

## Configuration

The plugin is configured through the CoffeeBreak plugin settings system. Available settings:

- **Point System Service URL**: Base URL for the external point system service (default: `http://localhost:8000`)
- **Connection Timeout**: Timeout in seconds for HTTP requests (default: 30.0s)
- **Retry Attempts**: Number of retry attempts for failed requests (default: 3)

## API Endpoints

The plugin provides the following endpoints:

- `GET /leaderboard` - Get general leaderboard
- `GET /leaderboard/{activity_id}` - Get activity-specific leaderboard
- `GET /points/{user_id}` - Get user's current points
- `GET /points/{user_id}/history` - Get user's transaction history
- `GET /points/{user_id}/activity/{activity_id}` - Get user's points in specific activity
- `POST /points/{user_id}/add` - Add points to user
- `POST /points/{user_id}/remove` - Remove points from user

## External Service Requirements

The plugin expects the external point system service to provide these endpoints:

- `GET /leaderboard/` - Returns list of users with points
- `GET /leaderboard/{activity_id}/` - Returns activity-specific leaderboard
- `GET /points/{user_id}/history` - Returns user's transaction history
- `POST /points/{user_id}/add?type={type}` - Adds points to user
- `POST /points/{user_id}/remove` - Removes points from user

## Data Format

The plugin handles data conversion between the external service format and internal CoffeeBreak schemas. All numeric fields are properly type-cast to ensure compatibility.

## Error Handling

The plugin includes comprehensive error handling and retry logic for HTTP requests. Failed requests are retried up to the configured number of attempts before failing.

## Testing

To test the plugin:

1. Ensure the external point system service is running on the configured URL
2. Start the CoffeeBreak core with the plugin enabled
3. Use the plugin's API endpoints to interact with the point system
4. Check logs for any errors or connection issues

## Dependencies

- `httpx` - For HTTP client functionality
- CoffeeBreak core services and schemas
