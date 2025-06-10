from flask import Flask, jsonify, request
from binance.client import Client
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# In-memory store for user's favorite trading pairs
FAVORITE_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'BNBUSDT', 'ADAUSDT']

@app.route('/')
def home():
    return 'Crypto Price Tracker Backend is running!'

@app.route('/api/symbol')
def get_symbols():
    # No API key/secret needed for public endpoints
    client = Client()
    exchange_info = client.get_exchange_info()
    symbols = [s['symbol'] for s in exchange_info['symbols']]
    return jsonify(symbols)

@app.route('/api/symbol/favorite', methods=['GET'])
def get_favorites():
    return jsonify(FAVORITE_PAIRS)

@app.route('/api/symbol/favorite', methods=['POST'])
def add_favorite():
    data = request.get_json()
    symbol = data.get('symbol', '').upper()
    if symbol and symbol not in FAVORITE_PAIRS:
        FAVORITE_PAIRS.append(symbol)
        return jsonify({'message': f'{symbol} added to favorites.', 'favorites': FAVORITE_PAIRS}), 201
    return jsonify({'message': 'Symbol already in favorites or invalid.', 'favorites': FAVORITE_PAIRS}), 400

@app.route('/api/symbol/favorite', methods=['DELETE'])
def delete_favorite():
    data = request.get_json()
    symbol = data.get('symbol', '').upper()
    if symbol in FAVORITE_PAIRS:
        FAVORITE_PAIRS.remove(symbol)
        return jsonify({'message': f'{symbol} removed from favorites.', 'favorites': FAVORITE_PAIRS}), 200
    return jsonify({'message': 'Symbol not found in favorites.', 'favorites': FAVORITE_PAIRS}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port) 