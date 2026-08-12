const defaults = {
  msrp: 599,
  usdCny: 7.2,
  targetCac: 200,
  factoryRmb: {
    plasticRmb: 500,
    sheetMetalRmb: 200,
    electricalRmb: 1000,
    packagingRmb: 150,
    assemblyRmb: 300,
  },
  landed: {
    oceanFreight: 18,
    customs: 9,
    drayage: 8,
    storage: 6,
    fulfillment: 5,
    domesticShipping: 30,
    paymentFee: 18,
    warrantyReserve: 12,
  },
  trayUnitCost: 1.1,
  trayShipping: 8,
  freeShippingThreshold: 72,
};

let model = structuredClone(defaults);

const bindings = {
  msrp: ["msrp"],
  usdCny: ["usdCny"],
  targetCac: ["targetCac"],
  plasticRmb: ["factoryRmb", "plasticRmb"],
  sheetMetalRmb: ["factoryRmb", "sheetMetalRmb"],
  electricalRmb: ["factoryRmb", "electricalRmb"],
  packagingRmb: ["factoryRmb", "packagingRmb"],
  assemblyRmb: ["factoryRmb", "assemblyRmb"],
  oceanFreight: ["landed", "oceanFreight"],
  customs: ["landed", "customs"],
  drayage: ["landed", "drayage"],
  storage: ["landed", "storage"],
  fulfillment: ["landed", "fulfillment"],
  domesticShipping: ["landed", "domesticShipping"],
  paymentFee: ["landed", "paymentFee"],
  warrantyReserve: ["landed", "warrantyReserve"],
  trayUnitCost: ["trayUnitCost"],
  trayShipping: ["trayShipping"],
  freeShippingThreshold: ["freeShippingThreshold"],
};

const getPath = (object, path) => path.reduce((value, key) => value[key], object);
function setPath(object, path, value) {
  const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
  parent[path.at(-1)] = value;
}

