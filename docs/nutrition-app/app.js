const STORAGE_KEY = "gesundheitscoach.nutrition.v1";
const GITHUB_TOKEN_KEY = "gesundheitscoach.nutrition.githubToken";

const defaultState = {
  goals: {
    protein: 120,
    caffeineCutoff: "14:00",
    lateMealCutoff: "20:00"
  },
  routines: [
    {
      id: crypto.randomUUID(),
      name: "Morgenroutine",
      timing: "Direkt nach dem Aufstehen",
      details: "300 ml Wasser mit Pantoprazol. Abstand bis Fruehstueck/Kaffee beobachten.",
      active: true
    },
    {
      id: crypto.randomUUID(),
      name: "Standard-Fruehstueck",
      timing: "30-45 Minuten nach Pantoprazol",
      details:
        "Sojaghurt-Bowl mit Leinsamen, Haferflocken, Flohsamenschalen, optional Beeren oder Nuessen, etwas Hafermilch und Kaffee mit Proteinpulver.",
      active: true
    }
  ],
  presets: [
    {
      name: "Pantoprazol + Wasser",
      mealType: "Medikament/Supplement",
      foods: "300 ml Wasser",
      medication: "Pantoprazol 20 mg",
      protein: 0,
      caffeineMg: 0,
      alcoholUnits: 0,
      notes: "Direkt nach dem Aufstehen"
    },
    {
      name: "Sojaghurt-Bowl",
      mealType: "Fruehstueck",
      foods:
        "Sojaghurt, Haferflocken, Leinsamen, Flohsamenschalen, optional Beeren/Nuesse, Hafermilch",
      proteinSource: "Sojaghurt, Proteinpulver",
      protein: 35,
      caffeineMg: 80,
      alcoholUnits: 0,
      fiber: ["Vollkorn", "Obst", "Nuesse/Samen"]
    },
    {
      name: "Freier Snack",
      mealType: "Snack",
      foods: "",
      protein: 0,
      caffeineMg: 0,
      alcoholUnits: 0,
      notes: "Hunger/Energie und Reflux-Kontext ergaenzen"
    }
  ],
  entries: [],
  checkins: [],
  github: {
    owner: "quantbj",
    repo: "GesundheitsCoach",
    branch: "main",
    path: "data/raw/manual/nutrition"
  }
};

let state = loadState();
let selectedDate = todayISO();

const views = document.querySelectorAll(".view");
const tabs = document.querySelectorAll(".tab");
const selectedDateInput = document.querySelector("#selected-date");
const entryForm = document.querySelector("#entry-form");
const checkinForm = document.querySelector("#checkin-form");
const routineForm = document.querySelector("#routine-form");
const goalsForm = document.querySelector("#goals-form");
const githubForm = document.querySelector("#github-form");
const reviewFromInput = document.querySelector("#review-from");
const reviewToInput = document.querySelector("#review-to");

init();

function init() {
  selectedDateInput.value = selectedDate;
  setDefaultEntryTime();
  setReviewDefaults();
  bindEvents();
  render();
}

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.querySelectorAll("[data-switch-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.switchView));
  });

  selectedDateInput.addEventListener("change", () => {
    selectedDate = selectedDateInput.value || todayISO();
    document.querySelector("#entry-date").value = selectedDate;
    document.querySelector("#checkin-date").value = selectedDate;
    renderToday();
    renderCheckinForm();
  });

  checkinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCheckin();
    switchView("today");
  });

  document.querySelector("#reset-checkin-form").addEventListener("click", resetCheckinForm);

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEntry();
    switchView("today");
  });

  document.querySelector("#save-and-next").addEventListener("click", () => {
    saveEntry();
    resetEntryForm();
    switchView("entry");
  });

  document.querySelector("#reset-form").addEventListener("click", resetEntryForm);

  routineForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRoutine();
  });

  goalsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.goals.protein = numberValue("#goal-protein");
    state.goals.caffeineCutoff = document.querySelector("#goal-caffeine-cutoff").value || "14:00";
    state.goals.lateMealCutoff = document.querySelector("#goal-late-cutoff").value || "20:00";
    persist();
    render();
  });

  reviewFromInput.addEventListener("change", renderReview);
  reviewToInput.addEventListener("change", renderReview);
  document.querySelector("#copy-review").addEventListener("click", copyReviewText);
  document.querySelector("#export-json").addEventListener("click", exportJson);
  document.querySelector("#export-csv").addEventListener("click", exportCsv);
  document.querySelector("#import-json").addEventListener("change", importJson);
  document.querySelector("#clear-data").addEventListener("click", clearData);
  githubForm.addEventListener("submit", saveGithubSettings);
  document.querySelector("#sync-today").addEventListener("click", () => syncDates([selectedDate]));
  document.querySelector("#sync-range").addEventListener("click", syncReviewRange);
}

