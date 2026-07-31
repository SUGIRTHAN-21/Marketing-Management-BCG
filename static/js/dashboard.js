const BCG_RMS_THRESHOLD = 1.0;
const BCG_IGR_THRESHOLD = 10.0;
const BCG_RMS_MAX = 5.0;
const BCG_IGR_MAX = 50.0;

const MARKER_SIZE = 54;

const QUADRANT_COLORS = {
  'Star': { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  'Cash Cow': { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  'Question Mark': { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  'Dog': { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
};

const PRODUCT_MARKER_COLORS = {
  'Pulsar': '#1d4ed8',
  'Platina': '#0f766e',
  'Dominar': '#7c2d12',
  'Avenger': '#581c87',
  'Chetak EV': '#15803d',
  'RE E-Tec': '#b45309',
  'Maxima': '#374151',
  'GoGo': '#065f46',
  'Low-End ICE': '#9f1239',
};

const PRODUCT_COLORS = [
  'rgba(29, 78, 216, 0.75)',
  'rgba(15, 118, 110, 0.75)',
  'rgba(124, 45, 18, 0.75)',
  'rgba(88, 28, 135, 0.75)',
  'rgba(21, 128, 61, 0.75)',
  'rgba(180, 83, 9, 0.75)',
  'rgba(55, 65, 81, 0.75)',
  'rgba(6, 95, 70, 0.75)',
  'rgba(159, 18, 57, 0.75)',
];

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
  previousQuadrant: {},
};

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      state.products = JSON.parse(JSON.stringify(data.products));
      state.sbuMapping = data.sbus;

      Object.keys(state.products).forEach(name => {
        const p = state.products[name];
        p.quadrant = getQuadrant(p.relative_market_share, p.industry_growth_rate);
        state.previousQuadrant[name] = p.quadrant;
      });

      state.selectedProduct = 'Pulsar';
      state.activeSBU = '2-Wheelers';

      attachProductButtons();
      attachSBULabels();
      attachSliders();

      applyMarkerColors();

      initCharts();
      refreshAll();
    })
    .catch(err => console.error('Data load failed:', err));
});

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
        loadSliders(firstProduct);
        updateInfoPanel();
        generateAndRenderRecommendation(state.previousQuadrant[firstProduct] || '');
        setText('control-product-name', firstProduct);
      }

      syncProductButtonHighlight();

      activateSBU(sbuName);
    });
  });
}

function attachSliders() {
  document.querySelectorAll('input[data-field]').forEach(slider => {
    slider.addEventListener('input', () => {
      const field = slider.dataset.field;
      const raw = parseFloat(slider.value);

      updateSliderDisplay(field, raw);

      const p = state.products[state.selectedProduct];
      if (!p) return;

      const prevQ = p.quadrant;
      p[field] = raw;
      p.quadrant = getQuadrant(p.relative_market_share, p.industry_growth_rate);

      const storedPrev = state.previousQuadrant[state.selectedProduct];

      updateBCGMatrix();
      updateInfoPanel();
      updateNavQuadrantDots();
      updateAllCharts();
      updateSBUBadges();
      updateExecStrip();
      generateAndRenderRecommendation(storedPrev);

      if (prevQ !== p.quadrant) {
        state.previousQuadrant[state.selectedProduct] = prevQ;
      }
    });
  });
}

