document.addEventListener("DOMContentLoaded", function () {
  setActiveNavLink();
  setFooterLastUpdated();
  setHomeGreeting();
  updateNavAuthState();        // NEW for 10.2D v2 — shows Log in / Admin+Log out depending on session
  loadDestinations();          // UPDATED for 10.2D v2 — now also supports ?search=
  loadPackages();              // UPDATED for 10.2D v2 — packages.html is now database-driven too
  initSearchResults();         // unchanged from Task 7.2D — search.html is still static
  initContactFormValidation(); // UPDATED for 10.2P — now also POSTs to the database
});

/* --------------------------------------------------------------------
   0. NEW for 10.2D v2 — Nav auth state.
   Checks GET /api/session on every page load and swaps the "Log in"
   nav item for "Admin" + "Log out" when an admin is signed in, so the
   nav reflects who's logged in without needing a full page template
   system.
-------------------------------------------------------------------- */
async function updateNavAuthState() {
  const authNavItem = document.getElementById("authNavItem");
  if (!authNavItem) return;

  try {
    const response = await fetch("/api/session");
    const data = await response.json();

    if (data.user) {
      authNavItem.innerHTML = `
        <a class="nav-link" href="/admin">Admin</a>
      `;
      const logoutItem = document.createElement("li");
      logoutItem.className = "nav-item";
      logoutItem.innerHTML = `<button type="button" class="nav-link btn btn-link" id="navLogoutBtn">Log out</button>`;
      authNavItem.after(logoutItem);
      document.getElementById("navLogoutBtn").addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "index.html";
      });
    }
  } catch (err) {
    console.error("Could not check login status:", err);
  }
}

/* --------------------------------------------------------------------
   1. Highlight the current page in the nav automatically.
-------------------------------------------------------------------- */
function setActiveNavLink() {
  const links = document.querySelectorAll(".navbar-nav .nav-link");
  if (!links.length) return;

  let current = window.location.pathname.split("/").pop();
  if (current === "") current = "index.html";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.remove("active");
    if (href === current) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

/* --------------------------------------------------------------------
   2. Footer: accurate "last updated" date.
-------------------------------------------------------------------- */
function setFooterLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (!el) return;
  const today = new Date();
  el.textContent = "Page last updated: " + today.toLocaleDateString("en-AU", {
    year: "numeric", month: "long", day: "numeric"
  });
}

/* --------------------------------------------------------------------
   3. Homepage: time-of-day greeting.
-------------------------------------------------------------------- */
function setHomeGreeting() {
  const el = document.getElementById("greetingBanner");
  if (!el) return;
  const hour = new Date().getHours();
  let greeting = "Welcome";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";
  el.textContent = greeting + ", ready to plan your next trip to Indonesia?";
}

/* --------------------------------------------------------------------
   4. NEW for Task 10.2P — Destinations page.
   Fetches rows from the destinations table via GET /api/destinations
   instead of reading them from hard-coded HTML, then renders the card
   grid and wires up the existing region filter (now re-fetches from
   the database with a ?region= query string param).
-------------------------------------------------------------------- */
const BADGE_CLASS = {
  "Beach & nature": "badge-beach",
  "Culture": "badge-culture",
  "Nature": "badge-nature",
  "Adventure": "badge-adventure"
};

/** Escapes HTML special characters before inserting admin-entered text
 *  (destination/package name, category, description) into innerHTML —
 *  defence-in-depth alongside the server-side validation, so a stray
 *  "<" or "&" in a title never breaks the markup or executes as HTML. */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function renderDestinationCard(destination) {
  const badgeClass = BADGE_CLASS[destination.category] || "badge-beach";
  return `
    <div class="col-md-4">
      <div class="card h-100" data-region="${destination.slug}">
        <img src="${escapeHtml(destination.image_url)}" class="card-img-top" alt="${escapeHtml(destination.name)}">
        <div class="card-body">
          <span class="badge ${badgeClass} mb-2">${escapeHtml(destination.category)}</span>
          <h5 class="card-title">${escapeHtml(destination.name)}</h5>
          <p class="card-text">${escapeHtml(destination.description)}</p>
          <a href="packages.html" class="btn btn-sm btn-primary">See packages</a>
        </div>
      </div>
    </div>`;
}

