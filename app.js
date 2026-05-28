const years = [2026, 2027, 2028, 2029];

const baseAssumptions = {
  tam: 30000000,
  launchYearUnits: 3000,
  price: 899,
  hardwareCogs: 399,
  subscriptionFee: 360,
  subscriptionCogs: 30,
  penetrationScale: 100,
  churnScale: 100,
  teamHeadcount: 15,
  monthlySalaryRmb: 20000,
  monthlyRentRmb: 30000,
  monthlySpendCapRmb: 400000,
  usdCny: 7.2,
  teamGrowth: 20,
  salesMarketingStart: 45,
  salesMarketingEnd: 18,
  rdPct: 8,
  gaPct: 6,
  supportCost: 24,
  startingCash: 1800000,
  penetration: [0, 0.002, 0.005, 0.012],
  churn: [0, 0.1, 0.15, 0.15],
};

const scenarioScales = {
  downside: { penetrationScale: 75, churnScale: 115 },
  base: { penetrationScale: 100, churnScale: 100 },
  upside: { penetrationScale: 125, churnScale: 90 },
};

const inputs = {
  tam: document.getElementById("tam"),
  launchYearUnits: document.getElementById("launchYearUnits"),
  price: document.getElementById("price"),
  hardwareCogs: document.getElementById("hardwareCogs"),
  subscriptionFee: document.getElementById("subscriptionFee"),
  subscriptionCogs: document.getElementById("subscriptionCogs"),
  penetrationScale: document.getElementById("penetrationScale"),
  churnScale: document.getElementById("churnScale"),
  teamHeadcount: document.getElementById("teamHeadcount"),
  monthlySalaryRmb: document.getElementById("monthlySalaryRmb"),
  monthlyRentRmb: document.getElementById("monthlyRentRmb"),
  monthlySpendCapRmb: document.getElementById("monthlySpendCapRmb"),
  usdCny: document.getElementById("usdCny"),
  teamGrowth: document.getElementById("teamGrowth"),
  salesMarketingStart: document.getElementById("salesMarketingStart"),
  salesMarketingEnd: document.getElementById("salesMarketingEnd"),
  rdPct: document.getElementById("rdPct"),
  gaPct: document.getElementById("gaPct"),
  supportCost: document.getElementById("supportCost"),
  startingCash: document.getElementById("startingCash"),
};

let state = { ...baseAssumptions };

