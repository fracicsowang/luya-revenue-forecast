/* ============================================================================
   LUYA 5-Year Growth Model
   Bottom-up 2026–2030 forecast: product lines, channel net pricing, consumables
   cohorts, CAC-driven S&M, working capital, tax and a cash bridge.
   ========================================================================== */

const years = [2026, 2027, 2028, 2029, 2030];
const stageText = [
  ["Validate", "验证"],
  ["Prove PMF", "验证PMF"],
  ["Scale", "规模化"],
  ["Expand", "扩张"],
  ["Expand", "扩张"],
];

/* Chart series colours. Validated with the dataviz palette validator on a white
   surface: adjacent CVD ΔE 9.1 (≥8), normal-vision ΔE 22.9 (≥15). Aqua and
   yellow sit below 3:1 contrast, so every chart ships a legend, direct value
   labels and a full data table underneath. */
const SERIES = {
  space: "#2a78d6",
  lab: "#eb6834",
  y: "#1baf7a",
  consumables: "#eda100",
  cash: "#2a78d6",
  flow: "#eb6834",
  installed: "#2a78d6",
  subs: "#eb6834",
  decrease: "#e34948",
};

const defaultModel = {
  tam: 30000000,
  startingCash: 1200000,
  /* The Founder 100 splits three ways: a validation cohort with itemised RMB
     spend, units gifted to KOLs, and units sold at list price. Only the sold
     units book revenue and enter the consumables cohort. */
  founder: {
    /* Tooling only happens after the Founder 100, so every 2026 unit is a
       small-batch build at this cost — not the mass-production BOM. */
    preToolingUnitCostRmb: 10000,
    validationUnits: 30,
    validationLogisticsRmb: 300000,
    validationOtherRmb: 400000,
    kolUnits: 30,
    /* A KOL unit costs the same hardware as any other 2026 unit, plus a
       promotion fee on top. Deriving the hardware half keeps it in step with
       preToolingUnitCostRmb instead of being frozen inside an all-in number. */
    kolPromoPerUnitRmb: 5000,
    paidUnits: 40,
  },
  /* Tooling is a step cost, not a run rate: one spend per mould, in the year it
     is cut. 2026 for X1 Space, 2027 for X1 Lab, nothing after. Indexed by year. */
  capexRmb: [1500000, 1500000, 0, 0, 0],
  /* What-if multipliers laid over the base plan (100 = plan as written), so the
     volume sliders never overwrite the channel build-up underneath. */
  drivers: { spaceUnits: 100, labUnits: 100, yUnits: 100 },
  products: {
    space: { name: "X1 Space", asp: 599, cogs: 120, cac: 200, net: 100 },
    lab: { name: "X1 Lab", asp: 999, cogs: 350, cac: 200, net: 100 },
    y: { name: "Luya Y", asp: 5500, cogs: 2000, cac: 1000, net: 100 },
  },
  units: {
    lab: [0, 5000, 15000, 35000, 65000],
    y: [0, 1000, 2500, 5000, 8000],
  },
  gtm: {
    founder: { en: "Founder / waitlist / organic", zh: "创始用户、候补名单与自然流量", net: 100, values: [100, 2000, 4000, 7000, 10000] },
    kol: { en: "KOL / KOC / affiliate", zh: "达人、口碑与联盟", net: 100, values: [0, 4000, 12000, 25000, 40000] },
    paid: { en: "Meta / Google / performance", zh: "绩效广告投放", net: 100, values: [0, 4000, 14000, 32000, 60000] },
    amazon: { en: "Amazon / marketplace", zh: "亚马逊与电商平台", net: 85, values: [0, 2000, 7000, 18000, 35000] },
    organic: { en: "PR / organic / referral", zh: "公关、自然流量与推荐", net: 100, values: [0, 1500, 4000, 8000, 14000] },
    retail: { en: "Retail / distributor / other", zh: "零售、经销与其他", net: 60, values: [0, 1500, 4000, 10000, 21000] },
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
    rdPct: 15,
    gaPct: 6,
    supportCost: 24,
  },
  finance: {
    inventoryDays: 60,
    dso: 45,
    dpo: 60,
    warrantyPct: 3,
    taxRate: 25,
  },
};

const scenarioConfig = {
  bear: { en: "Bear", zh: "保守", unitScale: 0.75, aspDelta: -5, cacScale: 1.2, attachDelta: -8, retentionDelta: -5, cogsScale: 1.05 },
  base: { en: "Base", zh: "基准", unitScale: 1, aspDelta: 0, cacScale: 1, attachDelta: 0, retentionDelta: 0, cogsScale: 1 },
  bull: { en: "Bull", zh: "乐观", unitScale: 1.25, aspDelta: 0, cacScale: 0.9, attachDelta: 5, retentionDelta: 3, cogsScale: 0.97 },
};

/* Bump this whenever the default assumptions or the model schema change —
   otherwise a saved model from a previous session is merged over the new
   defaults and silently keeps the old numbers. */
const STORAGE_KEY = "luya-forecast-v7";

let model = structuredClone(defaultModel);
let activeScenario = "base";
let lang = "zh";
let waterfallYear = 2027;

/* ------------------------------------------------------------------ i18n -- */

function t(en, zh) {
  if (lang === "en") return en;
  if (lang === "zh") return zh;
  return `${en} / ${zh}`;
}

function applyLang() {
  document.body.dataset.lang = lang;
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.querySelectorAll(".t").forEach((el) => {
    el.textContent = t(el.dataset.en, el.dataset.zh);
  });
  document.querySelectorAll("[data-aria-en]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.ariaEn, el.dataset.ariaZh));
  });
  document.querySelectorAll("[data-lang-set]").forEach((button) => {
    button.classList.toggle("active", button.dataset.langSet === lang);
  });
}

/* --------------------------------------------------------------- helpers -- */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const getPath = (object, path) => path.reduce((value, key) => value[key], object);

function setPath(object, path, value) {
  const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
  parent[path.at(-1)] = value;
}

function money(value, digits = 1) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(digits)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const number = (value) => Math.round(value).toLocaleString("en-US");

function compactNumber(value) {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(Math.abs(value) >= 100000 ? 0 : 1)}K`;
  return number(value);
}

const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const rmbToUsd = (sourceModel, rmb) => rmb / Math.max(sourceModel.opex.usdCny, 0.1);

const founderTotalUnits = (sourceModel) =>
  sourceModel.founder.validationUnits + sourceModel.founder.kolUnits + sourceModel.founder.paidUnits;

/* Every RMB line of the Founder 100 programme, in USD. Validation hardware is
   derived from the pre-tooling unit cost so the two can never drift apart. The
   per-unit KOL budget is all-in — it already covers that unit's hardware. */
function founderProgramCost(sourceModel) {
  const f = sourceModel.founder;
  return rmbToUsd(
    sourceModel,
    f.validationUnits * f.preToolingUnitCostRmb +
      f.validationLogisticsRmb +
      f.validationOtherRmb +
      f.kolUnits * (f.preToolingUnitCostRmb + f.kolPromoPerUnitRmb)
  );
}

function annualTeamCost(sourceModel) {
  const opex = sourceModel.opex;
  const payrollAndRent = opex.teamHeadcount * opex.monthlySalaryRmb + opex.monthlyRentRmb;
  const monthlySpend = Math.min(payrollAndRent, opex.monthlySpendCapRmb);
  return (monthlySpend * 12) / Math.max(opex.usdCny, 0.1);
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

/* ---------------------------------------------------------------- engine -- */

function calculateForecast(sourceModel, scenarioName = activeScenario) {
  const scenario = scenarioConfig[scenarioName];
  const finance = sourceModel.finance;
  const aspFactor = 1 + scenario.aspDelta / 100;

  /* Space units come from the channel build-up; index 0 is the Founder cohort
     and carries no commercial revenue. */
  /* In 2026 the only revenue-generating units are the Founder 100 units sold at
     list price; they run through the direct "founder" channel at 100% net price.
     Validation and KOL units ship too, but their cost is booked as programme
     spend and they generate no revenue. */
  /* The what-if multipliers are applied per channel, not to the total, so the
     channel mix — and therefore the blended net-price factor — stays intact.
     2026 is the fixed Founder cohort and is never scaled. */
  const drivers = sourceModel.drivers;
  const channelUnits = years.map((_, index) =>
    Object.fromEntries(
      Object.entries(sourceModel.gtm).map(([key, channel]) => [
        key,
        index === 0
          ? key === "founder"
            ? sourceModel.founder.paidUnits
            : 0
          : Math.round(channel.values[index] * scenario.unitScale * (drivers.spaceUnits / 100)),
      ])
    )
  );

  const units = {
    space: channelUnits.map((row) => Object.values(row).reduce((a, b) => a + b, 0)),
    lab: sourceModel.units.lab.map((value, index) => (index === 0 ? 0 : Math.round(value * scenario.unitScale * (drivers.labUnits / 100)))),
    y: sourceModel.units.y.map((value, index) => (index === 0 ? 0 : Math.round(value * scenario.unitScale * (drivers.yUnits / 100)))),
  };
  const rawSpaceUnits = years.map((_, index) =>
    index === 0 ? sourceModel.founder.paidUnits : Object.values(sourceModel.gtm).reduce((total, channel) => total + channel.values[index], 0)
  );

  const subscriptions = {
    space: adjustedSubscription(sourceModel.subscriptions.space, scenario),
    lab: adjustedSubscription(sourceModel.subscriptions.lab, scenario),
  };
  const economics = {
    space: planEconomics(sourceModel, sourceModel.subscriptions.space),
    lab: planEconomics(sourceModel, sourceModel.subscriptions.lab),
  };

  /* ---- pass 1: units, revenue, cost, EBITDA ---- */
  let activeSubs = { space: 0, lab: 0 };
  let installedBase = 0;
  const rows = [];

  years.forEach((year, index) => {
    const productUnits = {
      space: units.space[index],
      lab: index === 0 ? 0 : units.lab[index],
      y: index === 0 ? 0 : units.y[index],
    };
    const cDeviceUnits = productUnits.space + productUnits.lab;
    const totalUnits = cDeviceUnits + productUnits.y;
    installedBase += cDeviceUnits;

    /* Space net price is the channel-weighted realisation of list ASP. */
    const spaceListRevenue = productUnits.space * sourceModel.products.space.asp * aspFactor;
    const spaceChannelRevenue = Object.entries(sourceModel.gtm).reduce(
      (total, [key, channel]) => total + channelUnits[index][key] * sourceModel.products.space.asp * aspFactor * (channel.net / 100),
      0
    );
    const spaceChannelFactor = spaceListRevenue ? spaceChannelRevenue / spaceListRevenue : 1;
    const netFactor = {
      space: spaceChannelFactor * (sourceModel.products.space.net / 100),
      lab: sourceModel.products.lab.net / 100,
      y: sourceModel.products.y.net / 100,
    };

    const hardware = {};
    let hardwareRevenue = 0;
    let hardwareCogs = 0;
    ["space", "lab", "y"].forEach((key) => {
      const product = sourceModel.products[key];
      const netAsp = product.asp * aspFactor * netFactor[key];
      const revenue = productUnits[key] * netAsp;
      /* Tooling lands between the Founder 100 and the 2027 launch, so 2026 units
         are built in small batches at a known cost — well above the BOM, and not
         scaled by the scenario since it is already a committed number. */
      const unitCost =
        index === 0 ? rmbToUsd(sourceModel, sourceModel.founder.preToolingUnitCostRmb) : product.cogs * scenario.cogsScale;
      const cogs = productUnits[key] * unitCost;
      hardware[key] = { units: productUnits[key], netAsp, unitCost, revenue, cogs, grossProfit: revenue - cogs };
      hardwareRevenue += revenue;
      hardwareCogs += cogs;
    });
    const warrantyCost = hardwareRevenue * (finance.warrantyPct / 100);

    const consumables = {};
    let consumablesRevenue = 0;
    let consumablesCogs = 0;
    let averageActive = 0;
    ["space", "lab"].forEach((key) => {
      const subscription = subscriptions[key];
      const plan = economics[key];
      const beginningActive = activeSubs[key];
      const newAttached = productUnits[key] * subscription.attach;
      const firstYearRetentionIndex = 0.25 + 0.5 * subscription.ret3 + 0.25 * subscription.ret6;
      const newCohortFactor = 0.5 * firstYearRetentionIndex;
      const existingFactor = (1 + subscription.ret12) / 2;
      const revenue = newAttached * plan.annualRevenue * newCohortFactor + beginningActive * plan.annualRevenue * existingFactor;
      const cogs = newAttached * plan.annualCogs * newCohortFactor + beginningActive * plan.annualCogs * existingFactor;
      const endingActive = beginningActive * subscription.ret12 + newAttached * subscription.ret6;
      consumables[key] = { beginningActive, newAttached, endingActive, revenue, cogs };
      activeSubs[key] = endingActive;
      consumablesRevenue += revenue;
      consumablesCogs += cogs;
      averageActive += (beginningActive + endingActive) / 2;
    });

    const totalRevenue = hardwareRevenue + consumablesRevenue;
    const totalCogs = hardwareCogs + warrantyCost + consumablesCogs;
    const grossProfit = totalRevenue - totalCogs;

    /* No paid acquisition in 2026 — the Founder 100 comes from the waitlist and
       its cost is itemised in the programme spend instead. */
    const salesMarketingExpense =
      index === 0
        ? 0
        : ["space", "lab", "y"].reduce((total, key) => total + productUnits[key] * sourceModel.products[key].cac * scenario.cacScale, 0);
    const teamExpense = annualTeamCost(sourceModel) * Math.pow(1 + sourceModel.opex.teamGrowth / 100, index);
    const rdExpense = totalRevenue * (sourceModel.opex.rdPct / 100);
    const gaExpense = totalRevenue * (sourceModel.opex.gaPct / 100);
    const supportExpense = averageActive * sourceModel.opex.supportCost;
    const validationExpense = index === 0 ? founderProgramCost(sourceModel) : 0;
    const operatingExpenses = teamExpense + salesMarketingExpense + rdExpense + gaExpense + supportExpense + validationExpense;
    const ebitda = grossProfit - operatingExpenses;

    rows.push({
      year,
      stage: t(stageText[index][0], stageText[index][1]),
      units: productUnits,
      cDeviceUnits,
      totalUnits,
      installedBase,
      netFactor,
      spaceChannelFactor,
      hardware,
      hardwareRevenue,
      hardwareCogs,
      warrantyCost,
      consumables,
      activeSubscribers: activeSubs.space + activeSubs.lab,
      consumablesRevenue,
      consumablesCogs,
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMargin: totalRevenue ? grossProfit / totalRevenue : 0,
      recurringMix: totalRevenue ? consumablesRevenue / totalRevenue : 0,
      opex: { teamExpense, salesMarketingExpense, rdExpense, gaExpense, supportExpense, validationExpense, operatingExpenses },
      ebitda,
      ebitdaMargin: totalRevenue ? ebitda / totalRevenue : 0,
      tamPenetration: sourceModel.tam ? cDeviceUnits / sourceModel.tam : 0,
      tamCumulative: sourceModel.tam ? installedBase / sourceModel.tam : 0,
    });
  });

  /* ---- pass 2: working capital, tax, capex, cash ----
     Inventory is built against NEXT year's cost of goods: a hardware company
     funds the ramp before it sells it. The terminal year reuses its own COGS. */
  let cash = sourceModel.startingCash;
  let lossCarryforward = 0;
  let previousNwc = 0;

  rows.forEach((row, index) => {
    const forwardCogs = rows[index + 1] ? rows[index + 1].totalCogs : row.totalCogs;
    const inventory = (forwardCogs / 365) * finance.inventoryDays;
    const receivables = (row.totalRevenue / 365) * finance.dso;
    const payables = (row.totalCogs / 365) * finance.dpo;
    const nwc = inventory + receivables - payables;
    const deltaNwc = nwc - previousNwc;
    previousNwc = nwc;

    let tax = 0;
    if (row.ebitda > 0) {
      const shielded = Math.min(row.ebitda, lossCarryforward);
      lossCarryforward -= shielded;
      tax = (row.ebitda - shielded) * (finance.taxRate / 100);
    } else {
      lossCarryforward += -row.ebitda;
    }

    const capex = rmbToUsd(sourceModel, sourceModel.capexRmb[index] || 0);
    const freeCashFlow = row.ebitda - tax - deltaNwc - capex;
    const beginningCash = cash;
    cash += freeCashFlow;

    Object.assign(row, {
      inventory,
      receivables,
      payables,
      nwc,
      deltaNwc,
      tax,
      capex,
      freeCashFlow,
      beginningCash,
      endingCash: cash,
      lossCarryforward,
    });
  });

  return { rows, units, rawSpaceUnits, channelUnits, subscriptions, economics, scenarioName, scenario };
}

/* ------------------------------------------------------- unit economics -- */

function unitEconomics(sourceModel, forecast, key) {
  const scenario = forecast.scenario;
  const product = sourceModel.products[key];
  const terminal = forecast.rows[4];
  const netAsp = product.asp * (1 + scenario.aspDelta / 100) * terminal.netFactor[key];
  const warranty = netAsp * (sourceModel.finance.warrantyPct / 100);
  const hardwareGp = netAsp - product.cogs * scenario.cogsScale - warranty;
  const cac = product.cac * scenario.cacScale;

  const subscription = forecast.subscriptions[key];
  let attach = 0;
  let subAnnualGp = 0;
  let life = 0;
  if (subscription) {
    const plan = forecast.economics[key];
    attach = subscription.attach;
    subAnnualGp = plan.annualRevenue - plan.annualCogs - sourceModel.opex.supportCost;
    life = Math.min(8, 1 / Math.max(1 - subscription.ret12, 0.125));
  }
  const ltv = hardwareGp + attach * subAnnualGp * life;
  const monthlySubGp = (attach * subAnnualGp) / 12;
  const gap = cac - hardwareGp;
  const paybackMonths = gap <= 0 ? 0 : monthlySubGp > 0 ? gap / monthlySubGp : Infinity;

  return { key, name: product.name, netAsp, hardwareGp, attach, subAnnualGp, life, ltv, cac, ratio: cac ? ltv / cac : Infinity, paybackMonths };
}

/* ---------------------------------------------------------------- charts -- */

function niceScale(min, max, count = 4) {
  if (min === max) {
    if (min === 0) return { min: 0, max: 1, ticks: [0, 1] };
    max = min > 0 ? min * 1.2 : 0;
    min = min > 0 ? 0 : min * 1.2;
  }
  const rawStep = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
  const normalised = rawStep / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = lo; value <= hi + step * 1e-6; value += step) ticks.push(Number(value.toPrecision(12)));
  return { min: lo, max: hi, ticks };
}

/* Rounded 4px data-end at the top, square at the baseline. */
function capRect(x, y, width, height, radius = 4) {
  if (height <= 0.5) return "";
  const r = Math.min(radius, height, width / 2);
  return `M${x} ${y + height}L${x} ${y + r}Q${x} ${y} ${x + r} ${y}L${x + width - r} ${y}Q${x + width} ${y} ${x + width} ${y + r}L${x + width} ${y + height}Z`;
}

function axisFrame(scale, plot, formatter) {
  return scale.ticks
    .map((tick) => {
      const y = plot.y(tick);
      const isZero = Math.abs(tick) < 1e-9;
      return `<line class="grid ${isZero ? "grid-zero" : ""}" x1="${plot.left}" x2="${plot.left + plot.width}" y1="${y}" y2="${y}" />
        <text class="axis-label" x="${plot.left - 10}" y="${y + 4}" text-anchor="end">${formatter(tick)}</text>`;
    })
    .join("");
}

function categoryLabels(categories, plot) {
  return categories
    .map((label, index) => `<text class="axis-label" x="${plot.left + plot.band * (index + 0.5)}" y="${plot.top + plot.height + 24}" text-anchor="middle">${label}</text>`)
    .join("");
}

function svgOpen(width, height, title) {
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="xMidYMid meet"><title>${escapeHtml(title)}</title>`;
}

