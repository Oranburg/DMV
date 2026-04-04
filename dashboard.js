const STORAGE_KEYS = {
  saved: "housing-dashboard-saved-v1",
  compare: "housing-dashboard-compare-v1",
  notes: "housing-dashboard-notes-v1",
  tasks: "housing-dashboard-tasks-v1",
  checklist: "housing-dashboard-checklist-v1",
  filters: "housing-dashboard-filters-v1",
  weights: "housing-dashboard-weights-v1",
  scoringEnabled: "housing-dashboard-scoring-enabled-v1",
  preset: "housing-dashboard-score-preset-v1",
  mode: "housing-dashboard-mode-v1",
  sort: "housing-dashboard-sort-v1"
};

const DEFAULT_CONFIDENCE_SCALE = [
  {
    key: "Confirmed",
    rank: 4,
    label: "Confirmed",
    shortLabel: "Confirmed",
    description: "Supported by directly relevant source evidence.",
    color: "emerald"
  },
  {
    key: "Likely",
    rank: 3,
    label: "Likely",
    shortLabel: "Likely",
    description: "Supported indirectly but not fully conclusive.",
    color: "blue"
  },
  {
    key: "Estimated",
    rank: 2,
    label: "Estimated / Modeled",
    shortLabel: "Estimated",
    description: "Modeled from assumptions.",
    color: "violet"
  },
  {
    key: "Needs Verification",
    rank: 1,
    label: "Needs Verification",
    shortLabel: "Verify",
    description: "Needs a call, map check, or lease confirmation.",
    color: "amber"
  },
  {
    key: "Unknown",
    rank: 0,
    label: "Unknown",
    shortLabel: "Unknown",
    description: "No reliable basis yet.",
    color: "slate"
  }
];

const DEFAULT_SORT_OPTIONS = [
  { key: "score", label: "Best overall fit" },
  { key: "allInMonthly", label: "Lowest all-in monthly" },
  { key: "baseRent", label: "Lowest base rent" },
  { key: "cuaCommute", label: "Shortest CUA commute" },
  { key: "bermanCommute", label: "Shortest Berman commute" },
  { key: "kmsProximity", label: "Closest to KMS / community" },
  { key: "confidenceQuality", label: "Highest confidence" }
];

const DEFAULT_COMPARE_ROWS = [
  "allInMonthly",
  "baseRent",
  "parking",
  "mandatoryFees",
  "bedrooms",
  "bathrooms",
  "squareFeet",
  "walkToMetroMin",
  "cuaCommute",
  "bermanCommute",
  "kmsDriveMin",
  "inventoryConfidence",
  "pricingConfidence",
  "eruvConfidence",
  "evConfidence",
  "parkingConfidence",
  "familyFitConfidence",
  "toddlerFriendly",
  "officePotential",
  "twoCarWorkable",
  "playground",
  "outdoorSpace",
  "pool",
  "evCharging"
];

const DEFAULT_FILTERS = {
  maxMonthlyBudget: 5500,
  showAllInMonthly: true,
  unitTypes: ["Apartment", "Townhouse"],
  minimumBedrooms: 3,
  minimumBathrooms: 2,
  twoCarWorkableOnly: true,
  confirmedInventoryOnly: true,
  minimumEruvConfidence: "Likely",
  minimumEvConfidence: "Unknown",
  toddlerFriendlyOnly: false,
  poolOnly: false,
  hideHighlyUncertain: false,
  showOnlyRecentlyVerified: false,
  maxDaysSinceVerification: 30
};

const DEFAULT_SCORE_WEIGHTS = {
  budgetFit: 0.24,
  cuaCommute: 0.17,
  bermanCommute: 0.21,
  kmsProximity: 0.08,
  eruvConfidence: 0.08,
  evConfidence: 0.06,
  toddlerFriendliness: 0.08,
  spaceLayout: 0.05,
  confidenceQuality: 0.03
};

const FIELD_CONFIDENCE_KEYS = [
  "inventory",
  "pricing",
  "eruv",
  "ev",
  "parking",
  "commute",
  "familyFit"
];

const CONFIDENCE_ALIASES = {
  "Needs Call": "Needs Verification",
  "Needs call": "Needs Verification",
  Verify: "Needs Verification",
  "Estimated / Modeled": "Estimated",
  Modeled: "Estimated"
};

const state = {
  properties: [],
  config: null,
  schema: null,
  schemaSource: "none",
  confidenceScale: DEFAULT_CONFIDENCE_SCALE,
  confidenceByKey: new Map(),
  showAllInMonthly: true,
  sortKey: "score",
  scoringEnabled: true,
  activePreset: "balancedFamily",
  weights: { ...DEFAULT_SCORE_WEIGHTS },
  filters: {
    bedroomMode: "3plus",
    maxMonthlyBudget: 5500,
    minimumBathrooms: 2,
    includeApartment: true,
    includeTownhouse: true,
    twoCarWorkableOnly: true,
    confirmedInventoryOnly: true,
    confirmedEVOnly: false,
    likelyEruvOnly: true,
    toddlerFriendlyOnly: false,
    poolOnly: false,
    hideHighlyUncertain: false,
    showOnlyRecentlyVerified: false,
    maxDaysSinceVerification: 30,
    savedOnly: false
  },
  saved: new Set(),
  compare: new Set(),
  notes: {},
  taskChecks: {},
  checklist: {}
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  init().catch((err) => {
    console.error(err);
    els.resultsSummary.textContent = "Failed to load required JSON files.";
    els.schemaStatus.textContent = "Load error: check JSON file names and structure.";
  });
});

