from flask import Blueprint, jsonify, request
from binance.client import Client
from models import FavoritePair, db

symbol_bp = Blueprint('symbol', __name__, url_prefix='/api/symbol')

@symbol_bp.route('', methods=['GET'])
def get_symbols():
    client = Client()
    exchange_info = client.get_exchange_info()
    symbols = [s['symbol'] for s in exchange_info['symbols']]
    return jsonify(symbols)

@symbol_bp.route('/favorite', methods=['GET'])
def get_favorites():
    favorites = FavoritePair.query.all()
    return jsonify([f.as_dict() for f in favorites])

@symbol_bp.route('/favorite', methods=['POST'])
def add_favorite():
    data = request.get_json()
    symbol = data.get('symbol', '').upper()
    if symbol and not FavoritePair.query.filter_by(symbol=symbol).first():
        new_pair = FavoritePair(symbol=symbol)
        db.session.add(new_pair)
        db.session.commit()
        return jsonify({'message': f'{symbol} added to favorites.'}), 201
    return jsonify({'message': 'Symbol already in favorites or invalid.'}), 400

@symbol_bp.route('/favorite', methods=['DELETE'])
def delete_favorite():
    data = request.get_json()
    symbol = data.get('symbol', '').upper()
    pair = FavoritePair.query.filter_by(symbol=symbol).first()
    if pair:
        db.session.delete(pair)
        db.session.commit()
        return jsonify({'message': f'{symbol} removed from favorites.'}), 200
    return jsonify({'message': 'Symbol not found in favorites.'}), 404 