function selectProduct(name) {
  const p = state.products[name];
  if (!p) return;

  state.selectedProduct = name;
  loadSliders(name);
  updateInfoPanel();
  generateAndRenderRecommendation(state.previousQuadrant[name] || '');
  setText('control-product-name', name);
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

  document.querySelectorAll('.product-marker').forEach(el => {
    const productName = el.dataset.product;
    const p = state.products[productName];
    if (!p) return;

    if (el.dataset.sbu !== state.activeSBU) return;

    const { xPct, yPct } = getBCGPosition(
      p.relative_market_share,
      p.industry_growth_rate,
    );

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

function loadSliders(productName) {
  const p = state.products[productName];
  if (!p) return;

  ['market_share', 'relative_market_share', 'industry_growth_rate',
    'growth_rate', 'sales_volume', 'revenue', 'investment_level'].forEach(field => {
      const slider = document.getElementById(`sl-${field}`);
      if (slider) {
        slider.value = p[field];
        updateSliderDisplay(field, p[field]);
      }
    });
}

function updateSliderDisplay(field, value) {
  const el = document.getElementById(`val-${field}`);
  if (!el) return;
  const unit = el.querySelector('.slider-unit');

  let text = '';
  switch (field) {
    case 'market_share':
    case 'industry_growth_rate':
    case 'growth_rate':
    case 'investment_level': text = value.toFixed(1); break;
    case 'relative_market_share': text = value.toFixed(2); break;
    case 'sales_volume': text = formatNumber(value); break;
    case 'revenue': text = formatRevenue(value); break;
    default: text = String(value);
  }

  if (unit) {
    el.childNodes[0].textContent = text;
  } else {
    el.textContent = text;
  }
}

function getQuadrant(rms, igr) {
  const hi_rms = rms >= BCG_RMS_THRESHOLD;
  const hi_igr = igr >= BCG_IGR_THRESHOLD;
  if (hi_rms && hi_igr) return 'Star';
  if (hi_rms && !hi_igr) return 'Cash Cow';
  if (!hi_rms && hi_igr) return 'Question Mark';
  return 'Dog';
}

function updateInfoPanel() {
  const name = state.selectedProduct;
  const p = state.products[name];
  if (!p) return;
  const q = p.quadrant;

  setText('info-product-name', name);
  setText('info-sbu-name', p.sbu);
  setText('info-sales_volume', formatNumber(p.sales_volume) + ' units');
  setText('info-revenue', '₹' + formatRevenueLong(p.revenue));
  setText('info-market_share', p.market_share.toFixed(1) + '%');
  setText('info-relative_market_share', p.relative_market_share.toFixed(2) + '×');
  setText('info-industry_growth_rate', p.industry_growth_rate.toFixed(1) + '%');
  setText('info-growth_rate', p.growth_rate.toFixed(1) + '%');
  setText('info-investment_level', p.investment_level + '%');
  setText('info-current-quadrant', q);

  const badge = document.getElementById('info-quadrant-badge');
  if (badge) {
    badge.textContent = q;
    badge.className = 'quadrant-badge ' + quadrantBadgeClass(q);
  }
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

/* ═══════════════════════════════════════════════════════════════════
   EXECUTIVE STRIP  —  SBU-Level Aggregate KPIs
   ══════════════════════════════════════════════════════════════════ */

/**
 * Calculates and renders all top-strip KPIs for the currently active SBU.
 * Called on: initial load, SBU switch, slider change.
 */
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

  // 1. Combined Revenue
  const totalRevenue = names.reduce((sum, n) => sum + (state.products[n]?.revenue || 0), 0);
  setText('exec-total-revenue', formatRevenue(totalRevenue));

  // 2. Combined Volume
  const totalVolume = names.reduce((sum, n) => sum + (state.products[n]?.sales_volume || 0), 0);
  setText('exec-total-volume', formatNumber(totalVolume) + ' units');

  // 3. Revenue-Weighted Market Share
  const weightedMS = totalRevenue > 0
    ? names.reduce((sum, n) => sum + (state.products[n]?.market_share || 0) * (state.products[n]?.revenue || 0), 0) / totalRevenue
    : 0;
  setText('exec-avg-share', weightedMS.toFixed(1) + '%');

  // 4. Quadrant Mix (live-coloured micro-badges)
  const counts = { Star: 0, 'Cash Cow': 0, 'Question Mark': 0, Dog: 0 };
  names.forEach(n => {
    const q = getQuadrant(state.products[n].relative_market_share, state.products[n].industry_growth_rate);
    if (counts[q] !== undefined) counts[q]++;
  });

  const mixEl = document.getElementById('exec-mix');
  if (mixEl) {
    const parts = [];
    if (counts.Star > 0) {
      parts.push(`<span style="background:${QUADRANT_COLORS.Star.bg};color:${QUADRANT_COLORS.Star.text};">${counts.Star} Star</span>`);
    }
    if (counts['Cash Cow'] > 0) {
      parts.push(`<span style="background:${QUADRANT_COLORS['Cash Cow'].bg};color:${QUADRANT_COLORS['Cash Cow'].text};">${counts['Cash Cow']} CC</span>`);
    }
    if (counts['Question Mark'] > 0) {
      parts.push(`<span style="background:${QUADRANT_COLORS['Question Mark'].bg};color:${QUADRANT_COLORS['Question Mark'].text};">${counts['Question Mark']} QM</span>`);
    }
    if (counts.Dog > 0) {
      parts.push(`<span style="background:${QUADRANT_COLORS.Dog.bg};color:${QUADRANT_COLORS.Dog.text};">${counts.Dog} Dog</span>`);
    }
    mixEl.innerHTML = parts.join(' ') || '—';
  }

  // 5. Portfolio Health Score + Gauge
  const health = calculateHealthScore(names, totalRevenue);
  setText('health-score', Math.round(health));
  updateGauge(health);
}

/**
 * Revenue-weighted portfolio health score (0–100).
 * Stars = 1.0, Cash Cows = 0.8, Question Marks = 0.5, Dogs = 0.2.
 * Normalised so all-Dogs = 0 and all-Stars = 100.
 */
function calculateHealthScore(names, totalRevenue) {
  if (!names.length || totalRevenue <= 0) return 0;

  const weights = { Star: 1.0, 'Cash Cow': 0.8, 'Question Mark': 0.5, Dog: 0.2 };
  let weightedSum = 0;

  names.forEach(n => {
    const p = state.products[n];
    const q = getQuadrant(p.relative_market_share, p.industry_growth_rate);
    weightedSum += (p.revenue || 0) * (weights[q] || 0);
  });

  const raw = weightedSum / totalRevenue; // 0.2 … 1.0
  return Math.max(0, Math.min(100, ((raw - 0.2) / 0.8) * 100));
}

/**
 * Animates the semi-circular SVG gauge.
 * @param {number} score 0–100
 */
function updateGauge(score) {
  const fill = document.getElementById('gauge-fill');
  if (!fill) return;

  const clamped = Math.max(0, Math.min(100, score));
  const offset = 251 * (1 - clamped / 100);
  fill.style.strokeDashoffset = Math.max(0, offset);

  let color = '#4ade80'; // green
  if (clamped < 45) color = '#f87171';      // red
  else if (clamped < 72) color = '#fbbf24'; // amber
  fill.style.stroke = color;
}

/* ═══════════════════════════════════════════════════════════════════ */

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

  // Growth vs. Industry gap (previously missing)
  const growthGap = p.growth_rate - p.industry_growth_rate;
  const gapStr = (growthGap >= 0 ? '+' : '') + growthGap.toFixed(1) + '%';
  setText('rec-growth-gap', gapStr);

  const currEl = document.getElementById('rec-curr-quadrant');
  if (currEl) {
    const c = QUADRANT_COLORS[rec.currentQuadrant];
    if (c) { currEl.style.background = c.bg; currEl.style.color = c.text; }
  }
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
    return hex + 'bf';
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
        borderColor: colors.map(c => c.replace('bf', 'ff')),
        borderWidth: 1,
        borderRadius: 4,
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
        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
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
        backgroundColor: ['#dbeafe', '#dcfce7', '#fef9c3', '#ffe4e6'],
        borderColor: ['#1d4ed8', '#15803d', '#b45309', '#9f1239'],
        borderWidth: 2,
        hoverOffset: 8,
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
    const q = getQuadrant(state.products[n].relative_market_share, state.products[n].industry_growth_rate);
    if (counts[q] !== undefined) counts[q]++;
  });
  return counts;
}