async function loadDestinations(region) {
  const list = document.getElementById("destinationsList");
  const status = document.getElementById("destinationsStatus");
  if (!list) return; // not on the destinations page

  status.textContent = "Loading destinations…";
  status.classList.remove("d-none", "text-danger");

  try {
    const searchInput = document.getElementById("destinationSearchInput");
    const params = new URLSearchParams();
    if (region && region !== "all") params.set("region", region);
    if (searchInput && searchInput.value.trim()) params.set("search", searchInput.value.trim());

    const response = await fetch(`/api/destinations?${params}`);
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();

    if (!data.destinations || data.destinations.length === 0) {
      list.innerHTML = "";
      status.textContent = "No destinations matched your filter.";
      return;
    }

    list.innerHTML = data.destinations.map(renderDestinationCard).join("");
    status.classList.add("d-none");
  } catch (err) {
    console.error(err);
    status.textContent = "Could not load destinations from the database. Is the server running?";
    status.classList.add("text-danger");
  }
}

function initDestinationFilterButton() {
  const select = document.getElementById("regionFilter");
  const button = document.getElementById("regionFilterBtn");
  const searchInput = document.getElementById("destinationSearchInput");
  if (!select) return;

  function applyFilter() {
    loadDestinations(select.value);
  }
  if (button) button.addEventListener("click", applyFilter);
  select.addEventListener("change", applyFilter);
  if (searchInput) searchInput.addEventListener("input", applyFilter);
}
// Wire up the filter as soon as the destinations page's elements exist.
if (document.getElementById("regionFilter")) initDestinationFilterButton();

/* --------------------------------------------------------------------
   5. UPDATED for 10.2D v2 — Packages page.
   packages.html no longer has hard-coded cards; every package now
   comes from GET /api/packages, which supports ?type, ?search, ?sort
   and ?page/?pageSize (used for the pagination controls below).
-------------------------------------------------------------------- */
let packagesCurrentPage = 1;

function renderPackageCard(pkg) {
  const badgeClass = BADGE_CLASS[pkg.type.charAt(0).toUpperCase() + pkg.type.slice(1)] || `badge-${pkg.type}`;
  return `
    <div class="col-md-4">
      <div class="card h-100" data-type="${pkg.type}">
        <img src="${escapeHtml(pkg.image_url)}" class="card-img-top" alt="${escapeHtml(pkg.name)}">
        <div class="card-body">
          <span class="badge ${badgeClass} mb-2">${escapeHtml(pkg.type.charAt(0).toUpperCase() + pkg.type.slice(1))}</span>
          <h5 class="card-title">${escapeHtml(pkg.name)}, ${pkg.duration_days} day${pkg.duration_days > 1 ? "s" : ""}</h5>
          <p class="card-text">From $${pkg.price_from} per person. ${escapeHtml(pkg.description)}</p>
          <button type="button" class="btn btn-sm btn-outline-primary me-1" data-view-package="${pkg.id}">View details</button>
          <a href="contact.html" class="btn btn-sm btn-primary">Enquire</a>
        </div>
      </div>
    </div>`;
}

function renderPublicPagination(containerId, currentPage, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  let html = `<ul class="pagination">`;
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

async function loadPackages(page) {
  const list = document.getElementById("packagesList");
  const status = document.getElementById("packagesStatus");
  if (!list) return; // not on the packages page

  if (page) packagesCurrentPage = page;
  status.textContent = "Loading packages…";
  status.classList.remove("d-none", "text-danger");

  try {
    const type = document.getElementById("typeFilter")?.value || "all";
    const search = document.getElementById("packageSearchInput")?.value.trim() || "";
    const sort = document.getElementById("packageSortSelect")?.value || "";

    const params = new URLSearchParams({ page: packagesCurrentPage, pageSize: 6 });
    if (type !== "all") params.set("type", type);
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);

    const response = await fetch(`/api/packages?${params}`);
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();

    if (!data.packages || data.packages.length === 0) {
      list.innerHTML = "";
      status.textContent = "No packages matched your filter.";
      renderPublicPagination("packagesPagination", 1, 1, () => {});
      return;
    }

    list.innerHTML = data.packages.map(renderPackageCard).join("");
    list.dataset.records = JSON.stringify(data.packages);
    status.classList.add("d-none");
    renderPublicPagination("packagesPagination", data.page, data.totalPages, (newPage) => loadPackages(newPage));
  } catch (err) {
    console.error(err);
    status.textContent = "Could not load packages from the database. Is the server running?";
    status.classList.add("text-danger");
  }
}

