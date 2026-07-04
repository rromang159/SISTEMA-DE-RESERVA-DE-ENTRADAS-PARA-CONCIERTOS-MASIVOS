const API_URL = "/api";

let currentUser = null;
let concerts = [];
let reservations = [];
let selectedConcert = null;
let selectedTicket = null;
let selectedQuantity = 1;
let activeReservation = null;
let paymentInProgress = false;
let reservationInProgress = false;

const viewIds = [
  "authPanel",
  "concertsView",
  "ticketsView",
  "summaryView",
  "paymentView",
  "confirmationView",
  "reservationsView",
  "adminView",
];

const artistImages = [
  "url('assets/concerts/concert-1.jpg')",
  "url('assets/concerts/concert-2.jpg')",
  "url('assets/concerts/concert-3.jpg')",
  "url('assets/concerts/concert-4.jpg')",
];

const subtitles = [
  "Music of the Spheres",
  "After Hours Til Dawn",
  "Manana Sera Bonito Tour",
  "Tour mundial",
];

const authPanel = document.getElementById("authPanel");
const sessionBox = document.getElementById("sessionBox");
const notice = document.getElementById("notice");
const concertList = document.getElementById("concertList");
const reservationRows = document.getElementById("reservationRows");
const inventoryRows = document.getElementById("inventoryRows");
const metrics = document.getElementById("metrics");
const selectedConcertInfo = document.getElementById("selectedConcertInfo");
const ticketOptions = document.getElementById("ticketOptions");
const seatMap = document.getElementById("seatMap");
const quantityLabel = document.getElementById("quantityLabel");
const selectionTotal = document.getElementById("selectionTotal");
const reservationSummary = document.getElementById("reservationSummary");
const confirmationSummary = document.getElementById("confirmationSummary");
const confirmationCode = document.getElementById("confirmationCode");
const paymentTotal = document.getElementById("paymentTotal");
const avatarButton = document.getElementById("avatarButton");
const userDropdown = document.getElementById("userDropdown");

function userHeaders() {
  return currentUser ? { "x-user-id": currentUser.id } : {};
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...userHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Error en el servidor");
  return data;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatDate(date, time) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T${time}`));
}

function formatTime(time) {
  return String(time || "").slice(0, 5);
}

function showNotice(message) {
  notice.textContent = message;
  notice.classList.add("show");
  window.setTimeout(() => notice.classList.remove("show"), 3500);
}

function showView(name) {
  const target = name === "concerts" ? "concertsView" : `${name}View`;
  viewIds.forEach((id) => {
    document.getElementById(id).classList.toggle("active", id === target || (name === "auth" && id === "authPanel"));
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  if (name === "tickets") {
    syncSelectedConcert();
    renderTicketSelection();
  }
}

function getConcertImage(concert) {
  if (!concert) return artistImages[0];
  const index = Math.max(0, concerts.findIndex((item) => item.id === concert.id));
  return artistImages[index % artistImages.length];
}

function getConcertSubtitle(concert) {
  if (!concert) return subtitles[0];
  const index = Math.max(0, concerts.findIndex((item) => item.id === concert.id));
  return subtitles[index % subtitles.length];
}

function findReservation(id) {
  return reservations.find((reservation) => String(reservation.id) === String(id)) || activeReservation;
}

function syncSelectedConcert() {
  if (!selectedConcert) return;

  const updatedConcert = concerts.find((concert) => concert.id === selectedConcert.id);
  if (!updatedConcert) return;

  const selectedTicketId = selectedTicket?.id;
  selectedConcert = updatedConcert;
  selectedTicket =
    selectedConcert.ticketTypes.find((ticket) => ticket.id === selectedTicketId) ||
    selectedConcert.ticketTypes[0];
  selectedQuantity = Math.min(selectedQuantity, Math.max(1, selectedTicket?.available || 1));
}

function getUserInitial() {
  const source = currentUser?.name || currentUser?.email || "Usuario";
  return source.trim().charAt(0).toUpperCase();
}

function updateAvatar() {
  if (!avatarButton) return;
  avatarButton.textContent = currentUser ? getUserInitial() : "U";
  avatarButton.title = currentUser ? `${currentUser.name} - ${currentUser.email}` : "Usuario";
  if (userDropdown) userDropdown.hidden = true;
}

function renderSession() {
  if (!currentUser) {
    updateAvatar();
    showView("auth");
    return;
  }

  updateAvatar();
  sessionBox.innerHTML = `
    <h2>${currentUser.name}</h2>
    <p>${currentUser.email}</p>
    <p>${currentUser.role === "admin" ? "Administrador" : "Usuario"}</p>
    <button class="secondary-button" type="button" id="profileLogout">Cerrar sesion</button>
  `;

  document.getElementById("profileLogout")?.addEventListener("click", logout);
}

function renderConcerts() {
  const query = document.getElementById("concertSearch").value.trim().toLowerCase();
  const filtered = concerts.filter((concert) => `${concert.artist} ${concert.venue}`.toLowerCase().includes(query));

  if (!filtered.length) {
    concertList.innerHTML = '<div class="empty">No hay conciertos con ese criterio.</div>';
    return;
  }

  concertList.innerHTML = filtered
    .map((concert) => {
      const lowestPrice = Math.min(...concert.ticketTypes.map((ticket) => Number(ticket.price)));
      return `
        <article class="concert-card">
            <div class="concert-photo" style="background-image: ${getConcertImage(concert)}"></div>
          <div class="concert-body">
            <h2>${concert.artist}</h2>
            <p class="concert-subtitle">${getConcertSubtitle(concert)}</p>
            <div class="concert-meta">
              <span>${formatDate(concert.date, concert.time)}</span>
              <span>${concert.venue}</span>
              <span>${formatTime(concert.time)}</span>
            </div>
            <button class="concert-price" type="button" data-select-concert="${concert.id}">Desde ${formatMoney(lowestPrice)}</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-select-concert]").forEach((button) => {
    button.addEventListener("click", () => openTicketSelection(button.dataset.selectConcert));
  });
}