function switchView(viewName) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  views.forEach((view) => view.classList.toggle("is-active", view.id === `view-${viewName}`));
  if (viewName === "entry" && !document.querySelector("#entry-date").value) {
    resetEntryForm();
  }
  if (viewName === "checkin") {
    renderCheckinForm();
  }
}

function render() {
  renderToday();
  renderCheckinForm();
  renderPresets();
  renderRoutines();
  renderGoals();
  renderGithubSettings();
  renderReview();
}

function renderToday() {
  const entries = entriesForDate(selectedDate);
  const totals = summarizeEntries(entries);
  const proteinTarget = Math.max(state.goals.protein || 0, 1);
  const lateMeals = entries.filter((entry) => isLateMeal(entry)).length;
  const refluxEntries = entries.filter((entry) => Number(entry.reflux) > 0).length;
  const checkin = checkinForDate(selectedDate);

  document.querySelector("#metric-grid").innerHTML = [
    metricMarkup("Protein", `${totals.protein} g`, `${state.goals.protein} g Ziel`, totals.protein / proteinTarget),
    metricMarkup("Mahlzeiten", entries.length, "Eintraege heute", null),
    metricMarkup("Koffein", `${totals.caffeineMg} mg`, `Grenze ${state.goals.caffeineCutoff}`, null),
    metricMarkup("Check-in", checkin ? "erfasst" : "offen", "Tageskontext", null),
    metricMarkup("Reflux/Spaet", `${refluxEntries}/${lateMeals}`, "Reflux-Eintraege / Spaetmahlzeiten", null)
  ].join("");

  const list = document.querySelector("#entry-list");
  renderCheckinSummary();
  if (!entries.length) {
    list.innerHTML = document.querySelector("#empty-state-template").innerHTML;
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `
        <article class="entry-card">
          <div class="entry-card__top">
            <div>
              <time>${escapeHtml(entry.time || "--:--")}</time>
              <strong>${escapeHtml(entry.mealType || "Eintrag")}</strong>
            </div>
            <span class="tag">${Number(entry.protein || 0)} g Protein</span>
          </div>
          <p>${escapeHtml(entry.foods || entry.medication || "Keine Details")}</p>
          ${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ""}
          <div class="entry-actions">
            <button class="ghost-button" type="button" data-edit-entry="${entry.id}">Bearbeiten</button>
            <button class="danger-button" type="button" data-delete-entry="${entry.id}">Loeschen</button>
          </div>
        </article>
      `
    )
    .join("");

  list.querySelectorAll("[data-edit-entry]").forEach((button) => {
    button.addEventListener("click", () => editEntry(button.dataset.editEntry));
  });
  list.querySelectorAll("[data-delete-entry]").forEach((button) => {
    button.addEventListener("click", () => deleteEntry(button.dataset.deleteEntry));
  });

}

