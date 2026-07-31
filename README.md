# AI Strategic Portfolio Analyzer — Bajaj Auto

A professional executive business analytics dashboard for strategic BCG portfolio
analysis of Bajaj Auto's product portfolio.  Designed for MBA presentations,
management consulting demonstrations, and executive strategy reviews.

---

## Features

| Feature | Description |
|---------|-------------|
| **BCG Matrix** | Live SBU positioning with smooth CSS transitions |
| **7 Control Sliders** | Instantly adjust any product metric and watch the entire dashboard update |
| **Business Info Panel** | Full per-product metrics at a glance |
| **Recommendation Engine** | Rule-based analysis covering all 16 quadrant transitions |
| **5 Live Charts** | Sales, Revenue, Market Share, Industry Growth, Quadrant Distribution |
| **4 SBU Coverage** | ICE 3W & Motorcycles · Chetak EV & Premium · RE E-Tec · Low-End ICE |
| **8 Products** | Pulsar · Platina · Dominar · Avenger · Chetak EV · RE E-Tec · Maxima · RE Series |

---

## Technology Stack

- **Backend** — Python Flask 3.x
- **Data** — Pandas (dataset) · Vanilla Python dict
- **Frontend** — Bootstrap 5 · Chart.js 4 · Vanilla JavaScript · CSS3
- **Fonts** — Google Fonts (Inter)

No React · No database · No authentication · No Docker required.

---

## Project Structure

```
Portfolio/MM/
├── app.py                  # Flask entry point
├── requirements.txt
├── README.md
│
├── data/
│   └── bajaj_data.py       # Bajaj Auto dataset (8 products, 4 SBUs)
│
├── templates/
│   └── index.html          # Bootstrap 5 two-column dashboard
│
└── static/
    ├── css/
    │   └── style.css       # Professional consulting theme
    ├── js/
    │   └── dashboard.js    # App logic, BCG engine, charts, recommendations
    └── images/
        ├── sbu_ice_motorcycles.png
        ├── sbu_chetak_ev.png
        ├── sbu_re_etec.png
        └── sbu_lowend_ice.png
```

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the application

```bash
python app.py
```

### 3. Open in browser

```
http://127.0.0.1:5000
```

---

## BCG Matrix Logic

### Quadrant Thresholds

| Axis | Threshold |
|------|-----------|
| Relative Market Share (X) | ≥ 1.0× = High |
| Industry Growth Rate (Y)  | ≥ 10% = High  |

### Quadrant Classification

| Quadrant | RMS | IGR |
|----------|-----|-----|
| ⭐ Star | ≥ 1.0× | ≥ 10% |
| 💰 Cash Cow | ≥ 1.0× | < 10% |
| ❓ Question Mark | < 1.0× | ≥ 10% |
| 🐕 Dog | < 1.0× | < 10% |

### SBU Positioning

Each SBU marker is positioned using a **revenue-weighted average** of all constituent
products' RMS and IGR.  A **piecewise-linear mapping** ensures both quadrant dividing
lines always fall at the visual midpoint of the matrix, giving balanced quadrant areas
while preserving proportional relative positioning within each quadrant.

---

## Dataset (FY 2024–25 estimates)

| Product | SBU | RMS | IGR | Quadrant |
|---------|-----|-----|-----|----------|
| Pulsar | ICE 3W & Motorcycles | 1.80 | 12.5% | Star |
| Platina | ICE 3W & Motorcycles | 1.20 | 5.8% | Cash Cow |
| Dominar | ICE 3W & Motorcycles | 0.70 | 9.2% | Dog |
| Avenger | ICE 3W & Motorcycles | 0.50 | 3.4% | Dog |
| Chetak EV | Chetak EV & Premium | 0.45 | 38.5% | Question Mark |
| RE E-Tec Series | RE E-Tec | 2.80 | 8.5% | Cash Cow |
| Maxima Series | Low-End ICE | 1.60 | 2.1% | Cash Cow |
| RE Series | Low-End ICE | 1.10 | 1.8% | Cash Cow |

*Data represents representative estimates based on publicly available market intelligence.*