function money(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function number(value) {
  return Math.round(value).toLocaleString("en-US");
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function rmb(value) {
  return `RMB ${Math.round(value).toLocaleString("en-US")}`;
}

function annualTeamCostUsd(model) {
  const payrollAndRent = model.teamHeadcount * model.monthlySalaryRmb + model.monthlyRentRmb;
  const monthlyTeamSpend = Math.min(payrollAndRent, model.monthlySpendCapRmb);
  return (monthlyTeamSpend * 12) / model.usdCny;
}

function monthlyTeamSpendRmb(model) {
  const payrollAndRent = model.teamHeadcount * model.monthlySalaryRmb + model.monthlyRentRmb;
  return Math.min(payrollAndRent, model.monthlySpendCapRmb);
}

function calculateModel(model) {
  let endingSubscribers = 0;
  let endingCash = model.startingCash;

  return years.map((year, index) => {
    const penetration = model.penetration[index] * (model.penetrationScale / 100);
    const units = index === 0 ? model.launchYearUnits * (model.penetrationScale / 100) : model.tam * penetration;
    const startingSubscribers = endingSubscribers;
    const churn = index === 0 ? 0 : model.churn[index] * (model.churnScale / 100);
    const churnedSubscribers = startingSubscribers * churn;
    endingSubscribers = startingSubscribers - churnedSubscribers + units;
    const averageSubscribers = (startingSubscribers + endingSubscribers) / 2;

    const hardwareRevenue = units * model.price;
    const subscriptionRevenue = averageSubscribers * model.subscriptionFee;
    const totalRevenue = hardwareRevenue + subscriptionRevenue;
    const hardwareGrossProfit = hardwareRevenue - units * model.hardwareCogs;
    const subscriptionGrossProfit = subscriptionRevenue * (1 - model.subscriptionCogs / 100);
    const grossProfit = hardwareGrossProfit + subscriptionGrossProfit;
    const salesMarketingRate =
      (model.salesMarketingStart + ((model.salesMarketingEnd - model.salesMarketingStart) * index) / (years.length - 1)) / 100;
    const teamExpense = annualTeamCostUsd(model) * Math.pow(1 + model.teamGrowth / 100, index);
    const salesMarketingExpense = totalRevenue * salesMarketingRate;
    const rdExpense = totalRevenue * (model.rdPct / 100);
    const gaExpense = totalRevenue * (model.gaPct / 100);
    const supportExpense = endingSubscribers * model.supportCost;
    const operatingExpenses = teamExpense + salesMarketingExpense + rdExpense + gaExpense + supportExpense;
    const operatingProfit = grossProfit - operatingExpenses;
    const beginningCash = endingCash;
    endingCash = beginningCash + operatingProfit;
    const grossMargin = totalRevenue === 0 ? 0 : grossProfit / totalRevenue;
    const operatingMargin = totalRevenue === 0 ? 0 : operatingProfit / totalRevenue;

    return {
      year,
      units,
      startingSubscribers,
      endingSubscribers,
      hardwareRevenue,
      subscriptionRevenue,
      totalRevenue,
      grossProfit,
      operatingExpenses,
      opex: {
        teamExpense,
        salesMarketingExpense,
        rdExpense,
        gaExpense,
        supportExpense,
        salesMarketingRate,
      },
      operatingProfit,
      cash: {
        beginningCash,
        cashChange: operatingProfit,
        endingCash,
      },
      grossMargin,
      operatingMargin,
      subscriptionShare: totalRevenue === 0 ? 0 : subscriptionRevenue / totalRevenue,
    };
  });
}

function syncInputs() {
  inputs.tam.value = state.tam;
  inputs.launchYearUnits.value = state.launchYearUnits;
  inputs.price.value = state.price;
  inputs.hardwareCogs.value = state.hardwareCogs;
  inputs.subscriptionFee.value = state.subscriptionFee;
  inputs.subscriptionCogs.value = state.subscriptionCogs;
  inputs.penetrationScale.value = state.penetrationScale;
  inputs.churnScale.value = state.churnScale;
  inputs.teamHeadcount.value = state.teamHeadcount;
  inputs.monthlySalaryRmb.value = state.monthlySalaryRmb;
  inputs.monthlyRentRmb.value = state.monthlyRentRmb;
  inputs.monthlySpendCapRmb.value = state.monthlySpendCapRmb;
  inputs.usdCny.value = state.usdCny;
  inputs.teamGrowth.value = state.teamGrowth;
  inputs.salesMarketingStart.value = state.salesMarketingStart;
  inputs.salesMarketingEnd.value = state.salesMarketingEnd;
  inputs.rdPct.value = state.rdPct;
  inputs.gaPct.value = state.gaPct;
  inputs.supportCost.value = state.supportCost;
  inputs.startingCash.value = state.startingCash;
  document.getElementById("subscriptionCogsValue").textContent = `${state.subscriptionCogs}%`;
  document.getElementById("penetrationScaleValue").textContent = `${state.penetrationScale}%`;
  document.getElementById("churnScaleValue").textContent = `${state.churnScale}%`;
  document.getElementById("teamGrowthValue").textContent = `${state.teamGrowth}%`;
  document.getElementById("teamMonthlySpendValue").textContent = rmb(monthlyTeamSpendRmb(state));
  document.getElementById("teamAnnualUsdValue").textContent = money(annualTeamCostUsd(state));
  document.getElementById("salesMarketingStartValue").textContent = `${state.salesMarketingStart}%`;
  document.getElementById("salesMarketingEndValue").textContent = `${state.salesMarketingEnd}%`;
  document.getElementById("rdPctValue").textContent = `${state.rdPct}%`;
  document.getElementById("gaPctValue").textContent = `${state.gaPct}%`;
}

function readInputs() {
  state.tam = Number(inputs.tam.value) || 0;
  state.launchYearUnits = Number(inputs.launchYearUnits.value) || 0;
  state.price = Number(inputs.price.value) || 0;
  state.hardwareCogs = Number(inputs.hardwareCogs.value) || 0;
  state.subscriptionFee = Number(inputs.subscriptionFee.value) || 0;
  state.subscriptionCogs = Number(inputs.subscriptionCogs.value) || 0;
  state.penetrationScale = Number(inputs.penetrationScale.value) || 0;
  state.churnScale = Number(inputs.churnScale.value) || 0;
  state.teamHeadcount = Number(inputs.teamHeadcount.value) || 0;
  state.monthlySalaryRmb = Number(inputs.monthlySalaryRmb.value) || 0;
  state.monthlyRentRmb = Number(inputs.monthlyRentRmb.value) || 0;
  state.monthlySpendCapRmb = Number(inputs.monthlySpendCapRmb.value) || 0;
  state.usdCny = Number(inputs.usdCny.value) || 1;
  state.teamGrowth = Number(inputs.teamGrowth.value) || 0;
  state.salesMarketingStart = Number(inputs.salesMarketingStart.value) || 0;
  state.salesMarketingEnd = Number(inputs.salesMarketingEnd.value) || 0;
  state.rdPct = Number(inputs.rdPct.value) || 0;
  state.gaPct = Number(inputs.gaPct.value) || 0;
  state.supportCost = Number(inputs.supportCost.value) || 0;
  state.startingCash = Number(inputs.startingCash.value) || 0;
  syncInputs();
  render();
}

function setScenario(name) {
  const scenario = scenarioScales[name];
  state = {
    ...state,
    penetrationScale: scenario.penetrationScale,
    churnScale: scenario.churnScale,
  };
  document.querySelectorAll(".scenario-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === name);
  });
  syncInputs();
  render();
}

function drawRevenueChart(rows) {
  const svg = document.getElementById("revenueChart");
  const width = 720;
  const height = 320;
  const margin = { top: 24, right: 28, bottom: 42, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxRevenue = Math.max(...rows.map((row) => row.totalRevenue), 1);
  const barWidth = innerWidth / rows.length * 0.42;

  const y = (value) => margin.top + innerHeight - (value / maxRevenue) * innerHeight;
  const x = (index) => margin.left + index * (innerWidth / rows.length) + innerWidth / rows.length * 0.3;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const yy = margin.top + innerHeight - tick * innerHeight;
    svg.insertAdjacentHTML("beforeend", `<line class="grid-line" x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}"></line>`);
    svg.insertAdjacentHTML("beforeend", `<text class="chart-label" x="8" y="${yy + 4}">${money(maxRevenue * tick)}</text>`);
  });

  rows.forEach((row, index) => {
    const xx = x(index);
    const hardwareHeight = innerHeight - (y(row.hardwareRevenue) - margin.top);
    const subscriptionHeight = innerHeight - (y(row.subscriptionRevenue) - margin.top);
    const hardwareY = margin.top + innerHeight - hardwareHeight;
    const subscriptionY = hardwareY - subscriptionHeight;
    svg.insertAdjacentHTML("beforeend", `<rect class="subscription-bar" x="${xx}" y="${subscriptionY}" width="${barWidth}" height="${subscriptionHeight}"></rect>`);
    svg.insertAdjacentHTML("beforeend", `<rect class="hardware-bar" x="${xx}" y="${hardwareY}" width="${barWidth}" height="${hardwareHeight}"></rect>`);
    svg.insertAdjacentHTML("beforeend", `<text class="chart-label" x="${xx + barWidth / 2}" y="${height - 14}" text-anchor="middle">${row.year}</text>`);
  });

  svg.insertAdjacentHTML("beforeend", `<line class="axis" x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}"></line>`);
  svg.insertAdjacentHTML("beforeend", `<rect class="hardware-bar" x="${width - 174}" y="16" width="10" height="10"></rect><text class="legend-text" x="${width - 158}" y="25">Hardware</text>`);
  svg.insertAdjacentHTML("beforeend", `<rect class="subscription-bar" x="${width - 84}" y="16" width="10" height="10"></rect><text class="legend-text" x="${width - 68}" y="25">Subscription</text>`);
}