function renderCheckinSummary() {
  const container = document.querySelector("#checkin-summary");
  const checkin = checkinForDate(selectedDate);
  if (!checkin) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Check-in offen</strong>
        <span>Gewicht, Energie, Stress, Schulter, Training und Tageskontext erfassen.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <article class="entry-card">
      <div class="entry-card__top">
        <div>
          <time>${escapeHtml(checkin.date)}</time>
          <strong>Daily Check-in</strong>
        </div>
        <span class="tag">Energie ${Number(checkin.energy || 0)}/10</span>
      </div>
      <p>Stress ${Number(checkin.stress || 0)}/10, Fokus ${Number(checkin.moodFocus || 0)}/10, Schulter max ${Number(checkin.shoulderPainMax || 0)}/10</p>
      ${checkin.training ? `<p>${escapeHtml(checkin.training)}</p>` : ""}
      <div class="entry-actions">
        <button class="ghost-button" type="button" data-switch-view="checkin">Bearbeiten</button>
      </div>
    </article>
  `;
  container.querySelector("[data-switch-view]").addEventListener("click", () => switchView("checkin"));
}

function renderPresets() {
  const container = document.querySelector("#preset-list");
  container.innerHTML = state.presets
    .map(
      (preset, index) => `
        <article class="preset-card">
          <strong>${escapeHtml(preset.name)}</strong>
          <p>${escapeHtml(preset.foods || preset.medication || "Freier Eintrag")}</p>
          <div class="entry-actions">
            <button class="secondary-button" type="button" data-use-preset="${index}">Nutzen</button>
          </div>
        </article>
      `
    )
    .join("");

  container.querySelectorAll("[data-use-preset]").forEach((button) => {
    button.addEventListener("click", () => usePreset(Number(button.dataset.usePreset)));
  });
}

function renderRoutines() {
  const list = document.querySelector("#routine-list");
  if (!state.routines.length) {
    list.innerHTML = document.querySelector("#empty-state-template").innerHTML;
    return;
  }

  list.innerHTML = state.routines
    .map(
      (routine) => `
        <article class="routine-card">
          <div class="routine-card__top">
            <div>
              <strong>${escapeHtml(routine.name)}</strong>
              <small>${escapeHtml(routine.timing || "Ohne Zeitpunkt")}</small>
            </div>
            <span class="tag">${routine.active ? "aktiv" : "pausiert"}</span>
          </div>
          <p>${escapeHtml(routine.details || "")}</p>
          <div class="entry-actions">
            <button class="ghost-button" type="button" data-edit-routine="${routine.id}">Bearbeiten</button>
            <button class="secondary-button" type="button" data-toggle-routine="${routine.id}">
              ${routine.active ? "Pausieren" : "Aktivieren"}
            </button>
            <button class="danger-button" type="button" data-delete-routine="${routine.id}">Loeschen</button>
          </div>
        </article>
      `
    )
    .join("");

  list.querySelectorAll("[data-edit-routine]").forEach((button) => {
    button.addEventListener("click", () => editRoutine(button.dataset.editRoutine));
  });
  list.querySelectorAll("[data-toggle-routine]").forEach((button) => {
    button.addEventListener("click", () => toggleRoutine(button.dataset.toggleRoutine));
  });
  list.querySelectorAll("[data-delete-routine]").forEach((button) => {
    button.addEventListener("click", () => deleteRoutine(button.dataset.deleteRoutine));
  });
}

function renderGoals() {
  document.querySelector("#goal-protein").value = state.goals.protein;
  document.querySelector("#goal-caffeine-cutoff").value = state.goals.caffeineCutoff;
  document.querySelector("#goal-late-cutoff").value = state.goals.lateMealCutoff;
}

function renderGithubSettings() {
  document.querySelector("#github-owner").value = state.github.owner;
  document.querySelector("#github-repo").value = state.github.repo;
  document.querySelector("#github-branch").value = state.github.branch;
  document.querySelector("#github-path").value = state.github.path;
  document.querySelector("#github-token").value = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
}

function renderCheckinForm() {
  const checkin = checkinForDate(selectedDate);
  resetCheckinForm();
  if (!checkin) return;

  setValue("#checkin-id", checkin.id);
  setValue("#checkin-date", checkin.date);
  setValue("#checkin-weight", checkin.morningWeightKg);
  setValue("#checkin-bp-morning", checkin.bloodPressureMorning);
  setValue("#checkin-bp-evening", checkin.bloodPressureEvening);
  setValue("#checkin-energy", checkin.energy);
  setValue("#checkin-stress", checkin.stress);
  setValue("#checkin-focus", checkin.moodFocus);
  setValue("#checkin-digestion-score", checkin.digestionScore);
  setValue("#checkin-shoulder-pain", checkin.shoulderPainMax);
  setValue("#checkin-rehab-done", checkin.rehabDone);
  setValue("#checkin-training-rpe", checkin.trainingRpe);
  setValue("#checkin-breakfast", checkin.standardBreakfast);
  setValue("#checkin-training", checkin.training);
  setValue("#checkin-protein", checkin.proteinEstimate);
  setValue("#checkin-caffeine", checkin.caffeineMg);
  setValue("#checkin-last-caffeine", checkin.lastCaffeineTime);
  setValue("#checkin-alcohol", checkin.alcoholUnits);
  setValue("#checkin-digestion", checkin.digestion);
  setValue("#checkin-notes", checkin.notes);
  setCheckboxGroup("shoulderFlags", checkin.shoulderFlags);
  setCheckboxGroup("nutritionFlags", checkin.nutritionFlags);
  setCheckboxGroup("medicationFlags", checkin.medicationFlags);
}

function renderReview() {
  const from = reviewFromInput.value || selectedDate;
  const to = reviewToInput.value || selectedDate;
  const days = dateRange(from, to);
  const container = document.querySelector("#review-summary");

  container.innerHTML = days
    .map((date) => {
      const entries = entriesForDate(date);
      const checkin = checkinForDate(date);
      const totals = summarizeEntries(entries);
      const flags = buildFlags(date, entries, totals);
      return `
        <article class="review-day">
          <div class="entry-card__top">
            <strong>${formatDate(date)}</strong>
            <span class="tag">${entries.length} Eintraege, Check-in ${checkin ? "ja" : "nein"}</span>
          </div>
          <div class="review-stats">
            <div class="review-stat"><span>Protein</span><strong>${totals.protein} g</strong></div>
            <div class="review-stat"><span>Koffein</span><strong>${totals.caffeineMg} mg</strong></div>
            <div class="review-stat"><span>Alkohol</span><strong>${totals.alcoholUnits}</strong></div>
            <div class="review-stat"><span>Reflux max</span><strong>${totals.maxReflux}</strong></div>
          </div>
          <div class="review-flags">
            ${
              flags.length
                ? flags.map((flag) => `<span class="flag ${flag.alert ? "is-alert" : ""}">${escapeHtml(flag.text)}</span>`).join("")
                : '<span class="flag">keine Auffaelligkeit</span>'
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function saveEntry() {
  const formData = new FormData(entryForm);
  const id = document.querySelector("#entry-id").value || crypto.randomUUID();
  const entry = {
    id,
    date: formData.get("date") || selectedDate,
    time: formData.get("time") || "12:00",
    mealType: formData.get("mealType") || "Eintrag",
    foods: clean(formData.get("foods")),
    proteinSource: clean(formData.get("proteinSource")),
    fiber: formData.getAll("fiber"),
    protein: numberFromForm(formData, "protein"),
    caffeineMg: numberFromForm(formData, "caffeineMg"),
    alcoholUnits: numberFromForm(formData, "alcoholUnits"),
    hunger: numberFromForm(formData, "hunger"),
    energy: numberFromForm(formData, "energy"),
    reflux: numberFromForm(formData, "reflux"),
    stress: numberFromForm(formData, "stress"),
    digestion: clean(formData.get("digestion")),
    trainingContext: clean(formData.get("trainingContext")),
    medication: clean(formData.get("medication")),
    notes: clean(formData.get("notes")),
    updatedAt: new Date().toISOString()
  };

  const existingIndex = state.entries.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = entry;
  } else {
    entry.createdAt = entry.updatedAt;
    state.entries.push(entry);
  }

  selectedDate = entry.date;
  selectedDateInput.value = selectedDate;
  persist();
  resetEntryForm();
  render();
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  setValue("#entry-id", entry.id);
  setValue("#entry-date", entry.date);
  setValue("#entry-time", entry.time);
  setValue("#entry-meal-type", entry.mealType);
  setValue("#entry-foods", entry.foods);
  setValue("#entry-protein-source", entry.proteinSource);
  setValue("#entry-protein", entry.protein);
  setValue("#entry-caffeine", entry.caffeineMg);
  setValue("#entry-alcohol", entry.alcoholUnits);
  setValue("#entry-hunger", entry.hunger);
  setValue("#entry-energy", entry.energy);
  setValue("#entry-reflux", entry.reflux);
  setValue("#entry-stress", entry.stress);
  setValue("#entry-digestion", entry.digestion);
  setValue("#entry-training-context", entry.trainingContext);
  setValue("#entry-medication", entry.medication);
  setValue("#entry-notes", entry.notes);
  entryForm.querySelectorAll('input[name="fiber"]').forEach((input) => {
    input.checked = Array.isArray(entry.fiber) && entry.fiber.includes(input.value);
  });
  switchView("entry");
}

function deleteEntry(id) {
  if (!confirm("Diesen Eintrag wirklich loeschen?")) return;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  persist();
  render();
}

function usePreset(index) {
  const preset = state.presets[index];
  if (!preset) return;
  resetEntryForm();
  setValue("#entry-meal-type", preset.mealType);
  setValue("#entry-foods", preset.foods);
  setValue("#entry-protein-source", preset.proteinSource || "");
  setValue("#entry-protein", preset.protein);
  setValue("#entry-caffeine", preset.caffeineMg);
  setValue("#entry-alcohol", preset.alcoholUnits);
  setValue("#entry-digestion", preset.digestion || "");
  setValue("#entry-training-context", preset.trainingContext || "");
  setValue("#entry-medication", preset.medication || "");
  setValue("#entry-notes", preset.notes || "");
  entryForm.querySelectorAll('input[name="fiber"]').forEach((input) => {
    input.checked = Array.isArray(preset.fiber) && preset.fiber.includes(input.value);
  });
  switchView("entry");
}

function resetEntryForm() {
  entryForm.reset();
  setValue("#entry-id", "");
  setValue("#entry-date", selectedDate);
  setDefaultEntryTime();
}

function saveCheckin() {
  const formData = new FormData(checkinForm);
  const id = document.querySelector("#checkin-id").value || crypto.randomUUID();
  const checkin = {
    id,
    date: formData.get("date") || selectedDate,
    morningWeightKg: numberFromForm(formData, "morningWeightKg"),
    bloodPressureMorning: clean(formData.get("bloodPressureMorning")),
    bloodPressureEvening: clean(formData.get("bloodPressureEvening")),
    energy: numberFromForm(formData, "energy"),
    stress: numberFromForm(formData, "stress"),
    moodFocus: numberFromForm(formData, "moodFocus"),
    digestionScore: numberFromForm(formData, "digestionScore"),
    shoulderFlags: formData.getAll("shoulderFlags"),
    shoulderPainMax: numberFromForm(formData, "shoulderPainMax"),
    rehabDone: clean(formData.get("rehabDone")),
    trainingRpe: numberFromForm(formData, "trainingRpe"),
    standardBreakfast: clean(formData.get("standardBreakfast")),
    training: clean(formData.get("training")),
    nutritionFlags: formData.getAll("nutritionFlags"),
    proteinEstimate: numberFromForm(formData, "proteinEstimate"),
    caffeineMg: numberFromForm(formData, "caffeineMg"),
    lastCaffeineTime: clean(formData.get("lastCaffeineTime")),
    alcoholUnits: numberFromForm(formData, "alcoholUnits"),
    medicationFlags: formData.getAll("medicationFlags"),
    digestion: clean(formData.get("digestion")),
    notes: clean(formData.get("notes")),
    updatedAt: new Date().toISOString()
  };

  const existingIndex = state.checkins.findIndex((item) => item.date === checkin.date || item.id === id);
  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    checkin.createdAt = checkin.updatedAt;
    state.checkins.push(checkin);
  }

  selectedDate = checkin.date;
  selectedDateInput.value = selectedDate;
  persist();
  render();
}

