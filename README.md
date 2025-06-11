# Crypto Price Tracker

A real-time cryptocurrency price tracker with a modern, responsive UI and live market data from Binance.

## Main Features

- **Real-time Trading Pairs Grid:**
  - Live price and percent change for popular trading pairs
  - Click a pair for detailed price and order book info
- **Price Page with Candlestick Chart:**
  - Interactive candlestick chart (TradingView Lightweight Charts)
  - User-selectable intervals, infinite scroll for history, real-time updates
- **Real-time Order Book:**
  - Live bids/asks, color-coded market depth, real-time streaming
- **Smart Resource Management:**
  - Automatic WebSocket disconnect/reconnect
  - Persistent state across connection cycles
  - Efficient memory management
- **Favorites Management:**
  - Add/remove favorite trading pairs (backend API)

## Tech Stack

- **Frontend:** Angular 19, RxJS, TailwindCSS, TradingView Lightweight Charts, TypeScript
- **Backend:** Python, Flask, python-binance, flask-cors
- **Data Source:** Binance REST API & WebSocket Streams
- **Containerization:** Docker

## Getting Started

### Prerequisites
- Node.js (for frontend)
- Python 3 (for backend)
- Docker (optional, for containerized setup)

### Running the Frontend

1. Install dependencies:
   ```bash
   cd frontend
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm start
   ```
3. Open your browser at [http://localhost:4200](http://localhost:4200)

### Running the Backend

1. Install dependencies:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Start the backend server:
   ```bash
   python app.py
   ```
3. The backend will be available at [http://localhost:5000](http://localhost:5000) (or port 5050 if using Docker)

### Project Management with Makefile

The project provides a Makefile for easy management of frontend and backend services using Docker Compose. Common commands:

- `make up` – Build and start both frontend and backend containers (production config)
- `make up-dev` – Build and start both containers (development config)
- `make build` – Build both containers (production config)
- `make build-dev` – Build both containers (development config)
- `make down` – Stop and remove containers (production config)
- `make down-dev` – Stop and remove containers (development config)
- `make clean` – Remove containers, volumes, images, and orphans (production config)
- `make clean-dev` – Remove containers, volumes, images, and orphans (development config)
- `make pause` – Pause running containers (production config)
- `make pause-dev` – Pause running containers (development config)
- `make resume` – Resume paused containers (production config)
- `make resume-dev` – Resume paused containers (development config)

Run these commands from the project root. For example:
```bash
make up
```

## License

MIT 