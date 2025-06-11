from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class FavoritePair(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), unique=True, nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)

    def as_dict(self):
        return {"id": self.id, "symbol": self.symbol, "order": self.order}