# Sistema de reserva de entradas para conciertos masivos

Proyecto web basado en el documento `PROYECTO - ARQUITECTURA DE SOFTWARE.docx`.

Ahora el sistema esta preparado para funcionar con:

- Frontend: `index.html`, `styles.css`, `app.js`
- Backend: Python + Flask
- Base de datos: MySQL

## Que necesitas instalar

Instala estas dos cosas:

1. Python 3.10 o superior: https://www.python.org/downloads/
2. MySQL. Puedes usar una de estas opciones:
   - MySQL Community Server: https://dev.mysql.com/downloads/mysql/
   - XAMPP, que trae MySQL/MariaDB y phpMyAdmin: https://www.apachefriends.org/

Para un proyecto academico, XAMPP suele ser lo mas sencillo porque puedes crear/importar la base desde phpMyAdmin.

## Crear la base de datos

Opcion con phpMyAdmin:

1. Abre XAMPP.
2. Inicia `Apache` y `MySQL`.
3. Entra a `http://localhost/phpmyadmin`.
4. Ve a la pestana `Importar`.
5. Selecciona el archivo `schema.sql`.
6. Ejecuta la importacion.

Opcion con consola de MySQL:

```bash
mysql -u root -p < schema.sql
```

Si tu usuario `root` no tiene contrasena, puedes usar:

```bash
mysql -u root < schema.sql
```

## Configurar conexion

Copia `.env.example` y renombralo como `.env`.

Configuracion tipica con XAMPP:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=reservas_conciertos
```

Si tu MySQL tiene contrasena, ponla en `DB_PASSWORD`.

## Instalar dependencias del backend Python

Desde esta carpeta del proyecto:

```bash
python -m pip install -r requirements.txt
```

## Ejecutar el sistema

Inicia el servidor:

```bash
python app.py
```

Luego abre en el navegador:

```text
http://localhost:3000
```

Importante: con MySQL ya no abras `index.html` con doble clic ni con `file://`, porque el navegador necesita comunicarse con el backend.

## Credenciales de prueba

Usuario:

- Correo: `usuario@demo.com`
- Contrasena: `Usuario123`

Administrador:

- Correo: `admin@demo.com`
- Contrasena: `Admin123`

## Funcionalidades implementadas

- Registro e inicio de sesion de usuarios.
- Consulta de conciertos disponibles desde MySQL.
- Visualizacion de disponibilidad por tipo de entrada.
- Reserva temporal de entradas durante 2 minutos.
- Control transaccional para evitar doble venta.
- Pago simulado con resultado aprobado o rechazado.
- Confirmacion de compra y actualizacion de entradas vendidas.
- Panel administrativo para registrar conciertos y revisar inventario, bloqueos, ventas e ingresos.

## Archivos principales

- `index.html`: estructura de la interfaz.
- `styles.css`: estilos responsivos.
- `app.js`: frontend conectado a la API.
- `app.py`: backend Flask principal.
- `database.py`: conexion a MySQL.
- `modules/usuarios.py`: modulo de registro, login y usuarios.
- `modules/conciertos.py`: modulo de conciertos e inventario.
- `modules/reservas.py`: modulo de reservas y bloqueo temporal.
- `modules/pagos.py`: modulo de pagos y confirmacion.
- `schema.sql`: creacion de base, tablas y datos de prueba.
- `.env.example`: ejemplo de configuracion.

## Tablas de la base de datos

La base usa los nombres del modelo UML:

- `Usuario`
- `Concierto`
- `Entrada`
- `Reserva`
- `Pago`

Claves foraneas principales:

- `Entrada.idConcierto` -> `Concierto.idConcierto`
- `Reserva.idUsuario` -> `Usuario.idUsuario`
- `Reserva.idConcierto` -> `Concierto.idConcierto`
- `Reserva.idEntrada` -> `Entrada.idEntrada`
- `Pago.idReserva` -> `Reserva.idReserva`

## Relacion con requerimientos

- RF1: registro e inicio de sesion.
- RF2 y RF3: consulta de conciertos y disponibilidad.
- RF4, RF5, RF6 y RF7: seleccion, bloqueo temporal, reserva activa y expiracion.
- RF8 y RF9: procesamiento de pago y confirmacion.
- RF10: gestion administrativa.

La proteccion contra doble venta se hace en el backend usando transacciones y `SELECT ... FOR UPDATE` sobre el tipo de entrada al crear reservas.