function renderSeatMap() {
  const seats = [];
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      const distance = Math.abs(column - 7);
      if (row < distance / 1.8) {
        seats.push('<span></span>');
      } else {
        const color = row > 6 ? "green" : row > 4 ? "blue" : "";
        seats.push(`<span class="seat ${color}"></span>`);
      }
    }
  }
  seatMap.innerHTML = seats.join("");
}

function openTicketSelection(concertId) {
  selectedConcert = concerts.find((concert) => String(concert.id) === String(concertId));
  if (!selectedConcert) return;

  selectedTicket = selectedConcert.ticketTypes[0];
  selectedQuantity = 1;
  renderTicketSelection();
  showView("tickets");
}

function renderTicketSelection() {
  if (!selectedConcert || !selectedTicket) return;

  selectedConcertInfo.innerHTML = `
    <h2>${selectedConcert.artist}</h2>
    <p>${getConcertSubtitle(selectedConcert)}</p>
    <p>${formatDate(selectedConcert.date, selectedConcert.time)}</p>
    <p>${selectedConcert.venue}</p>
    <p>${formatTime(selectedConcert.time)}</p>
  `;

  ticketOptions.innerHTML = selectedConcert.ticketTypes
    .map((ticket) => `
      <button class="ticket-option ${ticket.id === selectedTicket.id ? "selected" : ""}" type="button" data-ticket="${ticket.id}" ${ticket.available === 0 ? "disabled" : ""}>
        <strong>${ticket.name}</strong>
        <span>${formatMoney(ticket.price)}</span>
        <em>${ticket.available} disponibles</em>
      </button>
    `)
    .join("");

  ticketOptions.querySelectorAll("[data-ticket]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTicket = selectedConcert.ticketTypes.find((ticket) => String(ticket.id) === String(button.dataset.ticket));
      selectedQuantity = Math.min(selectedQuantity, selectedTicket.available || 1);
      renderTicketSelection();
    });
  });

  quantityLabel.textContent = selectedQuantity;
  selectionTotal.textContent = formatMoney(selectedTicket.price * selectedQuantity);
  renderSeatMap();
}

function getSummaryMarkup(reservation) {
  const concert = selectedConcert || concerts.find((item) => item.artist === reservation.artist) || concerts[0];
  const ticketName = reservation.ticketName || selectedTicket?.name || "Entrada";
  const quantity = reservation.quantity || selectedQuantity;
  const total = Number(reservation.total || selectedTicket?.price * selectedQuantity || 0);
  const unit = total / Math.max(1, quantity);

  return `
    <div class="summary-main">
      <div class="summary-image" style="background-image: ${getConcertImage(concert)}"></div>
      <div>
        <h2>${reservation.artist || concert.artist}</h2>
        <p>${getConcertSubtitle(concert)}</p>
        <p>${concert ? `${formatDate(concert.date, concert.time)} - ${formatTime(concert.time)}` : ""}</p>
        <p>${concert?.venue || ""}</p>
      </div>
    </div>
    <table class="detail-table">
      <thead>
        <tr><th>Detalle</th><th>Cantidad</th><th>Precio</th></tr>
      </thead>
      <tbody>
        <tr><td>${ticketName}</td><td>${quantity}</td><td>${formatMoney(unit)} c/u</td></tr>
        <tr><td>Asientos</td><td colspan="2">Fila 12 - Asientos ${15 + quantity}</td></tr>
      </tbody>
    </table>
    <div class="summary-total"><span>Total a pagar</span><strong>${formatMoney(total)}</strong></div>
  `;
}

