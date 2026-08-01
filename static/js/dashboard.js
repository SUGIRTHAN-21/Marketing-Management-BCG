const BCG_RMS_THRESHOLD = 1.0;
const BCG_IGR_THRESHOLD = 10.0;
const BCG_RMS_MAX = 5.0;
const BCG_IGR_MAX = 50.0;

const MARKER_SIZE = 54;

const QUADRANT_COLORS = {
  'Star': { bg: '#dbeaff', border: '#93c5fd', text: '#1d4ed8' },
  'Cash Cow': { bg: '#d3f9e3', border: '#6ee7b7', text: '#047857' },
  'Question Mark': { bg: '#fef1c7', border: '#fcd34d', text: '#b45309' },
  'Dog': { bg: '#fdd9e2', border: '#fda4af', text: '#be123c' },
};

const PRODUCT_MARKER_COLORS = {
  'Pulsar': '#2563eb',
  'Platina': '#0d9488',
  'Dominar': '#c2410c',
  'Avenger': '#7e22ce',
  'Chetak EV': '#16a34a',
  'RE E-Tec': '#d97706',
  'Maxima': '#334155',
  'GoGo': '#059669',
  'Low-End ICE': '#e11d48',
};

const SBU_BADGE_IDS = {
  '2-Wheelers': 'sbu-badge-2w',
  '3-Wheelers': 'sbu-badge-3w',
};

function quadrantAbbr(q) {
  return { 'Star': 'Star', 'Cash Cow': 'CC', 'Question Mark': 'QM', 'Dog': 'Dog' }[q] || q;
}

let state = {
  products: {},
  sbuMapping: {},
  selectedProduct: '',
  activeSBU: '2-Wheelers',
  activeModule: 'strategic',
  previousQuadrant: {},
};

let charts = {};
let chartsInit = { strategic: false, performance: false };

document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      state.products = JSON.parse(JSON.stringify(data.products));
      state.sbuMapping = data.sbus;

      Object.values(state.products).forEach(p => recomputeProduct(p));

      Object.keys(state.products).forEach(name => {
        state.previousQuadrant[name] = state.products[name].quadrant;
      });

      state.selectedProduct = 'Pulsar';
      state.activeSBU = '2-Wheelers';
      state.activeModule = 'strategic';

      attachProductButtons();
      attachSBULabels();
      attachModuleTabs();
      attachSliders();

      applyMarkerColors();

      initStrategicCharts();
      chartsInit.strategic = true;

      refreshAll();
    })
    .catch(err => console.error('Data load failed:', err));
});

function recomputeProduct(p) {
  const competitor = p.largest_competitor_market_share > 0 ? p.largest_competitor_market_share : 0.1;
  p.relative_market_share = Math.round((p.market_share / competitor) * 100) / 100;
  p.quadrant = getQuadrant(p.relative_market_share, p.industry_growth_rate);
  p.revenue = Math.round(p.sales_volume * p.average_selling_price);
  p.profit = Math.round(p.revenue * (p.profit_margin / 100));
  p.performance_score = computePerformanceScore(p);
}

function computePerformanceScore(p) {
  const raw = (p.profit_margin * 1.8) + ((p.growth_rate - p.industry_growth_rate) * 1.2) + (p.investment_level * 0.25) + 20;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function getQuadrant(rms, igr) {
  const hi_rms = rms >= BCG_RMS_THRESHOLD;
  const hi_igr = igr >= BCG_IGR_THRESHOLD;
  if (hi_rms && hi_igr) return 'Star';
  if (hi_rms && !hi_igr) return 'Cash Cow';
  if (!hi_rms && hi_igr) return 'Question Mark';
  return 'Dog';
}

function attachProductButtons() {
  document.querySelectorAll('.product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.product;
      if (name && state.products[name]) selectProduct(name);
    });
  });
}

function attachSBULabels() {
  document.querySelectorAll('.sbu-label').forEach(label => {
    label.addEventListener('click', () => {
      const sbuName = label.dataset.sbu;
      if (!sbuName || !state.sbuMapping[sbuName]) return;

      const firstProduct = state.sbuMapping[sbuName][0];
      if (firstProduct) {
        state.selectedProduct = firstProduct;
        loadControls(firstProduct);
        updateInfoPanels();
        generateAndRenderRecommendation(state.previousQuadrant[firstProduct] || '');
        renderPerformanceAnalysis();
      }

      syncProductButtonHighlight();
      activateSBU(sbuName);
    });
  });
}

