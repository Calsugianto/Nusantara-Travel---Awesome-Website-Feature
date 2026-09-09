/* ----------------------------------------------------------------------
   plan.js
   Task 10.3HD — Awesome Website Feature: Live Travel Package
   Preference Visualiser (implements the feature proposed in 7.3HD).

   What it does, end to end:
   1. The customer drags the trip-duration / budget sliders and picks a
      travel style and destination type.
   2. On every input event, calculateCostBreakdown() re-estimates
      flights/accommodation/activities/food from those four values.
   3. generateItinerary() builds a day-by-day plan whose content
      changes with ALL FOUR inputs: duration decides how many days
      there are (and whether a free/rest day gets inserted on longer
      trips), destinationType decides the theme of each day's activity,
      and style + budget together decide how each activity is pitched
      (self-guided/budget vs guided/mid-range vs private/luxury) — see
      getEffectiveTier() below for how style and budget are combined.
   4. drawCostChart() and drawItineraryChart() redraw two <canvas>
      elements with the Canvas 2D API, and renderItineraryList() writes
      the day-by-day text list, all immediately — no page reload, no
      server round trip.
   5. checkBudgetFit() gives Constraint-Validation-style feedback:
      whether the estimated total comfortably fits the chosen budget.
   6. Redraws are debounced (~80ms) so dragging a slider doesn't
      trigger dozens of canvas redraws per second.
   7. A screen-reader-only aria-live region announces the new total
      after each debounced recalculation, so the feedback loop isn't
      purely visual.
   8. savePreference()/loadSavedPreference() persist the last chosen
      combination to localStorage, so a returning visitor sees their
      own preference restored automatically (client-side only — the
      backend/database from Task 10.2P is not involved in this
      feature, by design).
------------------------------------------------------------------------- */