function stackedColumnChart({ categories, series, title, formatter, height = 320, width = 660 }) {
  const pad = { top: 30, right: 18, bottom: 40, left: 68 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const scale = niceScale(0, Math.max(...totals, 1));
  const plot = {
    left: pad.left,
    top: pad.top,
    width: plotWidth,
    height: plotHeight,
    band: plotWidth / categories.length,
    y: (value) => pad.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight,
  };
  const barWidth = Math.min(24, plot.band * 0.5);

  let marks = "";
  let hits = "";
  categories.forEach((category, i) => {
    const x = plot.left + plot.band * (i + 0.5) - barWidth / 2;
    let cumulative = 0;
    const drawn = series.map((s, si) => ({ s, si, value: s.values[i] })).filter((entry) => entry.value > 0);
    drawn.forEach((entry, position) => {
      const bottom = plot.y(cumulative);
      const top = plot.y(cumulative + entry.value);
      cumulative += entry.value;
      const isTop = position === drawn.length - 1;
      /* 2px surface gap between touching segments */
      const y = isTop ? top : top + 2;
      const segmentHeight = bottom - y;
      marks += isTop
        ? `<path d="${capRect(x, y, barWidth, segmentHeight)}" fill="${entry.s.color}" />`
        : `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(segmentHeight, 0)}" fill="${entry.s.color}" />`;
    });
    if (totals[i] > 0) {
      marks += `<text class="value-label" x="${plot.left + plot.band * (i + 0.5)}" y="${plot.y(totals[i]) - 9}" text-anchor="middle">${formatter(totals[i])}</text>`;
    }
    const tip = `<b>${category}</b>` + series.map((s) => `<i style="background:${s.color}"></i>${s.label} <em>${formatter(s.values[i])}</em>`).join("") + `<hr><i class="blank"></i>${t("Total", "合计")} <em>${formatter(totals[i])}</em>`;
    hits += `<rect class="hit" x="${plot.left + plot.band * i}" y="${plot.top}" width="${plot.band}" height="${plot.height}" data-tip="${escapeHtml(tip)}" />`;
  });

  return `${svgOpen(width, height, title)}${axisFrame(scale, plot, formatter)}${marks}${categoryLabels(categories, plot)}${hits}</svg>`;
}

function comboCashChart({ categories, flows, cashLine, title, formatter, height = 320, width = 660 }) {
  const pad = { top: 30, right: 22, bottom: 40, left: 68 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const all = [...flows, ...cashLine, 0];
  const scale = niceScale(Math.min(...all), Math.max(...all));
  const plot = {
    left: pad.left,
    top: pad.top,
    width: plotWidth,
    height: plotHeight,
    band: plotWidth / categories.length,
    y: (value) => pad.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight,
  };
  const barWidth = Math.min(24, plot.band * 0.42);
  const zero = plot.y(0);

  /* The funding gap is the point of this chart and is usually small next to
     terminal cash, so the below-zero band is tinted to keep it visible. */
  let marks = "";
  if (zero < plot.top + plot.height - 0.5) {
    marks += `<rect class="danger-band" x="${plot.left}" y="${zero}" width="${plot.width}" height="${plot.top + plot.height - zero}" />`;
  }
  flows.forEach((value, i) => {
    const x = plot.left + plot.band * (i + 0.5) - barWidth / 2;
    const y = value >= 0 ? plot.y(value) : zero;
    const barHeight = Math.abs(plot.y(value) - zero);
    marks += value >= 0
      ? `<path d="${capRect(x, y, barWidth, barHeight)}" fill="${SERIES.flow}" />`
      : `<path d="${capRect(x, zero, barWidth, barHeight)}" fill="${SERIES.decrease}" transform="rotate(180 ${x + barWidth / 2} ${zero + barHeight / 2})" />`;
  });

  const points = cashLine.map((value, i) => [plot.left + plot.band * (i + 0.5), plot.y(value)]);
  marks += `<polyline class="series-line" points="${points.map((p) => p.join(",")).join(" ")}" stroke="${SERIES.cash}" />`;
  const troughIndex = cashLine.indexOf(Math.min(...cashLine));
  points.forEach(([x, y], i) => {
    marks += `<circle class="series-dot" cx="${x}" cy="${y}" r="4.5" fill="${SERIES.cash}" />`;
    if (i === troughIndex || i === points.length - 1) {
      marks += `<text class="value-label" x="${x}" y="${y - 12}" text-anchor="middle">${formatter(cashLine[i])}</text>`;
    }
  });

  let hits = "";
  categories.forEach((category, i) => {
    const tip = `<b>${category}</b><i style="background:${SERIES.flow}"></i>${t("Free cash flow", "自由现金流")} <em>${formatter(flows[i])}</em><i style="background:${SERIES.cash}"></i>${t("Ending cash", "年末现金")} <em>${formatter(cashLine[i])}</em>`;
    hits += `<rect class="hit" x="${plot.left + plot.band * i}" y="${plot.top}" width="${plot.band}" height="${plot.height}" data-tip="${escapeHtml(tip)}" />`;
  });

  return `${svgOpen(width, height, title)}${axisFrame(scale, plot, formatter)}${marks}${categoryLabels(categories, plot)}${hits}</svg>`;
}

function lineAreaChart({ categories, series, title, formatter, height = 300, width = 660 }) {
  const pad = { top: 28, right: 22, bottom: 40, left: 68 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const scale = niceScale(0, Math.max(...series.flatMap((s) => s.values), 1));
  const plot = {
    left: pad.left,
    top: pad.top,
    width: plotWidth,
    height: plotHeight,
    band: plotWidth / categories.length,
    y: (value) => pad.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight,
  };

  let marks = "";
  series.forEach((s) => {
    const points = s.values.map((value, i) => [plot.left + plot.band * (i + 0.5), plot.y(value)]);
    if (s.area) {
      const base = plot.y(scale.min);
      marks += `<polygon points="${points[0][0]},${base} ${points.map((p) => p.join(",")).join(" ")} ${points.at(-1)[0]},${base}" fill="${s.color}" opacity="0.1" />`;
    }
    marks += `<polyline class="series-line" points="${points.map((p) => p.join(",")).join(" ")}" stroke="${s.color}" />`;
    points.forEach(([x, y]) => {
      marks += `<circle class="series-dot" cx="${x}" cy="${y}" r="4.5" fill="${s.color}" />`;
    });
    const [lastX, lastY] = points.at(-1);
    marks += `<text class="value-label" x="${lastX}" y="${lastY - 12}" text-anchor="end">${formatter(s.values.at(-1))}</text>`;
  });

  let hits = "";
  categories.forEach((category, i) => {
    const tip = `<b>${category}</b>` + series.map((s) => `<i style="background:${s.color}"></i>${s.label} <em>${formatter(s.values[i])}</em>`).join("");
    hits += `<rect class="hit" x="${plot.left + plot.band * i}" y="${plot.top}" width="${plot.band}" height="${plot.height}" data-tip="${escapeHtml(tip)}" />`;
  });

  return `${svgOpen(width, height, title)}${axisFrame(scale, plot, formatter)}${marks}${categoryLabels(categories, plot)}${hits}</svg>`;
}

function waterfallChart({ items, title, formatter, height = 330, width = 940 }) {
  const pad = { top: 34, right: 18, bottom: 66, left: 78 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  let running = 0;
  const geometry = items.map((item) => {
    if (item.type === "total") {
      running = item.value;
      return { ...item, from: 0, to: item.value };
    }
    const from = running;
    running += item.value;
    return { ...item, from, to: running };
  });
  const bounds = geometry.flatMap((g) => [g.from, g.to]).concat(0);
  const scale = niceScale(Math.min(...bounds), Math.max(...bounds));
  const plot = {
    left: pad.left,
    top: pad.top,
    width: plotWidth,
    height: plotHeight,
    band: plotWidth / items.length,
    y: (value) => pad.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight,
  };
  const barWidth = Math.min(24, plot.band * 0.5);

  let marks = "";
  let hits = "";
  geometry.forEach((item, i) => {
    const centre = plot.left + plot.band * (i + 0.5);
    const x = centre - barWidth / 2;
    const yTop = plot.y(Math.max(item.from, item.to));
    const yBottom = plot.y(Math.min(item.from, item.to));
    const barHeight = Math.max(yBottom - yTop, 1);
    const isTotal = item.type === "total";
    const colour = isTotal ? (item.value >= 0 ? SERIES.space : SERIES.decrease) : item.value >= 0 ? SERIES.y : SERIES.decrease;
    marks += `<path d="${capRect(x, yTop, barWidth, barHeight)}" fill="${colour}" />`;
    if (i < geometry.length - 1) {
      const connectorY = plot.y(item.to);
      marks += `<line class="connector" x1="${centre + barWidth / 2}" x2="${plot.left + plot.band * (i + 1.5) - barWidth / 2}" y1="${connectorY}" y2="${connectorY}" />`;
    }
    marks += `<text class="value-label ${item.value < 0 ? "negative-label" : ""}" x="${centre}" y="${yTop - 9}" text-anchor="middle">${formatter(item.value)}</text>`;
    const words = item.label.split(" ");
    const lineOne = words.slice(0, Math.ceil(words.length / 2)).join(" ");
    const lineTwo = words.slice(Math.ceil(words.length / 2)).join(" ");
    marks += `<text class="axis-label" x="${centre}" y="${plot.top + plot.height + 22}" text-anchor="middle">${escapeHtml(lineOne)}</text>`;
    if (lineTwo) marks += `<text class="axis-label" x="${centre}" y="${plot.top + plot.height + 37}" text-anchor="middle">${escapeHtml(lineTwo)}</text>`;
    const tip = `<b>${escapeHtml(item.label)}</b><i class="blank"></i>${formatter(item.value)}`;
    hits += `<rect class="hit" x="${plot.left + plot.band * i}" y="${plot.top}" width="${plot.band}" height="${plot.height}" data-tip="${escapeHtml(tip)}" />`;
  });

  return `${svgOpen(width, height, title)}${axisFrame(scale, plot, formatter)}${marks}${hits}</svg>`;
}

function legendHtml(series) {
  return series.map((s) => `<span class="legend-item"><i style="background:${s.color}"></i>${escapeHtml(s.label)}</span>`).join("");
}

/* ----------------------------------------------------------- sensitivity -- */

/* Drag-to-explore levers. Ordered by the measured elasticity of 2030 EBITDA,
   so the sliders that matter most sit at the top of each group. */
const DRIVER_SLIDERS = [
  /* Steps are 1 on the currency levers so every default sits exactly on the
     grid — a coarser step would silently round the plan value on reset. */
  { g: ["Price", "定价"], path: ["products", "space", "asp"], en: "X1 Space price", zh: "X1 Space 售价", min: 300, max: 1200, step: 1, fmt: (v) => `$${number(v)}` },
  { g: ["Price", "定价"], path: ["products", "lab", "asp"], en: "X1 Lab price", zh: "X1 Lab 售价", min: 500, max: 2000, step: 1, fmt: (v) => `$${number(v)}` },
  { g: ["Price", "定价"], path: ["products", "y", "asp"], en: "Luya Y price", zh: "Luya Y 售价", min: 3000, max: 9000, step: 50, fmt: (v) => `$${number(v)}` },
  { g: ["Price", "定价"], path: ["plans", "standard", "price"], en: "Standard plan / month", zh: "标准套餐月费", min: 15, max: 60, step: 1, fmt: (v) => `$${v}` },

  { g: ["Cost", "成本"], path: ["products", "space", "cogs"], en: "X1 Space BOM", zh: "X1 Space BOM", min: 60, max: 400, step: 1, fmt: (v) => `$${number(v)}` },
  { g: ["Cost", "成本"], path: ["products", "lab", "cogs"], en: "X1 Lab BOM", zh: "X1 Lab BOM", min: 150, max: 900, step: 1, fmt: (v) => `$${number(v)}` },
  { g: ["Cost", "成本"], path: ["opex", "rdPct"], en: "R&D (% revenue)", zh: "研发费用 (% 营收)", min: 3, max: 30, step: 1, fmt: (v) => `${v}%` },

  { g: ["Acquisition", "获客与规模"], path: ["products", "space", "cac"], en: "X1 Space CAC", zh: "X1 Space CAC", min: 50, max: 600, step: 5, fmt: (v) => `$${number(v)}` },
  { g: ["Acquisition", "获客与规模"], path: ["products", "lab", "cac"], en: "X1 Lab CAC", zh: "X1 Lab CAC", min: 50, max: 600, step: 5, fmt: (v) => `$${number(v)}` },
  { g: ["Acquisition", "获客与规模"], path: ["drivers", "spaceUnits"], en: "Space volume vs plan", zh: "Space 销量 vs 计划", min: 40, max: 200, step: 5, fmt: (v) => `${v}%` },
  { g: ["Acquisition", "获客与规模"], path: ["drivers", "labUnits"], en: "Lab volume vs plan", zh: "Lab 销量 vs 计划", min: 40, max: 200, step: 5, fmt: (v) => `${v}%` },
  { g: ["Acquisition", "获客与规模"], path: ["subscriptions", "space", "attach"], en: "Space attach rate", zh: "Space 订阅加入率", min: 20, max: 90, step: 1, fmt: (v) => `${v}%` },

  { g: ["Working capital", "营运资金"], path: ["finance", "inventoryDays"], en: "Inventory days", zh: "库存周转天数", min: 15, max: 150, step: 5, fmt: (v) => `${v}d` },
  { g: ["Working capital", "营运资金"], path: ["finance", "dso"], en: "Receivable days (DSO)", zh: "应收账期 DSO", min: 0, max: 120, step: 5, fmt: (v) => `${v}d` },
  { g: ["Working capital", "营运资金"], path: ["finance", "dpo"], en: "Payable days (DPO)", zh: "应付账期 DPO", min: 0, max: 120, step: 5, fmt: (v) => `${v}d` },
  { g: ["Working capital", "营运资金"], path: ["startingCash"], en: "Initial free cash", zh: "初始自由资金", min: 0, max: 6000000, step: 50000, fmt: (v) => money(v, 1) },
];

/* A range input under the cursor swallows wheel events and silently changes
   value, so scrolling past this panel would edit the model. Block that and
   scroll the page by hand instead. */
document.addEventListener(
  "wheel",
  (event) => {
    if (!event.target.closest?.('input[type="range"]')) return;
    event.preventDefault();
    window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "instant" });
  },
  { passive: false }
);

/* Perturbed one at a time to measure elasticity: % change in the output for a
   +10% change in the input. */
const TORNADO_DRIVERS = [
  { en: "X1 Space price", zh: "X1 Space 售价", bump: (m) => (m.products.space.asp *= 1.1) },
  { en: "X1 Lab price", zh: "X1 Lab 售价", bump: (m) => (m.products.lab.asp *= 1.1) },
  { en: "Luya Y price", zh: "Luya Y 售价", bump: (m) => (m.products.y.asp *= 1.1) },
  { en: "R&D %", zh: "研发费用 %", bump: (m) => (m.opex.rdPct *= 1.1) },
  { en: "X1 Space CAC", zh: "X1 Space CAC", bump: (m) => (m.products.space.cac *= 1.1) },
  { en: "Space volume", zh: "Space 销量", bump: (m) => (m.drivers.spaceUnits *= 1.1) },
  { en: "Lab volume", zh: "Lab 销量", bump: (m) => (m.drivers.labUnits *= 1.1) },
  { en: "Standard plan price", zh: "标准套餐价", bump: (m) => (m.plans.standard.price *= 1.1) },
  { en: "X1 Space BOM", zh: "X1 Space BOM", bump: (m) => (m.products.space.cogs *= 1.1) },
  { en: "X1 Lab BOM", zh: "X1 Lab BOM", bump: (m) => (m.products.lab.cogs *= 1.1) },
  { en: "Luya Y BOM", zh: "Luya Y BOM", bump: (m) => (m.products.y.cogs *= 1.1) },
  { en: "Space attach rate", zh: "Space 加入率", bump: (m) => (m.subscriptions.space.attach *= 1.1) },
  { en: "Space 12M retention", zh: "Space 12月留存", bump: (m) => (m.subscriptions.space.ret12 *= 1.1) },
  { en: "Inventory days", zh: "库存周转天数", bump: (m) => (m.finance.inventoryDays *= 1.1) },
  { en: "Receivable days (DSO)", zh: "应收账期 DSO", bump: (m) => (m.finance.dso *= 1.1) },
  { en: "Payable days (DPO)", zh: "应付账期 DPO", bump: (m) => (m.finance.dpo *= 1.1) },
  { en: "China team headcount", zh: "中国团队人数", bump: (m) => (m.opex.teamHeadcount *= 1.1) },
  { en: "Warranty & returns", zh: "退货与保修", bump: (m) => (m.finance.warrantyPct *= 1.1) },
];

let tornadoMetric = "ebitda";

function outcomeOf(sourceModel) {
  const forecast = calculateForecast(sourceModel, activeScenario);
  const trough = troughOf(forecast.rows);
  return {
    revenue: forecast.rows[4].totalRevenue,
    ebitda: forecast.rows[4].ebitda,
    funding: Math.max(0, -trough.endingCash),
  };
}

function elasticities() {
  const current = outcomeOf(model);
  return TORNADO_DRIVERS.map((driver) => {
    const probe = structuredClone(model);
    driver.bump(probe);
    const shifted = outcomeOf(probe);
    const ratio = (after, before) => (Math.abs(before) < 1 ? 0 : (after - before) / Math.abs(before) / 0.1);
    return {
      label: t(driver.en, driver.zh),
      ebitda: ratio(shifted.ebitda, current.ebitda),
      funding: ratio(shifted.funding, current.funding),
    };
  })
    .map((row) => ({ ...row, value: row[tornadoMetric] }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/* Diverging bars around a zero axis: blue for "raises it", red for "lowers it". */
function tornadoChart({ items, title, width = 660 }) {
  const rowHeight = 26;
  const pad = { top: 26, right: 58, bottom: 30, left: 150 };
  const height = pad.top + pad.bottom + items.length * rowHeight;
  const plotWidth = width - pad.left - pad.right;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.2);
  const scale = niceScale(-max, max, 2);
  const x = (value) => pad.left + ((value - scale.min) / (scale.max - scale.min)) * plotWidth;
  const barHeight = 14;

  const grid = scale.ticks
    .map((tick) => {
      const isZero = Math.abs(tick) < 1e-9;
      return `<line class="grid ${isZero ? "grid-zero" : ""}" x1="${x(tick)}" x2="${x(tick)}" y1="${pad.top - 6}" y2="${pad.top + items.length * rowHeight}" />
        <text class="axis-label" x="${x(tick)}" y="${pad.top + items.length * rowHeight + 20}" text-anchor="middle">${tick > 0 ? "+" : ""}${tick.toFixed(1)}</text>`;
    })
    .join("");

  const marks = items
    .map((item, i) => {
      const y = pad.top + i * rowHeight + (rowHeight - barHeight) / 2;
      const zero = x(0);
      const end = x(item.value);
      const left = Math.min(zero, end);
      const barWidth = Math.max(Math.abs(end - zero), 1);
      const colour = item.value >= 0 ? SERIES.space : SERIES.decrease;
      const labelX = item.value >= 0 ? end + 7 : end - 7;
      const anchor = item.value >= 0 ? "start" : "end";
      const tip = `<b>${escapeHtml(item.label)}</b><i class="blank"></i>${t("+10% input moves the output by", "输入 +10% 带动输出变动")} <em>${(item.value * 10).toFixed(1)}%</em>`;
      return `<text class="axis-label" x="${pad.left - 12}" y="${y + barHeight - 2}" text-anchor="end">${escapeHtml(item.label)}</text>
        <rect x="${left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="${colour}" />
        <text class="value-label" x="${labelX}" y="${y + barHeight - 2}" text-anchor="${anchor}">${item.value > 0 ? "+" : ""}${item.value.toFixed(2)}</text>
        <rect class="hit" x="${pad.left}" y="${y - 6}" width="${plotWidth}" height="${rowHeight}" data-tip="${escapeHtml(tip)}" />`;
    })
    .join("");

  return `${svgOpen(width, height, title)}${grid}${marks}<line class="grid-zero" x1="${x(0)}" x2="${x(0)}" y1="${pad.top - 6}" y2="${pad.top + items.length * rowHeight}" stroke="#8fa0b8" />
    <text class="axis-label" x="${pad.left + plotWidth / 2}" y="14" text-anchor="middle">${t("Elasticity — output % change per 1% input change", "弹性系数 —— 输入每变动 1%，输出变动的百分比")}</text></svg>`;
}

function renderSensitivity(forecast, rebuild) {
  const panel = document.getElementById("sliderPanel");

  if (rebuild) {
    let html = "";
    let lastGroup = null;
    DRIVER_SLIDERS.forEach((slider, index) => {
      const group = t(slider.g[0], slider.g[1]);
      if (group !== lastGroup) {
        html += `<h4 class="slider-group">${group}</h4>`;
        lastGroup = group;
      }
      const value = getPath(model, slider.path);
      html += `<div class="slider-row">
        <label for="driver${index}">${t(slider.en, slider.zh)}</label>
        <input id="driver${index}" class="driver-slider" type="range" data-driver="${index}" min="${slider.min}" max="${slider.max}" step="${slider.step}" value="${value}" />
        <output data-driver-out="${index}">${slider.fmt(value)}</output>
      </div>`;
    });
    panel.innerHTML = html;
  } else {
    DRIVER_SLIDERS.forEach((slider, index) => {
      const value = getPath(model, slider.path);
      const input = panel.querySelector(`[data-driver="${index}"]`);
      const out = panel.querySelector(`[data-driver-out="${index}"]`);
      if (input && input !== document.activeElement) input.value = value;
      if (out) out.textContent = slider.fmt(value);
    });
  }

  const baseline = outcomeOf(defaultModel);
  const now = outcomeOf(model);
  const tile = (labelEn, labelZh, value, base, invert) => {
    const delta = value - base;
    const pct = Math.abs(base) < 1 ? null : (delta / Math.abs(base)) * 100;
    const good = invert ? delta <= 0 : delta >= 0;
    const cls = Math.abs(delta) < 1 ? "flat" : good ? "up" : "down";
    return `<article class="impact-tile">
      <span>${t(labelEn, labelZh)}</span>
      <strong>${money(value)}</strong>
      <small class="impact-delta ${cls}">${Math.abs(delta) < 1 ? t("same as plan", "与计划一致") : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}${pct === null ? "" : ` · ${delta > 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`}`}</small>
    </article>`;
  };
  document.getElementById("impactRow").innerHTML =
    tile("2030 revenue", "2030 营收", now.revenue, baseline.revenue, false) +
    tile("2030 EBITDA", "2030 经营利润", now.ebitda, baseline.ebitda, false) +
    tile("Peak funding need", "最大融资需求", now.funding, baseline.funding, true);

  const items = elasticities();
  document.getElementById("chartTornado").innerHTML = tornadoChart({
    items,
    title: t("Sensitivity ranking", "敏感性排序"),
  });
  document.querySelectorAll("[data-tornado]").forEach((button) => button.classList.toggle("active", button.dataset.tornado === tornadoMetric));
  document.getElementById("tornadoNote").textContent = items.length
    ? t(
        `Top lever right now: ${items[0].label}. A 10% move changes ${tornadoMetric === "ebitda" ? "2030 EBITDA" : "the peak funding need"} by ${(items[0].value * 10).toFixed(1)}%.`,
        `当前第一驱动因素：${items[0].label}。它变动 10%，${tornadoMetric === "ebitda" ? "2030 经营利润" : "最大融资需求"}变动 ${(items[0].value * 10).toFixed(1)}%。`
      )
    : "";
}

/* -------------------------------------------------------------- rendering -- */

function syncInputs() {
  Object.entries(inputBindings).forEach(([id, path]) => {
    const element = document.getElementById(id);
    if (element) element.value = getPath(model, path);
  });
}

const inputBindings = {
  tam: ["tam"],
  startingCash: ["startingCash"],
  preToolingUnitCostRmb: ["founder", "preToolingUnitCostRmb"],
  validationUnits: ["founder", "validationUnits"],
  validationLogisticsRmb: ["founder", "validationLogisticsRmb"],
  validationOtherRmb: ["founder", "validationOtherRmb"],
  kolUnits: ["founder", "kolUnits"],
  kolPromoPerUnitRmb: ["founder", "kolPromoPerUnitRmb"],
  paidUnits: ["founder", "paidUnits"],
  capex2026: ["capexRmb", 0],
  capex2027: ["capexRmb", 1],
  capex2028: ["capexRmb", 2],
  capex2029: ["capexRmb", 3],
  capex2030: ["capexRmb", 4],
  spaceAsp: ["products", "space", "asp"],
  spaceCogs: ["products", "space", "cogs"],
  spaceCac: ["products", "space", "cac"],
  spaceNet: ["products", "space", "net"],
  labAsp: ["products", "lab", "asp"],
  labCogs: ["products", "lab", "cogs"],
  labCac: ["products", "lab", "cac"],
  labNet: ["products", "lab", "net"],
  yAsp: ["products", "y", "asp"],
  yCogs: ["products", "y", "cogs"],
  yCac: ["products", "y", "cac"],
  yNet: ["products", "y", "net"],
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
  inventoryDays: ["finance", "inventoryDays"],
  dso: ["finance", "dso"],
  dpo: ["finance", "dpo"],
  warrantyPct: ["finance", "warrantyPct"],
  taxRate: ["finance", "taxRate"],
};

function troughOf(rows) {
  return rows.reduce((lowest, row) => (row.endingCash < lowest.endingCash ? row : lowest), rows[0]);
}

function renderKpis(forecast, economics) {
  const launch = forecast.rows[1];
  const terminal = forecast.rows[4];
  const trough = troughOf(forecast.rows);
  const funding = Math.max(0, -trough.endingCash);

  document.getElementById("kpiValidation").textContent = t("Validation year", "验证年");
  document.getElementById("kpi2027Revenue").textContent = money(launch.totalRevenue);
  document.getElementById("kpi2027Units").textContent = `${compactNumber(launch.totalUnits)} ${t("units", "台")} · ${percent(launch.ebitdaMargin)} ${t("EBITDA margin", "经营利润率")}`;
  document.getElementById("kpi2030Revenue").textContent = money(terminal.totalRevenue);
  document.getElementById("kpi2030Recurring").textContent = `${percent(terminal.recurringMix)} ${t("recurring", "持续收入")} · ${compactNumber(terminal.installedBase)} ${t("installed", "累计装机")}`;
  document.getElementById("kpiTrough").textContent = money(trough.endingCash);
  document.getElementById("kpiTroughYear").textContent = `${trough.year} · ${trough.endingCash < 0 ? t("cash gap", "资金缺口") : t("still funded", "尚可覆盖")}`;
  document.getElementById("kpiFunding").textContent = money(funding);
  document.getElementById("kpiFundingNote").textContent = funding
    ? `${t("Raise before", "需在此前融资")} ${trough.year}`
    : t("Self-funded across the forecast", "预测期内可自筹");

  const blendedLtv = economics.reduce((sum, e) => sum + e.ltv * forecast.rows[4].units[e.key], 0);
  const blendedCac = economics.reduce((sum, e) => sum + e.cac * forecast.rows[4].units[e.key], 0);
  const ratio = blendedCac ? blendedLtv / blendedCac : 0;
  document.getElementById("kpiLtvCac").textContent = `${ratio.toFixed(1)}×`;
  const spaceEcon = economics.find((e) => e.key === "space");
  document.getElementById("kpiPayback").textContent =
    spaceEcon.paybackMonths === 0
      ? t("Space CAC recovered at sale", "Space 出货即收回获客成本")
      : `${t("Space payback", "Space 回本")} ${spaceEcon.paybackMonths.toFixed(1)} ${t("months", "个月")}`;
}

function renderExecutive(forecast) {
  document.getElementById("executiveRows").innerHTML = forecast.rows
    .map(
      (row) => `<tr class="${row.year === 2026 ? "validation-row" : ""}">
      <td><strong>${row.year}</strong></td>
      <td><span class="stage-label">${row.stage}</span></td>
      <td>${row.year === 2026 ? `${number(row.totalUnits)}<small>${t("sold of", "原价销售 / 共")} ${number(founderTotalUnits(model))} Founder</small>` : number(row.totalUnits)}</td>
      <td>${money(row.hardwareRevenue)}</td>
      <td>${money(row.consumablesRevenue)}</td>
      <td><strong>${money(row.totalRevenue)}</strong></td>
      <td>${money(row.grossProfit)}</td>
      <td>${percent(row.grossMargin)}</td>
      <td class="${row.ebitda < 0 ? "negative" : "positive"}">${money(row.ebitda)}</td>
      <td>${percent(row.recurringMix)}</td>
    </tr>`
    )
    .join("");

  const breakEven = forecast.rows.find((row) => row.year > 2026 && row.ebitda >= 0);
  document.getElementById("breakEvenBadge").textContent = breakEven
    ? `${t("EBITDA break-even", "经营盈亏平衡")} · ${breakEven.year}`
    : t("No break-even in forecast", "预测期内未盈亏平衡");

  const series = [
    { key: "space", label: t("X1 Space hardware", "X1 Space 硬件"), color: SERIES.space, values: forecast.rows.map((r) => r.hardware.space.revenue) },
    { key: "lab", label: t("X1 Lab hardware", "X1 Lab 硬件"), color: SERIES.lab, values: forecast.rows.map((r) => r.hardware.lab.revenue) },
    { key: "y", label: t("Luya Y (B2B)", "Luya Y（B 端）"), color: SERIES.y, values: forecast.rows.map((r) => r.hardware.y.revenue) },
    { key: "consumables", label: t("Consumables", "耗材"), color: SERIES.consumables, values: forecast.rows.map((r) => r.consumablesRevenue) },
  ];
  document.getElementById("legendRevenue").innerHTML = legendHtml(series);
  document.getElementById("chartRevenue").innerHTML = stackedColumnChart({
    categories: years.map(String),
    series,
    title: t("Revenue build by source, 2026–2030", "2026–2030 营收构成"),
    formatter: (value) => money(value, 0),
  });
}

function renderCash(forecast) {
  document.getElementById("cashRows").innerHTML = forecast.rows
    .map(
      (row) => `<tr>
      <td><strong>${row.year}</strong></td>
      <td class="${row.ebitda < 0 ? "negative" : ""}">${money(row.ebitda)}</td>
      <td>${money(-row.tax)}</td>
      <td>${money(row.inventory)}</td>
      <td>${money(row.receivables)}</td>
      <td>${money(row.payables)}</td>
      <td class="${row.deltaNwc > 0 ? "negative" : ""}">${money(-row.deltaNwc)}</td>
      <td>${money(-row.capex)}</td>
      <td class="${row.freeCashFlow < 0 ? "negative" : "positive"}"><strong>${money(row.freeCashFlow)}</strong></td>
      <td class="${row.endingCash < 0 ? "negative" : "positive"}"><strong>${money(row.endingCash)}</strong></td>
    </tr>`
    )
    .join("");

  const trough = troughOf(forecast.rows);
  const funding = Math.max(0, -trough.endingCash);
  const badge = document.getElementById("cashBadge");
  badge.textContent = funding
    ? `${t("Funding gap", "资金缺口")} ${money(funding)} · ${trough.year}`
    : `${t("Trough cash", "现金最低点")} ${money(trough.endingCash)} · ${trough.year}`;
  badge.classList.toggle("badge-alert", funding > 0);

  document.getElementById("legendCash").innerHTML = legendHtml([
    { label: t("Free cash flow", "自由现金流"), color: SERIES.flow },
    { label: t("Ending cash", "年末现金"), color: SERIES.cash },
  ]);
  document.getElementById("chartCash").innerHTML = comboCashChart({
    categories: years.map(String),
    flows: forecast.rows.map((r) => r.freeCashFlow),
    cashLine: forecast.rows.map((r) => r.endingCash),
    title: t("Free cash flow and ending cash", "自由现金流与年末现金"),
    formatter: (value) => money(value, 0),
  });
}

function renderWaterfall(forecast) {
  const select = document.getElementById("waterfallYear");
  if (select.options.length !== years.length) {
    select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  }
  select.value = String(waterfallYear);
  const row = forecast.rows.find((r) => r.year === waterfallYear) || forecast.rows[1];

  const items = [
    { label: t("Revenue", "营收"), value: row.totalRevenue, type: "total" },
    { label: t("COGS", "销货成本"), value: -(row.hardwareCogs + row.consumablesCogs) },
    { label: t("Warranty", "退货保修"), value: -row.warrantyCost },
    { label: t("S&M (CAC)", "销售获客"), value: -row.opex.salesMarketingExpense },
    { label: t("R&D", "研发"), value: -row.opex.rdExpense },
    { label: t("G&A", "管理"), value: -row.opex.gaExpense },
    { label: t("Team", "团队"), value: -row.opex.teamExpense },
    { label: t("Support", "客户支持"), value: -row.opex.supportExpense },
    { label: t("Validation", "验证投入"), value: -row.opex.validationExpense },
    { label: t("EBITDA", "经营利润"), value: row.ebitda, type: "total" },
  ].filter((item) => item.type === "total" || Math.abs(item.value) > 0);

  document.getElementById("chartWaterfall").innerHTML = waterfallChart({
    items,
    title: `${row.year} ${t("revenue to EBITDA bridge", "营收到经营利润桥")}`,
    formatter: (value) => money(value, 1),
  });
  document.getElementById("waterfallRows").innerHTML = items
    .map(
      (item) => `<tr class="${item.type === "total" ? "total-row" : ""}">
      <td>${item.label}</td>
      <td class="${item.value < 0 ? "negative" : ""}">${money(item.value)}</td>
      <td>${row.totalRevenue ? percent(item.value / row.totalRevenue) : "—"}</td>
    </tr>`
    )
    .join("");
}

function renderUnitEconomics(economics) {
  document.getElementById("unitEconRows").innerHTML = economics
    .map(
      (e) => `<tr>
      <td><strong>${e.name}</strong></td>
      <td>$${number(e.netAsp)}</td>
      <td>$${number(e.hardwareGp)}</td>
      <td>${e.attach ? percent(e.attach, 0) : "—"}</td>
      <td>${e.subAnnualGp ? `$${number(e.subAnnualGp)}` : "—"}</td>
      <td>${e.life ? `${e.life.toFixed(1)} ${t("yr", "年")}` : "—"}</td>
      <td><strong>$${number(e.ltv)}</strong></td>
      <td>$${number(e.cac)}</td>
      <td class="${e.ratio >= 3 ? "positive" : "negative"}"><strong>${e.ratio.toFixed(1)}×</strong></td>
      <td>${e.paybackMonths === 0 ? t("At sale", "出货即回本") : e.paybackMonths === Infinity ? t("Never", "无法回本") : `${e.paybackMonths.toFixed(1)} ${t("mo", "个月")}`}</td>
    </tr>`
    )
    .join("");
}

function unitCell(product, index, displayedValue) {
  if (index === 0) {
    if (product === "space") {
      return `<strong data-cell="space-0">${number(displayedValue)}</strong><small>${t("sold of", "原价销售 / 共")} ${number(founderTotalUnits(model))} ${t("Founder units", "台 Founder")}</small>`;
    }
    return product === "lab" ? t("Engineering", "工程验证") : t("Pilot", "试点");
  }
  if (product === "space") {
    return `<strong data-cell="space-${index}">${number(displayedValue)}</strong><small>${t("from GTM build-up", "来自渠道加总")}</small>`;
  }
  const baseValue = model.units[product][index];
  if (activeScenario === "base") {
    return `<input class="table-input unit-input" type="number" min="0" step="500" data-product="${product}" data-year-index="${index}" value="${baseValue}" />`;
  }
  return `<strong>${number(displayedValue)}</strong><small>${number(baseValue)} ${t("base", "基准")}</small>`;
}

function renderProductModel(forecast, rebuild) {
  const productKeys = ["space", "lab", "y"];
  const descriptions = {
    space: t("Mass premium consumer", "高端大众消费"),
    lab: t("Health / longevity / biohacking", "健康、长寿与生物黑客"),
    y: t("B2B platform", "B 端平台"),
  };

  if (rebuild) {
    document.getElementById("productRows").innerHTML = productKeys
      .map((key) => {
        const product = model.products[key];
        const terminal = forecast.rows[4].hardware[key];
        const gm = terminal.revenue ? terminal.grossProfit / terminal.revenue : 0;
        return `<tr data-product-row="${key}"><td><strong>${product.name}</strong><small>${descriptions[key]}</small></td>${years
          .map((_, index) => `<td>${unitCell(key, index, forecast.units[key][index])}</td>`)
          .join("")}<td>$${number(product.asp)}</td><td data-cell="gm-${key}">${percent(gm)}</td></tr>`;
      })
      .join("");
  } else {
    productKeys.forEach((key) => {
      const terminal = forecast.rows[4].hardware[key];
      const gm = terminal.revenue ? terminal.grossProfit / terminal.revenue : 0;
      const cell = document.querySelector(`[data-cell="gm-${key}"]`);
      if (cell) cell.textContent = percent(gm);
    });
    years.forEach((_, index) => {
      const cell = document.querySelector(`[data-cell="space-${index}"]`);
      if (cell) cell.textContent = number(forecast.units.space[index]);
    });
  }

  const launch = forecast.rows[1];
  const terminal = forecast.rows[4];
  const cHardware = launch.hardware.space.revenue + launch.hardware.lab.revenue;
  document.getElementById("productCallouts").innerHTML = `
    <article><span>${t("2027 C-device hardware revenue", "2027 C 端硬件收入")}</span><strong>${money(cHardware)}</strong></article>
    <article><span>${t("Lab share of C-device units", "Lab 占 C 端销量")}</span><strong>${percent(launch.units.lab / Math.max(launch.cDeviceUnits, 1))}</strong></article>
    <article><span>${t("2027 B2B hardware revenue", "2027 B 端硬件收入")}</span><strong>${money(launch.hardware.y.revenue)}</strong></article>
    <article><span>${t("2030 blended Space net price", "2030 Space 加权净价")}</span><strong>$${number(terminal.hardware.space.netAsp)}</strong></article>`;
}

function renderConsumables(forecast) {
  document.getElementById("subscriptionSummary").innerHTML = ["space", "lab"]
    .map((key) => {
      const subscription = forecast.subscriptions[key];
      const plan = forecast.economics[key];
      const original = model.subscriptions[key];
      return `<article><div><span>${model.products[key].name}</span><strong>${money(plan.annualRevenue, 0)} ${t("blended annual plan", "加权年费")}</strong></div>
      <dl><dt>${t("Attach", "加入率")}</dt><dd>${percent(subscription.attach)}</dd>
      <dt>${t("Plan mix", "套餐组合")}</dt><dd>${original.standardMix}% ${t("Standard", "标准")} · ${100 - original.standardMix}% ${t("Power", "家庭")}</dd>
      <dt>${t("Retention 3 / 6 / 12M", "留存 3 / 6 / 12 月")}</dt><dd>${percent(subscription.ret3, 0)} · ${percent(subscription.ret6, 0)} · ${percent(subscription.ret12, 0)}</dd></dl></article>`;
    })
    .join("");

  document.getElementById("cohortRows").innerHTML = forecast.rows
    .map(
      (row) => `<tr><td><strong>${row.year}</strong></td><td>${row.year === 2026 ? "—" : number(row.cDeviceUnits)}</td><td>${number(row.installedBase)}</td><td>${number(row.activeSubscribers)}</td><td><strong>${money(row.consumablesRevenue)}</strong></td><td>${percent(row.recurringMix)}</td></tr>`
    )
    .join("");

  const series = [
    { label: t("Cumulative installed base", "累计装机"), color: SERIES.installed, area: true, values: forecast.rows.map((r) => r.installedBase) },
    { label: t("Ending active subscriptions", "年末活跃订阅"), color: SERIES.subs, values: forecast.rows.map((r) => r.activeSubscribers) },
  ];
  document.getElementById("legendCohort").innerHTML = legendHtml(series);
  document.getElementById("chartCohort").innerHTML = lineAreaChart({
    categories: years.map(String),
    series,
    title: t("Installed base vs active subscriptions", "累计装机与活跃订阅"),
    formatter: compactNumber,
  });
}

function renderGtm(forecast, rebuild) {
  if (rebuild) {
    document.getElementById("gtmRows").innerHTML = Object.entries(model.gtm)
      .map(
        ([key, channel]) => `<tr><td><strong>${t(channel.en, channel.zh)}</strong></td>
        <td><input class="table-input net-input" type="number" min="0" max="100" step="1" data-channel="${key}" value="${channel.net}" aria-label="${escapeHtml(t(channel.en, channel.zh))} net price %" /></td>
        ${years
          .map((_, index) => {
            if (index === 0 && key !== "founder") return "<td>—</td>";
            const value = index === 0 ? model.founder.paidUnits : channel.values[index];
            return `<td><input class="table-input gtm-input" type="number" min="0" step="500" data-channel="${key}" data-year-index="${index}" value="${value}" ${index === 0 ? "disabled" : ""} /></td>`;
          })
          .join("")}</tr>`
      )
      .join("");
  }

  const netRow = `<tr><th>${t("Blended net price", "加权净价系数")}</th><th>—</th>${forecast.rows
    .map((row) => `<th>${percent(row.spaceChannelFactor, 1)}</th>`)
    .join("")}</tr>`;
  const totalRow = `<tr><th>${t("Base channel total", "基准渠道合计")}</th><th>—</th>${forecast.rawSpaceUnits.map((value) => `<th>${number(value)}</th>`).join("")}</tr>`;
  const adjustedRow =
    activeScenario === "base"
      ? ""
      : `<tr><th>${t(scenarioConfig[activeScenario].en, scenarioConfig[activeScenario].zh)} ${t("adjusted units", "调整后销量")}</th><th>—</th>${forecast.units.space
          .map((value) => `<th>${number(value)}</th>`)
          .join("")}</tr>`;
  document.getElementById("gtmFooter").innerHTML = totalRow + adjustedRow + netRow;
}

function renderInvestorView(forecast, allScenarios) {
  const terminal = forecast.rows[4];
  const trough = troughOf(forecast.rows);
  const funding = Math.max(0, -trough.endingCash);
  const breakEven = forecast.rows.find((row) => row.year > 2026 && row.ebitda >= 0);

  document.getElementById("investorTam").textContent = percent(terminal.tamPenetration, 2);
  document.getElementById("investorTamCum").textContent = percent(terminal.tamCumulative, 2);
  document.getElementById("investorFunding").textContent = money(funding);
  document.getElementById("investorFundingYear").textContent = funding
    ? `${t("Peak gap in", "最大缺口年份")} ${trough.year}`
    : t("No funding gap in forecast", "预测期内无资金缺口");
  document.getElementById("investorBreakEven").textContent = breakEven ? breakEven.year : t("Beyond 2030", "2030 年以后");

  document.getElementById("scenarioComparison").innerHTML = ["bear", "base", "bull"]
    .map((name) => {
      const result = allScenarios[name];
      const end = result.rows[4];
      const low = troughOf(result.rows);
      const config = scenarioConfig[name];
      return `<article class="${name === activeScenario ? "active" : ""}"><span>${t(config.en, config.zh)}</span><strong>${money(end.totalRevenue)}</strong><small>${t("2030 revenue", "2030 营收")}</small>
      <dl><dt>${t("2030 EBITDA", "2030 经营利润")}</dt><dd>${money(end.ebitda)}</dd>
      <dt>${t("Recurring", "持续收入")}</dt><dd>${percent(end.recurringMix)}</dd>
      <dt>${t("2030 units", "2030 销量")}</dt><dd>${compactNumber(end.totalUnits)}</dd>
      <dt>${t("Funding need", "融资需求")}</dt><dd class="${low.endingCash < 0 ? "negative" : ""}">${money(Math.max(0, -low.endingCash))}</dd></dl></article>`;
    })
    .join("");
}

function renderMethodology(forecast) {
  const finance = model.finance;
  const notes = [
    [
      t("Consumables cohorts — where the weights come from", "耗材队列 —— 权重是怎么来的"),
      t(
        `Two separate adjustments, often confused. (1) The 0.5 is timing: units sell evenly through the year, so the average new subscriber is only billed for about half of it. (2) The 0.25 / 0.5 / 0.25 are time weights on the retention curve, and they are fractions of a year that must sum to 1: months 0–3 (3/12 = 0.25) with nobody churned yet, so retention is 100%; months 3–9 (6/12 = 0.5) held at the 3-month rate; months 9–12 (3/12 = 0.25) held at the 6-month rate. Multiply weight by retention in each band and add: ${(0.25).toFixed(2)}×100% + ${(0.5).toFixed(2)}×${percent(forecast.subscriptions.space.ret3, 0)} + ${(0.25).toFixed(2)}×${percent(forecast.subscriptions.space.ret6, 0)} = ${(0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6).toFixed(3)} for Space. The existing base gets (1 + 12M) ÷ 2, the average of a curve running from 100% at the start of the year to the 12-month rate at the end.`,
        `这里有两个互相独立、容易混淆的调整。(1) 0.5 是「时点」调整：设备全年均匀售出，所以平均一个新订阅用户当年只被计费约半年。(2) 0.25 / 0.5 / 0.25 是留存曲线上的「时间权重」，本质是各时间段占一年的比例，三者必须加总为 1：第 0–3 月（3/12 = 0.25）还没有人流失，留存按 100% 计；第 3–9 月（6/12 = 0.5）按 3 个月留存率计；第 9–12 月（3/12 = 0.25）按 6 个月留存率计。每段用「权重 × 该段留存率」再相加：0.25×100% + 0.50×${percent(forecast.subscriptions.space.ret3, 0)} + 0.25×${percent(forecast.subscriptions.space.ret6, 0)} = ${(0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6).toFixed(3)}（Space）。存量基数则用 (1 + 12月留存) ÷ 2，即一条从年初 100% 降到年末 12 个月留存率的曲线的平均值。`
      ),
    ],
    [
      t("How generous that approximation is", "这个近似有多宽松"),
      t(
        `Worth knowing before quoting these numbers. The step weighting above holds the 3-month rate all the way to month 9 and never uses the 12-month rate for a new cohort at all. A stricter trapezoidal average between the measured points — 0.125 + 0.25×3M + 0.375×6M + 0.25×12M — gives ${(0.125 + 0.25 * forecast.subscriptions.space.ret3 + 0.375 * forecast.subscriptions.space.ret6 + 0.25 * forecast.subscriptions.space.ret12).toFixed(3)} against ${(0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6).toFixed(3)}, roughly ${percent(1 - (0.125 + 0.25 * forecast.subscriptions.space.ret3 + 0.375 * forecast.subscriptions.space.ret6 + 0.25 * forecast.subscriptions.space.ret12) / (0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6), 0)} less first-year consumables revenue per new cohort. Neither is a substitute for a true monthly cohort engine, which would remove the approximation entirely.`,
        `在对外引用这些数字前值得知道。上面的阶梯权重把 3 个月留存率一直用到第 9 个月，而且新队列完全没有用到 12 个月留存率。如果改用测点之间的梯形平均——0.125 + 0.25×3月 + 0.375×6月 + 0.25×12月——结果是 ${(0.125 + 0.25 * forecast.subscriptions.space.ret3 + 0.375 * forecast.subscriptions.space.ret6 + 0.25 * forecast.subscriptions.space.ret12).toFixed(3)}，而当前口径是 ${(0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6).toFixed(3)}，新队列首年耗材收入约低 ${percent(1 - (0.125 + 0.25 * forecast.subscriptions.space.ret3 + 0.375 * forecast.subscriptions.space.ret6 + 0.25 * forecast.subscriptions.space.ret12) / (0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6), 0)}。两者都替代不了真正的月度队列模型——那才能彻底消除这层近似。`
      ),
    ],
    [
      t("Founder 100 programme", "Founder 100 计划"),
      t(
        `${founderTotalUnits(model)} units split three ways: ${model.founder.validationUnits} validation, ${model.founder.kolUnits} gifted to KOLs, ${model.founder.paidUnits} sold at list price. Tooling only lands after this cohort, so all ${founderTotalUnits(model)} are small-batch builds at ${number(model.founder.preToolingUnitCostRmb)} RMB each — the mass-production BOM applies from 2027. Each KOL unit costs ${number(model.founder.preToolingUnitCostRmb + model.founder.kolPromoPerUnitRmb)} RMB all-in: ${number(model.founder.preToolingUnitCostRmb)} hardware plus ${number(model.founder.kolPromoPerUnitRmb)} promotion. Validation and KOL spend is expensed in full in 2026 (${money(founderProgramCost(model))}); only the sold units book revenue and attach a subscription, at a hardware gross loss. No CAC is charged in 2026 because these customers come from the waitlist.`,
        `${founderTotalUnits(model)} 台分三部分：${model.founder.validationUnits} 台验证、${model.founder.kolUnits} 台赠送 KOL、${model.founder.paidUnits} 台原价销售。开模在这批之后才发生，因此全部 ${founderTotalUnits(model)} 台都是每台 ${number(model.founder.preToolingUnitCostRmb)} 元的小批量试制成本，量产 BOM 从 2027 年起适用。KOL 每台合计 ${number(model.founder.preToolingUnitCostRmb + model.founder.kolPromoPerUnitRmb)} 元 = ${number(model.founder.preToolingUnitCostRmb)} 硬件 + ${number(model.founder.kolPromoPerUnitRmb)} 投放。验证与 KOL 投入在 2026 年全额费用化（${money(founderProgramCost(model))}）；只有售出的台数计入收入并开通订阅，且硬件层面为毛亏。2026 年不计 CAC，因为这批用户来自候补名单。`
      ),
    ],
    [
      t("Sales & marketing", "销售与市场费用"),
      t(
        `From 2027 onward S&M is CAC × every unit shipped, blended across organic, referral and paid channels, and held flat across all five years. It is not a percentage of revenue, so growing units — not growing revenue — drives the spend.`,
        `2027 年起，销售费用 = CAC × 全部出货台数，混合计入自然流量、推荐与付费渠道，五年保持不变。它不是营收百分比，因此驱动开支的是台数增长而非营收增长。`
      ),
    ],
    [
      t("Channel net pricing", "渠道净价"),
      t(
        `Each X1 Space channel realises a share of list ASP: marketplace commission and distributor discount are netted off revenue rather than booked as expense. The blended factor is ${percent(forecast.rows[4].spaceChannelFactor, 1)} in 2030. Lab and Luya Y carry a single product-level factor.`,
        `X1 Space 每个渠道按各自比例实现挂牌售价：平台抽佣与经销折扣直接冲减收入，而非计入费用。2030 年加权系数为 ${percent(forecast.rows[4].spaceChannelFactor, 1)}。Lab 与 Luya Y 使用单一产品级系数。`
      ),
    ],
    [
      t("Working capital", "营运资金"),
      t(
        `Inventory = next year's COGS ÷ 365 × ${finance.inventoryDays} days, so a ramp is funded before it ships. Receivables = revenue ÷ 365 × ${finance.dso}. Payables = COGS ÷ 365 × ${finance.dpo}. The change in net working capital is a cash outflow in every growth year.`,
        `存货 = 下一年度销货成本 ÷ 365 × ${finance.inventoryDays} 天，即放量前先垫付。应收 = 营收 ÷ 365 × ${finance.dso}。应付 = 销货成本 ÷ 365 × ${finance.dpo}。净营运资金的增加在每个增长年都是现金流出。`
      ),
    ],
    [
      t("Tax", "所得税"),
      t(
        `Tax is ${finance.taxRate}% of EBITDA after applying accumulated losses carried forward from earlier years. It is a cash-basis approximation — no deferred tax assets, no jurisdiction split between the US and China entities.`,
        `所得税按经营利润的 ${finance.taxRate}% 计，并先抵扣以前年度累计亏损。这是收付实现制的近似——未考虑递延所得税资产，也未区分美国与中国主体的税务管辖。`
      ),
    ],
    [
      t("What this model does not do", "本模型未覆盖的部分"),
      t(
        `No depreciation or amortisation (EBITDA is pre-D&A while capex is a cash line), no financing cash flows, no FX exposure beyond the RMB salary conversion, no channel inventory or sell-through lag, no monthly seasonality, and no discounting. Treat it as an operating plan, not an audited projection.`,
        `不含折旧摊销（经营利润为折旧前口径，而资本开支按现金列示）、不含融资性现金流、除人民币薪酬折算外不含汇率敞口、不含渠道库存与动销滞后、不含月度季节性、不做折现。请将其视为经营计划而非经审计的财务预测。`
      ),
    ],
  ];
  document.getElementById("methodList").innerHTML = notes
    .map(([title, body]) => `<article><h3>${title}</h3><p>${body}</p></article>`)
    .join("");
}

/* ------------------------------------------------------------- definitions --
   Every metric marked with data-def gets an explanation: what it is, how this
   page arrives at the number (with the current live values substituted), and
   what the number actually rests on. Rebuilt on every render so the formulas
   always match what is on screen. */

const BASIS = {
  input: () => t("Your input", "左侧输入项"),
  scenario: () => t("Scenario-adjusted", "受情景调节"),
  derived: () => t("Derived by the model", "模型推导"),
  target: () => t("Management target — unvalidated", "管理层目标 · 待验证"),
};

let definitions = {};

function buildDefinitions(forecast, economics) {
  const [r26, r27, , , r30] = forecast.rows;
  const trough = troughOf(forecast.rows);
  const funding = Math.max(0, -trough.endingCash);
  const breakEven = forecast.rows.find((row) => row.year > 2026 && row.ebitda >= 0);
  const fin = model.finance;
  const subs = model.subscriptions;
  const space = economics.find((e) => e.key === "space");
  const cagr = r27.totalRevenue > 0 ? Math.pow(r30.totalRevenue / r27.totalRevenue, 1 / 3) - 1 : 0;
  const blendedLtv = economics.reduce((sum, e) => sum + e.ltv * r30.units[e.key], 0);
  const blendedCac = economics.reduce((sum, e) => sum + e.cac * r30.units[e.key], 0);

  const map = {};
  const add = (key, basis, label, what, how, source) => {
    map[key] = { basis, label, what, how, source };
  };

  /* ---- headline KPIs ---- */
  const founder = model.founder;
  add("kpi.validation", "target", t("2026 validation year", "2026 验证年"),
    t(`The Founder ${founderTotalUnits(model)} splits three ways: ${founder.validationUnits} units run the validation programme, ${founder.kolUnits} are gifted to KOLs, and ${founder.paidUnits} are sold at list price. Only the sold units book revenue and enter the subscription cohort — the other two groups are marketing and R&D spend that happens to ship hardware.`,
      `Founder ${founderTotalUnits(model)} 拆成三部分：${founder.validationUnits} 台用于验证计划，${founder.kolUnits} 台赠送给 KOL，${founder.paidUnits} 台原价销售。只有销售的那部分计入收入并进入订阅队列——另外两组本质上是恰好以硬件形式支出的市场与研发费用。`),
    `${t("Revenue", "营收")} ${money(r26.totalRevenue)} · ${t("programme spend", "计划投入")} ${money(r26.opex.validationExpense)} (${t("validation", "验证")} ${number(founder.validationUnits * founder.preToolingUnitCostRmb + founder.validationLogisticsRmb + founder.validationOtherRmb)} + KOL ${number(founder.kolUnits * (founder.preToolingUnitCostRmb + founder.kolPromoPerUnitRmb))} RMB, ${t("of which hardware", "其中硬件")} ${number(founder.kolUnits * founder.preToolingUnitCostRmb)}) · ${t("tooling", "模具")} ${money(r26.capex)} · ${t("EBITDA", "经营利润")} ${money(r26.ebitda)}`,
    t(`Tooling only happens after the Founder 100, so every 2026 unit is a small-batch build at ${number(founder.preToolingUnitCostRmb)} RMB (${money(rmbToUsd(model, founder.preToolingUnitCostRmb), 0)}) rather than the mass-production BOM. That is why the ${founder.paidUnits} units sold at $${number(model.products.space.asp)} lose ${money(Math.abs(r26.hardware.space.revenue - r26.hardware.space.cogs))} in aggregate — selling below cost pre-tooling is the price of buying validated data.`,
      `开模发生在 Founder 100 之后，所以 2026 年每台都是 ${number(founder.preToolingUnitCostRmb)} 元（${money(rmbToUsd(model, founder.preToolingUnitCostRmb), 0)}）的小批量试制成本，而不是量产 BOM。正因如此，按 $${number(model.products.space.asp)} 售出的 ${founder.paidUnits} 台合计亏损 ${money(Math.abs(r26.hardware.space.revenue - r26.hardware.space.cogs))}——开模前低于成本销售，是换取验证数据必须付的代价。`));

  add("kpi.rev2027", "derived", t("2027 revenue", "2027 营收"),
    t("Total revenue in the first full commercial year: net hardware revenue across all three product lines plus consumables subscription revenue. 2026 already carries a small amount of revenue from the Founder units sold at list price.",
      "首个完整商业化年度的总营收：三条产品线的硬件净收入，加上耗材订阅收入。2026 年已有少量收入，来自原价销售的那批 Founder 设备。"),
    `${money(r27.hardwareRevenue)} ${t("hardware (net)", "硬件净收入")} + ${money(r27.consumablesRevenue)} ${t("consumables", "耗材")} = ${money(r27.totalRevenue)}`,
    t("Hardware = units × ASP × channel net-price factor. Units come from the GTM channel build-up (Space) and the editable product table (Lab, Luya Y). Consumables come from the cohort model.",
      "硬件 = 台数 × 售价 × 渠道净价系数。Space 台数来自渠道拆解表，Lab 与 Luya Y 来自可编辑的产品线表。耗材来自队列模型。"));

  add("kpi.rev2030", "derived", t("2030 revenue", "2030 营收"),
    t("Terminal-year revenue. The recurring share matters more than the headline: it is what turns a hardware company into a subscription business.",
      "预测期末年营收。持续收入占比比营收本身更重要——它决定了这是一家硬件公司还是订阅公司。"),
    `${money(r30.hardwareRevenue)} + ${money(r30.consumablesRevenue)} = ${money(r30.totalRevenue)} · ${t("2027→2030 CAGR", "2027→2030 复合增速")} ${percent(cagr, 0)}`,
    t("Driven by the 2030 channel plan (Space) and the unit assumptions you set for Lab and Luya Y. Nothing here is fitted to a top-down market size — TAM is only used as a sanity check.",
      "由 2030 年渠道计划（Space）与你为 Lab、Luya Y 设定的销量假设驱动。没有任何数字是从自上而下的市场规模倒推的——TAM 仅用作合理性校验。"));

  add("kpi.trough", "derived", t("Lowest cash point", "现金最低点"),
    t("The minimum year-end cash balance across the whole forecast. This single number decides how much you must raise and by when.",
      "预测期内年末现金余额的最低值。这一个数字就决定了你至少要融多少钱、以及必须在什么时候融到。"),
    `min(${forecast.rows.map((row) => money(row.endingCash, 0)).join(", ")}) → ${trough.year}: ${money(trough.endingCash)}`,
    t(`Starts from initial free cash of ${money(model.startingCash)} and accumulates free cash flow. The model contains no financing inflows at all, so this is the unfunded path.`,
      `起点是初始自由资金 ${money(model.startingCash)}，之后逐年累加自由现金流。模型中不含任何融资流入，所以这是「不融资」情况下的真实轨迹。`));

  add("kpi.funding", "derived", t("Peak external funding need", "最大外部融资需求"),
    t("If the cash trough goes negative, this is how much outside money is needed to close it. It is the model's direct answer to “how much should we raise?”",
      "如果现金最低点为负，这就是补平缺口所需的外部资金。它是本模型对「该融多少钱」的直接回答。"),
    `${t("cash trough", "现金最低点")} ${money(trough.endingCash)} → max(0, ${money(-trough.endingCash)}) = ${money(funding)}${funding ? ` · ${t("gap opens in", "缺口出现于")} ${trough.year}` : ""}`,
    t("Working capital is what creates this gap, not losses: inventory for next year's ramp is paid for before the units sell. Note this figure carries zero safety margin — a real raise usually adds 6–12 months of buffer on top.",
      "造成这个缺口的是营运资金，不是亏损：下一年放量所需的存货，要在东西卖出去之前就付钱。注意这个数字不含任何安全垫——实际融资通常要在此基础上再加 6–12 个月缓冲。"));

  add("kpi.ltvcac", "derived", t("Blended LTV / CAC", "加权 LTV / CAC"),
    t("Lifetime value divided by acquisition cost, weighted by 2030 unit mix. Above 3× is generally considered healthy; below 1× means you lose money on every customer.",
      "生命周期价值 ÷ 获客成本，按 2030 年各产品销量加权。一般认为高于 3× 属健康，低于 1× 则每获取一个客户都在亏钱。"),
    `Σ(LTV × ${t("units", "台数")}) ÷ Σ(CAC × ${t("units", "台数")}) = ${money(blendedLtv, 0)} ÷ ${money(blendedCac, 0)} = ${(blendedCac ? blendedLtv / blendedCac : 0).toFixed(1)}×`,
    t("LTV is derived (see the Unit economics table). CAC is an assumption you entered — it is the single least validated input on this page, and the Founder 100 year is where it should be measured per channel.",
      "LTV 是推导出来的（见「单位经济模型」表）。CAC 是你输入的假设值——它是本页面最缺乏实证支撑的一个输入，应该在 Founder 100 阶段按渠道实测出来。"));

  /* ---- validation targets ---- */
  add("val.reliability", "target", t("Product reliability >95%", "产品可靠性 >95%"),
    t("Share of Founder 100 devices operating without needing repair over the validation period.",
      "验证期内无需返修即可正常工作的设备比例。"),
    t("Devices with no failure ÷ Founder 100 total", "无故障设备数 ÷ Founder 100 总台数"),
    t(`Falling short means the warranty and returns assumption (currently ${fin.warrantyPct}% of hardware revenue, ${money(r30.warrantyCost)} in 2030) has to go up, straight out of gross margin.`,
      `达不到就意味着退货与保修假设（当前为硬件收入的 ${fin.warrantyPct}%，2030 年计提 ${money(r30.warrantyCost)}）必须上调，直接从毛利里扣。`));

  add("val.nps", "target", t("NPS >50", "净推荐值 >50"),
    t("Net promoter score: promoters minus detractors. Above 50 puts a consumer hardware product in the top tier.",
      "净推荐值 = 推荐者比例 − 贬损者比例。50 以上属于消费硬件产品的第一梯队。"),
    t("% promoters − % detractors", "推荐者% − 贬损者%"),
    t(`Decides whether the PR / organic / referral channel works at all. That channel is planned at ${number(model.gtm.organic.values[4])} units in 2030 and carries no channel discount, so it is the highest-margin volume in the plan.`,
      `决定「公关、自然流量与推荐」这条渠道能否成立。该渠道 2030 年计划 ${number(model.gtm.organic.values[4])} 台，且不承担任何渠道折让，是全盘毛利最高的销量。`));

  add("val.active", "target", t("Device active rate >70%", "设备活跃率 >70%"),
    t("Share of the installed base that uses the device at least once a month.",
      "每月至少使用一次的设备，占累计装机量的比例。"),
    t("Monthly active devices ÷ installed base", "月活跃设备数 ÷ 累计装机量"),
    t(`Active use is the precondition for consumables revenue. An idle device cancels, which would invalidate the ${subs.space.ret12}% 12-month retention assumption that ${money(r30.consumablesRevenue)} of 2030 revenue depends on.`,
      `活跃使用是耗材收入的前置条件。设备闲置就会退订，那样 ${subs.space.ret12}% 的 12 个月留存假设就不成立——而 2030 年 ${money(r30.consumablesRevenue)} 的耗材收入完全建立在它上面。`));

  add("val.ret3", "target", t("3-month retention >85%", "3 个月留存率 >85%"),
    t("Share of subscribers still paying in month 3. This is one of the two most sensitive assumptions in the entire model.",
      "订阅用户在第 3 个月仍在付费的比例。这是全模型最敏感的两个假设之一。"),
    `${t("Feeds the first-year retention index", "进入首年留存指数")}: 0.25 + 0.5 × ${percent(forecast.subscriptions.space.ret3, 0)} + 0.25 × ${percent(forecast.subscriptions.space.ret6, 0)}`,
    t(`The model currently assumes ${subs.space.ret3}% for Space and ${subs.lab.ret3}% for Lab. It determines how much a newly attached cohort actually bills in its first year.`,
      `模型当前假设 Space 为 ${subs.space.ret3}%、Lab 为 ${subs.lab.ret3}%。它决定了新加入的队列在第一年实际能收到多少订阅费。`));

  add("val.trays", "target", t("Tray consumption 8+ / month", "托盘消耗量 8+ / 月"),
    t("Average trays consumed per active device per month — the physical driver of consumables revenue.",
      "每台活跃设备的月均托盘消耗量——耗材收入的物理驱动因素。"),
    `${t("Standard plan", "标准套餐")} ${model.plans.standard.trays} ${t("trays", "盘")} / $${model.plans.standard.price} · ${t("Power plan", "家庭套餐")} ${model.plans.power.trays} ${t("trays", "盘")} / $${model.plans.power.price}`,
    t(`Decides whether the Standard plan is enough or users upgrade. The model assumes ${subs.space.standardMix}% of Space subscribers stay on Standard; more upgrades means a higher blended plan value than the current ${money(forecast.economics.space.annualRevenue, 0)} per year.`,
      `决定标准套餐够不够用、用户会不会升级到家庭套餐。模型假设 ${subs.space.standardMix}% 的 Space 订阅用户留在标准套餐；升级越多，加权年费就高于当前的 ${money(forecast.economics.space.annualRevenue, 0)}。`));

  add("val.attach", "target", t("Subscription attach >55%", "订阅加入率 >55%"),
    t("Of the people who buy a device, how many switch on a consumables subscription. Together with retention this is what makes the business recurring rather than transactional.",
      "买了设备的人里，有多少会开通耗材订阅。它和留存一起，决定了这门生意是持续性的还是一次性的。"),
    `${t("Space", "Space")} ${percent(forecast.subscriptions.space.attach, 0)} · ${t("Lab", "Lab")} ${percent(forecast.subscriptions.lab.attach, 0)} → ${t("2030 recurring mix", "2030 持续收入占比")} ${percent(r30.recurringMix)}`,
    t(`The model takes this straight from your Space attach input of ${subs.space.attach}%. 2030 consumables revenue of ${money(r30.consumablesRevenue)} is close to directly proportional to it.`,
      `模型直接采用你输入的 Space 加入率 ${subs.space.attach}%。2030 年 ${money(r30.consumablesRevenue)} 的耗材收入几乎与它成正比。`));

  add("val.ugc", "target", t("UGC completion >40%", "内容产出率 >40%"),
    t("Share of users who finish and publish content made with the device.",
      "使用设备完成并发布内容的用户比例。"),
    t("Users publishing content ÷ active users", "发布内容的用户数 ÷ 活跃用户数"),
    t(`Fuel for the two lowest-cost channels: KOL/KOC and PR/organic/referral, together ${number(model.gtm.kol.values[4] + model.gtm.organic.values[4])} units in the 2030 plan.`,
      `这是成本最低的两条渠道——达人口碑与公关自然流量——的燃料，2030 年计划合计 ${number(model.gtm.kol.values[4] + model.gtm.organic.values[4])} 台。`));

  add("val.failure", "target", t("Failure rate <5%", "故障率 <5%"),
    t("Share of units that suffer a hardware failure within the warranty period.",
      "保修期内发生硬件故障的设备比例。"),
    `${t("Maps to the warranty provision", "对应退货与保修计提")}: ${fin.warrantyPct}% × ${t("hardware revenue", "硬件收入")} = ${money(r30.warrantyCost)} (2030)`,
    t("Set on the left under Working capital, tax & capex. Hardware failure is also the fastest way to lose a subscription, so it hits both the gross margin line and the retention line.",
      "在左侧「营运资金、税与资本开支」中设定。硬件故障同时也是流失订阅最快的原因，所以它既打毛利也打留存。"));

  /* ---- executive forecast ---- */
  add("exec.stage", "derived", t("Stage", "阶段"),
    t("The commercial posture of each year: validate, prove product-market fit, scale, expand. Labels only — they carry no maths.",
      "每一年的商业化状态：验证、验证 PMF、规模化、扩张。仅为标签，不参与任何计算。"),
    t("2026 validate · 2027 prove PMF · 2028 scale · 2029–30 expand", "2026 验证 · 2027 验证 PMF · 2028 规模化 · 2029–30 扩张"),
    t("Corresponds to the channel timeline at the bottom of the Go-to-market module.",
      "与「渠道拆解」模块底部的阶段时间轴对应。"));

  add("exec.units", "scenario", t("Units", "销量"),
    t(`Revenue-generating devices shipped in the year across all three product lines. 2026 counts only the ${model.founder.paidUnits} Founder units actually sold — the ${model.founder.validationUnits + model.founder.kolUnits} validation and KOL units ship as well but are expensed rather than sold.`,
      `当年三条产品线中产生收入的出货台数。2026 年只计入实际售出的 ${model.founder.paidUnits} 台 Founder 设备——另外 ${model.founder.validationUnits + model.founder.kolUnits} 台验证与 KOL 设备同样出货，但走费用而非销售。`),
    `${t("Space", "Space")} ${number(r27.units.space)} + ${t("Lab", "Lab")} ${number(r27.units.lab)} + ${t("Luya Y", "Luya Y")} ${number(r27.units.y)} = ${number(r27.totalUnits)} (2027)`,
    t(`Space units are the sum of the six go-to-market channels. Lab and Luya Y are entered directly. Every figure is then multiplied by the scenario unit scale (currently ${forecast.scenario.unitScale}×).`,
      `Space 台数是六条渠道的加总，Lab 与 Luya Y 为直接输入。所有数字再乘以情景销量倍数（当前 ${forecast.scenario.unitScale}×）。`));

  add("exec.hardware", "derived", t("Hardware revenue (net)", "硬件收入（净价）"),
    t("Hardware revenue AFTER marketplace commission and distributor discount. This is not list price × units — the channel's cut is netted off revenue rather than booked as an expense.",
      "已扣除平台抽佣与经销折让之后的硬件收入。它不是挂牌价 × 台数——渠道拿走的部分直接冲减收入，而不是计入费用。"),
    `Σ (${t("units", "台数")} × ASP × ${t("net-price factor", "净价系数")}) = ${money(r27.hardwareRevenue)} (2027) · ${t("Space blended factor", "Space 加权系数")} ${percent(r27.spaceChannelFactor, 1)}`,
    t(`Each Space channel has its own factor (Amazon ${model.gtm.amazon.net}%, retail ${model.gtm.retail.net}%, direct channels 100%), editable in the Go-to-market table. Lab and Luya Y carry a single product-level factor set on the left.`,
      `Space 每条渠道有各自的系数（亚马逊 ${model.gtm.amazon.net}%、零售经销 ${model.gtm.retail.net}%、直营渠道 100%），可在「渠道拆解」表中修改。Lab 与 Luya Y 使用左侧设定的单一产品级系数。`));

  add("exec.consumables", "derived", t("Consumables revenue", "耗材收入"),
    t("Subscription revenue from tray plans. Two groups pay in any given year: the cohort that just attached (billing for part of the year) and the base carried in from last year.",
      "托盘订阅带来的收入。任何一年都有两拨人在付费：当年新加入的队列（只付部分年份）和从上一年结转的存量用户。"),
    `${t("new", "新队列")} × ${money(forecast.economics.space.annualRevenue, 0)} × 0.5 (${t("timing", "时点")}) × ${(0.25 + 0.5 * forecast.subscriptions.space.ret3 + 0.25 * forecast.subscriptions.space.ret6).toFixed(3)} (${t("retention index", "留存指数")}) + ${t("existing", "存量")} × ${money(forecast.economics.space.annualRevenue, 0)} × ${((1 + forecast.subscriptions.space.ret12) / 2).toFixed(3)}`,
    t("Two separate factors. The 0.5 is timing: units sell through the year, so a new subscriber is billed for about half of it. The retention index is a time-weighted average of the retention curve — 0.25 of the year at 100% (nobody has churned yet), 0.5 at the 3-month rate, 0.25 at the 6-month rate; the weights are fractions of a year and sum to 1. See the Methodology appendix for how generous that weighting is.",
      "这里是两个独立的系数。0.5 是时点调整：设备全年陆续售出，新订阅用户当年平均只计费半年。留存指数则是留存曲线的时间加权平均——0.25 的年份按 100%（还没人流失）、0.5 按 3 个月留存率、0.25 按 6 个月留存率；权重就是各时段占一年的比例，加总为 1。这套权重有多宽松，见方法论附录。"));

  add("exec.revenue", "derived", t("Total revenue", "总营收"),
    t("Net hardware revenue plus consumables revenue. No other revenue lines exist in this model.",
      "硬件净收入 + 耗材收入。本模型没有其他收入科目。"),
    `${money(r27.hardwareRevenue)} + ${money(r27.consumablesRevenue)} = ${money(r27.totalRevenue)} (2027)`,
    t(`2026 books ${money(r26.totalRevenue)} from the ${model.founder.paidUnits} Founder units sold at list price. The validation and KOL units ship in the same year but are expensed, not sold, so they add cost without adding revenue.`,
      `2026 年录得 ${money(r26.totalRevenue)}，来自原价销售的 ${model.founder.paidUnits} 台 Founder 设备。验证台与 KOL 赠送台同年出货，但走费用而非销售，因此只增加成本、不增加收入。`));

  add("exec.gp", "derived", t("Gross profit", "毛利"),
    t("Revenue less all cost of goods: hardware bill of materials, the warranty and returns provision, and consumables cost.",
      "营收减去全部销货成本：硬件物料成本、退货与保修计提、耗材成本。"),
    `${money(r27.totalRevenue)} − ${money(r27.hardwareCogs)} ${t("hardware COGS", "硬件成本")} − ${money(r27.warrantyCost)} ${t("warranty", "退货保修")} − ${money(r27.consumablesCogs)} ${t("consumables COGS", "耗材成本")} = ${money(r27.grossProfit)}`,
    t(`Per-unit COGS is your input, multiplied by the scenario cost factor (currently ${forecast.scenario.cogsScale}×). It does not include tooling, which sits in capex.`,
      `单台成本为你的输入，再乘以情景成本系数（当前 ${forecast.scenario.cogsScale}×）。不含模具费用——那部分在资本开支里。`));

  add("exec.gm", "derived", t("Gross margin", "毛利率"),
    t("Gross profit as a share of total revenue. It rises slowly across the forecast as higher-margin consumables become a larger share of the mix.",
      "毛利占总营收的比例。随着高毛利的耗材在收入结构中占比上升，它在预测期内缓慢改善。"),
    `${money(r30.grossProfit)} ÷ ${money(r30.totalRevenue)} = ${percent(r30.grossMargin)} (2030)`,
    t("Pulled down by channel discounts on Amazon and retail — those show up here rather than as a marketing expense, which is why this number is lower than a pure DTC model would show.",
      "被亚马逊与零售的渠道折让压低——这部分体现在这里而不是营销费用里，所以这个数字会低于纯直营模型。"));

  add("exec.ebitda", "derived", t("EBITDA / operating profit", "经营利润 (EBITDA)"),
    t("Gross profit less every operating expense. Pre-depreciation and pre-amortisation: capital spending is shown as cash in the cash-flow table instead, so this line is not a net profit figure.",
      "毛利减去全部经营费用。这是折旧摊销前口径：资本开支改在现金流表中按现金列示，所以这一行不是净利润。"),
    `${money(r27.grossProfit)} − ${money(r27.opex.salesMarketingExpense)} ${t("S&M", "销售获客")} − ${money(r27.opex.rdExpense)} R&D − ${money(r27.opex.gaExpense)} G&A − ${money(r27.opex.teamExpense)} ${t("team", "团队")} − ${money(r27.opex.supportExpense)} ${t("support", "支持")} = ${money(r27.ebitda)}`,
    t("Sales & marketing is CAC × units, not a percentage of revenue — so spend scales with volume, not with price. See the P&L bridge chart for the full breakdown of any year.",
      "销售费用 = CAC × 台数，不是营收的百分比——所以它随销量增长，而不随售价增长。任一年的完整拆解见「利润桥」图。"));

  add("exec.recurring", "derived", t("Recurring revenue mix", "持续收入占比"),
    t("Consumables revenue as a share of total revenue. This is the number that determines whether the company is valued as hardware or as a subscription business.",
      "耗材收入占总营收的比例。这个数字决定了公司被按硬件估值还是按订阅业务估值。"),
    `${money(r30.consumablesRevenue)} ÷ ${money(r30.totalRevenue)} = ${percent(r30.recurringMix)} (2030)`,
    t("It climbs slowly because hardware keeps growing too. The mix only inflects once unit growth flattens and the installed base keeps paying — which happens beyond this forecast window.",
      "它上升缓慢，因为硬件收入也在同步增长。只有当销量增速放缓、而装机基数继续付费时，这个比例才会真正跃升——那要到本预测窗口之后。"));

  /* ---- cash bridge ---- */
  add("cash.tax", "derived", t("Corporate tax", "所得税"),
    t("Cash tax on operating profit, after applying losses carried forward from earlier years.",
      "按经营利润计提的现金所得税，先抵扣以前年度结转的累计亏损。"),
    `(${t("EBITDA", "经营利润")} − ${t("loss carryforward", "可抵扣亏损")}) × ${fin.taxRate}% → ${money(r27.tax)} (2027)`,
    t("A cash-basis approximation. No deferred tax assets, and no split between the US and China entities — a real structure would very likely pay a different effective rate.",
      "这是收付实现制的近似。不含递延所得税资产，也未区分美国与中国主体——真实的税务架构下实际税率很可能不同。"));

  add("cash.inventory", "derived", t("Inventory", "存货"),
    t("Cash tied up in stock at year end. Crucially it is sized against NEXT year's cost of goods: a hardware company pays for the ramp before it sells it.",
      "年末被库存占用的现金。关键在于它是按【下一年度】的销货成本备货的——硬件公司必须在东西卖出去之前就为放量付钱。"),
    `${t("next year COGS", "下一年销货成本")} ÷ 365 × ${fin.inventoryDays} ${t("days", "天")} → ${money(r26.inventory)} (2026) · ${money(r27.inventory)} (2027)`,
    t("This is the single biggest reason the funding need is not zero. In 2026 there is no revenue at all, yet inventory for the 2027 launch already has to be paid for.",
      "这是融资需求不为零的最主要原因。2026 年完全没有收入，却已经要为 2027 年的上市备货付钱。"));

  add("cash.receivables", "derived", t("Receivables", "应收账款"),
    t("Revenue booked but not yet collected — money sitting with Amazon and retail partners waiting out their payment terms.",
      "已确认收入但尚未收到的钱——躺在亚马逊和零售伙伴那里、等账期到期的资金。"),
    `${t("revenue", "营收")} ÷ 365 × ${fin.dso} ${t("days (DSO)", "天 DSO")} → ${money(r27.receivables)} (2027)`,
    t("Direct-to-consumer sales collect immediately, so a DTC-heavy mix would justify a lower DSO than the blended figure used here.",
      "直营销售是即时收款的，所以直营占比越高，DSO 就该低于这里使用的混合口径。"));

  add("cash.payables", "derived", t("Payables", "应付账款"),
    t("Cost incurred but not yet paid to suppliers — the one working-capital line that works in your favour.",
      "已发生但尚未支付给供应商的成本——营运资金里唯一对你有利的一项。"),
    `${t("COGS", "销货成本")} ÷ 365 × ${fin.dpo} ${t("days (DPO)", "天 DPO")} → ${money(r27.payables)} (2027)`,
    t("DPO depends entirely on negotiating leverage with contract manufacturers. An early-stage company often has to prepay, which would mean a far lower number here.",
      "DPO 完全取决于你对代工厂的议价能力。初创公司往往要预付款，那样这个数字会低得多。"));

  add("cash.dnwc", "derived", t("Change in working capital", "营运资金变动"),
    t("The year-on-year change in inventory plus receivables minus payables. An increase is a cash outflow — this is where a profitable-looking year can still burn cash.",
      "存货 + 应收 − 应付 的同比变动。增加即现金流出——这正是「账面赚钱」的年份仍然烧钱的地方。"),
    `(${money(r27.inventory)} + ${money(r27.receivables)} ${lessTerm(r27.payables)}) ${lessTerm(r26.nwc)} = ${money(Math.abs(r27.deltaNwc))} ${r27.deltaNwc >= 0 ? t("outflow", "流出") : t("inflow", "流入")} (2027)`,
    t("Growth consumes working capital. 2027 shows positive EBITDA and still ends with less cash than it started, entirely because of this line.",
      "增长会吞噬营运资金。2027 年经营利润为正，年末现金却比年初还少——原因完全在这一行。"));

  add("cash.capex", "derived", t("Capital expenditure", "资本开支"),
    t("Cash spent on tooling and moulds. Shown as cash rather than depreciated, which is why the profit line above is labelled EBITDA.",
      "用于模具与工装的现金支出。按现金列示而非计提折旧，这也是上方利润口径叫 EBITDA 的原因。"),
    `${forecast.rows.map((row, i) => `${row.year}: ${number(model.capexRmb[i] || 0)} RMB`).join(" · ")} → ${t("total", "合计")} ${money(forecast.rows.reduce((sum, row) => sum + row.capex, 0))}`,
    t("Each year is entered directly in RMB, because tooling is a step cost: you pay once per mould in the year it is cut, not as a running percentage of revenue. 2026 tools X1 Space, 2027 tools X1 Lab, and nothing is scheduled after that — so any new SKU beyond the current roadmap would add a spend this model does not carry.",
      "每一年都按人民币直接填入，因为模具是阶梯式支出：一套模开一次、在开模当年一次性付清，而不是随营收滚动的百分比。2026 年为 X1 Space 开模，2027 年为 X1 Lab 开模，之后没有安排——因此当前路线图之外的任何新品，都会带来本模型未计入的支出。"));

  add("cash.fcf", "derived", t("Free cash flow", "自由现金流"),
    t("What actually lands in the bank each year: operating profit, less tax, less the working-capital build, less capital spending.",
      "每年真正进到银行账户里的钱：经营利润，减所得税，减营运资金占用，减资本开支。"),
    `${money(r27.ebitda)} ${lessTerm(r27.tax)} ${t("tax", "税")} ${lessTerm(r27.deltaNwc)} ${t("working capital", "营运资金")} ${lessTerm(r27.capex)} ${t("capex", "资本开支")} = ${money(r27.freeCashFlow)} (2027)`,
    t("No financing flows are modelled — no debt, no equity raise, no interest. This is deliberately the unfunded path so the funding requirement is visible.",
      "不含任何融资性现金流——没有借款、没有股权融资、没有利息。这是刻意保留的「不融资」路径，好让资金需求暴露出来。"));

  add("cash.ending", "derived", t("Ending cash", "年末现金"),
    t("Cumulative cash balance at the end of each year. Where it goes negative, the company is insolvent on this plan unless it raises money first.",
      "每年年末的累计现金余额。一旦为负，就意味着按此计划公司在该时点已无力支付——除非提前融资。"),
    `${money(model.startingCash)} ${t("initial", "初始资金")} → ${forecast.rows.map((row) => money(row.endingCash, 0)).join(" → ")}`,
    t("Compare with the shaded band on the chart above: any part of the line inside the red band is a period you cannot fund from operations.",
      "对照上方图表中的红色着色区间：折线落在红色区域内的那段时间，就是你无法靠经营自筹的时期。"));

  /* ---- unit economics ---- */
  add("ue.netAsp", "derived", t("Net ASP", "净售价"),
    t("Average selling price after channel discounts and the scenario price adjustment — the revenue you actually book per unit.",
      "扣除渠道折让与情景价格调整之后的平均售价——你每台实际入账的收入。"),
    `${t("list ASP", "挂牌售价")} × (1 ${scenarioSign(forecast.scenario.aspDelta)}) × ${t("net-price factor", "净价系数")} → ${t("Space", "Space")} $${number(space.netAsp)}`,
    t("Uses the 2030 channel mix, which has the heaviest marketplace and retail weighting, so it is the most conservative year to quote.",
      "采用 2030 年的渠道结构——那是平台与零售占比最高的一年，因此是最保守的口径。"));

  add("ue.hwGp", "derived", t("Hardware gross profit per unit", "单台硬件毛利"),
    t("What one device contributes before any subscription revenue: net price less build cost less the warranty provision.",
      "在任何订阅收入之前，单台设备的贡献：净售价 − 制造成本 − 退货保修计提。"),
    `$${number(space.netAsp)} − $${number(model.products.space.cogs * forecast.scenario.cogsScale)} − $${number(space.netAsp * fin.warrantyPct / 100)} = $${number(space.hardwareGp)} (Space)`,
    t("If this exceeds CAC, the device pays for its own acquisition at the moment of sale and every subscription dollar afterwards is profit on top.",
      "如果它高于 CAC，那么设备在出货那一刻就已经收回了获客成本，之后每一分订阅收入都是净赚的。"));

  add("ue.attach", "scenario", t("Attach rate", "订阅加入率"),
    t("Share of device buyers who start a consumables subscription.",
      "购买设备的用户中，开通耗材订阅的比例。"),
    `${t("your input", "你的输入")} ${subs.space.attach}%${forecast.scenario.attachDelta ? ` ${forecast.scenario.attachDelta > 0 ? "+" : "−"}${Math.abs(forecast.scenario.attachDelta)}pt ${t("scenario", "情景调节")}` : ""} = ${percent(forecast.subscriptions.space.attach, 0)} (Space)`,
    t("Unvalidated. The Founder 100 target is >55%, which is exactly the base-case input — meaning the base case assumes validation lands precisely on target with no margin.",
      "尚未验证。Founder 100 的目标是 >55%，恰好等于基准情景的输入值——也就是说基准情景假设验证结果不多不少正好达标，没有留余量。"));

  add("ue.subGp", "derived", t("Subscription gross profit per year", "年订阅毛利"),
    t("Annual gross profit from one active subscription: blended plan revenue less tray cost less the per-subscriber support cost.",
      "单个活跃订阅每年的毛利：加权套餐收入 − 托盘成本 − 每用户支持成本。"),
    `${money(forecast.economics.space.annualRevenue, 0)} − ${money(forecast.economics.space.annualCogs, 0)} − $${model.opex.supportCost} = $${number(space.subAnnualGp)} (Space)`,
    t(`Blended across the plan mix you set (${subs.space.standardMix}% Standard / ${100 - subs.space.standardMix}% Power for Space).`,
      `按你设定的套餐组合加权（Space 为 ${subs.space.standardMix}% 标准 / ${100 - subs.space.standardMix}% 家庭）。`));

  add("ue.life", "derived", t("Expected subscription life", "预期订阅生命周期"),
    t("How many years an average subscription is expected to keep paying, inferred from the annual retention rate.",
      "按年留存率推算，一个平均订阅预期还能持续付费多少年。"),
    `1 ÷ (1 − ${percent(forecast.subscriptions.space.ret12, 0)}) = ${space.life.toFixed(1)} ${t("years", "年")} · ${t("capped at 8", "上限 8 年")}`,
    t("A geometric-decay approximation that assumes the churn rate stays constant forever. Real cohorts usually churn fastest early and then stabilise, so this can understate long-lived cohorts and overstate weak ones.",
      "这是等比衰减近似，假设流失率永远不变。真实队列通常前期流失最快、之后趋于稳定，所以它可能低估优质队列、高估弱队列。"));

  add("ue.ltv", "derived", t("Lifetime value (LTV)", "生命周期价值"),
    t("Total gross profit expected from one customer: the hardware margin at sale plus the subscription margin over its expected life.",
      "单个客户预期贡献的总毛利：出货时的硬件毛利，加上订阅在预期生命周期内的毛利。"),
    `$${number(space.hardwareGp)} + ${percent(space.attach, 0)} × $${number(space.subAnnualGp)} × ${space.life.toFixed(1)} = $${number(space.ltv)} (Space)`,
    t("Undiscounted — future subscription profit is counted at face value, so a discounted LTV would be meaningfully lower. Luya Y has no consumables attached, so its LTV is hardware margin only.",
      "未做折现——未来的订阅利润按面值计入，折现后的 LTV 会明显更低。Luya Y 没有耗材订阅，所以它的 LTV 只有硬件毛利。"));

  add("ue.cac", "input", t("Customer acquisition cost (CAC)", "获客成本 (CAC)"),
    t("The cost to acquire one customer, blended across every channel including organic and referral, and held flat across all five years.",
      "获取一个客户的成本，按全部渠道混合计算（含自然流量与推荐），并在五年内保持不变。"),
    `${t("Space", "Space")} $${model.products.space.cac} · ${t("Lab", "Lab")} $${model.products.lab.cac} · ${t("Luya Y", "Luya Y")} $${model.products.y.cac} × ${forecast.scenario.cacScale}× ${t("scenario", "情景")}`,
    t("Your assumption, and the least evidenced number on this page. Two things worth stress-testing: blending organic volume into the average flatters it, and holding CAC flat while units grow 12× assumes paid channels never saturate.",
      "这是你的假设，也是本页最缺乏证据支撑的数字。两点值得压力测试：把自然流量混进平均值会美化它；以及在销量增长 12 倍的同时保持 CAC 不变，等于假设付费渠道永不饱和。"));

  add("ue.ratio", "derived", t("LTV / CAC", "LTV / CAC"),
    t("How many times over a customer repays what it cost to acquire them. Above 3× is the usual health threshold for consumer subscription businesses.",
      "一个客户能把获取他的成本偿还多少倍。消费订阅业务通常以 3× 作为健康线。"),
    `$${number(space.ltv)} ÷ $${number(space.cac)} = ${space.ratio.toFixed(1)}× (Space)`,
    t("Both sides are soft: LTV depends on unvalidated retention, CAC on an unvalidated acquisition assumption. Treat the ratio as a hypothesis to test in 2026, not as a result.",
      "分子分母都不硬：LTV 依赖尚未验证的留存，CAC 依赖尚未验证的获客假设。请把这个比值当作 2026 年要去验证的假设，而不是已经成立的结论。"));

  add("ue.payback", "derived", t("CAC payback period", "获客成本回本周期"),
    t("How long it takes to earn back the acquisition cost. When hardware margin alone already exceeds CAC, payback happens the moment the device ships.",
      "收回获客成本需要多久。当单台硬件毛利本身就超过 CAC 时，回本发生在设备出货的那一刻。"),
    `$${number(space.hardwareGp)} ${t("hardware GP", "硬件毛利")} ${space.hardwareGp >= space.cac ? "≥" : "<"} $${number(space.cac)} CAC → ${space.paybackMonths === 0 ? t("recovered at sale", "出货即回本") : `${space.paybackMonths.toFixed(1)} ${t("months", "个月")}`}`,
    t("Immediate payback is unusually strong and is a direct consequence of the CAC assumption. If real CAC came in at 3–4× the assumption, payback would shift onto the subscription line and cash would behave very differently.",
      "即时回本是非常强的结论，它直接来自 CAC 假设。如果实测 CAC 是假设值的 3–4 倍，回本就要靠订阅收入来承担，现金流表现会完全不同。"));

  /* ---- cohort ---- */
  add("cohort.new", "derived", t("New C-devices", "新增 C 端设备"),
    t("Consumer devices shipped in the year — X1 Space plus X1 Lab. Luya Y is excluded because it is a B2B platform with no consumables subscription.",
      "当年出货的 C 端设备——X1 Space 加 X1 Lab。不含 Luya Y，因为它是没有耗材订阅的 B 端平台。"),
    `${number(r30.units.space)} Space + ${number(r30.units.lab)} Lab = ${number(r30.cDeviceUnits)} (2030)`,
    t("These are the units that feed new subscription cohorts each year.",
      "这些就是每年为新订阅队列提供来源的设备。"));

  add("cohort.installed", "derived", t("Cumulative installed base", "累计装机"),
    t("Every consumer device ever shipped, added up. Note this never decreases — the model does not retire or replace devices.",
      "历史累计出货的全部 C 端设备。注意它只增不减——模型不考虑设备报废或更换。"),
    `Σ ${t("new C-devices", "新增 C 端设备")} 2027–2030 = ${number(r30.installedBase)}`,
    t("Because devices never retire, the installed base is an upper bound. Over a longer horizon a replacement cycle would need to be modelled.",
      "由于设备永不报废，这个装机量是上限值。如果把预测拉长，就必须补上更换周期的建模。"));

  add("cohort.active", "derived", t("Ending active subscriptions", "年末活跃订阅"),
    t("Subscriptions still paying at year end: the surviving portion of last year's base plus the surviving portion of this year's new cohort.",
      "年末仍在付费的订阅数：上一年存量的存活部分，加上当年新队列的存活部分。"),
    `${t("beginning", "期初")} × ${percent(forecast.subscriptions.space.ret12, 0)} + ${t("new attached", "新增加入")} × ${percent(forecast.subscriptions.space.ret6, 0)} → ${number(r30.activeSubscribers)} (2030)`,
    t(`Only ${percent(r30.activeSubscribers / Math.max(r30.installedBase, 1), 0)} of the 2030 installed base is still subscribing. That gap between devices sold and devices paying is the single clearest thing the Founder 100 year needs to measure.`,
      `2030 年累计装机中只有 ${percent(r30.activeSubscribers / Math.max(r30.installedBase, 1), 0)} 仍在订阅。卖出的设备与仍在付费的设备之间的这个落差，是 Founder 100 阶段最需要实测清楚的一件事。`));

  /* ---- go-to-market ---- */
  add("gtm.net", "input", t("Channel net price %", "渠道净价 %"),
    t("The share of list price you actually keep after that channel takes its cut. 100% means you keep everything; 60% means the channel takes 40 points.",
      "该渠道抽成之后，你实际留下的挂牌价比例。100% 表示全额留存；60% 表示渠道拿走 40 个点。"),
    `${t("Amazon", "亚马逊")} ${model.gtm.amazon.net}% · ${t("retail / distributor", "零售经销")} ${model.gtm.retail.net}% · ${t("direct channels", "直营渠道")} 100% → ${t("2030 blended", "2030 加权")} ${percent(r30.spaceChannelFactor, 1)}`,
    t("Editable per channel. Shifting volume between direct and retail changes gross margin without changing a single unit of the sales plan — which is why the channel mix matters as much as the total.",
      "可按渠道逐一修改。在直营与零售之间挪动销量，会在销售计划一台不变的情况下改变毛利率——这就是渠道结构和总量同样重要的原因。"));

  /* ---- investor view ---- */
  add("inv.tamAnnual", "derived", t("2030 annual penetration", "2030 年度渗透率"),
    t("Annual consumer device shipments as a share of target households. A flow measure — what you sell in one year, not what is installed.",
      "当年 C 端设备出货量占目标家庭数的比例。这是流量口径——一年卖出多少，而不是累计装了多少。"),
    `${number(r30.cDeviceUnits)} ÷ ${number(model.tam)} = ${percent(r30.tamPenetration, 2)}`,
    t("Presented purely as a sanity check. Nothing in this model is derived from TAM — the forecast is built bottom-up from channels and then compared against market size, never the other way round.",
      "仅作合理性校验之用。本模型没有任何数字是从 TAM 推导出来的——预测是从渠道自下而上搭起来、再拿去和市场规模对照，而不是反过来。"));

  add("inv.tamCum", "derived", t("2030 cumulative penetration", "2030 累计渗透率"),
    t("Total installed base as a share of target households. A stock measure — the right one for judging whether saturation is anywhere close.",
      "累计装机量占目标家庭数的比例。这是存量口径——判断是否接近市场饱和应该看这个数。"),
    `${number(r30.installedBase)} ÷ ${number(model.tam)} = ${percent(r30.tamCumulative, 2)}`,
    t("Both penetration figures are shown because quoting only the annual one understates how much of the market has already been taken by the end of the forecast.",
      "两个口径都列出来，是因为只报年度渗透率会低估预测期末实际已占领的市场份额。"));

  add("inv.breakEven", "derived", t("EBITDA break-even", "经营盈亏平衡"),
    t("The first year operating profit turns positive. Note this is not the same as being cash-positive — working capital keeps cash negative for longer.",
      "经营利润首次转正的年份。注意这与「现金转正」不是一回事——营运资金会让现金在更长时间内保持为负。"),
    breakEven
      ? `${t("EBITDA positive", "经营利润转正")} ${breakEven.year} (${money(breakEven.ebitda)}) · ${t("cash positive", "现金转正")} ${forecast.rows.find((row) => row.endingCash >= 0)?.year ?? t("beyond 2030", "2030 年以后")}`
      : t("No positive EBITDA year in the forecast window", "预测期内没有经营利润为正的年份"),
    t("The gap between these two dates is the part founders most often miss, and it is exactly the window an investor will ask you to bridge.",
      "这两个时点之间的差距，是创始人最容易忽略的部分，也恰恰是投资人会要求你说明如何跨过去的那段窗口。"));

  return map;
}

function scenarioSign(delta) {
  if (!delta) return "+0%";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}%`;
}

/* money() already carries its own sign, so a subtraction chain has to flip the
   operator rather than prefix a second minus. */
const lessTerm = (value) => `${value < 0 ? "+" : "−"} ${money(Math.abs(value))}`;

/* ------------------------------------------------------------------ shell -- */

let lastForecast = null;

function render({ rebuildTables = true } = {}) {
  const forecast = calculateForecast(model);
  const allScenarios = {
    bear: activeScenario === "bear" ? forecast : calculateForecast(model, "bear"),
    base: activeScenario === "base" ? forecast : calculateForecast(model, "base"),
    bull: activeScenario === "bull" ? forecast : calculateForecast(model, "bull"),
  };
  const economics = ["space", "lab", "y"].map((key) => unitEconomics(model, forecast, key));
  lastForecast = forecast;
  definitions = buildDefinitions(forecast, economics);

  renderKpis(forecast, economics);
  renderExecutive(forecast);
  renderCash(forecast);
  renderWaterfall(forecast);
  renderUnitEconomics(economics);
  renderSensitivity(forecast, rebuildTables);
  renderProductModel(forecast, rebuildTables);
  renderConsumables(forecast);
  renderGtm(forecast, rebuildTables);
  renderInvestorView(forecast, allScenarios);
  renderMethodology(forecast);

  const founder = model.founder;
  const validation = forecast.rows[0];
  document.getElementById("kpiValidationNote").textContent =
    `${number(founder.validationUnits)} ${t("validation", "验证")} · ${number(founder.kolUnits)} KOL · ${number(founder.paidUnits)} ${t("sold", "原价销售")}`;
  document.getElementById("validationNote").textContent = t(
    `Of the Founder ${founderTotalUnits(model)}, ${founder.validationUnits} units run the validation programme and ${founder.kolUnits} go to KOLs — both expensed, no revenue. The remaining ${founder.paidUnits} are sold at list price, booking ${money(validation.totalRevenue)} of 2026 revenue and seeding the first subscription cohort. The eight targets above are what this cohort has to prove before any money is spent scaling: they are the source of the attach and retention assumptions the entire forecast rests on.`,
    `Founder ${founderTotalUnits(model)} 中，${founder.validationUnits} 台用于验证计划、${founder.kolUnits} 台赠送 KOL —— 两者均直接费用化、不产生收入。剩余 ${founder.paidUnits} 台按原价销售，为 2026 年带来 ${money(validation.totalRevenue)} 收入，并构成第一批订阅队列。上方八项指标就是这批用户在规模化投放前必须验证的内容：整个预测赖以成立的加入率与留存率，全部来源于此。`
  );
  document.getElementById("founderPreview").textContent =
    `${number(founderTotalUnits(model))} ${t("units", "台")} · ${money(founderProgramCost(model))} · KOL ${number(founder.preToolingUnitCostRmb + founder.kolPromoPerUnitRmb)} RMB/${t("unit", "台")}`;
  const soldGp = validation.hardware.space.revenue - validation.hardware.space.cogs;
  const marginBox = document.getElementById("founderMarginPreview");
  marginBox.textContent = `${money(soldGp)} · $${number(validation.hardware.space.netAsp)} ${t("price vs", "售价 vs")} $${number(validation.hardware.space.unitCost)} ${t("cost", "成本")}`;
  marginBox.parentElement.classList.toggle("warn-box", soldGp < 0);
  document.getElementById("capexPreview").textContent =
    `${number(model.capexRmb.reduce((a, b) => a + (b || 0), 0))} RMB · ${money(forecast.rows.reduce((sum, row) => sum + row.capex, 0))}`;
  document.getElementById("teamCostPreview").textContent = money(annualTeamCost(model));
  document.getElementById("spaceNetPreview").textContent = `$${number(forecast.rows[4].hardware.space.netAsp)} · ${percent(forecast.rows[4].spaceChannelFactor, 1)}`;
  document.querySelectorAll("[data-scenario]").forEach((button) => button.classList.toggle("active", button.dataset.scenario === activeScenario));
  if (pinnedDefinition) showDefinition(pinnedDefinition.key, pinnedDefinition.anchor, true);
  persist();
}

/* ------------------------------------------------- definition popover UI -- */

const definitionPopover = document.getElementById("definitionPopover");
let pinnedDefinition = null;
let definitionTimer = null;

function positionPopover(anchor) {
  definitionPopover.style.left = "0px";
  definitionPopover.style.top = "0px";
  const box = definitionPopover.getBoundingClientRect();
  const target = anchor.getBoundingClientRect();
  const margin = 10;
  let left = target.left + target.width / 2 - box.width / 2;
  left = Math.min(Math.max(left, margin), window.innerWidth - box.width - margin);
  let top = target.bottom + 8;
  if (top + box.height > window.innerHeight - margin) {
    const above = target.top - box.height - 8;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - box.height - margin);
  }
  definitionPopover.style.left = `${left}px`;
  definitionPopover.style.top = `${top}px`;
}

function showDefinition(key, anchor, pinned) {
  const def = definitions[key];
  if (!def || !anchor.isConnected) return;
  definitionPopover.innerHTML = `
    <header>
      <h4>${escapeHtml(def.label)}</h4>
      <span class="def-basis def-basis-${def.basis}">${escapeHtml(BASIS[def.basis]())}</span>
    </header>
    <p class="def-what">${escapeHtml(def.what)}</p>
    <div class="def-how"><span>${t("How it is calculated", "计算口径")}</span><code>${escapeHtml(def.how)}</code></div>
    <p class="def-source"><span>${t("What it rests on", "依据来源")}</span>${escapeHtml(def.source)}</p>
    ${pinned ? `<button type="button" class="def-close" id="definitionClose">${t("Close", "关闭")}</button>` : `<p class="def-hint">${t("Click to pin", "点击可固定")}</p>`}`;
  definitionPopover.hidden = false;
  definitionPopover.classList.toggle("pinned", !!pinned);
  positionPopover(anchor);
}

function hideDefinition(force) {
  if (pinnedDefinition && !force) return;
  pinnedDefinition = null;
  definitionPopover.hidden = true;
  document.querySelectorAll("[data-def].def-active").forEach((el) => el.classList.remove("def-active"));
}

document.addEventListener("pointerover", (event) => {
  const anchor = event.target.closest?.("[data-def]");
  if (!anchor || pinnedDefinition) return;
  clearTimeout(definitionTimer);
  definitionTimer = setTimeout(() => showDefinition(anchor.dataset.def, anchor, false), 90);
});

document.addEventListener("pointerout", (event) => {
  if (pinnedDefinition) return;
  const anchor = event.target.closest?.("[data-def]");
  if (!anchor || anchor.contains(event.relatedTarget)) return;
  clearTimeout(definitionTimer);
  hideDefinition();
});

document.addEventListener("click", (event) => {
  const anchor = event.target.closest?.("[data-def]");
  if (anchor) {
    /* Don't hijack a click that was meant for a control inside the element. */
    if (event.target.closest("input, select, button")) return;
    if (pinnedDefinition && pinnedDefinition.anchor === anchor) {
      hideDefinition(true);
      return;
    }
    hideDefinition(true);
    pinnedDefinition = { key: anchor.dataset.def, anchor };
    anchor.classList.add("def-active");
    showDefinition(anchor.dataset.def, anchor, true);
    return;
  }
  if (!event.target.closest("#definitionPopover") || event.target.id === "definitionClose") hideDefinition(true);
});

document.addEventListener("focusin", (event) => {
  const anchor = event.target.closest?.("[data-def]");
  if (anchor) showDefinition(anchor.dataset.def, anchor, false);
});

document.addEventListener("focusout", (event) => {
  if (event.target.closest?.("[data-def]")) hideDefinition();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideDefinition(true);
});

window.addEventListener("resize", () => hideDefinition(true));

document.addEventListener("scroll", () => {
  if (pinnedDefinition) positionPopover(pinnedDefinition.anchor);
  else hideDefinition();
}, true);

/* -------------------------------------------------------------- persistence */

const encode = (text) => btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(""));
const decode = (text) => new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch ?? base;
  const result = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (!(key in result)) return;
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value;
  });
  return result;
}

function snapshot() {
  return JSON.stringify({ model, scenario: activeScenario, lang, waterfallYear });
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, snapshot());
  } catch (error) {
    /* private browsing or storage disabled — the app still works, just not across reloads */
  }
}

function restore() {
  let payload = null;
  const hash = location.hash.match(/^#m=(.+)$/);
  if (hash) {
    try {
      payload = JSON.parse(decode(hash[1]));
    } catch (error) {
      payload = null;
    }
  }
  if (!payload) {
    try {
      payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      payload = null;
    }
  }
  if (!payload) return;
  if (payload.model) model = deepMerge(structuredClone(defaultModel), payload.model);
  if (scenarioConfig[payload.scenario]) activeScenario = payload.scenario;
  if (["en", "zh", "both"].includes(payload.lang)) lang = payload.lang;
  if (years.includes(payload.waterfallYear)) waterfallYear = payload.waterfallYear;
}

/* ------------------------------------------------------------------ export */

function exportCsv() {
  const forecast = lastForecast || calculateForecast(model);
  const header = [
    "Year", "Stage", "Space units", "Lab units", "Luya Y units", "Total units",
    "Space hardware revenue", "Lab hardware revenue", "Luya Y hardware revenue",
    "Hardware revenue (net)", "Consumables revenue", "Total revenue",
    "COGS", "Warranty", "Gross profit", "Gross margin",
    "S&M (CAC)", "R&D", "G&A", "Team", "Support", "Validation",
    "EBITDA", "Tax", "Inventory", "Receivables", "Payables", "Change in NWC", "Capex",
    "Free cash flow", "Ending cash", "Installed base", "Active subscriptions", "Recurring mix",
  ];
  const round = (value) => Math.round(value * 100) / 100;
  const lines = forecast.rows.map((row) =>
    [
      row.year, stageText[years.indexOf(row.year)][0],
      row.units.space, row.units.lab, row.units.y, row.totalUnits,
      round(row.hardware.space.revenue), round(row.hardware.lab.revenue), round(row.hardware.y.revenue),
      round(row.hardwareRevenue), round(row.consumablesRevenue), round(row.totalRevenue),
      round(row.hardwareCogs + row.consumablesCogs), round(row.warrantyCost), round(row.grossProfit), round(row.grossMargin),
      round(row.opex.salesMarketingExpense), round(row.opex.rdExpense), round(row.opex.gaExpense),
      round(row.opex.teamExpense), round(row.opex.supportExpense), round(row.opex.validationExpense),
      round(row.ebitda), round(row.tax), round(row.inventory), round(row.receivables), round(row.payables),
      round(row.deltaNwc), round(row.capex), round(row.freeCashFlow), round(row.endingCash),
      round(row.installedBase), round(row.activeSubscribers), round(row.recurringMix),
    ].join(",")
  );
  const csv = `﻿${header.join(",")}\n${lines.join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `luya-forecast-${activeScenario}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(t("CSV downloaded", "CSV 已下载"));
}

let toastTimer = null;
function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 2400);
}

/* ------------------------------------------------------------------ events */

Object.entries(inputBindings).forEach(([id, path]) => {
  document.getElementById(id)?.addEventListener("input", (event) => {
    setPath(model, path, Number(event.target.value) || 0);
    render();
  });
});

/* Table inputs live inside markup that render() rebuilds. Rebuilding the table
   the user is typing in destroys the focused node, so those edits re-render
   everything except the editable tables and patch the derived cells in place. */
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches(".unit-input")) {
    model.units[target.dataset.product][Number(target.dataset.yearIndex)] = Number(target.value) || 0;
    render({ rebuildTables: false });
  } else if (target.matches(".gtm-input")) {
    model.gtm[target.dataset.channel].values[Number(target.dataset.yearIndex)] = Number(target.value) || 0;
    render({ rebuildTables: false });
  } else if (target.matches(".net-input")) {
    model.gtm[target.dataset.channel].net = Number(target.value) || 0;
    render({ rebuildTables: false });
  }
});

document.querySelectorAll("[data-scenario]").forEach((button) => {
  button.addEventListener("click", () => {
    activeScenario = button.dataset.scenario;
    render();
  });
});

/* Sliders live inside markup that a full render rebuilds, so dragging one only
   refreshes the readouts — never the slider being held. */
document.addEventListener("input", (event) => {
  if (!event.target.matches(".driver-slider")) return;
  const slider = DRIVER_SLIDERS[Number(event.target.dataset.driver)];
  setPath(model, slider.path, Number(event.target.value) || 0);
  syncInputs();
  render({ rebuildTables: false });
});

document.querySelectorAll("[data-tornado]").forEach((button) => {
  button.addEventListener("click", () => {
    tornadoMetric = button.dataset.tornado;
    render({ rebuildTables: false });
  });
});

document.getElementById("resetDrivers").addEventListener("click", () => {
  DRIVER_SLIDERS.forEach((slider) => setPath(model, slider.path, getPath(defaultModel, slider.path)));
  syncInputs();
  render();
  toast(t("Sliders reset to plan", "滑块已恢复到计划值"));
});

document.querySelectorAll("[data-lang-set]").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.langSet;
    applyLang();
    render();
  });
});

document.getElementById("waterfallYear").addEventListener("change", (event) => {
  waterfallYear = Number(event.target.value);
  render();
});

document.getElementById("resetButton").addEventListener("click", () => {
  model = structuredClone(defaultModel);
  activeScenario = "base";
  waterfallYear = 2027;
  history.replaceState(null, "", location.pathname + location.search);
  syncInputs();
  render();
  toast(t("Assumptions reset", "假设已重置"));
});

document.getElementById("exportButton").addEventListener("click", exportCsv);
document.getElementById("printButton").addEventListener("click", () => {
  document.querySelectorAll("details").forEach((element) => element.setAttribute("open", ""));
  window.print();
});

document.getElementById("shareButton").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#m=${encode(snapshot())}`;
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url);
    toast(t("Link copied to clipboard", "链接已复制"));
  } catch (error) {
    toast(t("Link is in the address bar", "链接已生成在地址栏"));
  }
});