function attachModuleTabs() {
  document.querySelectorAll('.module-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const module = btn.dataset.module;
      if (!module || module === state.activeModule) return;
      switchModule(module);
    });
  });
}

function switchModule(module) {
  state.activeModule = module;

  document.querySelectorAll('.module-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.module === module);
  });

  document.getElementById('control-panel-strategic').style.display = module === 'strategic' ? '' : 'none';
  document.getElementById('control-panel-performance').style.display = module === 'performance' ? '' : 'none';
  document.getElementById('panel-strategic').style.display = module === 'strategic' ? '' : 'none';
  document.getElementById('panel-performance').style.display = module === 'performance' ? '' : 'none';

  if (module === 'performance' && !chartsInit.performance) {
    initPerformanceCharts();
    chartsInit.performance = true;
  }

  if (module === 'strategic') {
    updateBCGMatrix();
  }
}

function attachSliders() {
  document.querySelectorAll('input[data-field]').forEach(slider => {
    slider.addEventListener('input', () => {
      const field = slider.dataset.field;
      const prefix = slider.id.startsWith('sl-s-') ? 's' : 'p';
      const raw = parseFloat(slider.value);

      updateSliderDisplay(prefix, field, raw);

      const p = state.products[state.selectedProduct];
      if (!p) return;

      const prevQ = p.quadrant;
      p[field] = raw;
      recomputeProduct(p);

      const storedPrev = state.previousQuadrant[state.selectedProduct];

      syncMirrorSlider(field, raw);
      updateComputedDisplays();
      updateInfoPanels();
      updateBCGMatrix();
      updateNavQuadrantDots();
      updateAllCharts();
      updateSBUBadges();
      updateExecStrip();
      generateAndRenderRecommendation(storedPrev);
      renderPerformanceAnalysis();

      if (prevQ !== p.quadrant) {
        state.previousQuadrant[state.selectedProduct] = prevQ;
      }
    });
  });
}

function syncMirrorSlider(field, value) {
  document.querySelectorAll(`input[data-field="${field}"]`).forEach(el => {
    if (parseFloat(el.value) !== value) el.value = value;
    const prefix = el.id.startsWith('sl-s-') ? 's' : 'p';
    updateSliderDisplay(prefix, field, value);
  });
}

function selectProduct(name) {
  const p = state.products[name];
  if (!p) return;

  state.selectedProduct = name;
  loadControls(name);
  updateInfoPanels();
  generateAndRenderRecommendation(state.previousQuadrant[name] || '');
  renderPerformanceAnalysis();
  syncProductButtonHighlight();

  if (p.sbu !== state.activeSBU) {
    activateSBU(p.sbu);
  } else {
    syncSelectedMarker();
  }
}

function activateSBU(sbuName) {
  state.activeSBU = sbuName;

  document.querySelectorAll('.sbu-label').forEach(el => {
    el.classList.toggle('sbu-active', el.dataset.sbu === sbuName);
  });

  document.querySelectorAll('.product-marker').forEach(el => {
    const belongs = el.dataset.sbu === sbuName;
    el.classList.toggle('pm-visible', belongs);
  });

  updateBCGMatrix();
  syncSelectedMarker();

  updateAllCharts();
  updateSBUBadges();
  updateNavQuadrantDots();
  updateExecStrip();
}

function getBCGPosition(rms, igr) {
  let xPct;
  if (rms < BCG_RMS_THRESHOLD) {
    xPct = (rms / BCG_RMS_THRESHOLD) * 50;
  } else {
    xPct = 50 + Math.min((rms - BCG_RMS_THRESHOLD) / (BCG_RMS_MAX - BCG_RMS_THRESHOLD), 1) * 50;
  }
  xPct = Math.max(0, Math.min(100, xPct));

  let yPct;
  if (igr < BCG_IGR_THRESHOLD) {
    yPct = 100 - (igr / BCG_IGR_THRESHOLD) * 50;
  } else {
    yPct = 50 - Math.min((igr - BCG_IGR_THRESHOLD) / (BCG_IGR_MAX - BCG_IGR_THRESHOLD), 1) * 50;
  }
  yPct = Math.max(0, Math.min(100, yPct));

  return { xPct, yPct };
}