async function createReservationFromSelection() {
  if (!selectedConcert || !selectedTicket) return;
  if (reservationInProgress) return;
  if (selectedQuantity < 1 || selectedQuantity > selectedTicket.available) {
    showNotice("Selecciona una cantidad valida.");
    return;
  }

  const continueButton = document.getElementById("continueSelection");
  reservationInProgress = true;
  continueButton.disabled = true;
  continueButton.textContent = "Reservando...";

  try {
    const result = await api("/reservations", {
      method: "POST",
      body: JSON.stringify({
        concertId: selectedConcert.id,
        ticketTypeId: selectedTicket.id,
        quantity: selectedQuantity,
      }),
    });
    activeReservation = {
      id: result.id,
      artist: selectedConcert.artist,
      ticketName: selectedTicket.name,
      quantity: selectedQuantity,
      total: selectedTicket.price * selectedQuantity,
      status: "active",
    };
    selectedTicket.locked = Number(selectedTicket.locked || 0) + selectedQuantity;
    selectedTicket.available = Math.max(0, Number(selectedTicket.available || 0) - selectedQuantity);
    reservationSummary.innerHTML = getSummaryMarkup(activeReservation);
    showView("summary");
    refreshData(false).catch((error) => showNotice(error.message));
  } catch (error) {
    showNotice(error.message);
  } finally {
    reservationInProgress = false;
    continueButton.disabled = false;
    continueButton.textContent = "Continuar";
  }
}