function initPackageControls() {
  const typeFilter = document.getElementById("typeFilter");
  const searchInput = document.getElementById("packageSearchInput");
  const sortSelect = document.getElementById("packageSortSelect");
  if (!typeFilter) return;

  function applyFilter() { packagesCurrentPage = 1; loadPackages(); }
  typeFilter.addEventListener("change", applyFilter);
  if (searchInput) searchInput.addEventListener("input", applyFilter);
  if (sortSelect) sortSelect.addEventListener("change", applyFilter);

  // "View details" opens the shared modal with that package's full description.
  document.getElementById("packagesList").addEventListener("click", (event) => {
    const id = event.target.dataset.viewPackage;
    if (!id) return;
    const records = JSON.parse(document.getElementById("packagesList").dataset.records || "[]");
    const pkg = records.find((r) => String(r.id) === id);
    if (!pkg) return;

    document.getElementById("packageDetailModalLabel").textContent = `${pkg.name}, ${pkg.duration_days} days`;
    document.getElementById("packageDetailModalBody").innerHTML =
      `<p><strong>From $${pkg.price_from} per person.</strong> ${escapeHtml(pkg.description)}</p>`;
    new bootstrap.Modal(document.getElementById("packageDetailModal")).show();
  });
}
if (document.getElementById("typeFilter")) initPackageControls();

/* --------------------------------------------------------------------
   6. Search results page: unchanged from Task 7.2D — reads the ?q=
   query string and filters a small in-page dataset.
-------------------------------------------------------------------- */
function initSearchResults() {
  const list = document.getElementById("searchResultsList");
  const heading = document.getElementById("searchTermDisplay");
  if (!list) return;

  const dataset = [
    { title: "Bali & Lombok", type: "Destination", url: "destinations.html",
      text: "Beaches, rice terraces, and island-hopping by boat." },
    { title: "Java & Yogyakarta", type: "Destination", url: "destinations.html",
      text: "Ancient temples, royal courts, and the sunrise trek up Mount Bromo." },
    { title: "Raja Ampat & Papua", type: "Destination", url: "destinations.html",
      text: "Remote islands and some of the richest coral reefs on Earth." },
    { title: "Sumatera", type: "Destination", url: "destinations.html",
      text: "Lake Toba, orangutan jungles, and Batak highland culture." },
    { title: "Kalimantan", type: "Destination", url: "destinations.html",
      text: "Borneo rainforest, river cruises, and Dayak longhouse villages." },
    { title: "Bali & Gili Islands, 6 days", type: "Package — from $520", url: "packages.html",
      text: "Beach type. Flights, hotel, and one boat day trip included." },
    { title: "Bromo & Ijen trekking, 4 days", type: "Package — from $380", url: "packages.html",
      text: "Adventure type. Guide, permits, and transport included." },
    { title: "Java & Yogyakarta culture, 7 days", type: "Package — from $650", url: "packages.html",
      text: "Culture type. Borobudur, Prambanan, and a batik workshop included." },
    { title: "Nusa Penida day trip, 1 day", type: "Package — from $95", url: "packages.html",
      text: "Beach type. Cliff viewpoints, snorkelling, and a fast-boat transfer." },
    { title: "Mount Rinjani trek, Lombok, 3 days", type: "Package — from $410", url: "packages.html",
      text: "Adventure type. Crater-rim camping and a summit sunrise push." },
    { title: "Komodo & Labuan Bajo, 4 days", type: "Package — from $560", url: "packages.html",
      text: "Adventure type. Komodo dragon trek and Pink Beach snorkelling." },
    { title: "Lake Toba & Samosir Island, 5 days", type: "Package — from $470", url: "packages.html",
      text: "Culture type. Batak villages, traditional houses, and volcanic lake views." },
    { title: "Bukit Lawang orangutan trek, Sumatera, 3 days", type: "Package — from $340", url: "packages.html",
      text: "Nature type. Guided rainforest trek to see wild orangutans." },
    { title: "Tanjung Puting river cruise, Kalimantan, 4 days", type: "Package — from $590", url: "packages.html",
      text: "Nature type. Klotok houseboat cruise through orangutan reserve." },
    { title: "Kalimantan river & longhouse culture, 5 days", type: "Package — from $530", url: "packages.html",
      text: "Culture type. Dayak longhouse stay and traditional river travel." }
  ];

  const params = new URLSearchParams(window.location.search);
  const query = (params.get("q") || "").trim();

  if (heading) heading.textContent = query ? query : "all destinations & packages";

  const results = query
    ? dataset.filter((item) => (item.title + " " + item.text).toLowerCase().includes(query.toLowerCase()))
    : dataset;

  list.innerHTML = "";
  if (results.length === 0) {
    list.innerHTML = '<p class="text-muted">No results matched your search. Try a broader term, or browse <a href="destinations.html">Destinations</a> or <a href="packages.html">Packages</a> directly.</p>';
    return;
  }

  results.forEach((item) => {
    const a = document.createElement("a");
    a.href = item.url;
    a.className = "list-group-item list-group-item-action";
    a.innerHTML = `
      <div class="d-flex w-100 justify-content-between">
        <h5 class="mb-1">${item.title}</h5>
        <small class="text-muted">${item.type}</small>
      </div>
      <p class="mb-1">${item.text}</p>`;
    list.appendChild(a);
  });
}