function updateBCGMatrix() {
  const matrix = document.getElementById('bcg-matrix');
  if (!matrix) return;

  const W = matrix.offsetWidth || 1;
  const H = matrix.offsetHeight || 1;
  if (!W || !H) return;

  document.querySelectorAll('.product-marker').forEach(el => {
    const productName = el.dataset.product;
    const p = state.products[productName];
    if (!p) return;

    if (el.dataset.sbu !== state.activeSBU) return;

    const { xPct, yPct } = getBCGPosition(p.relative_market_share, p.industry_growth_rate);

    const mW = el.offsetWidth || MARKER_SIZE;
    const mH = el.offsetHeight || MARKER_SIZE;

    const raw_left = (xPct / 100) * W - mW / 2;
    const raw_top = (yPct / 100) * H - mH / 2;

    el.style.left = `${Math.round(Math.max(0, Math.min(W - mW, raw_left)))}px`;
    el.style.top = `${Math.round(Math.max(0, Math.min(H - mH, raw_top)))}px`;
  });
}

function applyMarkerColors() {
  document.querySelectorAll('.product-marker').forEach(el => {
    const color = PRODUCT_MARKER_COLORS[el.dataset.product];
    if (!color) return;
    if (el.classList.contains('pm-logo')) {
      el.style.borderColor = color;
    } else {
      el.style.background = color;
    }
  });
}

function syncSelectedMarker() {
  document.querySelectorAll('.product-marker').forEach(el => {
    el.classList.toggle('pm-selected', el.dataset.product === state.selectedProduct);
  });
}

function loadControls(productName) {
  const p = state.products[productName];
  if (!p) return;

  setText('control-product-name-s', productName);
  setText('control-product-name-p', productName);

  ['market_share', 'largest_competitor_market_share', 'industry_growth_rate'].forEach(field => {
    const slider = document.getElementById(`sl-s-${field}`);
    if (slider) {
      slider.value = p[field];
      updateSliderDisplay('s', field, p[field]);
    }
  });

  ['sales_volume', 'average_selling_price', 'investment_level', 'growth_rate', 'marketing_spend', 'profit_margin'].forEach(field => {
    const slider = document.getElementById(`sl-p-${field}`);
    if (slider) {
      slider.value = p[field];
      updateSliderDisplay('p', field, p[field]);
    }
  });

  updateComputedDisplays();
}

function updateComputedDisplays() {
  const p = state.products[state.selectedProduct];
  if (!p) return;

  setValueWithUnit('val-s-relative_market_share', p.relative_market_share.toFixed(2));
  setText('val-s-quadrant', p.quadrant);
  setText('val-p-revenue', formatRevenue(p.revenue));
  setText('val-p-profit', formatRevenue(p.profit));
}

function setValueWithUnit(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const unit = el.querySelector('.slider-unit');
  if (unit) {
    el.childNodes[0].textContent = text;
  } else {
    el.textContent = text;
  }
}

function updateSliderDisplay(prefix, field, value) {
  const el = document.getElementById(`val-${prefix}-${field}`);
  if (!el) return;

  let text = '';
  switch (field) {
    case 'market_share':
    case 'largest_competitor_market_share':
    case 'industry_growth_rate':
    case 'growth_rate':
    case 'marketing_spend':
    case 'profit_margin':
      text = value.toFixed(1);
      break;
    case 'investment_level':
      text = value.toFixed(0);
      break;
    case 'sales_volume':
      text = formatNumber(value);
      break;
    case 'average_selling_price':
      text = '₹' + formatNumber(value);
      break;
    default:
      text = String(value);
  }

  setValueWithUnit(el.id, text);
}

function updateInfoPanels() {
  const name = state.selectedProduct;
  const p = state.products[name];
  if (!p) return;
  const q = p.quadrant;

  setText('info-s-product-name', name);
  setText('info-s-sbu-name', p.sbu);
  setText('info-s-market_share', p.market_share.toFixed(1) + '%');
  setText('info-s-relative_market_share', p.relative_market_share.toFixed(2) + '×');
  setText('info-s-industry_growth_rate', p.industry_growth_rate.toFixed(1) + '%');
  setText('info-s-current-quadrant', q);

  const sBadge = document.getElementById('info-s-quadrant-badge');
  if (sBadge) {
    sBadge.textContent = q;
    sBadge.className = 'quadrant-badge ' + quadrantBadgeClass(q);
  }

  setText('info-p-product-name', name);
  setText('info-p-sbu-name', p.sbu);
  setText('info-p-sales_volume', formatNumber(p.sales_volume) + ' units');
  setText('info-p-revenue', '₹' + formatRevenueLong(p.revenue));
  setText('info-p-profit', '₹' + formatRevenueLong(p.profit));
  setText('info-p-average_selling_price', '₹' + formatNumber(p.average_selling_price));
  setText('info-p-investment_level', p.investment_level + '%');
  setText('info-p-performance_score', p.performance_score);
  setText('info-p-growth_rate', p.growth_rate.toFixed(1) + '%');
  setText('info-p-industry_growth_rate', p.industry_growth_rate.toFixed(1) + '%');
  setText('info-p-marketing_spend', p.marketing_spend.toFixed(1) + '%');
  setText('info-p-profit_margin', p.profit_margin.toFixed(1) + '%');

  const gap = p.growth_rate - p.industry_growth_rate;
  const gapText = gap >= 0
    ? `${name} is growing ${gap.toFixed(1)} points faster than the industry — outperforming its segment.`
    : `${name} is growing ${Math.abs(gap).toFixed(1)} points slower than the industry — underperforming its segment.`;
  setText('info-p-growth-summary', gapText);
}

