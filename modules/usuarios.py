from flask import Blueprint, current_app, jsonify, request

from database import execute


usuarios_bp = Blueprint("usuarios", __name__)


@usuarios_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    rows = execute(
        """
        SELECT
          idUsuario AS id,
          nombre AS name,
          correo AS email,
          rol AS role
        FROM Usuario
        WHERE correo = %s AND contrasena = %s
        """,
        [data.get("email"), data.get("password")],
    )
    if not rows:
        return jsonify({"message": "Credenciales incorrectas."}), 401
    return jsonify({"user": rows[0]})


@usuarios_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    try:
        execute(
            "INSERT INTO Usuario (nombre, correo, contrasena, rol) VALUES (%s, %s, %s, 'user')",
            [data.get("name"), data.get("email"), data.get("password")],
        )
    except Exception as error:
        if getattr(error, "args", [None])[0] == 1062:
            return jsonify({"message": "Ese correo ya esta registrado."}), 409
        raise

    rows = execute(
        """
        SELECT idUsuario AS id, nombre AS name, correo AS email, rol AS role
        FROM Usuario
        WHERE correo = %s
        """,
        [data.get("email")],
    )

    return jsonify({
        "user": {
            "id": rows[0]["id"],
            "name": rows[0]["name"],
            "email": rows[0]["email"],
            "role": rows[0]["role"],
        }
    }), 201