/* --------------------------------------------------------------------
   7. UPDATED for Task 10.2P — Contact page query-form validation.
   Client-side rules are unchanged from Task 7.2D (required fields,
   email pattern, digits-only phone). On a successful client-side
   check the form now also POSTs to /api/enquiries so the query is
   saved in the enquiries table, and reports the server's response
   (including any server-side validation errors) back to the user.
-------------------------------------------------------------------- */
function initContactFormValidation() {
  const form = document.getElementById("queryForm");
  if (!form) return;

  const MAX_PHONE_DIGITS = 10;
  const statusBox = document.getElementById("formStatus");
  const errorStatusBox = document.getElementById("formErrorStatus");
  const submitBtn = document.getElementById("queryFormSubmit");

  function setError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input || !errorEl) return;
    if (message) {
      input.classList.add("is-invalid");
      errorEl.textContent = message;
    } else {
      input.classList.remove("is-invalid");
      errorEl.textContent = "";
    }
  }

  function validateName() {
    const value = document.getElementById("name").value.trim();
    if (value === "") { setError("name", "nameError", "Please enter your name."); return false; }
    setError("name", "nameError", "");
    return true;
  }

  function validateEmail() {
    const value = document.getElementById("email").value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value === "") { setError("email", "emailError", "Please enter your email address."); return false; }
    if (!emailPattern.test(value)) {
      setError("email", "emailError", "Please enter a valid email address (e.g. name@example.com).");
      return false;
    }
    setError("email", "emailError", "");
    return true;
  }

  function validatePhone() {
    const raw = document.getElementById("phone").value.trim();
    if (raw === "") { setError("phone", "phoneError", ""); return true; } // optional
    const digitsOnly = /^[0-9]+$/;
    if (!digitsOnly.test(raw)) { setError("phone", "phoneError", "Phone number must contain digits only."); return false; }
    if (raw.length > MAX_PHONE_DIGITS) {
      setError("phone", "phoneError", `Phone number must be at most ${MAX_PHONE_DIGITS} digits.`);
      return false;
    }
    setError("phone", "phoneError", "");
    return true;
  }

  function validateMessage() {
    const value = document.getElementById("message").value.trim();
    if (value === "") { setError("message", "messageError", "Please enter your query."); return false; }
    if (value.length > 500) { setError("message", "messageError", "Please keep your query under 500 characters."); return false; }
    setError("message", "messageError", "");
    return true;
  }

  ["name", "email", "phone", "message"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const validators = { name: validateName, email: validateEmail, phone: validatePhone, message: validateMessage };
    el.addEventListener("blur", validators[id]);
    el.addEventListener("input", function () {
      if (el.classList.contains("is-invalid")) validators[id]();
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (statusBox) statusBox.classList.add("d-none");
    if (errorStatusBox) errorStatusBox.classList.add("d-none");

    const isNameValid = validateName();
    const isEmailValid = validateEmail();
    const isPhoneValid = validatePhone();
    const isMessageValid = validateMessage();

    if (!(isNameValid && isEmailValid && isPhoneValid && isMessageValid)) {
      const firstInvalid = form.querySelector(".is-invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const payload = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      message: document.getElementById("message").value,
      destinationSlug: document.getElementById("destination")
        ? document.getElementById("destination").value
        : null
    };

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        // Server-side validation failed — show its messages next to the fields.
        if (data.errors) {
          Object.entries(data.errors).forEach(([field, msg]) => setError(field, `${field}Error`, msg));
        }
        if (errorStatusBox) {
          errorStatusBox.textContent = "Please fix the highlighted fields and try again.";
          errorStatusBox.classList.remove("d-none");
        }
        return;
      }

      if (statusBox) {
        statusBox.textContent = `Thanks! Your query (reference #${data.id}) has been saved — we'll reply within one business day.`;
        statusBox.classList.remove("d-none");
      }
      form.reset();
    } catch (err) {
      console.error(err);
      if (errorStatusBox) {
        errorStatusBox.textContent = "Could not reach the server. Please check your connection and try again.";
        errorStatusBox.classList.remove("d-none");
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Send query"; }
    }
  });
}