function quadrantBadgeClass(q) {
  return { 'Star': 'qb-star', 'Cash Cow': 'qb-cc', 'Question Mark': 'qb-qm', 'Dog': 'qb-dog' }[q] || 'qb-star';
}

function syncProductButtonHighlight() {
  document.querySelectorAll('.product-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.product === state.selectedProduct);
  });
}

function updateNavQuadrantDots() {
  Object.entries(state.products).forEach(([name, p]) => {
    const dot = document.getElementById(`qdot-${name}`);
    if (!dot) return;
    const c = QUADRANT_COLORS[p.quadrant];
    dot.style.background = c ? c.text : '#94a3b8';
  });
}

function updateSBUBadges() {
  Object.entries(state.sbuMapping).forEach(([sbuName, productNames]) => {
    const id = SBU_BADGE_IDS[sbuName];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;

    const totalRev = productNames.reduce((s, n) => s + (state.products[n]?.revenue || 0), 0);
    if (totalRev === 0) return;
    const wRMS = productNames.reduce((s, n) => {
      const p = state.products[n]; return s + (p ? p.relative_market_share * p.revenue : 0);
    }, 0) / totalRev;
    const wIGR = productNames.reduce((s, n) => {
      const p = state.products[n]; return s + (p ? p.industry_growth_rate * p.revenue : 0);
    }, 0) / totalRev;

    const q = getQuadrant(wRMS, wIGR);
    el.textContent = quadrantAbbr(q);
    const c = QUADRANT_COLORS[q];
    if (c) { el.style.background = c.bg; el.style.color = c.text; }
  });
}

function updateExecStrip() {
  const names = getActiveSBUProductNames();

  setText('exec-sbu-name', state.activeSBU);

  if (!names.length) {
    setText('exec-total-revenue', '—');
    setText('exec-total-volume', '—');
    setText('exec-avg-share', '—');
    const mixEl = document.getElementById('exec-mix');
    if (mixEl) mixEl.innerHTML = '—';
    setText('health-score', '—');
    updateGauge(0);
    return;
  }

  const totalRevenue = names.reduce((sum, n) => sum + (state.products[n]?.revenue || 0), 0);
  setText('exec-total-revenue', formatRevenue(totalRevenue));

  const totalVolume = names.reduce((sum, n) => sum + (state.products[n]?.sales_volume || 0), 0);
  setText('exec-total-volume', formatNumber(totalVolume) + ' units');

  const weightedMS = totalRevenue > 0
    ? names.reduce((sum, n) => sum + (state.products[n]?.market_share || 0) * (state.products[n]?.revenue || 0), 0) / totalRevenue
    : 0;
  setText('exec-avg-share', weightedMS.toFixed(1) + '%');

  const counts = { Star: 0, 'Cash Cow': 0, 'Question Mark': 0, Dog: 0 };
  names.forEach(n => {
    const q = state.products[n].quadrant;
    if (counts[q] !== undefined) counts[q]++;
  });

  const mixEl = document.getElementById('exec-mix');
  if (mixEl) {
    const parts = [];
    if (counts.Star > 0) parts.push(`<span style="background:${QUADRANT_COLORS.Star.bg};color:${QUADRANT_COLORS.Star.text};">${counts.Star} Star</span>`);
    if (counts['Cash Cow'] > 0) parts.push(`<span style="background:${QUADRANT_COLORS['Cash Cow'].bg};color:${QUADRANT_COLORS['Cash Cow'].text};">${counts['Cash Cow']} CC</span>`);
    if (counts['Question Mark'] > 0) parts.push(`<span style="background:${QUADRANT_COLORS['Question Mark'].bg};color:${QUADRANT_COLORS['Question Mark'].text};">${counts['Question Mark']} QM</span>`);
    if (counts.Dog > 0) parts.push(`<span style="background:${QUADRANT_COLORS.Dog.bg};color:${QUADRANT_COLORS.Dog.text};">${counts.Dog} Dog</span>`);
    mixEl.innerHTML = parts.join(' ') || '—';
  }

  const health = calculateHealthScore(names, totalRevenue);
  setText('health-score', Math.round(health));
  updateGauge(health);
}

