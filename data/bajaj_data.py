"""
bajaj_data.py
-------------
Bajaj Auto strategic dataset — restructured into two SBUs:
  • 2-Wheelers : Pulsar, Platina, Dominar, Avenger, Chetak EV
  • 3-Wheelers : RE E-Tec, Maxima, GoGo, Low-End ICE

All metrics are representative estimates used for MBA / consulting analysis.
"""

# ---------------------------------------------------------------------------
# Products Dataset
# ---------------------------------------------------------------------------
PRODUCTS_DATA = {

    # ── SBU: 2-Wheelers ────────────────────────────────────────────────────
    "Pulsar": {
        "sbu": "2-Wheelers",
        "market_share": 35.2,
        "relative_market_share": 1.80,
        "industry_growth_rate": 12.5,
        "growth_rate": 15.3,
        "sales_volume": 450000,
        "revenue": 18_000_000_000,
        "investment_level": 65,
        "quadrant": "Star",
    },
    "Platina": {
        "sbu": "2-Wheelers",
        "market_share": 24.8,
        "relative_market_share": 1.20,
        "industry_growth_rate": 5.8,
        "growth_rate": 4.2,
        "sales_volume": 380000,
        "revenue": 12_000_000_000,
        "investment_level": 40,
        "quadrant": "Cash Cow",
    },
    "Dominar": {
        "sbu": "2-Wheelers",
        "market_share": 8.5,
        "relative_market_share": 0.70,
        "industry_growth_rate": 9.2,
        "growth_rate": 11.5,
        "sales_volume": 85000,
        "revenue": 7_000_000_000,
        "investment_level": 55,
        "quadrant": "Dog",
    },
    "Avenger": {
        "sbu": "2-Wheelers",
        "market_share": 5.2,
        "relative_market_share": 0.50,
        "industry_growth_rate": 3.4,
        "growth_rate": 2.1,
        "sales_volume": 45000,
        "revenue": 3_500_000_000,
        "investment_level": 30,
        "quadrant": "Dog",
    },
    "Chetak EV": {
        "sbu": "2-Wheelers",
        "market_share": 12.5,
        "relative_market_share": 0.45,
        "industry_growth_rate": 38.5,
        "growth_rate": 42.0,
        "sales_volume": 65000,
        "revenue": 5_200_000_000,
        "investment_level": 80,
        "quadrant": "Question Mark",
    },

    # ── SBU: 3-Wheelers ────────────────────────────────────────────────────
    "RE E-Tec": {
        "sbu": "3-Wheelers",
        "market_share": 62.8,
        "relative_market_share": 2.80,
        "industry_growth_rate": 8.5,
        "growth_rate": 9.2,
        "sales_volume": 280000,
        "revenue": 22_000_000_000,
        "investment_level": 45,
        "quadrant": "Cash Cow",
    },
    "Maxima": {
        "sbu": "3-Wheelers",
        "market_share": 38.5,
        "relative_market_share": 1.60,
        "industry_growth_rate": 2.1,
        "growth_rate": 1.5,
        "sales_volume": 120000,
        "revenue": 8_500_000_000,
        "investment_level": 25,
        "quadrant": "Cash Cow",
    },
    "GoGo": {
        "sbu": "3-Wheelers",
        "market_share": 6.5,
        "relative_market_share": 0.28,
        "industry_growth_rate": 35.0,
        "growth_rate": 52.0,
        "sales_volume": 22000,
        "revenue": 2_200_000_000,
        "investment_level": 72,
        "quadrant": "Question Mark",
    },
    "Low-End ICE": {
        "sbu": "3-Wheelers",
        "market_share": 28.4,
        "relative_market_share": 1.10,
        "industry_growth_rate": 1.8,
        "growth_rate": 0.8,
        "sales_volume": 95000,
        "revenue": 6_200_000_000,
        "investment_level": 20,
        "quadrant": "Cash Cow",
    },
}

# ---------------------------------------------------------------------------
# SBU Groupings
# ---------------------------------------------------------------------------
SBU_MAPPING = {
    "2-Wheelers": ["Pulsar", "Platina", "Dominar", "Avenger", "Chetak EV"],
    "3-Wheelers": ["RE E-Tec", "Maxima", "GoGo", "Low-End ICE"],
}

# Static image filename per SBU (served from /static/images/)
SBU_IMAGES = {
    "2-Wheelers": "sbu_2wheelers.png",
    "3-Wheelers": "sbu_3wheelers.png",
}

# BCG threshold constants
BCG_RMS_THRESHOLD = 1.0   # Relative Market Share dividing line
BCG_IGR_THRESHOLD = 10.0  # Industry Growth Rate (%) dividing line
