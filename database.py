import os
from queue import Empty, Queue

import pymysql
from pymysql.cursors import DictCursor

_POOL = Queue(maxsize=5)


def _create_connection():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "reservas_conciertos"),
        cursorclass=DictCursor,
        autocommit=True,
    )


def get_connection():
    try:
        conn = _POOL.get_nowait()
        conn.ping(reconnect=True)
        return conn
    except Empty:
        return _create_connection()


def release_connection(conn):
    if not conn.open:
        return
    try:
        conn.autocommit(True)
        _POOL.put_nowait(conn)
    except Exception:
        conn.close()


def execute(sql, params=None, connection=None):
    owns_connection = connection is None
    conn = connection or get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or [])
            if cursor.description:
                return cursor.fetchall()
            return cursor.rowcount
    finally:
        if owns_connection:
            release_connection(conn)


def begin_transaction():
    conn = get_connection()
    conn.autocommit(False)
    return conn
