# Polymarket Dashboard

Risk analysis & market intelligence dashboard for Polymarket prediction markets.

## Features

- 🎯 **Risk Categories**: Best risk/reward opportunities (Medium & Low risk)
- ⏰ **Closing Soon**: Safe bets closing in 24-48h
- 📰 **News Feed**: Market-moving news with AI analysis

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set API Key (Optional - for news analysis)

```bash
export ANTHROPIC_API_KEY="your-claude-api-key"
```

If not set, the system will use keyword matching fallback.

### 3. Run Backend Pipeline

```bash
cd backend
python3 main.py
```

This will:
1. Fetch latest markets from Polymarket
2. Calculate risk metrics
3. Fetch crypto news (last 48h)
4. Analyze news relevance
5. Generate `frontend/data/dashboard_data.json`

### 4. View Frontend

```bash
cd frontend
python3 -m http.server 8000
```

Open http://localhost:8000 in your browser.

## Project Structure

```
polymarket-dashboard/
├── backend/
│   ├── main.py              # Pipeline orchestrator
│   ├── scraper.py           # Polymarket API scraper
│   ├── risk_calculator.py   # Risk-reward calculations
│   ├── news_fetcher.py      # RSS news fetcher
│   ├── news_analyzer.py     # Claude AI news analysis
│   └── aggregator.py        # Data aggregation
├── frontend/
│   ├── index.html           # Main HTML
│   ├── js/app.js           # Vue.js app
│   ├── css/styles.css      # Styles
│   └── data/
│       └── dashboard_data.json
├── data/                    # Backend data cache
├── logs/                    # Pipeline logs
└── requirements.txt
```

## Testing

### Backend Unit Tests

```bash
# Test individual modules
cd backend
python3 risk_calculator.py
python3 news_fetcher.py
```

### Integration Test

```bash
python3 test_backend_integration.py
```

## Data Update

To refresh dashboard data:

```bash
cd backend
python3 main.py
```

Frontend will automatically show new data on next page load.

## Deployment

### GitHub Pages

```bash
# 1. Create repo
cd frontend
git init
git add .
git commit -m "Initial deployment"
gh repo create polymarket-dashboard --public --source=. --remote=origin
git push -u origin main

# 2. Enable GitHub Pages
# Settings → Pages → Source: main branch, / (root)

# 3. Access at: https://USERNAME.github.io/polymarket-dashboard/
```

## Configuration

### Risk Categories

- **Medium Risk**: 5-10% probability, 10-20x multiplier
- **Low Risk**: 10-20% probability, 5-10x multiplier

### Scoring Formula

```python
Score = (Multiplier - 1) × Volume_Weight
Volume_Weight = log10(volume) normalized to [0.1, 1.0]
```

## Dependencies

- `requests` - HTTP requests
- `anthropic` - Claude AI API (optional)
- `feedparser` - RSS feed parsing
- `python-dateutil` - Date handling

## License

MIT

## Support

For issues or questions, check the documentation in `PROJECT_DOCUMENTATION.md`.
