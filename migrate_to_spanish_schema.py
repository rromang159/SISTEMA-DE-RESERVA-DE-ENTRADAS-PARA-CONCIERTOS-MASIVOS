import os
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor


BASE_DIR = Path(__file__).resolve().parent


def load_env():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def connect():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "reservas_conciertos"),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


def table_exists(cursor, table):
    cursor.execute("SHOW TABLES LIKE %s", [table])
    return cursor.fetchone() is not None


def main():
    load_env()
    conn = connect()
    try:
        with conn.cursor() as cursor:
            if table_exists(cursor, "Usuario"):
                print("La base ya usa tablas en espanol. No se migro nada.")
                return

            users = []
            concerts = []
            tickets = []
            reservations = []
            payments = []

            if table_exists(cursor, "users"):
                cursor.execute("SELECT * FROM users ORDER BY created_at, id")
                users = cursor.fetchall()
            if table_exists(cursor, "concerts"):
                cursor.execute("SELECT * FROM concerts ORDER BY date, time, id")
                concerts = cursor.fetchall()
            if table_exists(cursor, "ticket_types"):
                cursor.execute("SELECT * FROM ticket_types ORDER BY concert_id, name, id")
                tickets = cursor.fetchall()
            if table_exists(cursor, "reservations"):
                cursor.execute("SELECT * FROM reservations ORDER BY created_at, id")
                reservations = cursor.fetchall()
            if table_exists(cursor, "payments"):
                cursor.execute("SELECT * FROM payments ORDER BY created_at, id")
                payments = cursor.fetchall()

            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            for table in ["Pago", "Reserva", "Entrada", "Concierto", "Usuario", "payments", "reservations", "ticket_types", "concerts", "users"]:
                cursor.execute(f"DROP TABLE IF EXISTS `{table}`")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

            for statement in (BASE_DIR / "schema.sql").read_text(encoding="utf-8").split(";"):
                statement = statement.strip()
                if statement:
                    cursor.execute(statement)

            cursor.execute("DELETE FROM Pago")
            cursor.execute("DELETE FROM Reserva")
            cursor.execute("DELETE FROM Entrada")
            cursor.execute("DELETE FROM Concierto")
            cursor.execute("DELETE FROM Usuario")

            user_map = {}
            for user in users:
                cursor.execute(
                    """
                    INSERT INTO Usuario (nombre, correo, contrasena, rol, fechaCreacion)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [user["name"], user["email"], user["password"], user["role"], user["created_at"]],
                )
                user_map[user["id"]] = cursor.lastrowid

            concert_map = {}
            for concert in concerts:
                cursor.execute(
                    """
                    INSERT INTO Concierto (artista, fecha, hora, lugar, fechaCreacion)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [concert["artist"], concert["date"], concert["time"], concert["venue"], concert["created_at"]],
                )
                concert_map[concert["id"]] = cursor.lastrowid

            ticket_map = {}
            for ticket in tickets:
                cursor.execute(
                    """
                    INSERT INTO Entrada (idConcierto, tipo, precio, total, vendidas, estado)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        concert_map[ticket["concert_id"]],
                        ticket["name"],
                        ticket["price"],
                        ticket["total"],
                        ticket["sold"],
                        "agotada" if int(ticket["sold"]) >= int(ticket["total"]) else "disponible",
                    ],
                )
                ticket_map[ticket["id"]] = cursor.lastrowid

            reservation_map = {}
            for reservation in reservations:
                cursor.execute(
                    """
                    INSERT INTO Reserva
                      (idUsuario, idConcierto, idEntrada, fechaReserva, estado, cantidad, total, expiraEn)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        user_map[reservation["user_id"]],
                        concert_map[reservation["concert_id"]],
                        ticket_map[reservation["ticket_type_id"]],
                        reservation["created_at"],
                        reservation["status"],
                        reservation["quantity"],
                        reservation["total"],
                        reservation["expires_at"],
                    ],
                )
                reservation_map[reservation["id"]] = cursor.lastrowid

            for payment in payments:
                if payment["reservation_id"] not in reservation_map:
                    continue
                cursor.execute(
                    """
                    INSERT INTO Pago (idReserva, monto, estado, metodo, fechaPago)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [
                        reservation_map[payment["reservation_id"]],
                        payment["amount"],
                        payment["status"],
                        payment["method"],
                        payment["created_at"],
                    ],
                )

        conn.commit()
        print("Migracion completada al modelo Usuario, Concierto, Entrada, Reserva y Pago.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
