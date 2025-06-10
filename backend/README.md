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