const API_BASE = "https://gym-ai-agent-backend-staging.onrender.com/api";

const state = {
  apiBase: API_BASE,
  token: "",
  selectedGymId: "",
  user: null,
};

const LOCATION_DATA = {
  "Costa Rica": {
    dialCode: "+506",
    states: {
      "San Jose": [
        "San Jose", "Escazu", "Desamparados", "Puriscal", "Tarrazu",
        "Aserri", "Mora", "Goicoechea", "Santa Ana", "Alajuelita",
        "Vazquez de Coronado", "Acosta", "Tibas", "Moravia", "Montes de Oca",
        "Turrubares", "Dota", "Curridabat", "Perez Zeledon", "Leon Cortes Castro",
      ],
      Alajuela: [
        "Alajuela", "San Ramon", "Grecia", "San Mateo", "Atenas",
        "Naranjo", "Palmares", "Poas", "Orotina", "San Carlos",
        "Zarcero", "Sarchi", "Upala", "Los Chiles", "Guatuso", "Rio Cuarto",
      ],
      Cartago: ["Cartago", "Paraiso", "La Union", "Jimenez", "Turrialba", "Alvarado", "Oreamuno", "El Guarco"],
      Heredia: ["Heredia", "Barva", "Santo Domingo", "Santa Barbara", "San Rafael", "San Isidro", "Belen", "Flores", "San Pablo", "Sarapiqui"],
      Guanacaste: ["Liberia", "Nicoya", "Santa Cruz", "Bagaces", "Carrillo", "Canas", "Abangares", "Tilaran", "Nandayure", "La Cruz", "Hojancha"],
      Puntarenas: ["Puntarenas", "Esparza", "Buenos Aires", "Montes de Oro", "Osa", "Quepos", "Golfito", "Coto Brus", "Parrita", "Corredores", "Garabito", "Monteverde", "Puerto Jimenez"],
      Limon: ["Limon", "Pococi", "Siquirres", "Talamanca", "Matina", "Guacimo"],
    },
  },
  Mexico: {
    dialCode: "+52",
    states: {
      CDMX: ["Cuauhtemoc", "Benito Juarez", "Coyoacan"],
      Jalisco: ["Guadalajara", "Zapopan", "Tlaquepaque"],
      NuevoLeon: ["Monterrey", "San Nicolas", "Guadalupe"],
    },
  },
  Colombia: {
    dialCode: "+57",
    states: {
      Cundinamarca: ["Bogota", "Soacha", "Chia"],
      Antioquia: ["Medellin", "Envigado", "Bello"],
      "Valle del Cauca": ["Cali", "Palmira", "Buenaventura"],
    },
  },
  "Estados Unidos": {
    dialCode: "+1",
    states: {
      California: ["Los Angeles", "San Diego", "San Jose"],
      Texas: ["Houston", "Dallas", "Austin"],
      Florida: ["Miami", "Orlando", "Tampa"],
    },
  },
};

const $ = (id) => document.getElementById(id);

// Session
const SESSION_KEY = "pt_tok";
function saveSession(t)  { sessionStorage.setItem(SESSION_KEY, t); }
function clearSession()  { sessionStorage.removeItem(SESSION_KEY); }
function getSavedToken() { return sessionStorage.getItem(SESSION_KEY) || ""; }

// Router
function navigate(path) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  applyRoute(path);
}

