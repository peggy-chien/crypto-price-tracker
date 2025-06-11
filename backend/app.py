from flask import Flask
from flask_cors import CORS
from routes.symbol import symbol_bp
import os
from flask_sqlalchemy import SQLAlchemy
from models import db

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{app.instance_path}/crypto.db"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

@app.route('/')
def home():
    return 'Crypto Price Tracker Backend is running!'

app.register_blueprint(symbol_bp)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port) 