function calculateHealthScore(names, totalRevenue) {
  if (!names.length || totalRevenue <= 0) return 0;

  const weights = { Star: 1.0, 'Cash Cow': 0.8, 'Question Mark': 0.5, Dog: 0.2 };
  let weightedSum = 0;

  names.forEach(n => {
    const p = state.products[n];
    weightedSum += (p.revenue || 0) * (weights[p.quadrant] || 0);
  });

  const raw = weightedSum / totalRevenue;
  return Math.max(0, Math.min(100, ((raw - 0.2) / 0.8) * 100));
}

function updateGauge(score) {
  const fill = document.getElementById('gauge-fill');
  if (!fill) return;

  const clamped = Math.max(0, Math.min(100, score));
  const offset = 251 * (1 - clamped / 100);
  fill.style.strokeDashoffset = Math.max(0, offset);

  let color = '#22c55e';
  if (clamped < 45) color = '#ef4444';
  else if (clamped < 72) color = '#f59e0b';
  fill.style.stroke = color;
}

function generateRecommendation(productName, prevQuadrant) {
  const p = state.products[productName];
  if (!p) return null;
  const curr = p.quadrant;

  const quadrantContent = {
    'Star': {
      analysis: `${productName} leads in a fast-growing market with a dominant competitive position. RMS of ${p.relative_market_share.toFixed(2)}× confirms market leadership. Strong brand equity underpins continued outperformance.`,
      strategy: `Invest aggressively to defend and extend market share. Expand distribution, accelerate product variants, and increase brand spend. Leverage volume advantage for cost leadership.`,
      investment: '70 – 85%',
      potential: 'Very High',
    },
    'Cash Cow': {
      analysis: `${productName} commands a strong position in a mature segment (IGR ${p.industry_growth_rate.toFixed(1)}%). High RMS of ${p.relative_market_share.toFixed(2)}× ensures superior margins and consistent free-cash-flow generation.`,
      strategy: `Maximise operating efficiency and harvest cash flows for reinvestment in Stars and Question Marks. Defend share through incremental product updates and fleet sales. Resist over-investing in declining segments.`,
      investment: '30 – 50%',
      potential: 'Moderate',
    },
    'Question Mark': {
      analysis: `${productName} operates in a high-growth market (IGR ${p.industry_growth_rate.toFixed(1)}%) but holds a sub-threshold relative share of ${p.relative_market_share.toFixed(2)}×. The segment offers significant upside with sustained capital commitment.`,
      strategy: `Deploy targeted investment to build market share rapidly before the growth curve flattens. Focus on pricing strategy, product differentiation, and channel partnerships. Set a clear decision milestone: achieve RMS ≥ 1.0 within 2–3 years or consider exit.`,
      investment: '55 – 75%',
      potential: 'High (Conditional)',
    },
    'Dog': {
      analysis: `${productName} faces a weak position in a low-growth segment (IGR ${p.industry_growth_rate.toFixed(1)}%, RMS ${p.relative_market_share.toFixed(2)}×). Margin pressure is elevated relative to competitors.`,
      strategy: `Explore portfolio rationalisation: selective niche positioning, price reduction to defend a loyal base, or phased divestiture. Redirect freed capital to higher-potential SBUs.`,
      investment: '10 – 25%',
      potential: 'Low',
    },
  };

  const reasons = {
    'Star → Star': 'Maintained strong competitive position in a high-growth market.',
    'Star → Cash Cow': 'Industry growth rate declined below 10% — market has matured.',
    'Star → Question Mark': 'Relative market share fell below 1.0× — a competitor overtook leadership.',
    'Star → Dog': 'Both market share leadership and industry growth have deteriorated.',
    'Cash Cow → Star': 'Industry growth surged above 10% — the mature segment has been revitalised.',
    'Cash Cow → Cash Cow': 'Stable mature positioning maintained — a consistent cash generator.',
    'Cash Cow → Question Mark': 'Relative market share eroded below 1.0× — competitive pressure is increasing.',
    'Cash Cow → Dog': 'Both maturity and competitive position have weakened — urgent review required.',
    'Question Mark → Star': 'Market share scaled above 1.0× in a still-growing industry — a strategic breakthrough.',
    'Question Mark → Question Mark': 'Still building market position in a high-growth segment.',
    'Question Mark → Cash Cow': 'Industry growth has moderated below 10%; share position must now be protected.',
    'Question Mark → Dog': 'Share-building efforts have stalled; the business case requires reassessment.',
    'Dog → Star': 'Major turnaround — both market dynamics and competitive position improved.',
    'Dog → Cash Cow': 'Share leadership regained in a low-growth environment.',
    'Dog → Question Mark': 'Industry growth re-emerged above 10% — new investment opportunity opens.',
    'Dog → Dog': 'Persistently weak position — portfolio rationalisation decision is overdue.',
  };

  const key = `${prevQuadrant} → ${curr}`;
  const reason = reasons[key] || (prevQuadrant ? `Quadrant changed from ${prevQuadrant} to ${curr}.` : 'Initial state — no prior quadrant on record.');
  const content = quadrantContent[curr] || quadrantContent['Dog'];

  return { previousQuadrant: prevQuadrant || '—', currentQuadrant: curr, reason, ...content };
}