function resetCheckinForm() {
  checkinForm.reset();
  setValue("#checkin-id", "");
  setValue("#checkin-date", selectedDate);
}

function saveRoutine() {
  const id = document.querySelector("#routine-id").value || crypto.randomUUID();
  const routine = {
    id,
    name: clean(document.querySelector("#routine-name").value),
    timing: clean(document.querySelector("#routine-timing").value),
    details: clean(document.querySelector("#routine-details").value),
    active: true
  };
  const existingIndex = state.routines.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    routine.active = state.routines[existingIndex].active;
    state.routines[existingIndex] = routine;
  } else {
    state.routines.push(routine);
  }
  routineForm.reset();
  setValue("#routine-id", "");
  persist();
  renderRoutines();
}

function editRoutine(id) {
  const routine = state.routines.find((item) => item.id === id);
  if (!routine) return;
  setValue("#routine-id", routine.id);
  setValue("#routine-name", routine.name);
  setValue("#routine-timing", routine.timing);
  setValue("#routine-details", routine.details);
}

function toggleRoutine(id) {
  state.routines = state.routines.map((routine) =>
    routine.id === id ? { ...routine, active: !routine.active } : routine
  );
  persist();
  renderRoutines();
}

function deleteRoutine(id) {
  if (!confirm("Diese Routine wirklich loeschen?")) return;
  state.routines = state.routines.filter((routine) => routine.id !== id);
  persist();
  renderRoutines();
}

