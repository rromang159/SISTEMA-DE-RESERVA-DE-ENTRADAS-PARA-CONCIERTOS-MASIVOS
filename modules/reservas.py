from flask import Blueprint, current_app, jsonify, request

from database import begin_transaction, execute


reservas_bp = Blueprint("reservas", __name__)


@reservas_bp.get("/reservations")
def get_reservations():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error

    user = ctx["get_user"](user_id)
    ctx["expire_reservations"]()
    params = []
    where = ""
    if user["role"] != "admin":
        where = "WHERE r.idUsuario = %s"
        params.append(user_id)

    rows = execute(
        f"""
        SELECT
          r.idReserva AS id,
          r.cantidad AS quantity,
          r.total,
          r.estado AS status,
          r.expiraEn AS expiresAt,
          c.artista AS artist,
          e.tipo AS ticketName
        FROM Reserva r
        JOIN Concierto c ON c.idConcierto = r.idConcierto
        JOIN Entrada e ON e.idEntrada = r.idEntrada
        {where}
        ORDER BY r.fechaReserva DESC
        """,
        params,
    )

    for row in rows:
        row["total"] = float(row["total"])
        row["expiresAt"] = str(row["expiresAt"]).replace(" ", "T")

    return jsonify(rows)


@reservas_bp.post("/reservations")
def create_reservation():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    conn = begin_transaction()
    try:
        ctx["expire_reservations"](conn)
        ticket_rows = execute(
            "SELECT * FROM Entrada WHERE idEntrada = %s AND idConcierto = %s FOR UPDATE",
            [data.get("ticketTypeId"), data.get("concertId")],
            connection=conn,
        )
        if not ticket_rows:
            conn.rollback()
            return jsonify({"message": "Tipo de entrada no encontrado."}), 404

        locked_rows = execute(
            "SELECT COALESCE(SUM(cantidad), 0) AS locked FROM Reserva WHERE idEntrada = %s AND estado = 'active'",
            [data.get("ticketTypeId")],
            connection=conn,
        )

        ticket = ticket_rows[0]
        quantity = int(data.get("quantity", 0))
        available = int(ticket["total"]) - int(ticket["vendidas"]) - int(locked_rows[0]["locked"])
        if quantity < 1 or quantity > available:
            conn.rollback()
            return jsonify({"message": "No hay suficientes entradas disponibles."}), 409

        total = float(ticket["precio"]) * quantity
        execute(
            """
            INSERT INTO Reserva
              (idUsuario, idConcierto, idEntrada, cantidad, total, estado, expiraEn, fechaReserva)
            VALUES (%s, %s, %s, %s, %s, 'active', DATE_ADD(NOW(), INTERVAL %s MINUTE), NOW())
            """,
            [
                user_id,
                data.get("concertId"),
                data.get("ticketTypeId"),
                quantity,
                total,
                ctx["reservation_minutes"],
            ],
            connection=conn,
        )
        reservation_id = execute("SELECT LAST_INSERT_ID() AS id", connection=conn)[0]["id"]
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return jsonify({"id": reservation_id}), 201


@reservas_bp.post("/reservations/<reservation_id>/cancel")
def cancel_reservation(reservation_id):
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error

    execute(
        "UPDATE Reserva SET estado = 'cancelled' WHERE idReserva = %s AND idUsuario = %s AND estado = 'active'",
        [reservation_id, user_id],
    )
    return jsonify({"ok": True})