function generateAndRenderRecommendation(prevQuadrant) {
  const name = state.selectedProduct;
  const p = state.products[name];
  if (!p) return;

  const rec = generateRecommendation(name, prevQuadrant);
  if (!rec) return;

  setText('rec-product-label', `${name} · ${p.sbu}`);
  setText('rec-prev-quadrant', rec.previousQuadrant);
  setText('rec-curr-quadrant', rec.currentQuadrant);
  setText('rec-reason', rec.reason);
  setText('rec-analysis', rec.analysis);
  setText('rec-strategy', rec.strategy);
  setText('rec-investment', rec.investment);
  setText('rec-potential', rec.potential);

  const currEl = document.getElementById('rec-curr-quadrant');
  if (currEl) {
    const c = QUADRANT_COLORS[rec.currentQuadrant];
    if (c) { currEl.style.background = c.bg; currEl.style.color = c.text; }
  }
}

function renderPerformanceAnalysis() {
  const name = state.selectedProduct;
  const p = state.products[name];
  if (!p) return;

  setText('perf-product-label', `${name} · ${p.sbu}`);

  const salesText = p.sales_volume >= 200000
    ? `${name} moves a high volume of ${formatNumber(p.sales_volume)} units, giving it strong scale advantages in its segment.`
    : `${name} sells ${formatNumber(p.sales_volume)} units — a moderate-to-low volume that limits scale economies.`;
  setText('perf-sales-performance', salesText);

  const investmentEfficiency = p.investment_level > 0 ? (p.profit / p.investment_level) : 0;
  const revText = p.profit_margin >= 20
    ? `Revenue of ₹${formatRevenueLong(p.revenue)} converts efficiently into profit at a ${p.profit_margin.toFixed(1)}% margin. Current investment level of ${p.investment_level}% is well-utilised.`
    : `Revenue of ₹${formatRevenueLong(p.revenue)} carries a thinner ${p.profit_margin.toFixed(1)}% margin. At ${p.investment_level}% investment, capital efficiency could be improved.`;
  setText('perf-revenue-performance', revText);

  const metrics = {
    'Growth Rate': p.growth_rate,
    'Profit Margin': p.profit_margin,
    'Investment Level': p.investment_level,
    'Sales Volume Index': Math.min(100, (p.sales_volume / 10000)),
  };
  const entries = Object.entries(metrics);
  const strongest = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const weakest = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  setText('perf-strongest-metric', strongest[0]);
  setText('perf-weakest-metric', weakest[0]);
}

function getActiveSBUProductNames() {
  return (state.sbuMapping[state.activeSBU] || []).filter(n => state.products[n]);
}

function getActiveSBUValues(field) {
  return getActiveSBUProductNames().map(n => state.products[n][field]);
}

function getActiveSBUColors() {
  return getActiveSBUProductNames().map(n => {
    const hex = PRODUCT_MARKER_COLORS[n] || '#64748b';
    return hex + 'd9';
  });
}