function exportJson() {
  downloadFile(
    `gesundheitscoach-nutrition-${todayISO()}.json`,
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    "application/json"
  );
}

function exportCsv() {
  const headers = [
    "date",
    "time",
    "meal_type",
    "foods",
    "protein_source",
    "fiber",
    "protein_g",
    "caffeine_mg",
    "alcohol_units",
    "hunger_1_5",
    "energy_1_5",
    "reflux_0_5",
    "stress_0_5",
    "digestion",
    "training_context",
    "medication_supplement",
    "notes"
  ];
  const rows = state.entries
    .slice()
    .sort(sortEntries)
    .map((entry) =>
      [
        entry.date,
        entry.time,
        entry.mealType,
        entry.foods,
        entry.proteinSource,
        Array.isArray(entry.fiber) ? entry.fiber.join("; ") : "",
        entry.protein,
        entry.caffeineMg,
        entry.alcoholUnits,
        entry.hunger,
        entry.energy,
        entry.reflux,
        entry.stress,
        entry.digestion,
        entry.trainingContext,
        entry.medication,
        entry.notes
      ].map(csvCell)
    );

  downloadFile(
    `gesundheitscoach-nutrition-${todayISO()}.csv`,
    [headers.map(csvCell), ...rows].map((row) => row.join(",")).join("\n"),
    "text/csv"
  );
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      state = normalizeState(imported);
      selectedDate = todayISO();
      selectedDateInput.value = selectedDate;
      persist();
      render();
      alert("Import abgeschlossen.");
    } catch (error) {
      alert("JSON konnte nicht importiert werden.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function clearData() {
  if (!confirm("Alle lokal gespeicherten Ernaehrungsdaten in diesem Browser loeschen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  selectedDate = todayISO();
  selectedDateInput.value = selectedDate;
  render();
}

function saveGithubSettings(event) {
  event.preventDefault();
  state.github = {
    owner: clean(document.querySelector("#github-owner").value) || "quantbj",
    repo: clean(document.querySelector("#github-repo").value) || "GesundheitsCoach",
    branch: clean(document.querySelector("#github-branch").value) || "main",
    path: clean(document.querySelector("#github-path").value).replace(/^\/+|\/+$/g, "") || "data/raw/manual/nutrition"
  };
  const token = clean(document.querySelector("#github-token").value);
  if (token) {
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
  }
  persist();
  setSyncStatus("Sync-Einstellungen gespeichert.");
}

async function syncReviewRange() {
  const dates = dateRange(reviewFromInput.value || selectedDate, reviewToInput.value || selectedDate);
  await syncDates(dates.filter((date) => entriesForDate(date).length > 0 || checkinForDate(date)));
}

async function syncDates(dates) {
  saveGithubSettings(new Event("submit"));
  const token = localStorage.getItem(GITHUB_TOKEN_KEY);
  if (!token) {
    setSyncStatus("Kein GitHub Token gespeichert. Token eintragen und erneut versuchen.", true);
    return;
  }
  if (!dates.length) {
    setSyncStatus("Keine Eintraege im gewaehlten Zeitraum.");
    return;
  }

  setSyncStatus(`Sync laeuft fuer ${dates.length} Tag(e)...`);
  const results = [];
  for (const date of dates) {
    try {
      const result = await upsertNutritionDay(date, token);
      results.push(`${date}: ${result}`);
      setSyncStatus(results.join("\n"));
    } catch (error) {
      results.push(`${date}: Fehler - ${error.message}`);
      setSyncStatus(results.join("\n"), true);
      return;
    }
  }
  setSyncStatus(`Sync abgeschlossen.\n${results.join("\n")}`);
}

async function upsertNutritionDay(date, token) {
  const config = state.github;
  const path = `${config.path}/${date}.json`;
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
  const existing = await getExistingGithubFile(url, config.branch, token);
  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: `Update nutrition log ${date}`,
      content: base64Encode(JSON.stringify(buildDayPayload(date), null, 2)),
      branch: config.branch,
      sha: existing ? existing.sha : undefined
    })
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `GitHub API ${response.status}`);
  }
  return existing ? "aktualisiert" : "angelegt";
}