function cacheElements() {
  els.appTitle = document.getElementById("appTitle");
  els.appSubtitle = document.getElementById("appSubtitle");
  els.allInLabel = document.getElementById("allInLabel");
  els.baseModeLabel = document.getElementById("baseModeLabel");

  els.maxBudgetRange = document.getElementById("maxBudgetRange");
  els.maxBudgetValue = document.getElementById("maxBudgetValue");
  els.bedroomModeSelect = document.getElementById("bedroomModeSelect");
  els.minBathroomsInput = document.getElementById("minBathroomsInput");
  els.typeApartment = document.getElementById("typeApartment");
  els.typeTownhouse = document.getElementById("typeTownhouse");
  els.twoCarOnly = document.getElementById("twoCarOnly");
  els.confirmedInventoryOnly = document.getElementById("confirmedInventoryOnly");
  els.confirmedEVOnly = document.getElementById("confirmedEVOnly");
  els.likelyEruvOnly = document.getElementById("likelyEruvOnly");
  els.toddlerOnly = document.getElementById("toddlerOnly");
  els.poolOnly = document.getElementById("poolOnly");
  els.hideUncertain = document.getElementById("hideUncertain");
  els.recentOnly = document.getElementById("recentOnly");
  els.savedOnly = document.getElementById("savedOnly");
  els.recentDaysInput = document.getElementById("recentDaysInput");

  els.sortSelect = document.getElementById("sortSelect");
  els.scoringEnabled = document.getElementById("scoringEnabled");
  els.scorePresetSelect = document.getElementById("scorePresetSelect");
  els.weightEditor = document.getElementById("weightEditor");
  els.globalChecklist = document.getElementById("globalChecklist");
  els.schemaStatus = document.getElementById("schemaStatus");

  els.resultsSummary = document.getElementById("resultsSummary");
  els.propertyList = document.getElementById("propertyList");
  els.emptyState = document.getElementById("emptyState");

  els.compareTray = document.getElementById("compareTray");
  els.compareCount = document.getElementById("compareCount");
  els.comparePills = document.getElementById("comparePills");
  els.openCompareBtn = document.getElementById("openCompareBtn");
  els.clearCompareBtn = document.getElementById("clearCompareBtn");

  els.compareDialog = document.getElementById("compareDialog");
  els.closeCompareBtn = document.getElementById("closeCompareBtn");
  els.compareHead = document.getElementById("compareHead");
  els.compareBody = document.getElementById("compareBody");

  els.propertyCardTemplate = document.getElementById("propertyCardTemplate");
}

async function init() {
  const [propertiesRaw, configRaw, schemaInfo] = await Promise.all([
    fetchJson("housing-properties.json", true),
    fetchJson("housing-config.json", true),
    fetchSchemaContract()
  ]);

  state.config = buildConfig(configRaw);
  state.confidenceScale = normalizeConfidenceScale(state.config.confidenceScale);
  state.confidenceByKey = new Map(state.confidenceScale.map((item) => [item.key, item]));

  state.schema = schemaInfo.schema;
  state.schemaSource = schemaInfo.source;
  state.properties = normalizeProperties(propertiesRaw);

  initializeFromConfig();
  loadPersistedState();
  bindEvents();
  buildStaticControls();
  renderGlobalChecklist();
  renderWeightEditor();
  render();
}

async function fetchSchemaContract() {
  const candidates = ["housing-schema.json", "housing-scheme.json"];
  for (const path of candidates) {
    try {
      const schema = await fetchJson(path, false);
      if (schema) {
        return { schema, source: path };
      }
    } catch (err) {
      console.warn(`Schema candidate failed: ${path}`, err);
    }
  }
  return { schema: null, source: "none" };
}

async function fetchJson(path, required) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    if (required) {
      throw new Error(`${path} is required and could not be loaded.`);
    }
    return null;
  }
  return response.json();
}

function buildConfig(rawConfig) {
  const safe = isObject(rawConfig) ? rawConfig : {};
  const scorePresets = isObject(safe.scorePresets) ? safe.scorePresets : { balancedFamily: DEFAULT_SCORE_WEIGHTS };

  return {
    confidenceScale: Array.isArray(safe.confidenceScale) ? safe.confidenceScale : DEFAULT_CONFIDENCE_SCALE,
    scoreWeights: isObject(safe.scoreWeights) ? safe.scoreWeights : DEFAULT_SCORE_WEIGHTS,
    scorePresets,
    filterDefaults: { ...DEFAULT_FILTERS, ...(isObject(safe.filterDefaults) ? safe.filterDefaults : {}) },
    sortOptions: Array.isArray(safe.sortOptions) && safe.sortOptions.length > 0 ? safe.sortOptions : DEFAULT_SORT_OPTIONS,
    compareRows: Array.isArray(safe.compareRows) && safe.compareRows.length > 0 ? safe.compareRows : DEFAULT_COMPARE_ROWS,
    badges: isObject(safe.badges) ? safe.badges : {},
    researchChecklist: Array.isArray(safe.researchChecklist) ? safe.researchChecklist : [],
    uiText: isObject(safe.uiText) ? safe.uiText : {}
  };
}

function normalizeConfidenceScale(scale) {
  const base = Array.isArray(scale) && scale.length > 0 ? scale : DEFAULT_CONFIDENCE_SCALE;
  return base
    .map((entry) => ({
      key: String(entry.key || "Unknown"),
      rank: Number(entry.rank ?? 0),
      label: String(entry.label || entry.key || "Unknown"),
      shortLabel: String(entry.shortLabel || entry.key || "Unknown"),
      description: String(entry.description || ""),
      color: String(entry.color || "slate")
    }))
    .sort((a, b) => b.rank - a.rank);
}

function normalizeProperties(rawProperties) {
  if (!Array.isArray(rawProperties)) {
    return [];
  }

  return rawProperties.map((raw, index) => {
    const safe = isObject(raw) ? raw : {};
    const pricingRaw = isObject(safe.pricing) ? safe.pricing : {};
    const confidenceRaw = isObject(safe.confidence) ? safe.confidence : {};
    const amenitiesRaw = isObject(safe.amenities) ? safe.amenities : {};
    const familyRaw = isObject(safe.family) ? safe.family : {};
    const communityRaw = isObject(safe.community) ? safe.community : {};
    const commuteRaw = isObject(safe.commute) ? safe.commute : {};

    const tasks = Array.isArray(safe.tasks) ? safe.tasks.filter(Boolean) : [];
    if (!tasks.some((task) => /call leasing office/i.test(task))) {
      tasks.push("Call leasing office to confirm unresolved details.");
    }

    const normalizedConfidence = {};
    for (const key of FIELD_CONFIDENCE_KEYS) {
      normalizedConfidence[key] = normalizeConfidenceValue(confidenceRaw[key]);
    }

    return {
      id: String(safe.id || `property-${index + 1}`),
      name: String(safe.name || "Unnamed property"),
      address: String(safe.address || "Address missing"),
      neighborhood: String(safe.neighborhood || "Unknown neighborhood"),
      metroStation: String(safe.metroStation || "Unknown metro"),
      walkToMetroMin: toNumber(safe.walkToMetroMin, null),
      unitType: normalizeUnitTypes(safe.unitType),
      bedrooms: toNumber(safe.bedrooms, 0),
      bathrooms: toNumber(safe.bathrooms, 0),
      squareFeet: toNumber(safe.squareFeet, 0),
      pricing: {
        baseRent: toNumber(pricingRaw.baseRent, 0),
        parking: toNumber(pricingRaw.parking, 0),
        utilities: {
          water: toNumber(pricingRaw.utilities?.water, 0),
          electric: toNumber(pricingRaw.utilities?.electric, 0),
          gas: toNumber(pricingRaw.utilities?.gas, 0),
          internet: toNumber(pricingRaw.utilities?.internet, 0)
        },
        mandatoryFees: toNumber(pricingRaw.mandatoryFees, 0),
        taxDelta: toNumber(pricingRaw.taxDelta, 0),
        estimatedAllIn: toNumber(pricingRaw.estimatedAllIn, 0),
        confidence: normalizeConfidenceValue(pricingRaw.confidence || confidenceRaw.pricing || "Estimated"),
        assumptions: Array.isArray(pricingRaw.assumptions) ? pricingRaw.assumptions.filter(Boolean) : []
      },
      confidence: normalizedConfidence,
      community: {
        eruvStatus: normalizeConfidenceValue(communityRaw.eruvStatus || normalizedConfidence.eruv),
        eruvNotes: String(communityRaw.eruvNotes || "No eruv notes available."),
        synagogueProximity: String(communityRaw.synagogueProximity || "Not specified"),
        kmsDriveMin: toNumber(communityRaw.kmsDriveMin, null)
      },
      commute: {
        cuaLaw: toNumber(commuteRaw.cuaLaw, null),
        berman: toNumber(commuteRaw.berman, null),
        confidence: normalizeConfidenceValue(commuteRaw.confidence || normalizedConfidence.commute)
      },
      amenities: {
        pool: Boolean(amenitiesRaw.pool),
        gym: Boolean(amenitiesRaw.gym),
        playground: Boolean(amenitiesRaw.playground),
        outdoorSpace: Boolean(amenitiesRaw.outdoorSpace),
        evCharging: Boolean(amenitiesRaw.evCharging)
      },
      family: {
        toddlerFriendly: Boolean(familyRaw.toddlerFriendly),
        strollerFriendly: Boolean(familyRaw.strollerFriendly),
        officePotential: Boolean(familyRaw.officePotential),
        twoCarWorkable: Boolean(familyRaw.twoCarWorkable)
      },
      evidence: normalizeEvidence(safe.evidence),
      notes: Array.isArray(safe.notes) ? safe.notes.filter(Boolean) : [],
      tasks,
      lastVerified: String(safe.lastVerified || "")
    };
  });
}