function applyRoute(path) {
  if (!state.token) {
    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    return;
  }
  $("loginScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  $("signedUser").textContent = state.user
    ? `Sesion: ${state.user.fullName} (${state.user.email})`
    : "";
  if (path.startsWith("/main/empresa/")) {
    const gymId = path.replace("/main/empresa/", "");
    state.selectedGymId = gymId;
    $("dashboardPage").classList.add("hidden");
    $("companyPage").classList.remove("hidden");
    $("backToDashboardBtn").classList.remove("hidden");
  } else {
    $("dashboardPage").classList.remove("hidden");
    $("companyPage").classList.add("hidden");
    $("backToDashboardBtn").classList.add("hidden");
    if (window.location.pathname !== "/main") {
      window.history.replaceState({}, "", "/main");
    }
  }
}

window.addEventListener("popstate", () => { applyRoute(window.location.pathname); });

// HTTP
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: {
      ...(state.token ? authHeaders() : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Error ${res.status}`);
  return body;
}

function fmtDate(iso) { return new Date(iso).toLocaleString("es-CR"); }

function roleRows(users) {
  return users.map((u) => `<li>${u.fullName} (${u.email}) ${u.isActive ? "" : "[INACTIVO]"}</li>`).join("");
}

function adminRows(admins, gymId) {
  return admins.map((u) => `
    <li class="admin-row">
      <span>${u.fullName} (${u.email}) ${u.isActive ? "" : "[INACTIVO]"}</span>
      <span class="admin-actions">
        ${u.isActive ? `<button class="ghost-btn deactivate-admin-btn" data-user-id="${u.id}" data-gym-id="${gymId}" data-admin-name="${u.fullName}">Desactivar</button>` : ""}
        <button class="ghost-btn danger-ghost-btn delete-admin-btn" data-user-id="${u.id}" data-gym-id="${gymId}" data-admin-name="${u.fullName}">Eliminar</button>
      </span>
    </li>`).join("");
}

// Pages
function showApp() {
  navigate("/main");
  void loadDashboard();
  void loadAlerts();
}

function showLogin() {
  clearSession();
  state.token = "";
  state.user = null;
  navigate("/");
}

function openCompanyPage() { navigate("/main/empresa/" + state.selectedGymId); }
function openDashboardPage() { navigate("/main"); }

// Modal
let _modalOnConfirm = null;

function openModal({ eyebrow = "", title = "", desc = "", step = 1, confirmLabel = "", confirmPlaceholder = "", confirmBtnText = "Confirmar", dangerBtn = false, onConfirm }) {
  $("modalEyebrow").textContent = eyebrow;
  $("modalTitle").textContent = title;
  $("modalDesc").textContent = desc;
  $("modalError").textContent = "";
  const btn = $("modalConfirmBtn");
  btn.textContent = confirmBtnText;
  btn.disabled = false;
  btn.className = dangerBtn ? "danger-btn" : "";
  if (step === 1) {
    $("modalStep1").classList.remove("hidden");
    $("modalStep2").classList.add("hidden");
    $("modalEmail").value = state.user ? state.user.email : "";
    $("modalPassword").value = "";
    setTimeout(() => $("modalPassword").focus(), 80);
  } else {
    $("modalStep1").classList.add("hidden");
    $("modalStep2").classList.remove("hidden");
    $("modalConfirmLabel").textContent = confirmLabel;
    $("modalConfirmInput").placeholder = confirmPlaceholder;
    $("modalConfirmInput").value = "";
    setTimeout(() => $("modalConfirmInput").focus(), 80);
  }
  _modalOnConfirm = onConfirm;
  $("confirmModal").classList.remove("hidden");
}

function closeModal() {
  $("confirmModal").classList.add("hidden");
  $("modalPassword").value = "";
  $("modalConfirmInput").value = "";
  $("modalError").textContent = "";
  _modalOnConfirm = null;
}

$("modalCancelBtn").addEventListener("click", closeModal);
$("confirmModal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("modalForm").addEventListener("submit", async (e) => { e.preventDefault(); if (_modalOnConfirm) await _modalOnConfirm(); });

// Location selectors
function fillSelectOptions(selectEl, placeholder, values) {
  selectEl.innerHTML = "";
  const first = document.createElement("option");
  first.value = ""; first.textContent = placeholder; first.selected = true;
  selectEl.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value; option.textContent = value;
    selectEl.appendChild(option);
  });
}

function syncLocationSelectors() {
  const country = $("companyCountry").value;
  const countryData = LOCATION_DATA[country];
  if (!countryData) {
    $("companyPhoneCode").value = "";
    fillSelectOptions($("companyState"), "Provincia o estado", []);
    fillSelectOptions($("companyDistrict"), "Canton o distrito", []);
    return;
  }
  $("companyPhoneCode").value = countryData.dialCode;
  fillSelectOptions($("companyState"), "Provincia o estado", Object.keys(countryData.states));
  fillSelectOptions($("companyDistrict"), "Canton o distrito", []);
}

function syncDistrictSelector() {
  const country = $("companyCountry").value;
  const stateName = $("companyState").value;
  const countryData = LOCATION_DATA[country];
  if (!countryData || !stateName) {
    fillSelectOptions($("companyDistrict"), "Canton o distrito", []);
    return;
  }
  fillSelectOptions($("companyDistrict"), "Canton o distrito", countryData.states[stateName] || []);
}

// Alerts
function renderAlerts(alerts, daysAhead) {
  const summaryEl = $("alertsSummary");
  const listEl = $("alertsList");
  if (!alerts || alerts.length === 0) {
    summaryEl.textContent = `Sin alertas en los proximos ${daysAhead} dias.`;
    listEl.innerHTML = ""; return;
  }
  const inGrace = alerts.filter((a) => a.isInGrace).length;
  const suspended = alerts.filter((a) => a.isSuspended).length;
  const expiring = alerts.filter((a) => a.isExpiringSoon).length;
  summaryEl.textContent = `Vencimientos: ${expiring} | En gracia: ${inGrace} | Suspendidos: ${suspended}`;
  listEl.innerHTML = alerts.slice(0, 8).map((alert) => `
    <article class="alert-card">
      <p class="alert-title">${alert.gymName}</p>
      <p class="alert-meta">Estado: ${alert.status} | Plan: ${alert.planTier.toUpperCase()}</p>
      <p class="alert-meta">Vence: ${fmtDate(alert.endsAt)} | Consultas pendientes: ${alert.pendingUserQueries}</p>
      ${alert.graceEndsAt ? `<p class="alert-meta">Gracia hasta: ${fmtDate(alert.graceEndsAt)}</p>` : ""}
    </article>`).join("");
}

async function loadAlerts() {
  try {
    const data = await apiFetch("/platform/alerts?daysAhead=10");
    renderAlerts(data.alerts, data.daysAhead);
  } catch (error) {
    $("alertsSummary").textContent = `Error: ${error.message}`;
    $("alertsList").innerHTML = "";
  }
}

// Dashboard
async function loadDashboard() {
  const summaryEl = $("summary");
  const listEl = $("companyList");
  const deletedSummaryEl = $("deletedSummary");
  const deletedListEl = $("deletedCompanyList");
  summaryEl.textContent = "Cargando...";
  listEl.innerHTML = "";
  deletedSummaryEl.textContent = "";
  deletedListEl.innerHTML = "";

  try {
    const data = await apiFetch("/platform/dashboard?includeDeleted=true");
    const activeCompanies  = data.companies.filter((c) => !c.isDeleted);
    const deletedCompanies = data.companies.filter((c) => c.isDeleted);

    summaryEl.textContent = `Empresas activas: ${data.summary.companies} | Por vencer: ${data.summary.expiringSoon} | Sobrecupo: ${data.summary.overflowing}`;
    deletedSummaryEl.textContent = deletedCompanies.length > 0
      ? `Eliminadas recuperables: ${deletedCompanies.length}`
      : "Sin empresas eliminadas.";

    listEl.innerHTML = activeCompanies.map((company) => `
      <article class="company-card">
        <h3>${company.gymName}</h3>
        <div class="company-meta">Owner: ${company.ownerName}</div>
        <div class="company-meta">Plan: ${company.planTier.toUpperCase()} | Cupo: ${company.userLimit}</div>
        <div class="company-meta">Activos: ${company.counts.activeMembers} | Estado: ${company.subscriptionStatus}</div>
        <div class="company-meta">Vence: ${fmtDate(company.activeUntil)}</div>
        <div class="company-actions">
          <button data-gym-id="${company.gymId}" class="ghost-btn detail-btn">Ver detalle</button>
          <button data-gym-id="${company.gymId}" data-gym-name="${company.gymName}" class="ghost-btn delete-btn">Eliminar</button>
        </div>
      </article>`).join("");

    deletedListEl.innerHTML = deletedCompanies.map((company) => `
      <article class="company-card deleted">
        <h3>${company.gymName}</h3>
        <div class="company-meta">Eliminada: ${company.deletedAt ? fmtDate(company.deletedAt) : "-"}</div>
        <div class="company-meta">Recuperable hasta: ${company.recoverUntil ? fmtDate(company.recoverUntil) : "-"}</div>
        <div class="company-actions">
          <button data-gym-id="${company.gymId}" class="ghost-btn detail-btn">Ver detalle</button>
          <button data-gym-id="${company.gymId}" data-gym-name="${company.gymName}" class="ghost-btn recover-btn">Recuperar</button>
          <button data-gym-id="${company.gymId}" data-gym-name="${company.gymName}" class="ghost-btn danger-ghost-btn hard-delete-btn">Eliminar definitivamente</button>
        </div>
      </article>`).join("");

    document.querySelectorAll(".detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedGymId = btn.getAttribute("data-gym-id");
        openCompanyPage();
        void loadCompanyDetail(state.selectedGymId);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gymId   = btn.getAttribute("data-gym-id");
        const gymName = btn.getAttribute("data-gym-name");
        openModal({
          eyebrow: "Paso 1 de 2 - Eliminar empresa",
          title: gymName,
          desc: "Confirma tu identidad como administrador de plataforma para iniciar la eliminacion. Tendras 60 dias para recuperarla.",
          step: 1,
          confirmBtnText: "Continuar",
          onConfirm: async () => {
            const password = $("modalPassword").value;
            if (!password) { $("modalError").textContent = "Ingresa tu contrasena."; return; }
            const cb = $("modalConfirmBtn");
            cb.disabled = true; cb.textContent = "Verificando..."; $("modalError").textContent = "";
            try {
              const step1 = await apiFetch(`/platform/companies/${gymId}/deletion/request`, {
                method: "POST", body: JSON.stringify({ platformPassword: password }),
              });
              openModal({
                eyebrow: "Paso 2 de 2 - Confirmar eliminacion",
                title: "Confirmar eliminacion definitiva",
                desc: `Para confirmar, escribe el nombre exacto del gimnasio y presiona Enter para eliminar.`,
                step: 2,
                confirmLabel: `"${gymName}"`,
                confirmPlaceholder: gymName,
                confirmBtnText: "Confirmar eliminacion",
                dangerBtn: true,
                onConfirm: async () => {
                  const confirmation = $("modalConfirmInput").value;
                  if (!confirmation) { $("modalError").textContent = "Escribe el nombre del gimnasio."; return; }
                  const cb2 = $("modalConfirmBtn");
                  cb2.disabled = true; cb2.textContent = "Eliminando..."; $("modalError").textContent = "";
                  try {
                    await apiFetch(`/platform/companies/${gymId}/deletion/confirm`, {
                      method: "POST", body: JSON.stringify({ challengeToken: step1.challengeToken, confirmation }),
                    });
                    closeModal();
                    await loadDashboard();
                    await loadAlerts();
                  } catch (err) {
                    $("modalError").textContent = err.message;
                    cb2.disabled = false; cb2.textContent = "Confirmar eliminacion";
                  }
                },
              });
            } catch (err) {
              $("modalError").textContent = err.message;
              cb.disabled = false; cb.textContent = "Continuar";
            }
          },
        });
      });
    });

    document.querySelectorAll(".recover-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gymId   = btn.getAttribute("data-gym-id");
        const gymName = btn.getAttribute("data-gym-name");
        openModal({
          eyebrow: "Recuperar empresa",
          title: gymName,
          desc: "Confirma tu identidad como administrador de plataforma para recuperar esta empresa.",
          step: 1,
          confirmBtnText: "Recuperar empresa",
          onConfirm: async () => {
            const password = $("modalPassword").value;
            if (!password) { $("modalError").textContent = "Ingresa tu contrasena."; return; }
            const cb = $("modalConfirmBtn");
            cb.disabled = true; cb.textContent = "Recuperando..."; $("modalError").textContent = "";
            try {
              await apiFetch(`/platform/companies/${gymId}/recover`, {
                method: "POST", body: JSON.stringify({ platformPassword: password }),
              });
              closeModal();
              await loadDashboard();
              await loadAlerts();
            } catch (err) {
              $("modalError").textContent = err.message;
              cb.disabled = false; cb.textContent = "Recuperar empresa";
            }
          },
        });
      });
    });
    document.querySelectorAll('.hard-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gymId   = btn.getAttribute('data-gym-id');
        const gymName = btn.getAttribute('data-gym-name');
        openModal({
          eyebrow: 'Paso 1 de 2 - Eliminacion definitiva',
          title: gymName,
          desc: 'ADVERTENCIA: Esta accion es IRREVERSIBLE. Todos los datos del gimnasio seran eliminados permanentemente. Confirma tu identidad para continuar.',
          step: 1,
          confirmBtnText: 'Continuar',
          onConfirm: async () => {
            const password = $('modalPassword').value;
            if (!password) { $('modalError').textContent = 'Ingresa tu contrasena.'; return; }
            const cb = $('modalConfirmBtn');
            cb.disabled = true; cb.textContent = 'Verificando...'; $('modalError').textContent = '';
            try {
              const step1 = await apiFetch(`/platform/companies/${gymId}/hard-delete/request`, {
                method: 'POST', body: JSON.stringify({ platformPassword: password }),
              });
              openModal({
                eyebrow: 'Paso 2 de 2 - Confirmar eliminacion definitiva',
                title: '⚠️ Esta accion es irreversible',
                desc: `Para confirmar la eliminacion PERMANENTE, escribe el nombre exacto del gimnasio.`,
                step: 2,
                confirmLabel: `"${gymName}"`,
                confirmPlaceholder: gymName,
                confirmBtnText: 'Eliminar definitivamente',
                dangerBtn: true,
                onConfirm: async () => {
                  const confirmation = $('modalConfirmInput').value;
                  if (!confirmation) { $('modalError').textContent = 'Escribe el nombre del gimnasio.'; return; }
                  const cb2 = $('modalConfirmBtn');
                  cb2.disabled = true; cb2.textContent = 'Eliminando...'; $('modalError').textContent = '';
                  try {
                    await apiFetch(`/platform/companies/${gymId}/hard-delete/confirm`, {
                      method: 'POST', body: JSON.stringify({ challengeToken: step1.challengeToken, confirmation }),
                    });
                    closeModal();
                    await loadDashboard();
                    await loadAlerts();
                  } catch (err) {
                    $('modalError').textContent = err.message;
                    cb2.disabled = false; cb2.textContent = 'Eliminar definitivamente';
                  }
                },
              });
            } catch (err) {
              $('modalError').textContent = err.message;
              cb.disabled = false; cb.textContent = 'Continuar';
            }
          },
        });
      });
    });  } catch (error) {
    summaryEl.textContent = `Error: ${error.message}`;
  }
}

// Company detail
async function loadCompanyDetail(gymId) {
  const detailEl = $("companyDetail");
  detailEl.textContent = "Cargando detalle...";
  try {
    const data = await apiFetch(`/platform/companies/${gymId}`);
    const sub  = data.subscription;
    detailEl.innerHTML = `
      <div class="detail-grid">
        <section class="block">
          <h3>${data.company.gymName}</h3>
          <p>Owner: ${data.company.ownerName}</p>
          <p>Moneda: ${data.company.currency}</p>
          <p>Estado empresa: ${data.company.isDeleted ? "Eliminada" : "Activa"}</p>
          ${data.company.recoverUntil ? `<p>Recuperable hasta: ${fmtDate(data.company.recoverUntil)}</p>` : ""}
          <p>Plan: ${sub.planTier.toUpperCase()} | Cupo: ${sub.userLimit}</p>
          <p>Estado: ${sub.status} | Miembros activos: ${sub.activeMemberCount}</p>
          <p>Vigencia: ${fmtDate(sub.startsAt)} a ${fmtDate(sub.endsAt)}</p>
          <p>Gracia: ${sub.graceEndsAt ? fmtDate(sub.graceEndsAt) : "No activa"}</p>
        </section>
        <section class="block">
          <h3>Acceso de empresa</h3>
          <p>${data.company.lockedAt ? `<strong>BLOQUEADO</strong> desde ${fmtDate(data.company.lockedAt)}` : "Acceso normal (desbloqueado)"}</p>
          <button id="lockToggleBtn" type="button">${data.company.lockedAt ? "Desbloquear acceso" : "Bloquear acceso"}</button>
        </section>
        <section class="block">
          <h3>Estado de suscripcion</h3>
          <div class="form-grid">
            <select id="subscriptionStatus" class="full">
              <option value="active">Activa</option>
              <option value="suspended">Suspendida</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <input id="subscriptionStatusReason" class="full" placeholder="Razon del cambio" />
            <button id="saveStatusBtn" class="full" type="button">Actualizar estado</button>
          </div>
        </section>
        <section class="block">
          <h3>Actualizar suscripcion</h3>
          <div class="form-grid">
            <select id="planTier">
              <option value="basica">Basica</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
            <input id="userLimit" type="number" min="1" placeholder="Cupo usuarios" />
            <input id="endsAt" class="full" type="datetime-local" />
            <input id="reason" class="full" type="text" placeholder="Razon de cambio" />
            <button id="saveSubBtn" class="full">Guardar suscripcion</button>
          </div>
        </section>
        <section class="block">
          <h3>Control de sobrecupo</h3>
          <button id="enforceBtn">Ejecutar validacion de cupo</button>
        </section>
        <section class="block">
          <h3>Crear administrador</h3>
          <div class="form-grid">
            <input id="adminName" placeholder="Nombre completo" />
            <input id="adminEmail" type="email" placeholder="Correo" />
            <input id="adminPassword" class="full" type="password" placeholder="Contrasena temporal" />
            <button id="createAdminBtn" class="full">Crear admin</button>
          </div>
        </section>
        <section class="block">
          <h3>Jerarquia</h3>
          <p><strong>Admins (${data.hierarchy.admins.length})</strong></p>
          <ul class="mini-list">${adminRows(data.hierarchy.admins, gymId)}</ul>
          <p><strong>Entrenadores (${data.hierarchy.trainers.length})</strong></p>
          <ul class="mini-list">${roleRows(data.hierarchy.trainers)}</ul>
          <p><strong>Miembros (${data.hierarchy.members.length})</strong></p>
          <ul class="mini-list">${roleRows(data.hierarchy.members.slice(0, 20))}</ul>
        </section>
      </div>`;

    $("planTier").value           = sub.planTier;
    $("userLimit").value          = String(sub.userLimit);
    $("endsAt").value             = sub.endsAt.slice(0, 16);
    $("subscriptionStatus").value = sub.status;

    $("saveSubBtn").addEventListener("click", async () => {
      try {
        await apiFetch(`/platform/companies/${gymId}/subscription`, {
          method: "PUT",
          body: JSON.stringify({
            planTier: $("planTier").value, userLimit: Number($("userLimit").value),
            endsAt: new Date($("endsAt").value).toISOString(), reason: $("reason").value || undefined,
          }),
        });
        alert("Suscripcion actualizada");
        await loadDashboard(); await loadAlerts(); await loadCompanyDetail(gymId);
      } catch (error) { alert(error.message); }
    });

    $("enforceBtn").addEventListener("click", async () => {
      try {
        const result = await apiFetch(`/platform/companies/${gymId}/subscription/enforce`, { method: "POST", body: JSON.stringify({}) });
        alert(result.message);
        await loadDashboard(); await loadAlerts(); await loadCompanyDetail(gymId);
      } catch (error) { alert(error.message); }
    });

    $("saveStatusBtn").addEventListener("click", async () => {
      try {
        await apiFetch(`/platform/companies/${gymId}/subscription/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: $("subscriptionStatus").value, reason: $("subscriptionStatusReason").value || undefined }),
        });
        alert("Estado actualizado");
        await loadDashboard(); await loadAlerts(); await loadCompanyDetail(gymId);
      } catch (error) { alert(error.message); }
    });

    $("createAdminBtn").addEventListener("click", async () => {
      try {
        await apiFetch(`/platform/companies/${gymId}/admins`, {
          method: "POST",
          body: JSON.stringify({ fullName: $("adminName").value, email: $("adminEmail").value, password: $("adminPassword").value }),
        });
        alert("Administrador creado");
        await loadCompanyDetail(gymId);
      } catch (error) { alert(error.message); }
    });

    $("lockToggleBtn").addEventListener("click", async () => {
      const isLocked = Boolean(data.company.lockedAt);
      const action = isLocked ? "desbloquear" : "bloquear";
      if (!confirm(`¿Seguro que deseas ${action} el acceso a este gimnasio?`)) return;
      try {
        await apiFetch(`/platform/companies/${gymId}/lock`, {
          method: "PATCH",
          body: JSON.stringify({ locked: !isLocked }),
        });
        await loadCompanyDetail(gymId);
      } catch (error) { alert(error.message); }
    });

    document.querySelectorAll(".deactivate-admin-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId    = btn.getAttribute("data-user-id");
        const adminName = btn.getAttribute("data-admin-name");
        if (!confirm(`¿Desactivar a ${adminName}? No podrá iniciar sesión hasta que se reactive.`)) return;
        try {
          await apiFetch(`/platform/companies/${gymId}/admins/${userId}/deactivate`, { method: "PATCH", body: JSON.stringify({}) });
          alert("Administrador desactivado");
          await loadCompanyDetail(gymId);
        } catch (error) { alert(error.message); }
      });
    });

    document.querySelectorAll(".delete-admin-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId    = btn.getAttribute("data-user-id");
        const adminName = btn.getAttribute("data-admin-name");
        openModal({
          eyebrow: "Eliminar administrador",
          title: adminName,
          desc: "Esta accion es permanente. Confirma tu contrasena para eliminar este administrador.",
          step: 1,
          confirmBtnText: "Eliminar",
          dangerBtn: true,
          onConfirm: async () => {
            const password = $("modalPassword").value;
            if (!password) { $("modalError").textContent = "Ingresa tu contrasena."; return; }
            const cb = $("modalConfirmBtn");
            cb.disabled = true; cb.textContent = "Eliminando..."; $("modalError").textContent = "";
            try {
              await apiFetch(`/platform/companies/${gymId}/admins/${userId}`, {
                method: "DELETE",
                body: JSON.stringify({ platformPassword: password }),
              });
              closeModal();
              await loadCompanyDetail(gymId);
            } catch (err) {
              $("modalError").textContent = err.message;
              cb.disabled = false; cb.textContent = "Eliminar";
            }
          },
        });
      });
    });
  } catch (error) {
    detailEl.textContent = `Error: ${error.message}`;
  }
}

