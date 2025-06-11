import os
from app import app
from models import db, FavoritePair

# Ensure the instance directory exists
os.makedirs(app.instance_path, exist_ok=True)

with app.app_context():
    db.create_all()
    # Pre-populate with default pairs if empty
    default_pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'BNBUSDT', 'ADAUSDT']
    if FavoritePair.query.count() == 0:
        for symbol in default_pairs:
            db.session.add(FavoritePair(symbol=symbol))
        db.session.commit()
        print("Database initialized and default favorite pairs added.")
    else:
        print("Database already initialized.")