(function () {
  const durationInputCheck = document.getElementById("durationInput");
  if (!durationInputCheck) return; // only run this file's logic on plan.html

  const STORAGE_KEY = "nusantaraTripPreference";

  /* ---------------- Elements ---------------- */
  const durationInput = document.getElementById("durationInput");
  const budgetInput = document.getElementById("budgetInput");
  const styleInput = document.getElementById("styleInput");
  const destinationTypeInput = document.getElementById("destinationTypeInput");

  const durationValue = document.getElementById("durationValue");
  const budgetValue = document.getElementById("budgetValue");

  const costChart = document.getElementById("costChart");
  const itineraryChart = document.getElementById("itineraryChart");
  const costCtx = costChart.getContext("2d");
  const itineraryCtx = itineraryChart.getContext("2d");

  const costFlightsEl = document.getElementById("costFlights");
  const costAccommodationEl = document.getElementById("costAccommodation");
  const costActivitiesEl = document.getElementById("costActivities");
  const costFoodEl = document.getElementById("costFood");
  const costTotalEl = document.getElementById("costTotal");

  const budgetStatus = document.getElementById("budgetStatus");
  const costAnnouncement = document.getElementById("costAnnouncement");
  const savedBanner = document.getElementById("savedBanner");
  const itineraryDayList = document.getElementById("itineraryDayList");

  const savePreferenceBtn = document.getElementById("savePreferenceBtn");
  const resetPreferenceBtn = document.getElementById("resetPreferenceBtn");

  /* ---------------- Cost model ----------------
     Simple representative per-category rates, scaled by travel style
     and (for flights) destination type. Not real fares — an estimate
     for the purpose of the live-feedback feature described in 7.3HD. */
  const STYLE_MULTIPLIERS = { budget: 0.7, "mid-range": 1.0, luxury: 1.8 };
  const DESTINATION_BASE_FLIGHT = { beach: 380, adventure: 460, culture: 320, nature: 520 };
  const NIGHTLY_ACCOMMODATION_BASE = 70;
  const DAILY_ACTIVITIES_BASE = 45;
  const DAILY_FOOD_BASE = 35;

  const DESTINATION_EXPLORE_LABEL = {
    beach: "Beach & relaxation",
    adventure: "Adventure activities",
    culture: "Cultural sightseeing",
    nature: "Nature & wildlife"
  };

  /* ---------------- Day-by-day activity pools ----------------
     One entry per "theme day" for each destination type. Each entry
     offers three phrasings — budget/midRange/luxury — so the SAME day
     slot reads differently depending on the effective tier (see
     getEffectiveTier). Pools are short and cycle for longer trips. */
  const DESTINATION_ACTIVITY_POOLS = {
    beach: [
      { budget: "Relax and swim at a public beach", midRange: "Half-day snorkelling tour", luxury: "Private snorkelling charter with lunch included" },
      { budget: "Self-guided coastal walk", midRange: "Guided sunset boat cruise", luxury: "Private sunset yacht cruise with drinks" },
      { budget: "Free time at your accommodation's beach", midRange: "Island-hopping day trip", luxury: "Private island day trip with onboard chef" },
      { budget: "Local warung dinner by the beach", midRange: "Beachfront seafood dinner", luxury: "Fine-dining beachfront degustation" }
    ],
    adventure: [
      { budget: "Self-guided hiking trail", midRange: "Guided half-day trek", luxury: "Private full-day trek with porter support" },
      { budget: "Join a public rafting group tour", midRange: "Guided white-water rafting", luxury: "Private rafting trip with helicopter transfer" },
      { budget: "DIY viewpoint hike at sunrise", midRange: "Guided sunrise summit trek", luxury: "Private sunrise trek with a photographer" },
      { budget: "Rest and recover at your guesthouse", midRange: "Village trekking day", luxury: "Multi-village trek with a private guide" }
    ],
    culture: [
      { budget: "Self-guided temple visit", midRange: "Guided temple & heritage tour", luxury: "Private guided tour with skip-the-line access" },
      { budget: "Free walking tour of the old town", midRange: "Batik or craft workshop", luxury: "Private workshop with a master craftsperson" },
      { budget: "Browse the local market", midRange: "Guided cultural village tour", luxury: "Private cultural immersion with a local family" },
      { budget: "Street food dinner", midRange: "Traditional dinner with a dance performance", luxury: "Private chef's-table cultural dinner" }
    ],
    nature: [
      { budget: "Self-guided nature walk", midRange: "Guided wildlife-spotting tour", luxury: "Private wildlife safari with a naturalist" },
      { budget: "Visit a public river viewpoint", midRange: "Guided river cruise", luxury: "Private houseboat cruise" },
      { budget: "Free time at your eco-lodge", midRange: "Guided rainforest trek", luxury: "Private rainforest trek with a researcher guide" },
      { budget: "Visit a community-run conservation site", midRange: "Guided conservation-centre tour", luxury: "Private conservation experience with a specialist" }
    ]
  };

  const STYLE_TO_TIER_KEY = { budget: "budget", "mid-range": "midRange", luxury: "luxury" };
  const TIER_ORDER = { budget: 0, midRange: 1, luxury: 2 };
  const TIER_KEYS = ["budget", "midRange", "luxury"];

  const ACCOMMODATION_LABEL = { budget: "guesthouse", midRange: "hotel", luxury: "resort" };

  function getPreferenceFromControls() {
    return {
      duration: Number(durationInput.value),
      budget: Number(budgetInput.value),
      style: styleInput.value,
      destinationType: destinationTypeInput.value
    };
  }

  function calculateCostBreakdown({ duration, style, destinationType }) {
    const multiplier = STYLE_MULTIPLIERS[style];
    const nights = Math.max(duration - 1, 1);

    // Flights scale only partly with style — a luxury seat costs more,
    // but not linearly with the rest of the trip's daily spend.
    const flights = Math.round(DESTINATION_BASE_FLIGHT[destinationType] * (0.6 + 0.4 * multiplier));
    const accommodation = Math.round(NIGHTLY_ACCOMMODATION_BASE * multiplier * nights);
    const activities = Math.round(DAILY_ACTIVITIES_BASE * multiplier * duration);
    const food = Math.round(DAILY_FOOD_BASE * multiplier * duration);
    const total = flights + accommodation + activities + food;

    return { flights, accommodation, activities, food, total };
  }

  /* ---------------- Effective tier: style AND budget together ----------------
     The chosen travel style sets the "aimed-for" tier, but a low
     budget-per-day pulls the itinerary content down to something more
     realistic — so the day-by-day plan reflects what the stated
     budget can actually support, not just the style label. This is
     what makes the itinerary respond to budget as well as style. */
  function getEffectiveTier(style, budget, duration) {
    const perDay = budget / duration;
    let budgetTierKey;
    if (perDay < 80) budgetTierKey = "budget";
    else if (perDay < 160) budgetTierKey = "midRange";
    else budgetTierKey = "luxury";

    const styleTierKey = STYLE_TO_TIER_KEY[style];
    const effectiveIndex = Math.min(TIER_ORDER[styleTierKey], TIER_ORDER[budgetTierKey]);
    return TIER_KEYS[effectiveIndex];
  }

  /* ---------------- Day-by-day itinerary generator ----------------
     Changes with all four inputs:
       - duration:        how many days, and whether a free/rest day
                           is inserted (every 5th day, on trips of 8+
                           days)
       - destinationType: which activity pool themes each day
       - style + budget:  which tier of phrasing is picked for each
                           day's activity (via getEffectiveTier)       */
  function generateItinerary({ duration, style, budget, destinationType }) {
    const pool = DESTINATION_ACTIVITY_POOLS[destinationType];
    const tier = getEffectiveTier(style, budget, duration);
    const accommodationLabel = ACCOMMODATION_LABEL[tier];
    const days = [];

    for (let day = 1; day <= duration; day++) {
      if (day === 1) {
        days.push({
          day,
          category: "arrival",
          title: "Arrival",
          description: `Arrive and check in to your ${accommodationLabel}. Evening at leisure.`
        });
        continue;
      }

      if (day === duration && duration > 1) {
        days.push({
          day,
          category: "departure",
          title: "Departure",
          description: "Free morning, then transfer to the airport for your flight home."
        });
        continue;
      }

      // A free/rest day every 5th day, only on longer trips.
      if (duration >= 8 && (day - 1) % 5 === 0) {
        days.push({
          day,
          category: "rest",
          title: "Free day",
          description: "A free day to relax, revisit a favourite spot, or explore independently."
        });
        continue;
      }

      const poolIndex = (day - 2) % pool.length;
      days.push({
        day,
        category: "explore",
        title: DESTINATION_EXPLORE_LABEL[destinationType],
        description: pool[poolIndex][tier]
      });
    }

    return { days, tier };
  }

  /* ---------------- Canvas theme colours ----------------
     Pulled from the site's existing CSS custom properties so the
     charts match the rest of the Nusantara Travel palette instead of
     hard-coding colours in JS. */
  function themeColor(varName, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  }

  function getPalette() {
    return {
      flights: themeColor("--nt-teal", "#0b4f5c"),
      accommodation: themeColor("--nt-coral", "#ef6c4d"),
      activities: themeColor("--nt-gold", "#e3a72e"),
      food: themeColor("--nt-teal-light", "#0e6e7f"),
      track: "#e4ded0",
      text: themeColor("--nt-ink", "#22313a")
    };
  }

  // Day categories reuse the same four theme colours as the cost
  // chart's legend, so "arrival" always reads as the same colour
  // across both charts.
  function dayCategoryColor(category, palette) {
    return {
      arrival: palette.flights,
      explore: palette.accommodation,
      rest: palette.food,
      departure: palette.activities
    }[category];
  }

  /* ---------------- Drawing: cost breakdown (stacked horizontal bar) ---------------- */
  function drawCostChart(breakdown) {
    const palette = getPalette();
    const { width, height } = costChart;
    costCtx.clearRect(0, 0, width, height);

    const barX = 16;
    const barY = 24;
    const barWidth = width - 32;
    const barHeight = 40;

    const segments = [
      { key: "flights", value: breakdown.flights },
      { key: "accommodation", value: breakdown.accommodation },
      { key: "activities", value: breakdown.activities },
      { key: "food", value: breakdown.food }
    ];

    // Background track so a $0 category is still visually represented.
    costCtx.fillStyle = palette.track;
    costCtx.fillRect(barX, barY, barWidth, barHeight);

    let x = barX;
    segments.forEach((segment) => {
      const segmentWidth = breakdown.total > 0 ? (segment.value / breakdown.total) * barWidth : 0;
      costCtx.fillStyle = palette[segment.key];
      costCtx.fillRect(x, barY, segmentWidth, barHeight);
      x += segmentWidth;
    });

    // Title + total, drawn as text directly on the canvas.
    costCtx.fillStyle = palette.text;
    costCtx.font = "600 15px 'Segoe UI', sans-serif";
    costCtx.textBaseline = "top";
    costCtx.fillText("Cost breakdown", barX, barY + barHeight + 14);
    costCtx.font = "700 15px 'Segoe UI', sans-serif";
    costCtx.fillText(`Total: $${breakdown.total.toLocaleString()}`, barX, barY + barHeight + 34);
  }

  /* ---------------- Drawing: itinerary timeline (one segment per day) ---------------- */
  function drawItineraryChart(itineraryDays) {
    const palette = getPalette();
    const { width, height } = itineraryChart;
    itineraryCtx.clearRect(0, 0, width, height);

    const trackX = 8;
    const trackY = 10;
    const trackWidth = width - 16;
    const trackHeight = 28;
    const gap = itineraryDays.length > 1 ? 2 : 0;
    const segmentWidth = (trackWidth - gap * (itineraryDays.length - 1)) / itineraryDays.length;

    itineraryDays.forEach((dayInfo, index) => {
      const x = trackX + index * (segmentWidth + gap);
      itineraryCtx.fillStyle = dayCategoryColor(dayInfo.category, palette);
      itineraryCtx.fillRect(x, trackY, segmentWidth, trackHeight);
    });

    itineraryCtx.fillStyle = palette.text;
    itineraryCtx.font = "600 12px 'Segoe UI', sans-serif";
    itineraryCtx.textBaseline = "top";
    itineraryCtx.fillText("Day 1", trackX, trackY + trackHeight + 6);
    const lastLabel = `Day ${itineraryDays.length}`;
    const lastLabelWidth = itineraryCtx.measureText(lastLabel).width;
    itineraryCtx.fillText(lastLabel, trackX + trackWidth - lastLabelWidth, trackY + trackHeight + 6);
  }

  /* ---------------- Day-by-day text list ---------------- */
  function renderItineraryList(itineraryDays) {
    itineraryDayList.innerHTML = itineraryDays
      .map(
        (dayInfo) => `
        <li class="itinerary-day itinerary-day--${dayInfo.category}">
          <span class="itinerary-day__label">Day ${dayInfo.day}: ${dayInfo.title}</span>
          <span class="itinerary-day__desc">${dayInfo.description}</span>
        </li>`
      )
      .join("");
  }

  /* ---------------- Budget-fit feedback (Constraint-Validation-style) ---------------- */
  function checkBudgetFit(total, budget) {
    budgetStatus.classList.remove("alert-success", "alert-warning", "alert-danger");

    if (total > budget * 1.15) {
      budgetStatus.classList.add("alert-danger");
      budgetStatus.textContent =
        `This combination is estimated at $${total.toLocaleString()}, over your $${budget.toLocaleString()} budget. Try a shorter trip, a lower travel style, or a bigger budget.`;
    } else if (total < budget * 0.6) {
      budgetStatus.classList.add("alert-warning");
      budgetStatus.textContent =
        `This combination is estimated at $${total.toLocaleString()}, well under your $${budget.toLocaleString()} budget — you could afford a longer trip or a higher travel style.`;
    } else {
      budgetStatus.classList.add("alert-success");
      budgetStatus.textContent =
        `This combination is estimated at $${total.toLocaleString()}, a comfortable fit for your $${budget.toLocaleString()} budget.`;
    }
  }

  /* ---------------- Recalculate + redraw ---------------- */
  function updateReadouts(breakdown) {
    costFlightsEl.textContent = `$${breakdown.flights.toLocaleString()}`;
    costAccommodationEl.textContent = `$${breakdown.accommodation.toLocaleString()}`;
    costActivitiesEl.textContent = `$${breakdown.activities.toLocaleString()}`;
    costFoodEl.textContent = `$${breakdown.food.toLocaleString()}`;
    costTotalEl.textContent = `$${breakdown.total.toLocaleString()}`;
  }

  function recalculateAndRender() {
    const preference = getPreferenceFromControls();
    durationValue.textContent = `${preference.duration} days`;
    budgetValue.textContent = `${preference.budget.toLocaleString()} AUD`;

    const breakdown = calculateCostBreakdown(preference);
    updateReadouts(breakdown);
    drawCostChart(breakdown);
    checkBudgetFit(breakdown.total, preference.budget);

    const { days, tier } = generateItinerary(preference);
    drawItineraryChart(days);
    renderItineraryList(days);

    // Announce once per debounced update, not on every keystroke/drag tick.
    const tierLabel = { budget: "budget-friendly", midRange: "mid-range", luxury: "luxury" }[tier];
    costAnnouncement.textContent =
      `Updated estimate: ${preference.duration} days, total cost $${breakdown.total.toLocaleString()}, ${tierLabel} itinerary.`;
  }

  // Debounce so rapid slider dragging redraws the canvas only after
  // the customer briefly pauses, keeping the UI smooth (see the
  // "Performance" section of the 7.3HD proposal).
  let debounceTimer = null;
  function scheduleUpdate() {
    // Numeric readouts next to the sliders still update immediately —
    // only the heavier canvas/list redraw + announcement are debounced.
    durationValue.textContent = `${durationInput.value} days`;
    budgetValue.textContent = `${Number(budgetInput.value).toLocaleString()} AUD`;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recalculateAndRender, 80);
  }

  /* ---------------- localStorage persistence ---------------- */
  function savePreference() {
    const preference = getPreferenceFromControls();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...preference, savedAt: new Date().toISOString() }));
    savePreferenceBtn.textContent = "Saved ✓";
    setTimeout(() => { savePreferenceBtn.textContent = "Save preference"; }, 1500);
  }

  function loadSavedPreference() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
      const saved = JSON.parse(raw);
      durationInput.value = saved.duration;
      budgetInput.value = saved.budget;
      styleInput.value = saved.style;
      destinationTypeInput.value = saved.destinationType;
      savedBanner.classList.remove("d-none");
      return true;
    } catch (err) {
      console.error("Could not parse saved trip preference:", err);
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  function resetPreference() {
    localStorage.removeItem(STORAGE_KEY);
    savedBanner.classList.add("d-none");
    durationInput.value = 7;
    budgetInput.value = 2000;
    styleInput.value = "mid-range";
    destinationTypeInput.value = "beach";
    recalculateAndRender();
  }

  /* ---------------- Wire up events ---------------- */
  [durationInput, budgetInput].forEach((input) => {
    input.addEventListener("input", scheduleUpdate);
  });
  [styleInput, destinationTypeInput].forEach((select) => {
    select.addEventListener("change", recalculateAndRender);
  });
  savePreferenceBtn.addEventListener("click", savePreference);
  resetPreferenceBtn.addEventListener("click", resetPreference);

  /* ---------------- Initial render ---------------- */
  loadSavedPreference();
  recalculateAndRender();
})();