/* Shared tooltip for every chart. */
const tooltip = document.getElementById("chartTooltip");
document.addEventListener("mousemove", (event) => {
  const hit = event.target.closest?.("[data-tip]");
  if (!hit) {
    tooltip.hidden = true;
    return;
  }
  tooltip.innerHTML = hit.dataset.tip;
  tooltip.hidden = false;
  const box = tooltip.getBoundingClientRect();
  const left = Math.min(Math.max(event.clientX + 16, 8), window.innerWidth - box.width - 8);
  const top = Math.max(event.clientY - box.height - 12, 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
});
document.addEventListener("scroll", () => {
  tooltip.hidden = true;
}, true);

/* --------------------------------------------------------------- the gate --
   A courtesy lock. The access code ships in this file and the whole model is
   in the page source, so this stops a forwarded link from opening on the first
   click — nothing more. Real access control needs a private host. */

const ACCESS_CODE = "LUYA";
const GATE_KEY = "luya-gate";

function unlock() {
  document.body.removeAttribute("data-locked");
  const gate = document.getElementById("gate");
  gate.hidden = true;
  try {
    sessionStorage.setItem(GATE_KEY, "1");
  } catch (error) {
    /* storage unavailable — the gate simply reappears next time */
  }
}

function initGate() {
  const gate = document.getElementById("gate");
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gateInput");
  const error = document.getElementById("gateError");

  let alreadyOpen = false;
  try {
    alreadyOpen = sessionStorage.getItem(GATE_KEY) === "1";
  } catch (err) {
    alreadyOpen = false;
  }
  if (alreadyOpen) {
    unlock();
    return;
  }

  gate.hidden = false;
  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim().toUpperCase() === ACCESS_CODE) {
      unlock();
      return;
    }
    error.textContent = t("That code is not right. Try again.", "访问码不正确，请重试。");
    error.hidden = false;
    form.classList.remove("shake");
    void form.offsetWidth; /* restart the animation */
    form.classList.add("shake");
    input.select();
  });

  input.addEventListener("input", () => {
    error.hidden = true;
  });
}

restore();
applyLang();
syncInputs();
render();
initGate();
