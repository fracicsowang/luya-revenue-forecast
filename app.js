const years = [2026, 2027, 2028, 2029, 2030];
const stages = ["Validate", "Prove PMF", "Scale", "Expand", "Expand"];

const defaultModel = {
  tam: 30000000,
  startingCash: 1800000,
  founderUnits: 100,
  validationSpend: 250000,
  products: {
    space: { name: "X1 Space", asp: 899, cogs: 399 },
    lab: { name: "X1 Lab", asp: 1499, cogs: 650 },
    y: { name: "Luya Y / B2B", asp: 4999, cogs: 2200 },
  },
  units: {
    lab: [0, 5000, 15000, 35000, 65000],
    y: [0, 1000, 2500, 5000, 8000],
  },
  gtm: {
    founder: { label: "Founder / Waitlist / Organic", values: [100, 2000, 4000, 7000, 10000] },
    kol: { label: "KOL / KOC / Affiliate", values: [0, 4000, 12000, 25000, 40000] },
    paid: { label: "Meta / Google / Performance", values: [0, 4000, 14000, 32000, 60000] },
    amazon: { label: "Amazon / Marketplace", values: [0, 2000, 7000, 18000, 35000] },
    organic: { label: "PR / Organic / Referral", values: [0, 1500, 4000, 8000, 14000] },
    retail: { label: "Retail / Distributor / Other", values: [0, 1500, 4000, 10000, 21000] },
  },
  plans: {
    standard: { price: 29, cogs: 9, trays: 8 },
    power: { price: 50, cogs: 16, trays: 16 },
  },
  subscriptions: {
    space: { attach: 55, standardMix: 75, ret3: 85, ret6: 75, ret12: 65 },
    lab: { attach: 75, standardMix: 50, ret3: 90, ret6: 82, ret12: 75 },
  },
  opex: {
    teamHeadcount: 15,
    monthlySalaryRmb: 20000,
    monthlyRentRmb: 30000,
    monthlySpendCapRmb: 400000,
    usdCny: 7.2,
    teamGrowth: 20,
    salesMarketingRates: [0, 35, 28, 22, 18],
    rdPct: 8,
    gaPct: 6,
    supportCost: 24,
  },
};

const scenarioConfig = {
  bear: { label: "Bear", unitScale: 0.75, attachDelta: -8, retentionDelta: -5, cogsScale: 1.05, smDelta: 4 },
  base: { label: "Base", unitScale: 1, attachDelta: 0, retentionDelta: 0, cogsScale: 1, smDelta: 0 },
  bull: { label: "Bull", unitScale: 1.25, attachDelta: 5, retentionDelta: 3, cogsScale: 0.97, smDelta: -2 },
};

let model = structuredClone(defaultModel);
let activeScenario = "base";

