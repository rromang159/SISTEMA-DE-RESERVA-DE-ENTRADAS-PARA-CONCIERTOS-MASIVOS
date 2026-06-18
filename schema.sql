CREATE DATABASE IF NOT EXISTS reservas_conciertos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reservas_conciertos;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Pago;
DROP TABLE IF EXISTS Reserva;
DROP TABLE IF EXISTS Entrada;
DROP TABLE IF EXISTS Concierto;
DROP TABLE IF EXISTS Usuario;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Usuario (
  idUsuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(160) NOT NULL UNIQUE,
  contrasena VARCHAR(120) NOT NULL,
  rol ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  fechaCreacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Concierto (
  idConcierto INT AUTO_INCREMENT PRIMARY KEY,
  artista VARCHAR(160) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  lugar VARCHAR(160) NOT NULL,
  fechaCreacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Entrada (
  idEntrada INT AUTO_INCREMENT PRIMARY KEY,
  idConcierto INT NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  estado ENUM('disponible', 'agotada') NOT NULL DEFAULT 'disponible',
  total INT NOT NULL,
  vendidas INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_Entrada_Concierto
    FOREIGN KEY (idConcierto) REFERENCES Concierto(idConcierto)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Reserva (
  idReserva INT AUTO_INCREMENT PRIMARY KEY,
  idUsuario INT NOT NULL,
  idConcierto INT NOT NULL,
  idEntrada INT NOT NULL,
  fechaReserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('active', 'confirmed', 'rejected', 'expired', 'cancelled') NOT NULL,
  cantidad INT NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  expiraEn DATETIME NOT NULL,
  CONSTRAINT fk_Reserva_Usuario
    FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario),
  CONSTRAINT fk_Reserva_Concierto
    FOREIGN KEY (idConcierto) REFERENCES Concierto(idConcierto),
  CONSTRAINT fk_Reserva_Entrada
    FOREIGN KEY (idEntrada) REFERENCES Entrada(idEntrada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Pago (
  idPago INT AUTO_INCREMENT PRIMARY KEY,
  idReserva INT NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  estado ENUM('approved', 'rejected') NOT NULL,
  metodo VARCHAR(80) NOT NULL,
  fechaPago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_Pago_Reserva
    FOREIGN KEY (idReserva) REFERENCES Reserva(idReserva)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_Reserva_Entrada_Estado_Expira
  ON Reserva(idEntrada, estado, expiraEn);

INSERT INTO Usuario (idUsuario, nombre, correo, contrasena, rol) VALUES
  (1, 'Administrador', 'admin@demo.com', 'Admin123', 'admin'),
  (2, 'Usuario Demo', 'usuario@demo.com', 'Usuario123', 'user');

INSERT INTO Concierto (idConcierto, artista, fecha, hora, lugar) VALUES
  (1, 'Festival Andino Live', '2026-07-18', '20:00:00', 'Estadio Banco Pacifico'),
  (2, 'Noche Urbana', '2026-08-03', '21:00:00', 'Coliseo Mayor'),
  (3, 'Sinfonia Pop', '2026-09-12', '19:30:00', 'Arena Milagro');

INSERT INTO Entrada (idEntrada, idConcierto, tipo, precio, total, vendidas) VALUES
  (1, 1, 'General', 35.00, 3200, 1180),
  (2, 1, 'VIP', 85.00, 750, 420),
  (3, 2, 'General', 42.00, 4500, 2430),
  (4, 2, 'VIP', 110.00, 950, 610),
  (5, 3, 'General', 28.00, 1800, 400),
  (6, 3, 'VIP', 70.00, 300, 125);
