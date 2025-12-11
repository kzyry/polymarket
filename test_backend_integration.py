#!/usr/bin/env python3
"""Integration test for backend with mock data"""
import sys
import json
sys.path.insert(0, 'backend')

from risk_calculator import enrich_with_risk_metrics
from aggregator import build_dashboard_data

# Load mock markets
with open('test_data/mock_markets.json', 'r') as f:
    mock_data = json.load(f)

markets = mock_data['markets']

# Test 1: Risk enrichment
print("TEST 1: Risk Calculator")
enriched_markets = enrich_with_risk_metrics(markets)
assert len(enriched_markets) == 3, "Should have 3 markets"
for market in enriched_markets:
    for outcome in market['outcomes']:
        assert 'risk_metrics' in outcome, "All outcomes should have risk_metrics"
        assert 'score' in outcome['risk_metrics'], "Should have score"
print("✓ Risk Calculator passed")

# Test 2: Mock news analysis
mock_news_analysis = {
    'news_market_mapping': [
        {
            'news_id': 0,
            'news_title': 'Bitcoin surges to $95k',
            'news_link': 'http://example.com',
            'market_id': 'test-market-1',
            'market_question': enriched_markets[0]['question'],
            'market_url': enriched_markets[0]['url'],
            'relevance_score': 9,
            'affects_outcomes': ['Yes'],
            'impact_direction': 'positive',
            'confidence': 'high',
            'reasoning': 'Directly related to BTC price'
        }
    ],
    'stats': {
        'total_analyzed': 10,
        'claude_ai': 5,
        'keyword_fallback': 5,
        'cached': 0,
        'errors': 0
    }
}

# Test 3: Aggregator
print("\nTEST 2: Aggregator")
dashboard_data = build_dashboard_data(enriched_markets, mock_news_analysis)

assert 'widgets' in dashboard_data
assert 'risk_categories' in dashboard_data['widgets']
assert 'closing_soon' in dashboard_data['widgets']
assert 'news_feed' in dashboard_data['widgets']
print("✓ Aggregator passed")

# Test 4: Risk Categories
risk_cats = dashboard_data['widgets']['risk_categories']
print(f"\n  Medium risk opportunities: {len(risk_cats['medium_risk'])}")
print(f"  Low risk opportunities: {len(risk_cats['low_risk'])}")

# Test 5: Closing Soon
closing = dashboard_data['widgets']['closing_soon']
print(f"  Closing soon opportunities: {len(closing)}")

# Test 6: News Feed
news = dashboard_data['widgets']['news_feed']
print(f"  News items: {len(news)}")

# Save test output
with open('frontend/data/dashboard_data.json', 'w') as f:
    json.dump(dashboard_data, f, indent=2, ensure_ascii=False)

print("\n✅ ALL INTEGRATION TESTS PASSED")
print(f"Dashboard data saved to frontend/data/dashboard_data.json")