function normalizeUnitTypes(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const filtered = value
    .map((item) => String(item || "").trim())
    .filter((item) => item === "Apartment" || item === "Townhouse");
  return filtered.length > 0 ? filtered : ["Apartment"];
}

function normalizeEvidence(rawEvidence) {
  const safe = isObject(rawEvidence) ? rawEvidence : {};
  const groups = ["inventory", "pricing", "eruv", "ev", "commute"];
  const normalized = {};

  for (const group of groups) {
    const items = Array.isArray(safe[group]) ? safe[group] : [];
    normalized[group] = items
      .filter((item) => isObject(item))
      .map((item) => ({
        label: String(item.label || "Source"),
        url: String(item.url || ""),
        checkedAt: String(item.checkedAt || ""),
        note: String(item.note || "")
      }));
  }

  return normalized;
}

function initializeFromConfig() {
  const defaults = state.config.filterDefaults;

  state.showAllInMonthly = Boolean(defaults.showAllInMonthly);
  state.filters.maxMonthlyBudget = toNumber(defaults.maxMonthlyBudget, 5500);
  state.filters.minimumBathrooms = toNumber(defaults.minimumBathrooms, 2);
  state.filters.includeApartment = Array.isArray(defaults.unitTypes) ? defaults.unitTypes.includes("Apartment") : true;
  state.filters.includeTownhouse = Array.isArray(defaults.unitTypes) ? defaults.unitTypes.includes("Townhouse") : true;
  state.filters.bedroomMode = toNumber(defaults.minimumBedrooms, 3) > 3 ? "3plus" : "3plus";
  state.filters.twoCarWorkableOnly = Boolean(defaults.twoCarWorkableOnly);
  state.filters.confirmedInventoryOnly = Boolean(defaults.confirmedInventoryOnly);
  state.filters.confirmedEVOnly = normalizeConfidenceValue(defaults.minimumEvConfidence) === "Confirmed";
  state.filters.likelyEruvOnly = confidenceRank(normalizeConfidenceValue(defaults.minimumEruvConfidence)) >= confidenceRank("Likely");
  state.filters.toddlerFriendlyOnly = Boolean(defaults.toddlerFriendlyOnly);
  state.filters.poolOnly = Boolean(defaults.poolOnly);
  state.filters.hideHighlyUncertain = Boolean(defaults.hideHighlyUncertain);
  state.filters.showOnlyRecentlyVerified = Boolean(defaults.showOnlyRecentlyVerified);
  state.filters.maxDaysSinceVerification = toNumber(defaults.maxDaysSinceVerification, 30);

  const presetKeys = Object.keys(state.config.scorePresets);
  state.activePreset = presetKeys.includes("balancedFamily") ? "balancedFamily" : presetKeys[0] || "custom";
  state.weights = {
    ...DEFAULT_SCORE_WEIGHTS,
    ...(isObject(state.config.scoreWeights) ? state.config.scoreWeights : {}),
    ...(isObject(state.config.scorePresets[state.activePreset]) ? state.config.scorePresets[state.activePreset] : {})
  };

  state.sortKey = state.config.sortOptions.some((item) => item.key === "score")
    ? "score"
    : state.config.sortOptions[0]?.key || "allInMonthly";
}

function loadPersistedState() {
  const saved = loadJson(STORAGE_KEYS.saved, []);
  const compare = loadJson(STORAGE_KEYS.compare, []);
  const notes = loadJson(STORAGE_KEYS.notes, {});
  const tasks = loadJson(STORAGE_KEYS.tasks, {});
  const checklist = loadJson(STORAGE_KEYS.checklist, {});
  const filters = loadJson(STORAGE_KEYS.filters, {});
  const weights = loadJson(STORAGE_KEYS.weights, {});

  if (Array.isArray(saved)) {
    state.saved = new Set(saved);
  }
  if (Array.isArray(compare)) {
    state.compare = new Set(compare.slice(0, 4));
  }
  if (isObject(notes)) {
    state.notes = notes;
  }
  if (isObject(tasks)) {
    state.taskChecks = tasks;
  }
  if (isObject(checklist)) {
    state.checklist = checklist;
  }
  if (isObject(filters)) {
    state.filters = { ...state.filters, ...filters };
  }
  if (isObject(weights)) {
    state.weights = { ...state.weights, ...weights };
  }

  const scoringEnabled = localStorage.getItem(STORAGE_KEYS.scoringEnabled);
  if (scoringEnabled === "false") {
    state.scoringEnabled = false;
  }

  const preset = localStorage.getItem(STORAGE_KEYS.preset);
  if (preset && (preset === "custom" || state.config.scorePresets[preset])) {
    state.activePreset = preset;
  }

  const mode = localStorage.getItem(STORAGE_KEYS.mode);
  if (mode === "base") {
    state.showAllInMonthly = false;
  }

  const sort = localStorage.getItem(STORAGE_KEYS.sort);
  if (sort && state.config.sortOptions.some((option) => option.key === sort)) {
    state.sortKey = sort;
  }
}

