const state = {
  apiBase: "",
  token: "",
  selectedGymId: "",
};

const $ = (id) => document.getElementById(id);

function header() {
  return {
    "Content-Type": "application/json",
    "x-platform-token": state.token,
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: {
      ...header(),
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
  return body;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString("es-CR");
}

function roleRows(users) {
  return users
    .map((u) => `<li>${u.fullName} (${u.email}) ${u.isActive ? "" : "[INACTIVO]"}</li>`)
    .join("");
}

async function loadDashboard() {
  const summaryEl = $("summary");
  const listEl = $("companyList");
  summaryEl.textContent = "Cargando...";
  listEl.innerHTML = "";

  try {
    const data = await apiFetch("/platform/dashboard");
    summaryEl.textContent = `Empresas: ${data.summary.companies} | Por vencer: ${data.summary.expiringSoon} | Sobrecupo: ${data.summary.overflowing}`;

    listEl.innerHTML = data.companies
      .map(
        (company) => `
          <article class="company-card">
            <h3>${company.gymName}</h3>
            <div class="company-meta">Owner: ${company.ownerName}</div>
            <div class="company-meta">Plan: ${company.planTier.toUpperCase()} | Cupo: ${company.userLimit}</div>
            <div class="company-meta">Activos: ${company.counts.activeMembers} | Estado: ${company.subscriptionStatus}</div>
            <div class="company-meta">Vence: ${fmtDate(company.activeUntil)}</div>
            <div class="company-actions">
              <button data-gym-id="${company.gymId}" class="secondary detail-btn">Ver detalle</button>
            </div>
          </article>
        `,
      )
      .join("");

    document.querySelectorAll(".detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedGymId = btn.getAttribute("data-gym-id");
        void loadCompanyDetail(state.selectedGymId);
      });
    });
  } catch (error) {
    summaryEl.textContent = `Error: ${error.message}`;
  }
}

async function loadCompanyDetail(gymId) {
  const detailEl = $("companyDetail");
  detailEl.textContent = "Cargando detalle...";

  try {
    const data = await apiFetch(`/platform/companies/${gymId}`);
    const sub = data.subscription;

    detailEl.innerHTML = `
      <div class="detail-grid">
        <section class="block">
          <h3>${data.company.gymName}</h3>
          <p>Owner: ${data.company.ownerName}</p>
          <p>Moneda: ${data.company.currency}</p>
          <p>Plan: ${sub.planTier.toUpperCase()} | Cupo: ${sub.userLimit}</p>
          <p>Estado: ${sub.status} | Miembros activos: ${sub.activeMemberCount}</p>
          <p>Vigencia: ${fmtDate(sub.startsAt)} a ${fmtDate(sub.endsAt)}</p>
          <p>Gracia: ${sub.graceEndsAt ? fmtDate(sub.graceEndsAt) : "No activa"}</p>
        </section>

        <section class="block">
          <h3>Actualizar suscripción</h3>
          <div class="form-grid">
            <select id="planTier">
              <option value="basica">Basica</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
            <input id="userLimit" type="number" min="1" placeholder="Cupo usuarios" />
            <input id="endsAt" class="full" type="datetime-local" />
            <input id="reason" class="full" type="text" placeholder="Razón de cambio" />
            <button id="saveSubBtn" class="full">Guardar suscripción</button>
          </div>
        </section>

        <section class="block">
          <h3>Control de sobrecupo</h3>
          <button id="enforceBtn">Ejecutar validación de cupo</button>
        </section>

        <section class="block">
          <h3>Crear administrador</h3>
          <div class="form-grid">
            <input id="adminName" placeholder="Nombre completo" />
            <input id="adminEmail" type="email" placeholder="Correo" />
            <input id="adminPassword" class="full" type="password" placeholder="Contraseña temporal" />
            <button id="createAdminBtn" class="full">Crear admin</button>
          </div>
        </section>

        <section class="block">
          <h3>Jerarquía</h3>
          <p><strong>Admins (${data.hierarchy.admins.length})</strong></p>
          <ul class="mini-list">${roleRows(data.hierarchy.admins)}</ul>
          <p><strong>Entrenadores (${data.hierarchy.trainers.length})</strong></p>
          <ul class="mini-list">${roleRows(data.hierarchy.trainers)}</ul>
          <p><strong>Miembros (${data.hierarchy.members.length})</strong></p>
          <ul class="mini-list">${roleRows(data.hierarchy.members.slice(0, 20))}</ul>
        </section>
      </div>
    `;

    $("planTier").value = sub.planTier;
    $("userLimit").value = String(sub.userLimit);
    $("endsAt").value = sub.endsAt.slice(0, 16);

    $("saveSubBtn").addEventListener("click", async () => {
      try {
        await apiFetch(`/platform/companies/${gymId}/subscription`, {
          method: "PUT",
          body: JSON.stringify({
            planTier: $("planTier").value,
            userLimit: Number($("userLimit").value),
            endsAt: new Date($("endsAt").value).toISOString(),
            reason: $("reason").value || undefined,
          }),
        });
        alert("Suscripción actualizada");
        await loadDashboard();
        await loadCompanyDetail(gymId);
      } catch (error) {
        alert(error.message);
      }
    });

    $("enforceBtn").addEventListener("click", async () => {
      try {
        const result = await apiFetch(`/platform/companies/${gymId}/subscription/enforce`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        alert(result.message);
        await loadDashboard();
        await loadCompanyDetail(gymId);
      } catch (error) {
        alert(error.message);
      }
    });

    $("createAdminBtn").addEventListener("click", async () => {
      try {
        await apiFetch(`/platform/companies/${gymId}/admins`, {
          method: "POST",
          body: JSON.stringify({
            fullName: $("adminName").value,
            email: $("adminEmail").value,
            password: $("adminPassword").value,
          }),
        });
        alert("Administrador creado");
        await loadCompanyDetail(gymId);
      } catch (error) {
        alert(error.message);
      }
    });
  } catch (error) {
    detailEl.textContent = `Error: ${error.message}`;
  }
}

$("connectBtn").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("platformToken").value.trim();
  if (!apiBase || !token) {
    alert("Debes completar API base y token");
    return;
  }

  state.apiBase = apiBase;
  state.token = token;
  await loadDashboard();
});
