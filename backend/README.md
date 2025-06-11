# Crypto Price Tracker Backend

This is the backend for the Crypto Price Tracker MVP, built with Flask.

## Setup

1. Create a virtual environment (optional but recommended):
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Run the server

```bash
python app.py
```

The backend will be available at `http://127.0.0.1:5000/` by default.

**Note:**
- When running with Docker Compose in development, the backend is mapped to port `5050` (i.e., `http://localhost:5050/`) due to a port conflict with macOS Control Center. 

## Database (SQLite)

### Database Migrations (Flask-Migrate)

When you change your models, use Flask-Migrate to manage schema changes:

1. **Initialize migrations directory (only once):**
   ```bash
   flask db init
   ```
2. **Generate a migration after model changes:**
   ```bash
   flask db migrate -m "Describe your change"
   ```
3. **Apply the migration to the database:**
   ```bash
   flask db upgrade
   ```

- The `migrations/` directory and its contents **should be tracked in git** so all developers share the same migration history.

### When you modify models (e.g., add/change tables) or set up the project for the first time:

1. Run the database setup script (from the backend directory):
   ```bash
   python -m scripts.setup_db
   ```
   This will create the `instance/` directory (if it doesn't exist), initialize the database, and add default favorite pairs if needed.

### How to connect to and visualize the SQLite database
- The database file is `instance/crypto.db` in the backend directory.

#### Command Line:
```bash
sqlite3 instance/crypto.db
```
- Useful commands inside sqlite3:
  - `.tables` — list tables
  - `SELECT * FROM favorite_pair;` — view all favorite pairs

#### GUI Tools:
- [DB Browser for SQLite](https://sqlitebrowser.org/) (free, cross-platform)
- TablePlus, DBeaver, or any SQLite-compatible tool
- Open `instance/crypto.db` with your chosen tool to browse and edit data

#### VS Code Extension:
- Install the "SQLite" extension in VS Code
- Open `instance/crypto.db` directly in the editor 