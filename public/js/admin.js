document.addEventListener("DOMContentLoaded", function () {
  const notification = document.getElementById("notification");

  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `alert alert-${type}`;
    notification.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  /** Wraps fetch for admin API calls: on a 401 (session expired /
   *  logged out in another tab), redirects to the login page instead
   *  of silently failing. */
  async function adminFetch(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    if (response.status === 401) {
      window.location.href = "/login.html";
      throw new Error("Not authorised");
    }
    return response;
  }

  function setFieldErrors(prefix, errors) {
    Object.keys(errors || {}).forEach((field) => {
      const el = document.getElementById(`${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}Error`);
      if (el) el.textContent = errors[field];
    });
  }
  function clearFieldErrors(prefix, fields) {
    fields.forEach((field) => {
      const el = document.getElementById(`${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}Error`);
      if (el) el.textContent = "";
    });
  }

  /* ---------------- Session / logout ---------------- */
  adminFetch("/api/session").then((r) => r.json()).then((data) => {
    if (data.user) document.getElementById("adminUsername").textContent = data.user.username;
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await adminFetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });

  /* ---------------- Tabs ---------------- */
  document.querySelectorAll("#adminTabs .nav-link").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll("#adminTabs .nav-link").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".admin-tab").forEach((section) => section.classList.add("d-none"));
      tabBtn.classList.add("active");
      document.getElementById(`tab-${tabBtn.dataset.tab}`).classList.remove("d-none");
    });
  });

  /* ============================================================
     Destinations
     ============================================================ */
  const destinationForm = document.getElementById("destinationForm");
  const destinationFields = ["name", "category", "description", "imageUrl"];

  async function loadDestinationsTable() {
    const search = document.getElementById("destinationSearch").value.trim();
    const url = "/api/destinations" + (search ? `?search=${encodeURIComponent(search)}` : "");
    const data = await (await adminFetch(url)).json();

    document.getElementById("destinationsTableBody").innerHTML = data.destinations.map((d) => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.category)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-edit-destination="${d.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-delete-destination="${d.id}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="3" class="text-muted">No destinations found.</td></tr>`;

    // Stash full records on the table body for the edit buttons to read without a second fetch.
    document.getElementById("destinationsTableBody").dataset.records = JSON.stringify(data.destinations);
  }

  function resetDestinationForm() {
    destinationForm.reset();
    document.getElementById("destinationId").value = "";
    document.getElementById("destinationFormTitle").textContent = "Add a destination";
    document.getElementById("destinationSubmitBtn").textContent = "Add destination";
    document.getElementById("destinationCancelBtn").classList.add("d-none");
    clearFieldErrors("destination", destinationFields);
  }

  destinationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors("destination", destinationFields);

    const id = document.getElementById("destinationId").value;
    const payload = {
      name: document.getElementById("destinationName").value,
      category: document.getElementById("destinationCategory").value,
      description: document.getElementById("destinationDescription").value,
      image_url: document.getElementById("destinationImageUrl").value
    };

    try {
      const response = await adminFetch(id ? `/api/destinations/${id}` : "/api/destinations", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors) setFieldErrors("destination", data.errors);
        showNotification(data.error || "Please fix the highlighted fields.", "danger");
        return;
      }

      showNotification(id ? "Destination updated." : "Destination added.", "success");
      resetDestinationForm();
      loadDestinationsTable();
    } catch (err) {
      console.error(err);
      showNotification("Could not reach the server. Please try again.", "danger");
    }
  });

  document.getElementById("destinationCancelBtn").addEventListener("click", resetDestinationForm);

  document.getElementById("destinationsTableBody").addEventListener("click", async (event) => {
    const editId = event.target.dataset.editDestination;
    const deleteId = event.target.dataset.deleteDestination;

    if (editId) {
      const records = JSON.parse(document.getElementById("destinationsTableBody").dataset.records || "[]");
      const record = records.find((r) => String(r.id) === editId);
      if (!record) return;
      document.getElementById("destinationId").value = record.id;
      document.getElementById("destinationName").value = record.name;
      document.getElementById("destinationCategory").value = record.category;
      document.getElementById("destinationDescription").value = record.description;
      document.getElementById("destinationImageUrl").value = record.image_url;
      document.getElementById("destinationFormTitle").textContent = `Editing: ${record.name}`;
      document.getElementById("destinationSubmitBtn").textContent = "Save changes";
      document.getElementById("destinationCancelBtn").classList.remove("d-none");
      document.getElementById("destinationForm").scrollIntoView({ behavior: "smooth" });
    }

    if (deleteId) {
      if (!confirm("Delete this destination? This cannot be undone.")) return;
      try {
        const response = await adminFetch(`/api/destinations/${deleteId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
          showNotification(data.error || "Could not delete this destination.", "danger");
          return;
        }
        showNotification("Destination deleted.", "success");
        loadDestinationsTable();
      } catch (err) {
        console.error(err);
        showNotification("Could not reach the server. Please try again.", "danger");
      }
    }
  });

  document.getElementById("destinationSearch").addEventListener("input", () => loadDestinationsTable());

  /* ============================================================
     Packages
     ============================================================ */
  const packageForm = document.getElementById("packageForm");
  const packageFields = ["name", "description", "imageUrl", "price", "duration"];
  let packagesPage = 1;

  function resetPackageForm() {
    packageForm.reset();
    document.getElementById("packageId").value = "";
    document.getElementById("packageFormTitle").textContent = "Add a package";
    document.getElementById("packageSubmitBtn").textContent = "Add package";
    document.getElementById("packageCancelBtn").classList.add("d-none");
    clearFieldErrors("package", packageFields);
  }

  async function loadPackagesTable() {
    const search = document.getElementById("packageSearch").value.trim();
    const sort = document.getElementById("packageSort").value;
    const params = new URLSearchParams({ page: packagesPage, pageSize: 6 });
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);

    const data = await (await adminFetch(`/api/packages?${params}`)).json();

    document.getElementById("packagesTableBody").innerHTML = data.packages.map((p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.type)}</td>
        <td>$${p.price_from}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-edit-package="${p.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-delete-package="${p.id}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="4" class="text-muted">No packages found.</td></tr>`;

    document.getElementById("packagesTableBody").dataset.records = JSON.stringify(data.packages);
    renderPagination("packagesPagination", data.page, data.totalPages, (page) => { packagesPage = page; loadPackagesTable(); });
  }

  packageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors("package", packageFields);

    const id = document.getElementById("packageId").value;
    const payload = {
      name: document.getElementById("packageName").value,
      type: document.getElementById("packageType").value,
      price_from: document.getElementById("packagePrice").value,
      duration_days: document.getElementById("packageDuration").value,
      description: document.getElementById("packageDescription").value,
      image_url: document.getElementById("packageImageUrl").value
    };

    try {
      const response = await adminFetch(id ? `/api/packages/${id}` : "/api/packages", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors) setFieldErrors("package", data.errors);
        showNotification(data.error || "Please fix the highlighted fields.", "danger");
        return;
      }

      showNotification(id ? "Package updated." : "Package added.", "success");
      resetPackageForm();
      loadPackagesTable();
    } catch (err) {
      console.error(err);
      showNotification("Could not reach the server. Please try again.", "danger");
    }
  });

  document.getElementById("packageCancelBtn").addEventListener("click", resetPackageForm);

  document.getElementById("packagesTableBody").addEventListener("click", async (event) => {
    const editId = event.target.dataset.editPackage;
    const deleteId = event.target.dataset.deletePackage;

    if (editId) {
      const records = JSON.parse(document.getElementById("packagesTableBody").dataset.records || "[]");
      const record = records.find((r) => String(r.id) === editId);
      if (!record) return;
      document.getElementById("packageId").value = record.id;
      document.getElementById("packageName").value = record.name;
      document.getElementById("packageType").value = record.type;
      document.getElementById("packagePrice").value = record.price_from;
      document.getElementById("packageDuration").value = record.duration_days;
      document.getElementById("packageDescription").value = record.description;
      document.getElementById("packageImageUrl").value = record.image_url;
      document.getElementById("packageFormTitle").textContent = `Editing: ${record.name}`;
      document.getElementById("packageSubmitBtn").textContent = "Save changes";
      document.getElementById("packageCancelBtn").classList.remove("d-none");
      document.getElementById("packageForm").scrollIntoView({ behavior: "smooth" });
    }

    if (deleteId) {
      if (!confirm("Delete this package? This cannot be undone.")) return;
      try {
        const response = await adminFetch(`/api/packages/${deleteId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
          showNotification(data.error || "Could not delete this package.", "danger");
          return;
        }
        showNotification("Package deleted.", "success");
        loadPackagesTable();
      } catch (err) {
        console.error(err);
        showNotification("Could not reach the server. Please try again.", "danger");
      }
    }
  });

  document.getElementById("packageSearch").addEventListener("input", () => { packagesPage = 1; loadPackagesTable(); });
  document.getElementById("packageSort").addEventListener("change", () => { packagesPage = 1; loadPackagesTable(); });

  /* ============================================================
     Enquiries
     ============================================================ */
  let enquiriesPage = 1;

  async function loadEnquiriesTable() {
    const search = document.getElementById("enquirySearch").value.trim();
    const status = document.getElementById("enquiryStatusFilter").value;
    const sort = document.getElementById("enquirySort").value;
    const params = new URLSearchParams({ page: enquiriesPage, pageSize: 5, status, sort });
    if (search) params.set("search", search);

    const data = await (await adminFetch(`/api/enquiries?${params}`)).json();

    document.getElementById("enquiriesTableBody").innerHTML = data.enquiries.map((e) => `
      <tr>
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.email)}</td>
        <td style="max-width: 260px;">${escapeHtml(e.message)}</td>
        <td>${escapeHtml(e.destination_name || "—")}</td>
        <td><span class="badge ${e.status === "responded" ? "bg-success" : "bg-warning text-dark"}">${e.status}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-toggle-status="${e.id}" data-current-status="${e.status}">
            Mark ${e.status === "responded" ? "pending" : "responded"}
          </button>
          <button class="btn btn-sm btn-outline-danger" data-delete-enquiry="${e.id}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="6" class="text-muted">No enquiries found.</td></tr>`;

    renderPagination("enquiriesPagination", data.page, data.totalPages, (page) => { enquiriesPage = page; loadEnquiriesTable(); });
  }

  document.getElementById("enquiriesTableBody").addEventListener("click", async (event) => {
    const toggleId = event.target.dataset.toggleStatus;
    const deleteId = event.target.dataset.deleteEnquiry;

    if (toggleId) {
      const newStatus = event.target.dataset.currentStatus === "responded" ? "pending" : "responded";
      const response = await adminFetch(`/api/enquiries/${toggleId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) { showNotification(data.error || "Could not update status.", "danger"); return; }
      showNotification(`Enquiry marked as ${newStatus}.`, "success");
      loadEnquiriesTable();
    }

    if (deleteId) {
      if (!confirm("Delete this enquiry? This cannot be undone.")) return;
      const response = await adminFetch(`/api/enquiries/${deleteId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { showNotification(data.error || "Could not delete this enquiry.", "danger"); return; }
      showNotification("Enquiry deleted.", "success");
      loadEnquiriesTable();
    }
  });

  ["enquirySearch"].forEach((id) => document.getElementById(id).addEventListener("input", () => { enquiriesPage = 1; loadEnquiriesTable(); }));
  ["enquiryStatusFilter", "enquirySort"].forEach((id) => document.getElementById(id).addEventListener("change", () => { enquiriesPage = 1; loadEnquiriesTable(); }));

  /* ---------------- Shared pagination renderer ---------------- */
  function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) { container.innerHTML = ""; return; }

    let html = `<ul class="pagination pagination-sm">`;
    for (let page = 1; page <= totalPages; page++) {
      html += `<li class="page-item ${page === currentPage ? "active" : ""}">
        <button type="button" class="page-link" data-page="${page}">${page}</button>
      </li>`;
    }
    html += `</ul>`;
    container.innerHTML = html;
    container.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => onPageChange(Number(btn.dataset.page)));
    });
  }

  /* ---------------- Initial load ---------------- */
  loadDestinationsTable();
  loadPackagesTable();
  loadEnquiriesTable();
});