function bindEvents() {
  document.querySelectorAll('input[name="costMode"]').forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.showAllInMonthly = event.target.value === "allIn";
      persistMode();
      render();
    });
  });

  els.maxBudgetRange.addEventListener("input", (event) => {
    state.filters.maxMonthlyBudget = toNumber(event.target.value, state.filters.maxMonthlyBudget);
    persistFilters();
    render();
  });

  els.bedroomModeSelect.addEventListener("change", (event) => {
    state.filters.bedroomMode = event.target.value;
    persistFilters();
    render();
  });

  els.minBathroomsInput.addEventListener("input", (event) => {
    state.filters.minimumBathrooms = toNumber(event.target.value, state.filters.minimumBathrooms);
    persistFilters();
    render();
  });

  const checkboxBindings = [
    [els.typeApartment, "includeApartment"],
    [els.typeTownhouse, "includeTownhouse"],
    [els.twoCarOnly, "twoCarWorkableOnly"],
    [els.confirmedInventoryOnly, "confirmedInventoryOnly"],
    [els.confirmedEVOnly, "confirmedEVOnly"],
    [els.likelyEruvOnly, "likelyEruvOnly"],
    [els.toddlerOnly, "toddlerFriendlyOnly"],
    [els.poolOnly, "poolOnly"],
    [els.hideUncertain, "hideHighlyUncertain"],
    [els.recentOnly, "showOnlyRecentlyVerified"],
    [els.savedOnly, "savedOnly"]
  ];

  checkboxBindings.forEach(([element, key]) => {
    element.addEventListener("change", (event) => {
      state.filters[key] = event.target.checked;
      persistFilters();
      render();
    });
  });

  els.recentDaysInput.addEventListener("input", (event) => {
    state.filters.maxDaysSinceVerification = toNumber(event.target.value, state.filters.maxDaysSinceVerification);
    persistFilters();
    render();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sortKey = event.target.value;
    localStorage.setItem(STORAGE_KEYS.sort, state.sortKey);
    render();
  });

  els.scoringEnabled.addEventListener("change", (event) => {
    state.scoringEnabled = event.target.checked;
    localStorage.setItem(STORAGE_KEYS.scoringEnabled, String(state.scoringEnabled));
    render();
  });

  els.scorePresetSelect.addEventListener("change", (event) => {
    const presetKey = event.target.value;
    state.activePreset = presetKey;

    if (presetKey !== "custom" && state.config.scorePresets[presetKey]) {
      state.weights = {
        ...state.weights,
        ...state.config.scorePresets[presetKey]
      };
      persistWeights();
      renderWeightEditor();
    }

    localStorage.setItem(STORAGE_KEYS.preset, state.activePreset);
    render();
  });

  els.openCompareBtn.addEventListener("click", () => {
    renderCompareDialog();
    els.compareDialog.showModal();
  });

  els.clearCompareBtn.addEventListener("click", () => {
    state.compare.clear();
    persistCompare();
    render();
  });

  els.compareDialog.addEventListener("click", (event) => {
    const rect = els.compareDialog.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) {
      els.compareDialog.close();
    }
  });
}

function buildStaticControls() {
  const uiText = state.config.uiText;
  els.appTitle.textContent = uiText.appTitle || "Family Housing Research Dashboard";
  els.appSubtitle.textContent = uiText.appSubtitle || "Evidence-aware comparison for DMV rental decisions";
  els.allInLabel.textContent = uiText.allInModeLabel || "All-in monthly";
  els.baseModeLabel.textContent = uiText.baseRentModeLabel || "Base rent only";

  els.maxBudgetRange.value = String(state.filters.maxMonthlyBudget);
  els.maxBudgetValue.textContent = formatCurrency(state.filters.maxMonthlyBudget);
  els.bedroomModeSelect.value = state.filters.bedroomMode;
  els.minBathroomsInput.value = String(state.filters.minimumBathrooms);

  els.typeApartment.checked = state.filters.includeApartment;
  els.typeTownhouse.checked = state.filters.includeTownhouse;
  els.twoCarOnly.checked = state.filters.twoCarWorkableOnly;
  els.confirmedInventoryOnly.checked = state.filters.confirmedInventoryOnly;
  els.confirmedEVOnly.checked = state.filters.confirmedEVOnly;
  els.likelyEruvOnly.checked = state.filters.likelyEruvOnly;
  els.toddlerOnly.checked = state.filters.toddlerFriendlyOnly;
  els.poolOnly.checked = state.filters.poolOnly;
  els.hideUncertain.checked = state.filters.hideHighlyUncertain;
  els.recentOnly.checked = state.filters.showOnlyRecentlyVerified;
  els.savedOnly.checked = state.filters.savedOnly;
  els.recentDaysInput.value = String(state.filters.maxDaysSinceVerification);

  els.scoringEnabled.checked = state.scoringEnabled;

  els.sortSelect.innerHTML = "";
  state.config.sortOptions.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.key;
    node.textContent = option.label;
    els.sortSelect.appendChild(node);
  });
  els.sortSelect.value = state.sortKey;

  els.scorePresetSelect.innerHTML = "";
  Object.keys(state.config.scorePresets).forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = toTitleCase(key);
    els.scorePresetSelect.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom";
  els.scorePresetSelect.appendChild(customOption);

  if (![...els.scorePresetSelect.options].some((option) => option.value === state.activePreset)) {
    state.activePreset = "custom";
  }
  els.scorePresetSelect.value = state.activePreset;

  updateSchemaStatus();
}

function renderGlobalChecklist() {
  els.globalChecklist.innerHTML = "";

  if (!Array.isArray(state.config.researchChecklist) || state.config.researchChecklist.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No shared checklist configured.";
    li.className = "small muted";
    els.globalChecklist.appendChild(li);
    return;
  }

  state.config.researchChecklist.forEach((item) => {
    const key = `global::${item}`;
    const li = document.createElement("li");
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(state.checklist[key]);
    input.addEventListener("change", () => {
      state.checklist[key] = input.checked;
      persistChecklist();
    });

    const text = document.createElement("span");
    text.textContent = item;

    label.appendChild(input);
    label.appendChild(text);
    li.appendChild(label);
    els.globalChecklist.appendChild(li);
  });
}

