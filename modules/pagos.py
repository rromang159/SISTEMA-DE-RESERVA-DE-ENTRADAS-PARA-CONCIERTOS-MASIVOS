from flask import Blueprint, current_app, jsonify, request

from database import begin_transaction, execute


pagos_bp = Blueprint("pagos", __name__)


@pagos_bp.post("/payments")
def create_payment():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    conn = begin_transaction()
    try:
        ctx["expire_reservations"](conn)
        reservation_rows = execute(
            "SELECT * FROM Reserva WHERE idReserva = %s AND idUsuario = %s FOR UPDATE",
            [data.get("reservationId"), user_id],
            connection=conn,
        )
        if not reservation_rows or reservation_rows[0]["estado"] != "active":
            conn.rollback()
            return jsonify({"message": "La reserva no esta activa."}), 409

        reservation = reservation_rows[0]
        payment_status = "approved" if data.get("result") == "approved" else "rejected"
        if payment_status == "approved":
            execute(
                "UPDATE Entrada SET vendidas = vendidas + %s WHERE idEntrada = %s",
                [reservation["cantidad"], reservation["idEntrada"]],
                connection=conn,
            )
            execute(
                "UPDATE Reserva SET estado = 'confirmed' WHERE idReserva = %s",
                [data.get("reservationId")],
                connection=conn,
            )
        else:
            execute(
                "UPDATE Reserva SET estado = 'rejected' WHERE idReserva = %s",
                [data.get("reservationId")],
                connection=conn,
            )

        execute(
            "INSERT INTO Pago (idReserva, metodo, estado, monto, fechaPago) VALUES (%s, %s, %s, %s, NOW())",
            [
                data.get("reservationId"),
                data.get("method"),
                payment_status,
                reservation["total"],
            ],
            connection=conn,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return jsonify({"ok": True, "status": payment_status})