function linePath(rows, key, maxValue, minValue, width, height, margin) {
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const spread = Math.max(maxValue - minValue, 1);
  return rows
    .map((row, index) => {
      const x = margin.left + index * (innerWidth / (rows.length - 1));
      const y = margin.top + innerHeight - ((row[key] - minValue) / spread) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function drawProfitChart(rows) {
  const svg = document.getElementById("profitChart");
  const width = 720;
  const height = 320;
  const margin = { top: 24, right: 28, bottom: 42, left: 58 };
  const innerHeight = height - margin.top - margin.bottom;
  const values = rows.flatMap((row) => [row.grossProfit, row.operatingProfit]);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const y = (value) => margin.top + innerHeight - ((value - minValue) / Math.max(maxValue - minValue, 1)) * innerHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const value = minValue + (maxValue - minValue) * tick;
    const yy = y(value);
    svg.insertAdjacentHTML("beforeend", `<line class="grid-line" x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}"></line>`);
    svg.insertAdjacentHTML("beforeend", `<text class="chart-label" x="8" y="${yy + 4}">${money(value)}</text>`);
  });

  rows.forEach((row, index) => {
    const x = margin.left + index * ((width - margin.left - margin.right) / (rows.length - 1));
    svg.insertAdjacentHTML("beforeend", `<text class="chart-label" x="${x}" y="${height - 14}" text-anchor="middle">${row.year}</text>`);
  });

  svg.insertAdjacentHTML("beforeend", `<path class="gross-line" d="${linePath(rows, "grossProfit", maxValue, minValue, width, height, margin)}"></path>`);
  svg.insertAdjacentHTML("beforeend", `<path class="operating-line" d="${linePath(rows, "operatingProfit", maxValue, minValue, width, height, margin)}"></path>`);
  rows.forEach((row, index) => {
    const x = margin.left + index * ((width - margin.left - margin.right) / (rows.length - 1));
    svg.insertAdjacentHTML("beforeend", `<circle cx="${x}" cy="${y(row.grossProfit)}" r="4" fill="#c07a12"></circle>`);
    svg.insertAdjacentHTML("beforeend", `<circle cx="${x}" cy="${y(row.operatingProfit)}" r="4" fill="#7b61d8"></circle>`);
  });
  svg.insertAdjacentHTML("beforeend", `<rect x="${width - 202}" y="16" width="10" height="10" fill="#c07a12"></rect><text class="legend-text" x="${width - 186}" y="25">Gross Profit</text>`);
  svg.insertAdjacentHTML("beforeend", `<rect x="${width - 96}" y="16" width="10" height="10" fill="#7b61d8"></rect><text class="legend-text" x="${width - 80}" y="25">Operating</text>`);
}

function renderTable(rows) {
  document.getElementById("forecastRows").innerHTML = rows
    .map((row) => {
      const operatingClass = row.operatingProfit < 0 ? "negative" : "";
      return `
        <tr>
          <td>${row.year}E</td>
          <td>${number(row.units)}</td>
          <td>${money(row.hardwareRevenue)}</td>
          <td>${money(row.subscriptionRevenue)}</td>
          <td>${money(row.totalRevenue)}</td>
          <td>${money(row.grossProfit)}</td>
          <td>${money(row.operatingExpenses)}</td>
          <td class="${operatingClass}">${money(row.operatingProfit)}</td>
          <td class="${operatingClass}">${percent(row.operatingMargin)}</td>
          <td>${percent(row.grossMargin)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderOpexTable(rows) {
  document.getElementById("opexRows").innerHTML = rows
    .map((row) => {
      return `
        <tr>
          <td>${row.year}E</td>
          <td>${money(row.opex.teamExpense)}</td>
          <td>${money(row.opex.salesMarketingExpense)}</td>
          <td>${money(row.opex.rdExpense)}</td>
          <td>${money(row.opex.gaExpense)}</td>
          <td>${money(row.opex.supportExpense)}</td>
          <td>${money(row.operatingExpenses)}</td>
          <td>${percent(row.opex.salesMarketingRate)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCashTable(rows) {
  document.getElementById("cashRows").innerHTML = rows
    .map((row) => {
      const cashClass = row.cash.endingCash < 0 ? "negative" : "";
      const status = row.cash.endingCash < 0 ? "Funding needed" : row.cash.cashChange < 0 ? "Using cash" : "Cash building";
      return `
        <tr>
          <td>${row.year}E</td>
          <td>${money(row.cash.beginningCash)}</td>
          <td class="${row.cash.cashChange < 0 ? "negative" : ""}">${money(row.cash.cashChange)}</td>
          <td class="${cashClass}">${money(row.cash.endingCash)}</td>
          <td class="${cashClass}">${status}</td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  const rows = calculateModel(state);
  const finalYear = rows.at(-1);
  const lowestCashYear = rows.reduce((lowest, row) => (row.cash.endingCash < lowest.cash.endingCash ? row : lowest), rows[0]);
  const baseRows = calculateModel(baseAssumptions);
  const baseRevenue = baseRows.at(-1).totalRevenue;
  const revenueDelta = baseRevenue === 0 ? 0 : finalYear.totalRevenue / baseRevenue - 1;

  document.getElementById("metricRevenue").textContent = money(finalYear.totalRevenue);
  document.getElementById("metricRevenueDelta").textContent = `${revenueDelta >= 0 ? "+" : ""}${percent(revenueDelta)} vs. base`;
  document.getElementById("metricGrossProfit").textContent = money(finalYear.grossProfit);
  document.getElementById("metricGrossMargin").textContent = `${percent(finalYear.grossMargin)} gross margin`;
  document.getElementById("metricOperatingProfit").textContent = money(finalYear.operatingProfit);
  document.getElementById("metricOperatingMargin").textContent = `${percent(finalYear.operatingMargin)} operating margin`;
  document.getElementById("metricSubscribers").textContent = number(finalYear.endingSubscribers);
  document.getElementById("metricSubscriptionShare").textContent = `${percent(finalYear.subscriptionShare)} subscription revenue`;
  document.getElementById("metricCash").textContent = money(finalYear.cash.endingCash);
  document.getElementById("metricCash").classList.toggle("negative", finalYear.cash.endingCash < 0);
  document.getElementById("metricCashStatus").textContent =
    lowestCashYear.cash.endingCash < 0
      ? `Lowest cash: ${money(lowestCashYear.cash.endingCash)} in ${lowestCashYear.year}`
      : "Cash positive every year";
  document.getElementById("revenuePeakLabel").textContent = `${money(finalYear.totalRevenue)} in ${finalYear.year}`;
  document.getElementById("marginLabel").textContent = `${percent(finalYear.grossMargin)} gross margin`;

  drawRevenueChart(rows);
  drawProfitChart(rows);
  renderTable(rows);
  renderOpexTable(rows);
  renderCashTable(rows);
}

Object.values(inputs).forEach((input) => input.addEventListener("input", readInputs));
document.getElementById("resetButton").addEventListener("click", () => {
  state = { ...baseAssumptions };
  document.querySelectorAll(".scenario-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === "base");
  });
  syncInputs();
  render();
});
document.querySelectorAll(".scenario-button").forEach((button) => {
  button.addEventListener("click", () => setScenario(button.dataset.scenario));
});

syncInputs();
render();