function renderWeightEditor() {
  els.weightEditor.innerHTML = "";

  const entries = Object.entries(state.weights);
  entries.forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "weight-row";

    const label = document.createElement("label");
    label.setAttribute("for", `weight-${key}`);
    label.textContent = `${toTitleCase(key)} (${Math.round(value * 100)}%)`;

    const slider = document.createElement("input");
    slider.id = `weight-${key}`;
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(Math.round(value * 100));
    slider.addEventListener("input", (event) => {
      const nextValue = toNumber(event.target.value, 0) / 100;
      state.weights[key] = nextValue;
      state.activePreset = "custom";
      els.scorePresetSelect.value = "custom";
      localStorage.setItem(STORAGE_KEYS.preset, "custom");
      persistWeights();
      renderWeightEditor();
      render();
    });

    row.appendChild(label);
    row.appendChild(slider);
    els.weightEditor.appendChild(row);
  });
}

function render() {
  const filtered = applyFilters(state.properties);
  const sorted = sortProperties(filtered);

  renderSummary(sorted.length, state.properties.length);
  renderPropertyCards(sorted);
  renderCompareTray();

  els.emptyState.hidden = sorted.length > 0;
  els.maxBudgetValue.textContent = formatCurrency(state.filters.maxMonthlyBudget);

  document.querySelector(`input[name="costMode"][value="${state.showAllInMonthly ? "allIn" : "base"}"]`).checked = true;
}

function applyFilters(properties) {
  const now = new Date();
  return properties.filter((property) => {
    if (state.filters.bedroomMode === "3only" && property.bedrooms !== 3) {
      return false;
    }
    if (state.filters.bedroomMode === "3plus" && property.bedrooms < 3) {
      return false;
    }

    if (property.bathrooms < state.filters.minimumBathrooms) {
      return false;
    }

    const hasApartment = property.unitType.includes("Apartment");
    const hasTownhouse = property.unitType.includes("Townhouse");
    const typeMatch =
      (state.filters.includeApartment && hasApartment) ||
      (state.filters.includeTownhouse && hasTownhouse);
    if (!typeMatch) {
      return false;
    }

    const costs = computeCostModel(property);
    const budgetValue = state.showAllInMonthly ? costs.allInMonthly : costs.baseRent;
    if (budgetValue > state.filters.maxMonthlyBudget) {
      return false;
    }

    if (state.filters.twoCarWorkableOnly && !property.family.twoCarWorkable) {
      return false;
    }
    if (state.filters.confirmedInventoryOnly && property.confidence.inventory !== "Confirmed") {
      return false;
    }
    if (state.filters.confirmedEVOnly && property.confidence.ev !== "Confirmed") {
      return false;
    }
    if (state.filters.likelyEruvOnly && confidenceRank(property.confidence.eruv) < confidenceRank("Likely")) {
      return false;
    }
    if (state.filters.toddlerFriendlyOnly && !property.family.toddlerFriendly) {
      return false;
    }
    if (state.filters.poolOnly && !property.amenities.pool) {
      return false;
    }
    if (state.filters.savedOnly && !state.saved.has(property.id)) {
      return false;
    }

    if (state.filters.hideHighlyUncertain && isHighlyUncertain(property)) {
      return false;
    }

    if (state.filters.showOnlyRecentlyVerified) {
      const ageDays = daysSince(property.lastVerified, now);
      if (ageDays === null || ageDays > state.filters.maxDaysSinceVerification) {
        return false;
      }
    }

    return true;
  });
}

function sortProperties(properties) {
  const items = [...properties];
  const activeSort = state.scoringEnabled ? state.sortKey : state.sortKey === "score" ? "allInMonthly" : state.sortKey;

  items.sort((a, b) => {
    if (activeSort === "score") {
      return computeScore(b) - computeScore(a);
    }
    if (activeSort === "allInMonthly") {
      return computeCostModel(a).allInMonthly - computeCostModel(b).allInMonthly;
    }
    if (activeSort === "baseRent") {
      return a.pricing.baseRent - b.pricing.baseRent;
    }
    if (activeSort === "cuaCommute") {
      return nullHigh(a.commute.cuaLaw) - nullHigh(b.commute.cuaLaw);
    }
    if (activeSort === "bermanCommute") {
      return nullHigh(a.commute.berman) - nullHigh(b.commute.berman);
    }
    if (activeSort === "kmsProximity") {
      return nullHigh(a.community.kmsDriveMin) - nullHigh(b.community.kmsDriveMin);
    }
    if (activeSort === "confidenceQuality") {
      return confidenceQuality(b) - confidenceQuality(a);
    }
    return 0;
  });

  return items;
}

function renderSummary(visible, total) {
  const modeLabel = state.showAllInMonthly ? "all-in mode" : "base-rent mode";
  const scoringLabel = state.scoringEnabled ? "score enabled" : "score disabled";
  els.resultsSummary.textContent = `${visible} of ${total} properties shown, ${modeLabel}, ${scoringLabel}.`;
}

function renderPropertyCards(properties) {
  els.propertyList.innerHTML = "";

  properties.forEach((property) => {
    const node = els.propertyCardTemplate.content.firstElementChild.cloneNode(true);

    const saveButton = node.querySelector('[data-action="save"]');
    const compareButton = node.querySelector('[data-action="compare"]');
    const notesField = node.querySelector('[data-field="notes"]');

    node.querySelector('[data-field="meta"]').textContent =
      `${property.unitType.join(" / ")} | ${property.bedrooms}BR/${property.bathrooms}BA | ${valueOrDash(property.walkToMetroMin, "min walk")}`;
    node.querySelector('[data-field="name"]').textContent = property.name;
    node.querySelector('[data-field="address"]').textContent = `${property.address} | ${property.neighborhood} | ${property.metroStation}`;

    const costs = computeCostModel(property);
    node.querySelector('[data-field="displayTotal"]').textContent = formatCurrency(
      state.showAllInMonthly ? costs.allInMonthly : costs.baseRent
    );

    renderCostBreakdown(node.querySelector('[data-field="costBreakdown"]'), costs);
    renderAssumptions(node.querySelector('[data-field="assumptions"]'), property, costs);
    renderMetrics(node.querySelector('[data-field="metrics"]'), property);
    renderFlags(node.querySelector('[data-field="flags"]'), property);
    renderConfidence(node.querySelector('[data-field="confidence"]'), property);
    renderEvidence(node.querySelector('[data-field="evidence"]'), property);
    renderTasks(node.querySelector('[data-field="tasks"]'), property);

    notesField.value = state.notes[property.id] || "";
    notesField.addEventListener("input", (event) => {
      state.notes[property.id] = event.target.value;
      persistNotes();
    });

    const isSaved = state.saved.has(property.id);
    saveButton.textContent = isSaved ? "Saved" : "Save";
    saveButton.classList.toggle("button-secondary", !isSaved);
    saveButton.addEventListener("click", () => {
      toggleSaved(property.id);
      render();
    });

    const inCompare = state.compare.has(property.id);
    compareButton.textContent = inCompare ? "In compare" : "Compare";
    compareButton.classList.toggle("button-secondary", inCompare);
    compareButton.disabled = !inCompare && state.compare.size >= 4;
    compareButton.addEventListener("click", () => {
      toggleCompare(property.id);
      render();
    });

    els.propertyList.appendChild(node);
  });
}