const inputBindings = {
  tam: ["tam"],
  startingCash: ["startingCash"],
  founderUnits: ["founderUnits"],
  validationSpend: ["validationSpend"],
  spaceAsp: ["products", "space", "asp"],
  spaceCogs: ["products", "space", "cogs"],
  labAsp: ["products", "lab", "asp"],
  labCogs: ["products", "lab", "cogs"],
  yAsp: ["products", "y", "asp"],
  yCogs: ["products", "y", "cogs"],
  standardPrice: ["plans", "standard", "price"],
  standardCogs: ["plans", "standard", "cogs"],
  powerPrice: ["plans", "power", "price"],
  powerCogs: ["plans", "power", "cogs"],
  spaceAttach: ["subscriptions", "space", "attach"],
  spaceStandardMix: ["subscriptions", "space", "standardMix"],
  spaceRet3: ["subscriptions", "space", "ret3"],
  spaceRet6: ["subscriptions", "space", "ret6"],
  spaceRet12: ["subscriptions", "space", "ret12"],
  labAttach: ["subscriptions", "lab", "attach"],
  labStandardMix: ["subscriptions", "lab", "standardMix"],
  labRet3: ["subscriptions", "lab", "ret3"],
  labRet6: ["subscriptions", "lab", "ret6"],
  labRet12: ["subscriptions", "lab", "ret12"],
  teamHeadcount: ["opex", "teamHeadcount"],
  monthlySalaryRmb: ["opex", "monthlySalaryRmb"],
  monthlyRentRmb: ["opex", "monthlyRentRmb"],
  monthlySpendCapRmb: ["opex", "monthlySpendCapRmb"],
  usdCny: ["opex", "usdCny"],
  teamGrowth: ["opex", "teamGrowth"],
  rdPct: ["opex", "rdPct"],
  gaPct: ["opex", "gaPct"],
  supportCost: ["opex", "supportCost"],
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function getPath(object, path) {
  return path.reduce((value, key) => value[key], object);
}

function setPath(object, path, value) {
  const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
  parent[path.at(-1)] = value;
}

function money(value, digits = 1) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(digits)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function number(value) {
  return Math.round(value).toLocaleString("en-US");
}

function compactNumber(value) {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(value >= 100000 ? 0 : 1)}K`;
  return number(value);
}

function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function annualTeamCost(sourceModel) {
  const opex = sourceModel.opex;
  const payrollAndRent = opex.teamHeadcount * opex.monthlySalaryRmb + opex.monthlyRentRmb;
  const monthlySpend = Math.min(payrollAndRent, opex.monthlySpendCapRmb);
  return (monthlySpend * 12) / Math.max(opex.usdCny, 0.1);
}

function spaceBaseUnits(sourceModel) {
  return years.map((_, index) => {
    if (index === 0) return sourceModel.founderUnits;
    return Object.values(sourceModel.gtm).reduce((total, channel) => total + channel.values[index], 0);
  });
}

function planEconomics(sourceModel, subscription) {
  const standardMix = clamp(subscription.standardMix / 100);
  const powerMix = 1 - standardMix;
  const monthlyRevenue = standardMix * sourceModel.plans.standard.price + powerMix * sourceModel.plans.power.price;
  const monthlyCogs = standardMix * sourceModel.plans.standard.cogs + powerMix * sourceModel.plans.power.cogs;
  return { annualRevenue: monthlyRevenue * 12, annualCogs: monthlyCogs * 12 };
}

function adjustedSubscription(subscription, scenario) {
  return {
    attach: clamp((subscription.attach + scenario.attachDelta) / 100),
    ret3: clamp((subscription.ret3 + scenario.retentionDelta) / 100),
    ret6: clamp((subscription.ret6 + scenario.retentionDelta) / 100),
    ret12: clamp((subscription.ret12 + scenario.retentionDelta) / 100),
    standardMix: subscription.standardMix,
  };
}

function calculateForecast(sourceModel, scenarioName = activeScenario) {
  const scenario = scenarioConfig[scenarioName];
  const rawSpaceUnits = spaceBaseUnits(sourceModel);
  const units = {
    space: rawSpaceUnits.map((value, index) => index === 0 ? sourceModel.founderUnits : Math.round(value * scenario.unitScale)),
    lab: sourceModel.units.lab.map((value, index) => index === 0 ? 0 : Math.round(value * scenario.unitScale)),
    y: sourceModel.units.y.map((value, index) => index === 0 ? 0 : Math.round(value * scenario.unitScale)),
  };

  const subscriptions = {
    space: adjustedSubscription(sourceModel.subscriptions.space, scenario),
    lab: adjustedSubscription(sourceModel.subscriptions.lab, scenario),
  };
  const economics = {
    space: planEconomics(sourceModel, sourceModel.subscriptions.space),
    lab: planEconomics(sourceModel, sourceModel.subscriptions.lab),
  };

  let activeSubs = { space: 0, lab: 0 };
  let cash = sourceModel.startingCash;
  let installedBase = 0;
  const rows = [];

  years.forEach((year, index) => {
    const commercialSpaceUnits = index === 0 ? 0 : units.space[index];
    const commercialLabUnits = index === 0 ? 0 : units.lab[index];
    const commercialYUnits = index === 0 ? 0 : units.y[index];
    const productUnits = { space: commercialSpaceUnits, lab: commercialLabUnits, y: commercialYUnits };
    const cDeviceUnits = commercialSpaceUnits + commercialLabUnits;
    const totalUnits = cDeviceUnits + commercialYUnits;
    installedBase += cDeviceUnits;

    const hardware = {};
    let hardwareRevenue = 0;
    let hardwareCogs = 0;
    ["space", "lab", "y"].forEach((key) => {
      const product = sourceModel.products[key];
      const revenue = productUnits[key] * product.asp;
      const cogs = productUnits[key] * product.cogs * scenario.cogsScale;
      hardware[key] = { units: productUnits[key], revenue, cogs, grossProfit: revenue - cogs };
      hardwareRevenue += revenue;
      hardwareCogs += cogs;
    });

    const consumables = {};
    let consumablesRevenue = 0;
    let consumablesCogs = 0;
    ["space", "lab"].forEach((key) => {
      const subscription = subscriptions[key];
      const plan = economics[key];
      const beginningActive = activeSubs[key];
      const newAttached = productUnits[key] * subscription.attach;
      const firstYearRetentionIndex = 0.25 + 0.5 * subscription.ret3 + 0.25 * subscription.ret6;
      const newCohortRevenueFactor = 0.5 * firstYearRetentionIndex;
      const existingRevenueFactor = (1 + subscription.ret12) / 2;
      const revenue = newAttached * plan.annualRevenue * newCohortRevenueFactor + beginningActive * plan.annualRevenue * existingRevenueFactor;
      const cogs = newAttached * plan.annualCogs * newCohortRevenueFactor + beginningActive * plan.annualCogs * existingRevenueFactor;
      const endingActive = beginningActive * subscription.ret12 + newAttached * subscription.ret6;
      consumables[key] = { beginningActive, newAttached, endingActive, revenue, cogs };
      activeSubs[key] = endingActive;
      consumablesRevenue += revenue;
      consumablesCogs += cogs;
    });

    const totalRevenue = hardwareRevenue + consumablesRevenue;
    const grossProfit = totalRevenue - hardwareCogs - consumablesCogs;
    const teamExpense = annualTeamCost(sourceModel) * Math.pow(1 + sourceModel.opex.teamGrowth / 100, index);
    const smRate = index === 0 ? 0 : clamp((sourceModel.opex.salesMarketingRates[index] + scenario.smDelta) / 100, 0, 0.8);
    const salesMarketingExpense = totalRevenue * smRate;
    const rdExpense = totalRevenue * sourceModel.opex.rdPct / 100;
    const gaExpense = totalRevenue * sourceModel.opex.gaPct / 100;
    const supportExpense = (activeSubs.space + activeSubs.lab) * sourceModel.opex.supportCost;
    const validationExpense = index === 0
      ? sourceModel.validationSpend + sourceModel.founderUnits * sourceModel.products.space.cogs * scenario.cogsScale
      : 0;
    const operatingExpenses = teamExpense + salesMarketingExpense + rdExpense + gaExpense + supportExpense + validationExpense;
    const operatingProfit = grossProfit - operatingExpenses;
    const beginningCash = cash;
    cash += operatingProfit;

    rows.push({
      year,
      stage: stages[index],
      units: productUnits,
      cDeviceUnits,
      totalUnits,
      installedBase,
      hardware,
      hardwareRevenue,
      hardwareCogs,
      consumables,
      activeSubscribers: activeSubs.space + activeSubs.lab,
      consumablesRevenue,
      consumablesCogs,
      totalRevenue,
      grossProfit,
      grossMargin: totalRevenue ? grossProfit / totalRevenue : 0,
      recurringMix: totalRevenue ? consumablesRevenue / totalRevenue : 0,
      opex: { teamExpense, salesMarketingExpense, rdExpense, gaExpense, supportExpense, validationExpense, operatingExpenses, smRate },
      operatingProfit,
      beginningCash,
      endingCash: cash,
      tamPenetration: sourceModel.tam ? cDeviceUnits / sourceModel.tam : 0,
    });
  });

  return { rows, units, rawSpaceUnits, subscriptions, economics, scenarioName };
}

function syncInputs() {
  Object.entries(inputBindings).forEach(([id, path]) => {
    const element = document.getElementById(id);
    if (element) element.value = getPath(model, path);
  });
  document.getElementById("teamCostPreview").textContent = money(annualTeamCost(model));
}

function renderKpis(forecast) {
  const launch = forecast.rows[1];
  const scale = forecast.rows[2];
  const terminal = forecast.rows[4];
  document.getElementById("kpi2027Units").textContent = compactNumber(launch.totalUnits);
  document.getElementById("kpi2027Revenue").textContent = money(launch.totalRevenue);
  document.getElementById("kpi2027Recurring").textContent = `${percent(launch.recurringMix)} recurring`;
  document.getElementById("kpi2028Units").textContent = compactNumber(scale.totalUnits);
  document.getElementById("kpiRecurringMix").textContent = percent(terminal.recurringMix);
  document.getElementById("kpiInstalledBase").textContent = `${compactNumber(terminal.installedBase)} installed C-devices`;
  document.getElementById("kpiTamPenetration").textContent = percent(terminal.tamPenetration, 2);
}

function renderExecutive(forecast) {
  document.getElementById("executiveRows").innerHTML = forecast.rows.map((row) => `
    <tr class="${row.year === 2026 ? "validation-row" : ""}">
      <td><strong>${row.year}</strong></td>
      <td><span class="stage-label">${row.stage}</span></td>
      <td>${row.year === 2026 ? "Founder 100" : number(row.totalUnits)}</td>
      <td>${money(row.hardwareRevenue)}</td>
      <td>${money(row.consumablesRevenue)}</td>
      <td><strong>${money(row.totalRevenue)}</strong></td>
      <td>${money(row.grossProfit)}</td>
      <td>${percent(row.recurringMix)}</td>
      <td class="${row.endingCash < 0 ? "negative" : "positive"}">${money(row.endingCash)}</td>
    </tr>`).join("");
  const breakEven = forecast.rows.find((row) => row.year > 2026 && row.operatingProfit >= 0);
  document.getElementById("breakEvenBadge").textContent = breakEven ? `Operating break-even · ${breakEven.year}` : "No break-even in forecast";
}

function unitCell(product, index, displayedValue) {
  if (index === 0) return product === "space" ? `${number(model.founderUnits)} validation` : product === "lab" ? "Engineering" : "Pilot";
  if (product === "space") return `<strong>${number(displayedValue)}</strong><small>from GTM build-up</small>`;
  const baseValue = model.units[product][index];
  if (activeScenario === "base") {
    return `<input class="table-input unit-input" type="number" min="0" step="500" data-product="${product}" data-year-index="${index}" value="${baseValue}" />`;
  }
  return `<strong>${number(displayedValue)}</strong><small>${number(baseValue)} base</small>`;
}

function renderProductModel(forecast) {
  const productKeys = ["space", "lab", "y"];
  document.getElementById("productRows").innerHTML = productKeys.map((key) => {
    const product = model.products[key];
    const terminal = forecast.rows[4].hardware[key];
    const gm = terminal.revenue ? terminal.grossProfit / terminal.revenue : 0;
    return `<tr><td><strong>${product.name}</strong><small>${key === "space" ? "Mass premium consumer" : key === "lab" ? "Health / longevity / biohacking" : "B2B platform"}</small></td>${years.map((_, index) => `<td>${unitCell(key, index, forecast.units[key][index])}</td>`).join("")}<td>$${number(product.asp)}</td><td>${percent(gm)}</td></tr>`;
  }).join("");

  const launch = forecast.rows[1];
  const cHardware = launch.hardware.space.revenue + launch.hardware.lab.revenue;
  const labShare = cHardware ? launch.hardware.lab.revenue / cHardware : 0;
  document.getElementById("productCallouts").innerHTML = `
    <article><span>2027 C-device hardware revenue</span><strong>${money(cHardware)}</strong></article>
    <article><span>Lab share of C-device units</span><strong>${percent(launch.units.lab / Math.max(launch.cDeviceUnits, 1))}</strong></article>
    <article><span>Lab share of C-device hardware revenue</span><strong>${percent(labShare)}</strong></article>
    <article><span>2027 B2B hardware revenue</span><strong>${money(launch.hardware.y.revenue)}</strong></article>`;
}

function renderWaterfall(forecast) {
  const launch = forecast.rows[1];
  const components = [
    { label: "Space Hardware", value: launch.hardware.space.revenue, color: "blue" },
    { label: "Lab Hardware", value: launch.hardware.lab.revenue, color: "violet" },
    { label: "Luya Y / B2B", value: launch.hardware.y.revenue, color: "amber" },
    { label: "Consumables", value: launch.consumablesRevenue, color: "green" },
  ];
  const max = Math.max(...components.map((item) => item.value), 1);
  document.getElementById("waterfallTotal").textContent = `Total ${money(launch.totalRevenue)}`;
  document.getElementById("waterfallBars").innerHTML = components.map((item) => `
    <article><div class="waterfall-label"><span>${item.label}</span><strong>${money(item.value)}</strong></div><div class="bar-track"><div class="bar-fill ${item.color}" style="width:${item.value / max * 100}%"></div></div></article>`).join("") +
    `<article class="waterfall-total"><div class="waterfall-label"><span>Total 2027 Revenue</span><strong>${money(launch.totalRevenue)}</strong></div></article>`;
}

function renderConsumables(forecast) {
  const summary = ["space", "lab"].map((key) => {
    const subscription = forecast.subscriptions[key];
    const plan = forecast.economics[key];
    const original = model.subscriptions[key];
    return `<article><div><span>${model.products[key].name}</span><strong>${money(plan.annualRevenue, 0)} blended annual plan</strong></div><dl><dt>Attach</dt><dd>${percent(subscription.attach)}</dd><dt>Plan mix</dt><dd>${original.standardMix}% Standard / ${100 - original.standardMix}% Power</dd><dt>Retention</dt><dd>${percent(subscription.ret3, 0)} · ${percent(subscription.ret6, 0)} · ${percent(subscription.ret12, 0)}</dd></dl></article>`;
  }).join("");
  document.getElementById("subscriptionSummary").innerHTML = summary;
  document.getElementById("cohortRows").innerHTML = forecast.rows.map((row) => `
    <tr><td><strong>${row.year}</strong></td><td>${row.year === 2026 ? "—" : number(row.cDeviceUnits)}</td><td>${number(row.installedBase)}</td><td>${number(row.activeSubscribers)}</td><td><strong>${money(row.consumablesRevenue)}</strong></td><td>${percent(row.recurringMix)}</td></tr>`).join("");
}

function renderGtm(forecast) {
  document.getElementById("gtmRows").innerHTML = Object.entries(model.gtm).map(([key, channel]) => `
    <tr><td><strong>${channel.label}</strong></td>${years.map((_, index) => `<td>${index === 0 && key !== "founder" ? "—" : `<input class="table-input gtm-input" type="number" min="0" step="500" data-channel="${key}" data-year-index="${index}" value="${index === 0 && key === "founder" ? model.founderUnits : channel.values[index]}" ${index === 0 ? "disabled" : ""} />`}</td>`).join("")}</tr>`).join("");
  document.getElementById("gtmFooter").innerHTML = `<tr><th>Base channel total</th>${forecast.rawSpaceUnits.map((value) => `<th>${number(value)}</th>`).join("")}</tr>${activeScenario === "base" ? "" : `<tr><th>${scenarioConfig[activeScenario].label} adjusted units</th>${forecast.units.space.map((value) => `<th>${number(value)}</th>`).join("")}</tr>`}`;
}

function renderInvestorView(forecast) {
  const terminal = forecast.rows[4];
  const lowestCash = forecast.rows.reduce((lowest, row) => row.endingCash < lowest.endingCash ? row : lowest, forecast.rows[0]);
  const fundingNeed = Math.max(0, -lowestCash.endingCash);
  const breakEven = forecast.rows.find((row) => row.year > 2026 && row.operatingProfit >= 0);
  document.getElementById("investorTam").textContent = percent(terminal.tamPenetration, 2);
  document.getElementById("investorInstalled").textContent = compactNumber(terminal.installedBase);
  document.getElementById("investorFunding").textContent = money(fundingNeed);
  document.getElementById("investorFundingYear").textContent = fundingNeed ? `Peak gap in ${lowestCash.year}` : "No funding gap in forecast";
  document.getElementById("investorBreakEven").textContent = breakEven ? breakEven.year : "Beyond 2030";

  document.getElementById("scenarioComparison").innerHTML = ["bear", "base", "bull"].map((name) => {
    const result = calculateForecast(model, name);
    const end = result.rows[4];
    const low = result.rows.reduce((lowest, row) => row.endingCash < lowest.endingCash ? row : lowest, result.rows[0]);
    return `<article class="${name === activeScenario ? "active" : ""}"><span>${scenarioConfig[name].label}</span><strong>${money(end.totalRevenue)}</strong><small>2030 revenue</small><dl><dt>Recurring</dt><dd>${percent(end.recurringMix)}</dd><dt>2030 units</dt><dd>${compactNumber(end.totalUnits)}</dd><dt>Funding need</dt><dd>${money(Math.max(0, -low.endingCash))}</dd></dl></article>`;
  }).join("");
}

function render() {
  const forecast = calculateForecast(model);
  renderKpis(forecast);
  renderExecutive(forecast);
  renderProductModel(forecast);
  renderWaterfall(forecast);
  renderConsumables(forecast);
  renderGtm(forecast);
  renderInvestorView(forecast);
  document.getElementById("teamCostPreview").textContent = money(annualTeamCost(model));
  document.querySelectorAll("[data-scenario]").forEach((button) => button.classList.toggle("active", button.dataset.scenario === activeScenario));
}

Object.entries(inputBindings).forEach(([id, path]) => {
  document.getElementById(id)?.addEventListener("input", (event) => {
    setPath(model, path, Number(event.target.value) || 0);
    render();
  });
});

document.addEventListener("input", (event) => {
  if (event.target.matches(".unit-input")) {
    model.units[event.target.dataset.product][Number(event.target.dataset.yearIndex)] = Number(event.target.value) || 0;
    render();
  }
  if (event.target.matches(".gtm-input")) {
    model.gtm[event.target.dataset.channel].values[Number(event.target.dataset.yearIndex)] = Number(event.target.value) || 0;
    render();
  }
});

document.querySelectorAll("[data-scenario]").forEach((button) => {
  button.addEventListener("click", () => {
    activeScenario = button.dataset.scenario;
    render();
  });
});

document.getElementById("resetButton").addEventListener("click", () => {
  model = structuredClone(defaultModel);
  activeScenario = "base";
  syncInputs();
  render();
});

syncInputs();
render();