async function getExistingGithubFile(url, branch, token) {
  const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token)
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `GitHub API ${response.status}`);
  }
  return response.json();
}

function buildDayPayload(date) {
  const entries = entriesForDate(date);
  const dailyCheckin = checkinForDate(date);
  return {
    schema: "gesundheitscoach.nutrition.day.v1",
    date,
    exportedAt: new Date().toISOString(),
    source: {
      app: "docs/nutrition-app",
      storage: "browser-localStorage",
      deviceHint: navigator.userAgent
    },
    goals: state.goals,
    routines: state.routines.filter((routine) => routine.active),
    dailyCheckin,
    summary: summarizeEntries(entries),
    entries
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function base64Encode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function setSyncStatus(message, isError = false) {
  const status = document.querySelector("#sync-status");
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function copyReviewText() {
  const from = reviewFromInput.value || selectedDate;
  const to = reviewToInput.value || selectedDate;
  const days = dateRange(from, to);
  const lines = [`Ernaehrungsreview ${from} bis ${to}`];

  days.forEach((date) => {
    const entries = entriesForDate(date);
    const checkin = checkinForDate(date);
    const totals = summarizeEntries(entries);
    lines.push("");
    lines.push(`${formatDate(date)}: ${entries.length} Eintraege`);
    lines.push(
      `Protein ${totals.protein} g, Koffein ${totals.caffeineMg} mg, Alkohol ${totals.alcoholUnits}, Reflux max ${totals.maxReflux}`
    );
    if (checkin) {
      lines.push(
        `Check-in: Energie ${checkin.energy || 0}/10, Stress ${checkin.stress || 0}/10, Fokus ${checkin.moodFocus || 0}/10, Schulter max ${checkin.shoulderPainMax || 0}/10`
      );
    } else {
      lines.push("Check-in: fehlt");
    }
    entries.forEach((entry) => {
      lines.push(
        `- ${entry.time} ${entry.mealType}: ${entry.foods || entry.medication || "ohne Details"} (${entry.protein || 0} g Protein)`
      );
    });
  });

  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    alert("Review-Text kopiert.");
  });
}

function entriesForDate(date) {
  return state.entries.filter((entry) => entry.date === date).sort(sortEntries);
}

function checkinForDate(date) {
  return state.checkins.find((checkin) => checkin.date === date) || null;
}

function summarizeEntries(entries) {
  return entries.reduce(
    (summary, entry) => {
      summary.protein += Number(entry.protein || 0);
      summary.caffeineMg += Number(entry.caffeineMg || 0);
      summary.alcoholUnits += Number(entry.alcoholUnits || 0);
      summary.maxReflux = Math.max(summary.maxReflux, Number(entry.reflux || 0));
      return summary;
    },
    { protein: 0, caffeineMg: 0, alcoholUnits: 0, maxReflux: 0 }
  );
}

function buildFlags(date, entries, totals) {
  const flags = [];
  if (!checkinForDate(date)) flags.push({ text: "Check-in fehlt", alert: false });
  if (totals.protein < state.goals.protein) flags.push({ text: "Protein unter Ziel", alert: true });
  if (entries.some((entry) => Number(entry.caffeineMg) > 0 && entry.time > state.goals.caffeineCutoff)) {
    flags.push({ text: "Koffein nach Grenze", alert: false });
  }
  if (entries.some(isLateMeal)) flags.push({ text: "Spaetmahlzeit", alert: false });
  if (totals.alcoholUnits > 0) flags.push({ text: "Alkohol", alert: false });
  if (totals.maxReflux >= 3) flags.push({ text: "Reflux auffaellig", alert: true });
  return flags;
}

function isLateMeal(entry) {
  if (!entry.time || !state.goals.lateMealCutoff) return false;
  if (entry.mealType === "Medikament/Supplement") return false;
  return entry.time >= state.goals.lateMealCutoff;
}

function metricMarkup(label, value, helper, progressValue) {
  const progress =
    progressValue === null
      ? ""
      : `<progress max="1" value="${Math.min(Math.max(progressValue, 0), 1)}"></progress>`;
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(helper)}</span>
      ${progress}
    </article>
  `;
}

function setReviewDefaults() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  reviewFromInput.value = toISODate(start);
  reviewToInput.value = toISODate(end);
}

function setDefaultEntryTime() {
  const now = new Date();
  setValue("#entry-date", selectedDate);
  setValue("#entry-time", `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  if (!value || typeof value !== "object") return structuredClone(defaultState);
  return {
    goals: { ...defaultState.goals, ...(value.goals || {}) },
    routines: Array.isArray(value.routines) ? value.routines : structuredClone(defaultState.routines),
    presets: Array.isArray(value.presets) ? value.presets : structuredClone(defaultState.presets),
    entries: Array.isArray(value.entries) ? value.entries : [],
    checkins: Array.isArray(value.checkins) ? value.checkins : [],
    github: { ...defaultState.github, ...(value.github || {}) }
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sortEntries(a, b) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function dateRange(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end || start > end) return [];
  const days = [];
  const current = new Date(start);
  while (current <= end && days.length < 31) {
    days.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function todayISO() {
  return toISODate(new Date());
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parseDate(date));
}

function clean(value) {
  return String(value || "").trim();
}

function numberFromForm(formData, name) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : 0;
}

function numberValue(selector) {
  const value = Number(document.querySelector(selector).value);
  return Number.isFinite(value) ? value : 0;
}

function setValue(selector, value) {
  document.querySelector(selector).value = value ?? "";
}

function setCheckboxGroup(name, values) {
  const selected = Array.isArray(values) ? values : [];
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = selected.includes(input.value);
  });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value ?? "";
  return element.innerHTML;
}
