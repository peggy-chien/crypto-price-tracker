# CryptoPriceTracker

This project is a real-time cryptocurrency price tracker built with Angular 19. It features a modern, responsive UI and leverages the latest Angular features, including signals and standalone components.

## Main Features

- **Real-time Trading Pairs Grid:**
  - Displays a grid of popular trading pairs with live price and percent change, color-coded by price movement.
  - Click a pair to view detailed price and order book information.

- **Price Page with Candlestick Chart:**
  - Interactive candlestick chart for each trading pair, powered by [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts).
  - User-selectable intervals: 1m, 30m, 1h, 1d.
  - Lazy loading of historical candles as you scroll left (infinite scroll).
  - Real-time updates via WebSocket for the latest candle.
  - Custom time axis formatting for clear multi-day navigation.

- **Real-time Order Book:**
  - Live order book displaying current bids and asks with real-time updates.
  - Color-coded price levels for easy visualization of market depth.
  - Automatic updates via WebSocket streaming.

- **Smart Resource Management:**
  - Automatic WebSocket disconnect/reconnect when user switches tabs or minimizes the browser.
  - Persistent data signals that maintain state across connection cycles.
  - Efficient memory management preventing data leaks during reconnections.

- **Modern Angular Architecture:**
  - Uses Angular 19 standalone components, signals, and best practices for state management and reactivity.
  - Clean separation of frontend and backend (future-ready for full-stack expansion).
  - Reactive programming with RxJS for real-time data streams.

## Data Source

All price and candlestick data is sourced from the official [Binance public APIs](https://github.com/binance/binance-spot-api-docs):
- [Binance REST API](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md) for historical candles
- [Binance WebSocket Streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md) for real-time price, kline, and order book updates

## Chart Library

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) is used for fast, interactive, and beautiful candlestick chart rendering.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Deploy to GitHub Pages

```bash
npx gh-pages -d dist/crypto-price-tracker/browser
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