function initCharts() {
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#64748b';

  const names = getActiveSBUProductNames();
  const colors = getActiveSBUColors();

  charts.sales = buildBarChart(
    'chart-sales', 'Sales Volume (Units)',
    getActiveSBUValues('sales_volume'), names, colors, ' units',
  );
  charts.revenue = buildBarChart(
    'chart-revenue', 'Revenue (₹ B)',
    getActiveSBUValues('revenue').map(r => +(r / 1e9).toFixed(2)), names, colors, ' B',
  );
  charts.marketshare = buildBarChart(
    'chart-marketshare', 'Market Share (%)',
    getActiveSBUValues('market_share'), names, colors, '%',
  );
  charts.growth = buildBarChart(
    'chart-growth', 'Industry Growth Rate (%)',
    getActiveSBUValues('industry_growth_rate'), names, colors, '%',
  );
  charts.quadrant = buildQuadrantChart('chart-quadrant');
  updateQuadrantChart();
}

function updateAllCharts() {
  const names = getActiveSBUProductNames();
  const colors = getActiveSBUColors();

  const update = (chart, values) => {
    if (!chart) return;
    chart.data.labels = names;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor = colors.map(c => c.replace('bf', 'ff'));
    chart.update('none');
  };

  update(charts.sales, getActiveSBUValues('sales_volume'));
  update(charts.revenue, getActiveSBUValues('revenue').map(r => +(r / 1e9).toFixed(2)));
  update(charts.marketshare, getActiveSBUValues('market_share'));
  update(charts.growth, getActiveSBUValues('industry_growth_rate'));
  updateQuadrantChart();
}

function updateQuadrantChart() {
  if (!charts.quadrant) return;
  const qc = countQuadrantsForActiveSBU();
  charts.quadrant.data.datasets[0].data = [qc.Star, qc['Cash Cow'], qc['Question Mark'], qc.Dog];
  charts.quadrant.update('none');
}

function refreshAll() {
  loadSliders(state.selectedProduct);
  updateInfoPanel();
  activateSBU(state.activeSBU);
  syncProductButtonHighlight();
  updateNavQuadrantDots();
  updateSBUBadges();
  updateExecStrip();
  generateAndRenderRecommendation(state.previousQuadrant[state.selectedProduct] || '');
  setText('control-product-name', state.selectedProduct);
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

function attachAIInsightButton() {
  const btn = document.getElementById('btn-ai-insight');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name = state.selectedProduct;
    const p = state.products[name];
    if (!p) return;

    const target = document.getElementById('rec-ai-insight');
    target.textContent = 'Generating insight...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/gemini-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: name, data: p }),
      });
      const json = await res.json();

      if (json.insight) {
        target.textContent = json.insight;
      } else {
        target.textContent = 'Error: ' + (json.error || 'Unknown error');
      }
    } catch (err) {
      target.textContent = 'Request failed: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachAIInsightButton();
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