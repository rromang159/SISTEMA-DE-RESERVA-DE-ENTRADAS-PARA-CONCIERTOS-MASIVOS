import os
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from database import execute
from modules.usuarios import usuarios_bp
from modules.conciertos import conciertos_bp
from modules.reservas import reservas_bp
from modules.pagos import pagos_bp


BASE_DIR = Path(__file__).resolve().parent
RESERVATION_MINUTES = 10


def load_env():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def create_id(prefix):
    return f"{prefix}-{uuid.uuid4()}"


def get_user(user_id):
    rows = execute(
        """
        SELECT
          idUsuario AS id,
          nombre AS name,
          correo AS email,
          rol AS role
        FROM Usuario
        WHERE idUsuario = %s
        """,
        [user_id],
    )
    return rows[0] if rows else None


def expire_reservations(connection=None):
    execute(
        "UPDATE Reserva SET estado = 'expired' WHERE estado = 'active' AND expiraEn <= NOW()",
        connection=connection,
    )


def require_user():
    user_id = request.headers.get("x-user-id")
    if not user_id:
        return None, (jsonify({"message": "Inicia sesion primero."}), 401)
    if not get_user(user_id):
        return None, (jsonify({"message": "Sesion expirada. Inicia sesion nuevamente."}), 401)
    return user_id, None


def require_admin(user_id):
    user = get_user(user_id)
    if not user or user["role"] != "admin":
        return None, (jsonify({"message": "Solo el administrador puede realizar esta accion."}), 403)
    return user, None


def create_app():
    load_env()
    app = Flask(__name__, static_folder=None)

    app.config["APP_CONTEXT"] = {
        "create_id": create_id,
        "get_user": get_user,
        "expire_reservations": expire_reservations,
        "require_user": require_user,
        "require_admin": require_admin,
        "reservation_minutes": RESERVATION_MINUTES,
    }

    app.register_blueprint(usuarios_bp, url_prefix="/api")
    app.register_blueprint(conciertos_bp, url_prefix="/api")
    app.register_blueprint(reservas_bp, url_prefix="/api")
    app.register_blueprint(pagos_bp, url_prefix="/api")

    @app.get("/")
    def index():
      return send_from_directory(BASE_DIR, "index.html")

    @app.get("/<path:filename>")
    def static_files(filename):
        return send_from_directory(BASE_DIR, filename)

    @app.errorhandler(Exception)
    def handle_error(error):
        print(error)
        return jsonify({"message": "Error interno del servidor."}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", "3000"))
    app.run(host="0.0.0.0", port=port, debug=False)
