from flask import Blueprint, current_app, jsonify, request

from database import begin_transaction, execute


conciertos_bp = Blueprint("conciertos", __name__)


@conciertos_bp.get("/concerts")
def get_concerts():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error

    ctx["expire_reservations"]()
    concert_rows = execute("SELECT * FROM Concierto ORDER BY fecha, hora")
    ticket_rows = execute("""
        SELECT
          e.idEntrada AS id,
          e.idConcierto AS concertId,
          e.tipo AS name,
          e.precio AS price,
          e.total,
          e.vendidas AS sold,
          COALESCE(SUM(CASE WHEN r.estado = 'active' THEN r.cantidad ELSE 0 END), 0) AS locked
        FROM Entrada e
        LEFT JOIN Reserva r ON r.idEntrada = e.idEntrada
        GROUP BY e.idEntrada
        ORDER BY e.tipo
    """)

    concerts = []
    for concert in concert_rows:
        ticket_types = []
        for ticket in ticket_rows:
            if ticket["concertId"] != concert["idConcierto"]:
                continue
            total = int(ticket["total"])
            sold = int(ticket["sold"])
            locked = int(ticket["locked"])
            ticket_types.append({
                "id": ticket["id"],
                "name": ticket["name"],
                "price": float(ticket["price"]),
                "total": total,
                "sold": sold,
                "locked": locked,
                "available": max(0, total - sold - locked),
            })

        concerts.append({
            "id": concert["idConcierto"],
            "artist": concert["artista"],
            "venue": concert["lugar"],
            "date": str(concert["fecha"]),
            "time": str(concert["hora"]),
            "ticketTypes": ticket_types,
        })

    return jsonify(concerts)


@conciertos_bp.post("/concerts")
def create_concert():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error
    _admin, error = ctx["require_admin"](user_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    for ticket in data.get("tickets", []):
        try:
            price = float(ticket.get("price"))
            total = int(ticket.get("total"))
        except (TypeError, ValueError):
            return jsonify({"message": "Los valores de entradas y precios deben ser validos."}), 400
        if price < 5 or total < 5:
            return jsonify({"message": "Los valores de entradas y precios deben ser de 5 en adelante."}), 400

    conn = begin_transaction()
    try:
        execute(
            "INSERT INTO Concierto (artista, lugar, fecha, hora) VALUES (%s, %s, %s, %s)",
            [data.get("artist"), data.get("venue"), data.get("date"), data.get("time")],
            connection=conn,
        )
        concert_id = execute("SELECT LAST_INSERT_ID() AS id", connection=conn)[0]["id"]
        for ticket in data.get("tickets", []):
            execute(
                "INSERT INTO Entrada (idConcierto, tipo, precio, total, vendidas, estado) VALUES (%s, %s, %s, %s, 0, 'disponible')",
                [concert_id, ticket.get("name"), ticket.get("price"), ticket.get("total")],
                connection=conn,
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return jsonify({"id": concert_id}), 201


@conciertos_bp.patch("/ticket-types/<ticket_type_id>")
def update_ticket_type(ticket_type_id):
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error
    _admin, error = ctx["require_admin"](user_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    try:
        new_total = int(data.get("total"))
    except (TypeError, ValueError):
        return jsonify({"message": "La cantidad debe ser un numero valido."}), 400

    conn = begin_transaction()
    try:
        ctx["expire_reservations"](conn)
        ticket_rows = execute(
            "SELECT idEntrada AS id, vendidas AS sold FROM Entrada WHERE idEntrada = %s FOR UPDATE",
            [ticket_type_id],
            connection=conn,
        )
        if not ticket_rows:
            conn.rollback()
            return jsonify({"message": "Tipo de entrada no encontrado."}), 404

        locked_rows = execute(
            "SELECT COALESCE(SUM(cantidad), 0) AS locked FROM Reserva WHERE idEntrada = %s AND estado = 'active'",
            [ticket_type_id],
            connection=conn,
        )
        minimum_total = int(ticket_rows[0]["sold"]) + int(locked_rows[0]["locked"])
        if new_total < minimum_total:
            conn.rollback()
            return jsonify({
                "message": f"La cantidad no puede ser menor a {minimum_total} entradas ya vendidas o bloqueadas."
            }), 409

        execute(
            "UPDATE Entrada SET total = %s, estado = CASE WHEN %s <= vendidas THEN 'agotada' ELSE 'disponible' END WHERE idEntrada = %s",
            [new_total, new_total, ticket_type_id],
            connection=conn,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return jsonify({"ok": True, "total": new_total})


@conciertos_bp.get("/admin/summary")
def admin_summary():
    ctx = current_app.config["APP_CONTEXT"]
    user_id, error = ctx["require_user"]()
    if error:
        return error
    _admin, error = ctx["require_admin"](user_id)
    if error:
        return error

    ctx["expire_reservations"]()
    rows = execute("""
        SELECT
          c.idConcierto AS id,
          c.artista AS artist,
          COALESCE(SUM(e.vendidas), 0) AS sold,
          COALESCE(SUM(e.vendidas * e.precio), 0) AS revenue,
          COALESCE(SUM(e.total - e.vendidas), 0) AS baseAvailable
        FROM Concierto c
        JOIN Entrada e ON e.idConcierto = c.idConcierto
        GROUP BY c.idConcierto
        ORDER BY c.fecha, c.hora
    """)
    locked_rows = execute("""
        SELECT c.idConcierto AS id, COALESCE(SUM(r.cantidad), 0) AS locked
        FROM Concierto c
        JOIN Reserva r ON r.idConcierto = c.idConcierto AND r.estado = 'active'
        GROUP BY c.idConcierto
    """)

    locked_by_concert = {row["id"]: int(row["locked"]) for row in locked_rows}
    inventory = []
    for row in rows:
        locked = locked_by_concert.get(row["id"], 0)
        inventory.append({
            "artist": row["artist"],
            "sold": int(row["sold"]),
            "locked": locked,
            "available": int(row["baseAvailable"]) - locked,
            "revenue": float(row["revenue"]),
        })

    totals = {
        "sold": sum(item["sold"] for item in inventory),
        "locked": sum(item["locked"] for item in inventory),
        "revenue": sum(item["revenue"] for item in inventory),
    }
    return jsonify({"totals": totals, "inventory": inventory})