// Login form
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = $("loginError");
  errorEl.textContent = "";
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!email || !password) { errorEl.textContent = "Completa correo y contrasena."; return; }
  try {
    const login = await apiFetch("/platform/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }), headers: { "Content-Type": "application/json" },
    });
    state.token = login.token;
    saveSession(login.token);
    const me   = await apiFetch("/platform/auth/me");
    state.user = me.user;
    showApp();
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

// Create company form
$("createCompanyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = $("createCompanyError");
  errorEl.textContent = "";
  try {
    const payload = {
      gymName:       $("companyGymName").value,
      ownerName:     $("companyOwnerName").value,
      address:       $("companyAddress").value || undefined,
      country:       $("companyCountry").value || undefined,
      state:         $("companyState").value   || undefined,
      district:      $("companyDistrict").value || undefined,
      phone:         $("companyPhone").value
        ? `${$("companyPhoneCode").value || ""} ${$("companyPhone").value}`.trim()
        : undefined,
      currency:      $("companyCurrency").value,
      adminEmail:    $("companyAdminEmail").value,
      adminFullName: $("companyAdminName").value,
      adminPassword: $("companyAdminPassword").value,
      planTier:      $("companyPlanTier").value,
      userLimit:     Number($("companyUserLimit").value),
      startsAt:      $("companyStartsAt").value ? new Date($("companyStartsAt").value).toISOString() : undefined,
      endsAt:        $("companyEndsAt").value   ? new Date($("companyEndsAt").value).toISOString()   : undefined,
      notes:         $("companyNotes").value || undefined,
    };
    await apiFetch("/platform/companies", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    $("companyCurrency").value = "USD";
    $("companyPlanTier").value  = "premium";
    $("companyUserLimit").value = "50";
    syncLocationSelectors();
    alert("Gimnasio creado correctamente");
    await loadDashboard();
    await loadAlerts();
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

$("companyCountry").addEventListener("change", syncLocationSelectors);
$("companyState").addEventListener("change", syncDistrictSelector);
syncLocationSelectors();

$("refreshBtn").addEventListener("click", async () => {
  await loadDashboard();
  await loadAlerts();
  if (state.selectedGymId) await loadCompanyDetail(state.selectedGymId);
});

$("backToDashboardBtn").addEventListener("click", () => { openDashboardPage(); });

document.querySelectorAll(".accordion-header").forEach((btn) => {
  btn.addEventListener("click", () => { btn.closest(".accordion").classList.toggle("open"); });
});

$("logoutBtn").addEventListener("click", () => {
  state.selectedGymId = "";
  $("companyDetail").textContent = "Selecciona una empresa para ver jerarquia y suscripcion.";
  showLogin();
});

// Init
(async function init() {
  const saved = getSavedToken();
  if (saved) {
    state.token = saved;
    try {
      const me   = await apiFetch("/platform/auth/me");
      state.user = me.user;
    } catch {
      state.token = "";
      clearSession();
    }
  }
  applyRoute(window.location.pathname);
  if (state.token) {
    void loadDashboard();
    void loadAlerts();
    if (window.location.pathname.startsWith("/main/empresa/")) {
      void loadCompanyDetail(window.location.pathname.replace("/main/empresa/", ""));
    }
  }
})();