function renderCostBreakdown(container, costs) {
  container.innerHTML = "";
  const rows = [
    { label: "Base rent", value: costs.baseRent, modeled: false },
    { label: "Parking", value: costs.parking, modeled: false },
    { label: "Mandatory fees", value: costs.mandatoryFees, modeled: false },
    { label: "Tax assumption", value: costs.taxDelta, modeled: true },
    { label: "Utilities (modeled)", value: costs.utilitiesTotal, modeled: true },
    { label: "All-in monthly", value: costs.allInMonthly, modeled: true }
  ];

  rows.forEach((row) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = row.label;
    if (row.modeled) {
      left.className = "modeled";
    }
    const right = document.createElement("strong");
    right.textContent = formatCurrency(row.value);
    li.appendChild(left);
    li.appendChild(right);
    container.appendChild(li);
  });
}

function renderAssumptions(container, property, costs) {
  const assumptions = property.pricing.assumptions;
  const callNeeded = requiresFollowUpCall(property);

  const assumptionText = assumptions.length > 0
    ? assumptions.map((item) => `- ${item}`).join(" ")
    : "- No explicit assumptions provided; verify lease-specific fees and utility policy.";

  container.textContent = `${assumptionText} Follow-up call needed: ${callNeeded ? "Yes" : "No"}.`;

  if (Math.abs(property.pricing.estimatedAllIn - costs.allInMonthly) > 5) {
    container.textContent += ` Stored estimated all-in (${formatCurrency(property.pricing.estimatedAllIn)}) differs from computed all-in (${formatCurrency(costs.allInMonthly)}).`;
  }
}

function renderMetrics(container, property) {
  container.innerHTML = "";
  const score = computeScore(property);

  const metrics = [
    ["All-in", formatCurrency(computeCostModel(property).allInMonthly)],
    ["CUA", valueOrDash(property.commute.cuaLaw, "min")],
    ["Berman", valueOrDash(property.commute.berman, "min")],
    ["KMS", valueOrDash(property.community.kmsDriveMin, "min")],
    ["Sq ft", valueOrDash(property.squareFeet, "sq ft")],
    ["Score", state.scoringEnabled ? String(score) : "Disabled"]
  ];

  metrics.forEach(([label, value]) => {
    const cell = document.createElement("div");
    cell.className = "metric";

    const labelNode = document.createElement("span");
    labelNode.className = "label";
    labelNode.textContent = label;

    const valueNode = document.createElement("span");
    valueNode.className = "value";
    valueNode.textContent = value;

    cell.appendChild(labelNode);
    cell.appendChild(valueNode);
    container.appendChild(cell);
  });
}

function renderFlags(container, property) {
  container.innerHTML = "";
  const badges = [];

  if (property.family.twoCarWorkable) {
    badges.push("Two-car workable");
  }
  if (property.amenities.evCharging) {
    badges.push("On-site EV charging");
  }
  if (property.family.toddlerFriendly) {
    badges.push("Toddler-friendly");
  }
  if (property.family.officePotential) {
    badges.push("WFH viable");
  }
  if (isStrongBerman(property)) {
    badges.push(state.config.badges.bestBerman || "Strong Berman commute");
  }
  if (isStrongCUA(property)) {
    badges.push(state.config.badges.bestCUA || "Strong CUA commute");
  }
  if (isStrongCommunity(property)) {
    badges.push("Strong community / eruv fit");
  }

  if (badges.length === 0) {
    badges.push("Needs more evidence before flagging fit");
  }

  badges.forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "flag-pill";
    pill.textContent = text;
    container.appendChild(pill);
  });
}

function renderConfidence(container, property) {
  container.innerHTML = "";

  FIELD_CONFIDENCE_KEYS.forEach((key) => {
    const status = normalizeConfidenceValue(property.confidence[key]);
    const pill = buildConfidencePill(`${toTitleCase(key)}: ${status}`, status);
    container.appendChild(pill);
  });
}

function renderEvidence(container, property) {
  container.innerHTML = "";
  const groups = ["inventory", "pricing", "eruv", "ev", "commute"];

  groups.forEach((group) => {
    const card = document.createElement("section");
    card.className = "evidence-group";

    const head = document.createElement("div");
    head.className = "evidence-head";

    const title = document.createElement("strong");
    title.textContent = group;

    const status = normalizeConfidenceValue(property.confidence[group] || (group === "pricing" ? property.pricing.confidence : "Unknown"));
    const statusPill = buildConfidencePill(status, status);

    head.appendChild(title);
    head.appendChild(statusPill);

    const followTag = document.createElement("span");
    followTag.className = "evidence-tag";
    followTag.textContent = requiresFollowUpForGroup(property, group) ? "Call needed" : "No call needed";
    head.appendChild(followTag);

    card.appendChild(head);

    const list = document.createElement("ul");
    list.className = "evidence-list";

    const items = property.evidence[group] || [];
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No source logged for this field.";
      empty.className = "small muted";
      list.appendChild(empty);
    } else {
      items.forEach((item) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = item.url || "#";
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = item.label;

        const date = document.createElement("span");
        date.className = "small muted";
        date.textContent = item.checkedAt ? `Checked ${item.checkedAt}` : "Checked date missing";

        const note = document.createElement("span");
        note.className = "evidence-note";
        note.textContent = item.note || "No caveat provided.";

        li.appendChild(link);
        li.appendChild(date);
        li.appendChild(note);
        list.appendChild(li);
      });
    }

    card.appendChild(list);
    container.appendChild(card);
  });
}

function renderTasks(container, property) {
  container.innerHTML = "";
  const taskKeyPrefix = `${property.id}::`;
  const tasks = property.tasks;

  const progress = document.createElement("p");
  progress.className = "small muted";

  let doneCount = 0;

  tasks.forEach((task) => {
    const key = `${taskKeyPrefix}${task}`;
    if (state.taskChecks[key]) {
      doneCount += 1;
    }

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state.taskChecks[key]);
    checkbox.addEventListener("change", () => {
      state.taskChecks[key] = checkbox.checked;
      persistTasks();
      render();
    });

    const text = document.createElement("span");
    text.textContent = task;

    label.appendChild(checkbox);
    label.appendChild(text);
    container.appendChild(label);
  });

  progress.textContent = `${doneCount}/${tasks.length} follow-up tasks complete.`;
  container.prepend(progress);
}