function renderReservations() {
  if (!reservations.length) {
    reservationRows.innerHTML = '<div class="empty">No hay reservas registradas.</div>';
    return;
  }

  reservationRows.innerHTML = reservations
    .map((reservation) => {
      const remaining = Math.max(0, new Date(reservation.expiresAt).getTime() - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
      const statusLabel = {
        active: '<span class="pill warn">Activa</span>',
        confirmed: '<span class="pill ok">Confirmada</span>',
        rejected: '<span class="pill">Rechazada</span>',
        expired: '<span class="pill">Expirada</span>',
        cancelled: '<span class="pill">Cancelada</span>',
      }[reservation.status];
      const action =
        reservation.status === "active"
          ? `<button class="small-action" type="button" data-pay="${reservation.id}">Pagar</button>
             <button class="small-action danger-action" type="button" data-cancel="${reservation.id}">Cancelar</button>`
          : "";

      return `
        <article class="reservation-item">
          <div>
            <h2>${reservation.artist}</h2>
            <p>${reservation.ticketName} x ${reservation.quantity}</p>
            <p>${formatMoney(reservation.total)} ${reservation.status === "active" ? `- ${minutes}:${seconds}` : ""}</p>
          </div>
          <div>
            ${statusLabel}
            <div>${action}</div>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-pay]").forEach((button) => {
    button.addEventListener("click", () => openPayment(button.dataset.pay));
  });
  document.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelReservation(button.dataset.cancel));
  });
}

function openPayment(reservationId) {
  const reservation = findReservation(reservationId);
  if (!reservation || reservation.status !== "active") return;
  activeReservation = reservation;
  paymentTotal.textContent = formatMoney(reservation.total);
  showView("payment");
}

async function processPayment(event) {
  event.preventDefault();
  if (!activeReservation) return;
  if (paymentInProgress) return;

  const method = new FormData(event.currentTarget).get("paymentMethod") || "Tarjeta de credito / debito";
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  paymentInProgress = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Procesando...";
  }

  try {
    await api("/payments", {
      method: "POST",
      body: JSON.stringify({
        reservationId: activeReservation.id,
        method,
        result: "approved",
      }),
    });
    activeReservation.status = "confirmed";
    confirmationCode.textContent = `Numero de orden: ${String(activeReservation.id).slice(0, 18).toUpperCase()}`;
    confirmationSummary.innerHTML = getSummaryMarkup(activeReservation);
    showView("confirmation");
    refreshData(false).catch((error) => showNotice(error.message));
  } catch (error) {
    showNotice(error.message);
  } finally {
    paymentInProgress = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Pagar";
    }
  }
}

async function cancelReservation(reservationId) {
  try {
    await api(`/reservations/${reservationId}/cancel`, { method: "POST" });
    showNotice("Reserva cancelada. Las entradas vuelven a estar disponibles.");
    await refreshData(false);
  } catch (error) {
    showNotice(error.message);
  }
}

function renderAdmin(summary) {
  const canAdmin = currentUser?.role === "admin";
  const concertForm = document.getElementById("concertForm");
  concertForm.hidden = !canAdmin;
  metrics.hidden = !canAdmin;
  inventoryRows.hidden = !canAdmin;

  if (!canAdmin) {
    metrics.innerHTML = "";
    inventoryRows.innerHTML = "";
    return;
  }

  metrics.innerHTML = `
    <div class="metric"><span>Vendidas</span><strong>${summary.totals.sold}</strong></div>
    <div class="metric"><span>Bloqueadas</span><strong>${summary.totals.locked}</strong></div>
    <div class="metric"><span>Ingresos</span><strong>${formatMoney(summary.totals.revenue)}</strong></div>
  `;

  inventoryRows.innerHTML = summary.inventory
    .map((item) => `
      <article class="inventory-item">
        <strong>${item.artist}</strong>
        <p>Vendidas: ${item.sold} - Bloqueadas: ${item.locked} - Disponibles: ${item.available}</p>
        <p>Ingresos: ${formatMoney(item.revenue)}</p>
      </article>
    `)
    .join("");

  const ticketControls = concerts
    .map((concert) => `
      <article class="inventory-item">
        <strong>${concert.artist}</strong>
        <p>${concert.venue}</p>
        <div class="admin-ticket-list">
          ${concert.ticketTypes
            .map((ticket) => `
              <form class="admin-ticket-row" data-ticket-form="${ticket.id}">
                <div>
                  <strong>${ticket.name}</strong>
                  <span>${ticket.available} disponibles - ${ticket.sold} vendidas - ${ticket.locked} bloqueadas</span>
                </div>
                <label>
                  Total
                  <input type="number" min="${ticket.sold + ticket.locked}" value="${ticket.total}" data-ticket-total="${ticket.id}">
                </label>
                <button class="small-action" type="submit">Guardar</button>
              </form>
            `)
            .join("")}
        </div>
      </article>
    `)
    .join("");

  inventoryRows.insertAdjacentHTML("beforeend", ticketControls);

  document.querySelectorAll("[data-ticket-form]").forEach((form) => {
    form.addEventListener("submit", updateTicketAvailability);
  });
}

async function updateTicketAvailability(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const ticketId = form.dataset.ticketForm;
  const input = form.querySelector(`[data-ticket-total="${ticketId}"]`);
  const button = form.querySelector("button");
  const total = Number(input.value);

  if (!Number.isInteger(total) || total < Number(input.min)) {
    showNotice(`La cantidad minima permitida es ${input.min}.`);
    return;
  }

  button.disabled = true;
  button.textContent = "Guardando...";
  try {
    await api(`/ticket-types/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ total }),
    });
    showNotice("Disponibilidad actualizada.");
    await refreshData(false);
  } catch (error) {
    showNotice(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Guardar";
  }
}

async function refreshData(keepCurrentView = true) {
  if (!currentUser) {
    renderSession();
    return;
  }

  try {
    concerts = await api("/concerts");
    reservations = await api("/reservations");
    syncSelectedConcert();
    renderSession();
    renderConcerts();
    renderReservations();
    renderAdmin(
      currentUser.role === "admin"
        ? await api("/admin/summary")
        : { totals: { sold: 0, locked: 0, revenue: 0 }, inventory: [] }
    );
    if (!keepCurrentView) return;
    if (![...document.querySelectorAll(".screen")].some((screen) => screen.classList.contains("active"))) {
      showView("concerts");
    }
  } catch (error) {
    showNotice(error.message);
  }
}

function logout() {
  currentUser = null;
  selectedConcert = null;
  selectedTicket = null;
  activeReservation = null;
  sessionStorage.removeItem("currentUser");
  updateAvatar();
  showView("auth");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!currentUser) {
      showNotice("Inicia sesion para acceder al sistema.");
      return;
    }
    showView(button.dataset.view);
    refreshData(false);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.back));
});

avatarButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!currentUser) return;
  userDropdown.hidden = !userDropdown.hidden;
});

document.getElementById("logoutButton").addEventListener("click", logout);

document.addEventListener("click", (event) => {
  if (!userDropdown || userDropdown.hidden) return;
  if (!event.target.closest(".user-menu")) userDropdown.hidden = true;
});

function showAuthForm(formName) {
  document.getElementById("loginForm").hidden = formName !== "login";
  document.getElementById("registerForm").hidden = formName !== "register";
  document.getElementById("recoverForm").hidden = formName !== "recover";
}

document.getElementById("showRegister").addEventListener("click", () => showAuthForm("register"));
document.getElementById("showLogin").addEventListener("click", () => showAuthForm("login"));
document.getElementById("showRecover").addEventListener("click", () => showAuthForm("recover"));
document.getElementById("showLoginFromRecover").addEventListener("click", () => showAuthForm("login"));

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value.trim().toLowerCase(),
        password: document.getElementById("loginPassword").value,
      }),
    });
    currentUser = data.user;
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
    await refreshData(false);
    showView("concerts");
  } catch (error) {
    showNotice(error.message);
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim().toLowerCase(),
        password: document.getElementById("registerPassword").value,
      }),
    });
    currentUser = data.user;
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
    event.target.reset();
    await refreshData(false);
    showView("concerts");
  } catch (error) {
    showNotice(error.message);
  }
});

document.getElementById("recoverForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("recoverEmail").value.trim().toLowerCase();
  const password = document.getElementById("recoverPassword").value;
  const confirmPassword = document.getElementById("recoverConfirmPassword").value;

  if (password !== confirmPassword) {
    showNotice("Las contrasenas no coinciden.");
    return;
  }

  try {
    await api("/recover-password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    event.target.reset();
    document.getElementById("loginEmail").value = email;
    document.getElementById("loginPassword").value = "";
    showAuthForm("login");
    showNotice("Contrasena actualizada. Inicia sesion con tu nueva contrasena.");
  } catch (error) {
    showNotice(error.message);
  }
});

document.getElementById("concertSearch").addEventListener("input", renderConcerts);

document.getElementById("decreaseQty").addEventListener("click", () => {
  selectedQuantity = Math.max(1, selectedQuantity - 1);
  renderTicketSelection();
});

document.getElementById("increaseQty").addEventListener("click", () => {
  selectedQuantity = Math.min(selectedTicket?.available || 1, selectedQuantity + 1);
  renderTicketSelection();
});

document.getElementById("continueSelection").addEventListener("click", createReservationFromSelection);

document.getElementById("goToPayment").addEventListener("click", () => {
  if (!activeReservation) return;
  paymentTotal.textContent = formatMoney(activeReservation.total);
  showView("payment");
});

document.getElementById("paymentForm").addEventListener("submit", processPayment);

document.getElementById("downloadTickets").addEventListener("click", () => {
  showNotice("Entradas listas para descargar.");
});

document.getElementById("concertForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const numericFields = [
    document.getElementById("generalQty"),
    document.getElementById("generalPrice"),
    document.getElementById("vipQty"),
    document.getElementById("vipPrice"),
  ];
  if (numericFields.some((input) => Number(input.value) < 5)) {
    showNotice("Los valores numericos deben ser de 5 en adelante.");
    return;
  }

  try {
    await api("/concerts", {
      method: "POST",
      body: JSON.stringify({
        artist: document.getElementById("artistInput").value.trim(),
        venue: document.getElementById("venueInput").value.trim(),
        date: document.getElementById("dateInput").value,
        time: document.getElementById("timeInput").value,
        tickets: [
          {
            name: "General",
            price: Number(document.getElementById("generalPrice").value),
            total: Number(document.getElementById("generalQty").value),
          },
          {
            name: "VIP",
            price: Number(document.getElementById("vipPrice").value),
            total: Number(document.getElementById("vipQty").value),
          },
        ],
      }),
    });
    event.target.reset();
    showNotice("Concierto registrado.");
    await refreshData(false);
  } catch (error) {
    showNotice(error.message);
  }
});

currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
renderSession();
updateAvatar();
refreshData(false).then(() => {
  if (currentUser) showView("concerts");
});
window.setInterval(() => {
  if (currentUser) refreshData(false);
}, 30000);
