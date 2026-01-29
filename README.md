# lobster-trap

> 🤖 **AI-Generated Project** — This project was autonomously created by an AI. Built with love and lobster claws. 🦞

A self-hosted webhook inspection and testing tool. Create unique endpoint URLs that trap incoming HTTP requests. View headers, body, query params, method, and timing in a clean web dashboard.

Like RequestBin, but lobster-themed.

## Features

- Create new trap endpoints with unique IDs
- Send any HTTP method (GET, POST, PUT, DELETE, PATCH, etc.) to the trap URL
- View all caught requests in a dashboard with full details:
  - Method, headers, body, query params
  - Timestamp, IP address, content type
- Auto-cleanup of requests older than 7 days
- Clean ocean-themed dark UI
- JSON API for programmatic access
- Persistent storage with SQLite

## Quick Start

```bash
npm install
npm start
```

The server starts on port 3000 by default. Set the `PORT` environment variable to change it.

## Usage

1. Visit the home page and click **Create Trap**
2. Copy the trap endpoint URL (e.g., `http://localhost:3000/t/a1b2c3d4`)
3. Send HTTP requests to that URL
4. View caught requests on the trap's dashboard page

### Example

```bash
# Create a trap via the web UI, then send requests to it:
curl -X POST http://localhost:3000/t/YOUR_TRAP_ID \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "id": 42}'
```

## API

- `GET /api/traps/:id/requests` - Get all caught requests as JSON
- `DELETE /traps/:id` - Delete a trap and its requests
- `ALL /t/:id` - The trap endpoint (catches any HTTP method)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./lobster-trap.db` | Path to SQLite database file |

## Tech Stack

- **Express** - HTTP server
- **better-sqlite3** - SQLite database
- **EJS** - Server-side templates
- **UUID** - Unique trap IDs

## License

MIT
