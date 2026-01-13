from flask import Flask

def create_app():
    # Initializes flask and automatically finds /static and /templates in /app
    app = Flask(__name__)

    # Register the routes blueprint
    from .routes import bp
    app.register_blueprint(bp)

    return app