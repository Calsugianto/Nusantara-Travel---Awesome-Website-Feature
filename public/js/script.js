document.addEventListener("DOMContentLoaded", function () {
  setActiveNavLink();
  setFooterLastUpdated();
  setHomeGreeting();
  loadDestinations();          // NEW for 10.2P — was initDestinationFilter() reading static HTML
  initPackageFilter();         // unchanged from Task 7.2D — packages.html is still static
  initSearchResults();         // unchanged from Task 7.2D — search.html is still static
  initContactFormValidation(); // UPDATED for 10.2P — now also POSTs to the database
});

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

function renderDestinationCard(destination) {
  const badgeClass = BADGE_CLASS[destination.category] || "badge-beach";
  return `
    <div class="col-md-4">
      <div class="card h-100" data-region="${destination.slug}">
        <img src="${destination.image_url}" class="card-img-top" alt="${destination.name}">
        <div class="card-body">
          <span class="badge ${badgeClass} mb-2">${destination.category}</span>
          <h5 class="card-title">${destination.name}</h5>
          <p class="card-text">${destination.description}</p>
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
    const url = region && region !== "all"
      ? `/api/destinations?region=${encodeURIComponent(region)}`
      : "/api/destinations";
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();

    if (!data.destinations || data.destinations.length === 0) {
      list.innerHTML = "";
      status.textContent = "No destinations matched that region.";
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
  if (!select) return;

  function applyFilter() {
    loadDestinations(select.value);
  }
  if (button) button.addEventListener("click", applyFilter);
  select.addEventListener("change", applyFilter);
}
// Wire up the filter as soon as the destinations page's elements exist.
if (document.getElementById("regionFilter")) initDestinationFilterButton();

/* --------------------------------------------------------------------
   5. Packages page: unchanged from Task 7.2D — still a client-side
   filter over the static cards (not part of the database scope for
   this task, which asked for "one or two straightforward tables").
-------------------------------------------------------------------- */
function initPackageFilter() {
  const select = document.getElementById("typeFilter");
  const button = document.getElementById("typeFilterBtn");
  const cards = document.querySelectorAll("[data-type]");
  if (!select || !cards.length) return;

  function applyFilter() {
    const chosen = select.value;
    cards.forEach((card) => {
      const show = chosen === "all" || card.dataset.type === chosen;
      const col = card.closest("[class*='col-']") || card;
      col.classList.toggle("d-none", !show);
    });
  }

  if (button) button.addEventListener("click", applyFilter);
  select.addEventListener("change", applyFilter);
  applyFilter();
}

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