function buildBarChart(canvasId, label, values, names, colors, suffix) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{
        label,
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('d9', 'ff')),
        borderWidth: 1.5,
        borderRadius: 5,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatChartValue(ctx.parsed.x, suffix)}` } },
      },
      scales: {
        x: { grid: { color: '#eef2f7' }, ticks: { font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  });
}

function buildQuadrantChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Star', 'Cash Cow', 'Question Mark', 'Dog'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e'],
        borderColor: ['#1d4ed8', '#047857', '#b45309', '#be123c'],
        borderWidth: 2,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 10 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} products` } },
      },
      cutout: '62%',
    },
  });
}

function countQuadrantsForActiveSBU() {
  const counts = { Star: 0, 'Cash Cow': 0, 'Question Mark': 0, Dog: 0 };
  getActiveSBUProductNames().forEach(n => {
    const q = state.products[n].quadrant;
    if (counts[q] !== undefined) counts[q]++;
  });
  return counts;
}

function initStrategicCharts() {
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#64748b';

  const names = getActiveSBUProductNames();
  const colors = getActiveSBUColors();

  charts.marketshare = buildBarChart('chart-marketshare', 'Market Share (%)', getActiveSBUValues('market_share'), names, colors, '%');
  charts.growth = buildBarChart('chart-growth', 'Industry Growth Rate (%)', getActiveSBUValues('industry_growth_rate'), names, colors, '%');
  charts.quadrant = buildQuadrantChart('chart-quadrant');
  updateQuadrantChart();
}

function initPerformanceCharts() {
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#64748b';

  const names = getActiveSBUProductNames();
  const colors = getActiveSBUColors();

  charts.sales = buildBarChart('chart-sales', 'Sales Volume (Units)', getActiveSBUValues('sales_volume'), names, colors, ' units');
  charts.revenue = buildBarChart('chart-revenue', 'Revenue (₹ B)', getActiveSBUValues('revenue').map(r => +(r / 1e9).toFixed(2)), names, colors, ' B');
  charts.profit = buildBarChart('chart-profit', 'Profit (₹ B)', getActiveSBUValues('profit').map(r => +(r / 1e9).toFixed(2)), names, colors, ' B');
}

function updateAllCharts() {
  const names = getActiveSBUProductNames();
  const colors = getActiveSBUColors();

  const update = (chart, values) => {
    if (!chart) return;
    chart.data.labels = names;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor = colors.map(c => c.replace('d9', 'ff'));
    chart.update('none');
  };

  update(charts.marketshare, getActiveSBUValues('market_share'));
  update(charts.growth, getActiveSBUValues('industry_growth_rate'));
  update(charts.sales, getActiveSBUValues('sales_volume'));
  update(charts.revenue, getActiveSBUValues('revenue').map(r => +(r / 1e9).toFixed(2)));
  update(charts.profit, getActiveSBUValues('profit').map(r => +(r / 1e9).toFixed(2)));
  updateQuadrantChart();
}

function updateQuadrantChart() {
  if (!charts.quadrant) return;
  const qc = countQuadrantsForActiveSBU();
  charts.quadrant.data.datasets[0].data = [qc.Star, qc['Cash Cow'], qc['Question Mark'], qc.Dog];
  charts.quadrant.update('none');
}