function renderCompareTray() {
  const selected = getCompareProperties();
  const count = selected.length;

  els.compareTray.hidden = count === 0;
  els.compareCount.textContent = `${count} selected for comparison (max 4)`;
  els.openCompareBtn.disabled = count < 2;

  els.comparePills.innerHTML = "";
  selected.forEach((property) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = property.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${property.name} from compare`);
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", () => {
      state.compare.delete(property.id);
      persistCompare();
      render();
    });

    pill.appendChild(removeBtn);
    els.comparePills.appendChild(pill);
  });
}

function renderCompareDialog() {
  const selected = getCompareProperties();
  els.compareHead.innerHTML = "";
  els.compareBody.innerHTML = "";

  const metricTh = document.createElement("th");
  metricTh.textContent = "Metric";
  els.compareHead.appendChild(metricTh);

  selected.forEach((property) => {
    const th = document.createElement("th");
    th.textContent = property.name;
    els.compareHead.appendChild(th);
  });

  const rows = state.config.compareRows
    .map((key) => buildCompareRowDefinition(key))
    .filter(Boolean);

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const metricCell = document.createElement("td");
    metricCell.innerHTML = `<strong>${row.label}</strong><div class="small muted">${row.tag}</div>`;
    tr.appendChild(metricCell);

    const values = selected.map((property) => row.rawValue(property));
    const bestSet = getBestValueIndices(values, row.bestRule);

    selected.forEach((property, index) => {
      const td = document.createElement("td");
      if (bestSet.has(index)) {
        td.classList.add("best-cell");
      }

      const value = row.renderValue(property);
      const valueNode = document.createElement("div");
      valueNode.textContent = value;
      td.appendChild(valueNode);

      if (row.confidenceKey) {
        const status = normalizeConfidenceValue(property.confidence[row.confidenceKey]);
        td.appendChild(buildConfidencePill(status, status));
      }

      tr.appendChild(td);
    });

    els.compareBody.appendChild(tr);
  });
}

function buildCompareRowDefinition(key) {
  const defs = {
    allInMonthly: {
      label: "All-in monthly",
      tag: "Modeled",
      rawValue: (property) => computeCostModel(property).allInMonthly,
      renderValue: (property) => formatCurrency(computeCostModel(property).allInMonthly),
      bestRule: "min",
      confidenceKey: "pricing"
    },
    baseRent: {
      label: "Base rent",
      tag: "Sourced",
      rawValue: (property) => property.pricing.baseRent,
      renderValue: (property) => formatCurrency(property.pricing.baseRent),
      bestRule: "min",
      confidenceKey: "pricing"
    },
    parking: {
      label: "Parking",
      tag: "Sourced",
      rawValue: (property) => property.pricing.parking,
      renderValue: (property) => formatCurrency(property.pricing.parking),
      bestRule: "min",
      confidenceKey: "parking"
    },
    mandatoryFees: {
      label: "Mandatory fees",
      tag: "Sourced",
      rawValue: (property) => property.pricing.mandatoryFees,
      renderValue: (property) => formatCurrency(property.pricing.mandatoryFees),
      bestRule: "min",
      confidenceKey: "pricing"
    },
    bedrooms: {
      label: "Bedrooms",
      tag: "Sourced",
      rawValue: (property) => property.bedrooms,
      renderValue: (property) => String(property.bedrooms),
      bestRule: "max"
    },
    bathrooms: {
      label: "Bathrooms",
      tag: "Sourced",
      rawValue: (property) => property.bathrooms,
      renderValue: (property) => String(property.bathrooms),
      bestRule: "max"
    },
    squareFeet: {
      label: "Square feet",
      tag: "Sourced",
      rawValue: (property) => property.squareFeet,
      renderValue: (property) => valueOrDash(property.squareFeet, "sq ft"),
      bestRule: "max"
    },
    walkToMetroMin: {
      label: "Walk to metro",
      tag: "Estimated",
      rawValue: (property) => nullHigh(property.walkToMetroMin),
      renderValue: (property) => valueOrDash(property.walkToMetroMin, "min"),
      bestRule: "min"
    },
    cuaCommute: {
      label: "CUA commute",
      tag: "Estimated",
      rawValue: (property) => nullHigh(property.commute.cuaLaw),
      renderValue: (property) => valueOrDash(property.commute.cuaLaw, "min"),
      bestRule: "min",
      confidenceKey: "commute"
    },
    bermanCommute: {
      label: "Berman commute",
      tag: "Estimated",
      rawValue: (property) => nullHigh(property.commute.berman),
      renderValue: (property) => valueOrDash(property.commute.berman, "min"),
      bestRule: "min",
      confidenceKey: "commute"
    },
    kmsDriveMin: {
      label: "Community (KMS drive)",
      tag: "Estimated",
      rawValue: (property) => nullHigh(property.community.kmsDriveMin),
      renderValue: (property) => valueOrDash(property.community.kmsDriveMin, "min"),
      bestRule: "min"
    },
    inventoryConfidence: confidenceRow("Inventory confidence", "inventory"),
    pricingConfidence: confidenceRow("Pricing confidence", "pricing"),
    eruvConfidence: confidenceRow("Eruv confidence", "eruv"),
    evConfidence: confidenceRow("EV confidence", "ev"),
    parkingConfidence: confidenceRow("Parking confidence", "parking"),
    familyFitConfidence: confidenceRow("Family-fit confidence", "familyFit"),
    toddlerFriendly: booleanRow("Toddler-friendly", (property) => property.family.toddlerFriendly),
    officePotential: booleanRow("Office potential", (property) => property.family.officePotential),
    twoCarWorkable: booleanRow("Two-car workable", (property) => property.family.twoCarWorkable),
    playground: booleanRow("Playground", (property) => property.amenities.playground),
    outdoorSpace: booleanRow("Outdoor space", (property) => property.amenities.outdoorSpace),
    pool: booleanRow("Pool", (property) => property.amenities.pool),
    evCharging: booleanRow("EV charging", (property) => property.amenities.evCharging)
  };

  return defs[key] || null;
}

function confidenceRow(label, key) {
  return {
    label,
    tag: "Field confidence",
    rawValue: (property) => confidenceRank(property.confidence[key]),
    renderValue: (property) => normalizeConfidenceValue(property.confidence[key]),
    bestRule: "max",
    confidenceKey: key
  };
}

function booleanRow(label, getter) {
  return {
    label,
    tag: "Sourced",
    rawValue: (property) => (getter(property) ? 1 : 0),
    renderValue: (property) => (getter(property) ? "Yes" : "No"),
    bestRule: "max"
  };
}

function computeCostModel(property) {
  const baseRent = property.pricing.baseRent;
  const parking = property.pricing.parking;
  const mandatoryFees = property.pricing.mandatoryFees;
  const taxDelta = property.pricing.taxDelta;
  const utilitiesTotal = Object.values(property.pricing.utilities).reduce((sum, value) => sum + toNumber(value, 0), 0);

  return {
    baseRent,
    parking,
    mandatoryFees,
    taxDelta,
    utilitiesTotal,
    allInMonthly: baseRent + parking + mandatoryFees + taxDelta + utilitiesTotal
  };
}

function computeScore(property) {
  const normalized = normalizeWeights(state.weights);
  const costs = computeCostModel(property);

  const factors = {
    budgetFit: clamp01((7000 - costs.allInMonthly) / 4200) * 100,
    cuaCommute: clamp01((45 - nullHigh(property.commute.cuaLaw)) / 30) * 100,
    bermanCommute: clamp01((40 - nullHigh(property.commute.berman)) / 30) * 100,
    kmsProximity: clamp01((25 - nullHigh(property.community.kmsDriveMin)) / 18) * 100,
    eruvConfidence: (confidenceRank(property.confidence.eruv) / 4) * 100,
    evConfidence: (confidenceRank(property.confidence.ev) / 4) * 100,
    toddlerFriendliness: (property.family.toddlerFriendly ? 0.6 : 0) * 100 +
      (property.amenities.playground ? 0.2 : 0) * 100 +
      (property.amenities.outdoorSpace ? 0.2 : 0) * 100,
    spaceLayout: clamp01((property.squareFeet - 950) / 850) * 100,
    confidenceQuality: (confidenceQuality(property) / 4) * 100
  };

  let score = 0;
  Object.keys(normalized).forEach((key) => {
    score += (factors[key] || 0) * normalized[key];
  });

  return Math.round(score);
}

function normalizeWeights(weights) {
  const safe = isObject(weights) ? weights : {};
  const entries = Object.entries(safe).map(([key, value]) => [key, Math.max(0, toNumber(value, 0))]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return { ...DEFAULT_SCORE_WEIGHTS };
  }

  const normalized = {};
  entries.forEach(([key, value]) => {
    normalized[key] = value / total;
  });
  return normalized;
}

function confidenceQuality(property) {
  const total = FIELD_CONFIDENCE_KEYS.reduce((sum, key) => sum + confidenceRank(property.confidence[key]), 0);
  return total / FIELD_CONFIDENCE_KEYS.length;
}

function isHighlyUncertain(property) {
  return confidenceQuality(property) < 1.7;
}

function requiresFollowUpCall(property) {
  return FIELD_CONFIDENCE_KEYS.some((key) => confidenceRank(property.confidence[key]) < confidenceRank("Likely"));
}

function requiresFollowUpForGroup(property, group) {
  const status = normalizeConfidenceValue(property.confidence[group] || (group === "pricing" ? property.pricing.confidence : "Unknown"));
  const lowConfidence = confidenceRank(status) < confidenceRank("Likely");
  const noEvidence = !Array.isArray(property.evidence[group]) || property.evidence[group].length === 0;
  return lowConfidence || noEvidence;
}

function isStrongBerman(property) {
  return property.commute.berman !== null && property.commute.berman <= 15;
}

function isStrongCUA(property) {
  return property.commute.cuaLaw !== null && property.commute.cuaLaw <= 20;
}

function isStrongCommunity(property) {
  return property.community.kmsDriveMin !== null &&
    property.community.kmsDriveMin <= 12 &&
    confidenceRank(property.confidence.eruv) >= confidenceRank("Likely");
}

function toggleSaved(propertyId) {
  if (state.saved.has(propertyId)) {
    state.saved.delete(propertyId);
  } else {
    state.saved.add(propertyId);
  }
  persistSaved();
}

function toggleCompare(propertyId) {
  if (state.compare.has(propertyId)) {
    state.compare.delete(propertyId);
  } else if (state.compare.size < 4) {
    state.compare.add(propertyId);
  }
  persistCompare();
}

function getCompareProperties() {
  return [...state.compare]
    .map((id) => state.properties.find((property) => property.id === id))
    .filter(Boolean);
}

function updateSchemaStatus() {
  const count = state.properties.length;
  if (!state.schema) {
    els.schemaStatus.textContent = "No schema file loaded (expected housing-schema.json or housing-scheme.json).";
    return;
  }

  const schemaType = state.schema.type || "unknown";
  let text = `Loaded ${state.schemaSource} (schema type: ${schemaType}). Data rows: ${count}.`;

  if (schemaType !== "array") {
    text += " Contract appears item-level instead of dataset-level; keep this in mind when validating arrays.";
  }

  els.schemaStatus.textContent = text;
}

function getBestValueIndices(values, rule) {
  if (!Array.isArray(values) || values.length === 0) {
    return new Set();
  }

  let bestValue = values[0];
  values.forEach((value) => {
    if (rule === "min" && value < bestValue) {
      bestValue = value;
    }
    if (rule === "max" && value > bestValue) {
      bestValue = value;
    }
  });

  const indices = new Set();
  values.forEach((value, index) => {
    if (value === bestValue) {
      indices.add(index);
    }
  });

  return indices;
}

function buildConfidencePill(text, status) {
  const meta = state.confidenceByKey.get(normalizeConfidenceValue(status)) || state.confidenceByKey.get("Unknown");
  const pill = document.createElement("span");
  pill.className = "conf-pill";
  pill.dataset.color = meta?.color || "slate";
  pill.textContent = text;
  pill.title = meta?.description || "";
  return pill;
}

function normalizeConfidenceValue(value) {
  if (!value) {
    return "Unknown";
  }
  const raw = String(value).trim();
  const canonical = CONFIDENCE_ALIASES[raw] || raw;

  if (state.confidenceByKey && state.confidenceByKey.has(canonical)) {
    return canonical;
  }

  const fallback = DEFAULT_CONFIDENCE_SCALE.find((item) => item.key === canonical);
  return fallback ? fallback.key : "Unknown";
}

function confidenceRank(status) {
  const normalized = normalizeConfidenceValue(status);
  const match = state.confidenceByKey.get(normalized);
  return match ? match.rank : 0;
}

function daysSince(dateString, now) {
  if (!dateString) {
    return null;
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function valueOrDash(value, suffix) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return suffix ? `${value} ${suffix}` : String(value);
}

function nullHigh(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 999;
  }
  return value;
}

function formatCurrency(value) {
  const number = toNumber(value, 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(number);
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toTitleCase(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function persistSaved() {
  localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify([...state.saved]));
}

function persistCompare() {
  localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify([...state.compare]));
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.notes));
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.taskChecks));
}

function persistChecklist() {
  localStorage.setItem(STORAGE_KEYS.checklist, JSON.stringify(state.checklist));
}

function persistFilters() {
  localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(state.filters));
}

function persistWeights() {
  localStorage.setItem(STORAGE_KEYS.weights, JSON.stringify(state.weights));
}

function persistMode() {
  localStorage.setItem(STORAGE_KEYS.mode, state.showAllInMonthly ? "allIn" : "base");
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed to parse persisted key ${key}`, err);
    return fallback;
  }
}