const money = (value, digits = 0) => {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(digits)}`;
};
const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const number = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function economics() {
  const factoryRmb = Object.values(model.factoryRmb).reduce((sum, value) => sum + value, 0);
  const factoryUsd = factoryRmb / Math.max(model.usdCny, 0.1);
  const logistics = model.landed.oceanFreight + model.landed.customs + model.landed.drayage;
  const commercial = Object.values(model.landed).reduce((sum, value) => sum + value, 0);
  const landedCost = factoryUsd + commercial;
  const manufacturingMargin = model.msrp - factoryUsd;
  const contribution = model.msrp - landedCost;
  const afterCac = contribution - model.targetCac;
  return { factoryRmb, factoryUsd, logistics, commercial, landedCost, manufacturingMargin, contribution, afterCac };
}

const trayPlans = [
  { name: "Starter", trays: 8, price: 29, tag: "", luyaPaysShipping: false },
  { name: "Standard", trays: 16, price: 50, tag: "", luyaPaysShipping: true },
  { name: "Family", trays: 24, price: 72, tag: "Most Popular", luyaPaysShipping: true },
  { name: "Pro", trays: 32, price: 92, tag: "Best Value", luyaPaysShipping: true },
];

function trayEconomics(plan) {
  const productCost = plan.trays * model.trayUnitCost;
  const freeShipping = plan.price >= model.freeShippingThreshold;
  const shipping = plan.luyaPaysShipping ? model.trayShipping : 0;
  const contribution = plan.price - productCost - shipping;
  return { ...plan, productCost, shipping, contribution, margin: contribution / plan.price, perTray: plan.price / plan.trays, freeShipping };
}

function renderKpis(e) {
  document.getElementById("kpiMsrp").textContent = money(model.msrp);
  document.getElementById("kpiFactory").textContent = money(e.factoryUsd);
  document.getElementById("kpiFactoryMargin").textContent = `${percent(e.manufacturingMargin / model.msrp)} manufacturing margin`;
  document.getElementById("kpiLanded").textContent = money(e.landedCost);
  document.getElementById("kpiContribution").textContent = money(e.contribution);
  document.getElementById("kpiContributionMargin").textContent = `${percent(e.contribution / model.msrp)} of MSRP`;
  const afterCac = document.getElementById("kpiAfterCac");
  afterCac.textContent = money(e.afterCac);
  afterCac.className = e.afterCac >= 0 ? "profit" : "loss";
  document.getElementById("kpiBreakEvenCac").textContent = `Break-even CAC: ${money(e.contribution)}`;
}

function renderHardware(e) {
  const layers = [
    { label: "Factory", value: e.factoryUsd },
    { label: "Ocean", value: model.landed.oceanFreight },
    { label: "Customs", value: model.landed.customs },
    { label: "Drayage", value: model.landed.drayage },
    { label: "3PL", value: model.landed.storage },
    { label: "Fulfillment", value: model.landed.fulfillment },
    { label: "US delivery", value: model.landed.domesticShipping },
    { label: "Fees & warranty", value: model.landed.paymentFee + model.landed.warrantyReserve },
  ];
  const max = Math.max(...layers.map((item) => item.value), 1);
  document.getElementById("costBridge").innerHTML = layers.map((item) => `
    <article class="cost-bar">
      <strong>${money(item.value)}</strong>
      <div class="cost-column" style="height:${Math.max(3, item.value / max * 135)}px"></div>
      <span>${item.label}</span>
    </article>`).join("");

  const rows = [
    ["Factory cost / 工厂制造", e.factoryUsd, "Supply-chain capability / 供应链能力"],
    ["International logistics / 国际物流", e.logistics, "China → US 3PL"],
    ["3PL storage & inbound / 入库仓储", model.landed.storage, "45-day inventory assumption"],
    ["Fulfillment / 订单履约", model.landed.fulfillment, "Pick, pack, label"],
    ["US delivery / 美国配送", model.landed.domesticShipping, "UPS / FedEx Ground average"],
    ["Payment fee / 支付手续费", model.landed.paymentFee, "Stripe budget"],
    ["Warranty reserve / 售后准备金", model.landed.warrantyReserve, "Support, DOA, parts"],
  ];
  document.getElementById("hardwareRows").innerHTML = rows.map(([label, value, use]) => `
    <tr><td><strong>${label}</strong></td><td>${money(value)}</td><td>${percent(value / model.msrp)}</td><td>${use}</td></tr>`).join("") +
    `<tr class="total-row"><td>Landed Cost / 商业落地成本</td><td>${money(e.landedCost)}</td><td>${percent(e.landedCost / model.msrp)}</td><td>Commercial unit economics / 商业模型标准</td></tr>`;
  document.getElementById("landedBadge").textContent = `${money(e.landedCost)} / unit`;
  document.getElementById("factoryPreview").textContent = `¥${number(e.factoryRmb)} · ${money(e.factoryUsd)}`;
}

function renderCac(e) {
  const maxCac = Math.max(300, model.targetCac * 1.35, e.contribution * 1.35);
  const breakEvenPosition = Math.min(100, e.contribution / maxCac * 100);
  const targetPosition = Math.min(100, model.targetCac / maxCac * 100);
  document.getElementById("cacGauge").innerHTML = `
    <div class="cac-marker marker-break-even" style="left:${breakEvenPosition}%"><span class="cac-label">Break-even ${money(e.contribution)}</span></div>
    <div class="cac-marker marker-target" style="left:${targetPosition}%"><span class="cac-label">Target ${money(model.targetCac)}</span></div>`;
  const values = [100, 150, model.targetCac, 250];
  document.getElementById("cacScenarios").innerHTML = values.map((cac) => {
    const profit = e.contribution - cac;
    return `<article><span>CAC ${money(cac)}</span><strong class="${profit >= 0 ? "profit" : "loss"}">${money(profit)}</strong><small>first-order profit / 首单利润</small></article>`;
  }).join("");
}

function renderTrays() {
  const plans = trayPlans.map(trayEconomics);
  document.getElementById("thresholdBadge").textContent = money(model.freeShippingThreshold);
  document.getElementById("trayCards").innerHTML = plans.map((plan) => `
    <article class="tray-card ${plan.name === "Family" ? "featured" : plan.name === "Pro" ? "best" : ""}">
      ${plan.tag ? `<em>${plan.tag}</em>` : ""}
      <span>${plan.name} · ${plan.trays} Tray</span>
      <strong>${money(plan.price)}</strong>
      <small>${money(plan.perTray, 2)} / tray · ${plan.freeShipping ? "Free shipping" : plan.shipping ? "Shipping budget included" : "Customer pays shipping"}</small>
      <dl><dt>Contribution</dt><dd>${money(plan.contribution, 1)}</dd><dt>Margin</dt><dd>${percent(plan.margin)}</dd></dl>
    </article>`).join("");
  document.getElementById("trayRows").innerHTML = plans.map((plan) => `
    <tr><td><strong>${plan.name}</strong></td><td>${plan.trays}</td><td>${money(plan.price)}</td><td>${money(plan.perTray, 2)}</td><td>${money(plan.productCost, 2)}</td><td>${plan.shipping ? money(plan.shipping) : "Customer"}</td><td><strong>${money(plan.contribution, 2)}</strong></td><td>${percent(plan.margin)}</td></tr>`).join("");
}

function syncInputs() {
  Object.entries(bindings).forEach(([id, path]) => {
    const input = document.getElementById(id);
    if (input) input.value = getPath(model, path);
  });
}

function render() {
  const e = economics();
  renderKpis(e);
  renderHardware(e);
  renderCac(e);
  renderTrays();
}

Object.entries(bindings).forEach(([id, path]) => {
  document.getElementById(id)?.addEventListener("input", (event) => {
    setPath(model, path, Number(event.target.value) || 0);
    render();
  });
});

document.getElementById("resetButton").addEventListener("click", () => {
  model = structuredClone(defaults);
  syncInputs();
  render();
});

const ACCESS_CODE = "LUYA";
const GATE_KEY = "luya-gate";

function unlock() {
  document.body.removeAttribute("data-locked");
  document.getElementById("gate").hidden = true;
  try {
    sessionStorage.setItem(GATE_KEY, "1");
  } catch (error) {
    /* The courtesy gate simply reappears when storage is unavailable. */
  }
}

function initGate() {
  const gate = document.getElementById("gate");
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gateInput");
  const error = document.getElementById("gateError");
  try {
    if (sessionStorage.getItem(GATE_KEY) === "1") {
      unlock();
      return;
    }
  } catch (storageError) {
    /* Continue with the gate visible. */
  }
  input.focus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim().toUpperCase() === ACCESS_CODE) {
      unlock();
      return;
    }
    error.textContent = "访问码不正确，请重试。 / Incorrect code.";
    error.hidden = false;
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
    input.select();
  });
  input.addEventListener("input", () => {
    error.hidden = true;
  });
}

syncInputs();
render();
initGate();