function refreshAll() {
  loadControls(state.selectedProduct);
  updateInfoPanels();
  activateSBU(state.activeSBU);
  syncProductButtonHighlight();
  updateNavQuadrantDots();
  updateSBUBadges();
  updateExecStrip();
  generateAndRenderRecommendation(state.previousQuadrant[state.selectedProduct] || '');
  renderPerformanceAnalysis();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatNumber(n) {
  return Math.round(n).toLocaleString('en-IN');
}

function formatRevenue(n) {
  if (n >= 1e9) return '₹' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '₹' + (n / 1e6).toFixed(1) + 'M';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatRevenueLong(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' Trillion';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Billion';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' Million';
  return Math.round(n).toLocaleString('en-IN');
}

function formatChartValue(val, suffix) {
  if (suffix === ' units') return formatNumber(val) + suffix;
  if (suffix === ' B') return '₹' + val.toFixed(2) + ' B';
  return val.toFixed(1) + suffix;
}

function attachAIInsightButtons() {
  const strategyBtn = document.getElementById('btn-strategy-insight');
  if (strategyBtn) {
    strategyBtn.addEventListener('click', async () => {
      const name = state.selectedProduct;
      const p = state.products[name];
      if (!p) return;

      const target = document.getElementById('rec-strategy-ai-insight');
      target.textContent = 'Generating insight...';
      strategyBtn.disabled = true;

      try {
        const res = await fetch('/api/strategy-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: name, data: { ...p, quadrant: p.quadrant } }),
        });
        const json = await res.json();
        target.textContent = json.insight || ('Error: ' + (json.error || 'Unknown error'));
      } catch (err) {
        target.textContent = 'Request failed: ' + err.message;
      } finally {
        strategyBtn.disabled = false;
      }
    });
  }

  const performanceBtn = document.getElementById('btn-performance-insight');
  if (performanceBtn) {
    performanceBtn.addEventListener('click', async () => {
      const name = state.selectedProduct;
      const p = state.products[name];
      if (!p) return;

      const target = document.getElementById('rec-performance-ai-insight');
      target.textContent = 'Generating insight...';
      performanceBtn.disabled = true;

      try {
        const res = await fetch('/api/performance-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: name, data: p }),
        });
        const json = await res.json();
        target.textContent = json.insight || ('Error: ' + (json.error || 'Unknown error'));
      } catch (err) {
        target.textContent = 'Request failed: ' + err.message;
      } finally {
        performanceBtn.disabled = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachAIInsightButtons();
  initAIChat();
});

function renderMarkdown(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const bullet = line.match(/^[\*\-]\s+(.+)/);
    const numbered = line.match(/^\d+\.\s+(.+)/);
    const heading = line.match(/^\*\*(.+)\*\*\s*$/);

    if (bullet || numbered) {
      if (!inList) { html += '<ul class="ai-md-list">'; inList = true; }
      const content = (bullet ? bullet[1] : numbered[1]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
      html += `<li>${content}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (heading) {
        html += `<p class="ai-md-heading">${heading[1]}</p>`;
      } else if (line.trim() === '') {
        html += '<br>';
      } else {
        const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
        html += `<p>${formatted}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function initAIChat() {
  const fab = document.getElementById('ai-fab');
  const panel = document.getElementById('ai-chat-panel');
  const closeBtn = document.getElementById('ai-chat-close');
  const clearBtn = document.getElementById('ai-chat-clear');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');
  const msgList = document.getElementById('ai-chat-messages');
  const chips = document.querySelectorAll('.ai-chip');

  if (!fab || !panel) return;

  let chatHistory = [];
  let isOpen = false;

  const WELCOME_HTML = `👋 Hi! I'm your <strong>Groq-powered</strong> BCG strategy analyst.<br><br>
    Ask me anything about the Bajaj portfolio — investment plans, quadrant moves, revenue breakdowns, or strategic recommendations.`;

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('ai-open', isOpen);
    if (isOpen) input.focus();
  }

  function appendMessage(role, text, isTyping = false) {
    const wrap = document.createElement('div');
    wrap.className = `ai-msg ai-msg-${role}${isTyping ? ' ai-msg-typing' : ''}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';

    if (isTyping) {
      bubble.innerHTML = `<span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>`;
    } else {
      bubble.innerHTML = renderMarkdown(text);
    }

    wrap.appendChild(bubble);
    msgList.appendChild(wrap);
    msgList.scrollTop = msgList.scrollHeight;
    return wrap;
  }

  async function sendMessage(text) {
    text = text.trim();
    if (!text) return;

    appendMessage('user', text);
    chatHistory.push({ role: 'user', text });

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    document.getElementById('ai-chat-suggestions').style.display = 'none';

    const typingEl = appendMessage('bot', '', true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory.slice(-10) }),
      });
      const json = await res.json();

      typingEl.remove();

      if (json.reply) {
        appendMessage('bot', json.reply);
        chatHistory.push({ role: 'bot', text: json.reply });
      } else {
        appendMessage('bot', '⚠️ Error: ' + (json.error || 'Unknown error from server.'));
      }
    } catch (err) {
      typingEl.remove();
      appendMessage('bot', '⚠️ Request failed: ' + err.message);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  fab.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  clearBtn.addEventListener('click', () => {
    chatHistory = [];
    msgList.innerHTML = '';
    const resetMsg = document.createElement('div');
    resetMsg.className = 'ai-msg ai-msg-bot';
    resetMsg.innerHTML = `<div class="ai-msg-bubble">${WELCOME_HTML}</div>`;
    msgList.appendChild(resetMsg);
    document.getElementById('ai-chat-suggestions').style.display = 'flex';
  });

  sendBtn.addEventListener('click', () => sendMessage(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.q);
    });
  });
}