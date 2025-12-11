#!/usr/bin/env python3
"""
Data Aggregator - Combines all data into final dashboard JSON
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


def build_risk_categories_widget(markets_data):
    """
    Build risk categories widget with top-5 medium and low risk opportunities
    """
    all_outcomes = []

    for market in markets_data:
        for outcome in market.get('outcomes', []):
            risk_metrics = outcome.get('risk_metrics', {})
            risk_category = risk_metrics.get('risk_category')

            if risk_category in ['medium', 'low']:
                all_outcomes.append({
                    'market_title': market.get('question', ''),
                    'market_url': market.get('url', ''),
                    'market_end_date': market.get('end_date', ''),
                    'outcome_name': outcome.get('name', ''),
                    'probability': outcome.get('probability', 0),
                    'multiplier': risk_metrics.get('multiplier', 0),
                    'score': risk_metrics.get('score', 0),
                    'risk_category': risk_category,
                    'volume': outcome.get('volume', 0),
                    'image': market.get('image', '')
                })

    # Sort by score (best risk-reward first)
    medium_risk = sorted(
        [o for o in all_outcomes if o['risk_category'] == 'medium'],
        key=lambda x: x['score'],
        reverse=True
    )[:5]

    low_risk = sorted(
        [o for o in all_outcomes if o['risk_category'] == 'low'],
        key=lambda x: x['score'],
        reverse=True
    )[:5]

    return {
        'medium_risk': medium_risk,
        'low_risk': low_risk
    }


# Closing Soon widget removed - not useful for users


def build_news_feed_widget(news_analysis, markets_data):
    """
    Build news feed widget with top-10 most relevant news
    """
    news_mapping = news_analysis.get('news_market_mapping', [])

    # Group by market
    news_by_market = {}
    for item in news_mapping:
        market_id = item.get('market_id', '')
        if market_id not in news_by_market:
            news_by_market[market_id] = []
        news_by_market[market_id].append(item)

    # Get best news per market
    top_news = []
    for market_id, news_list in news_by_market.items():
        # Sort by relevance score
        best_news = max(news_list, key=lambda x: x.get('relevance_score', 0))

        # Find market details
        market = next((m for m in markets_data if m.get('market_id') == market_id), None)

        if market:
            top_news.append({
                'news_title': best_news.get('news_title', ''),
                'news_link': best_news.get('news_link', ''),
                'market_title': market.get('question', ''),
                'market_url': market.get('url', ''),
                'relevance_score': best_news.get('relevance_score', 0),
                'affects_outcomes': best_news.get('affects_outcomes', []),
                'impact_direction': best_news.get('impact_direction', 'neutral'),
                'confidence': best_news.get('confidence', 'low'),
                'reasoning': best_news.get('reasoning', '')
            })

    # Sort by relevance score and take top 10
    top_news = sorted(top_news, key=lambda x: x['relevance_score'], reverse=True)[:10]

    return top_news


def build_dashboard_data(markets_with_metrics, news_analysis):
    """
    Build complete dashboard data structure

    Args:
        markets_with_metrics: list of markets with risk metrics
        news_analysis: dict with news analysis results

    Returns:
        dict with complete dashboard data
    """
    logger.info("Building dashboard data...")

    # Count markets by category
    trending_count = sum(1 for m in markets_with_metrics if 'trending' in m.get('tags', []))
    crypto_count = sum(1 for m in markets_with_metrics if 'crypto' in m.get('tags', []))

    dashboard_data = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'widgets': {
            'risk_categories': build_risk_categories_widget(markets_with_metrics),
            'news_feed': build_news_feed_widget(news_analysis, markets_with_metrics)
        },
        'metadata': {
            'total_markets': len(markets_with_metrics),
            'trending_count': trending_count,
            'crypto_count': crypto_count,
            'news_analyzed': news_analysis.get('stats', {}).get('total_analyzed', 0),
            'snapshot_time': datetime.now(timezone.utc).isoformat()
        }
    }

    logger.info("Dashboard data built successfully")
    logger.info(f"  Risk categories: {len(dashboard_data['widgets']['risk_categories']['medium_risk'])} medium, "
                f"{len(dashboard_data['widgets']['risk_categories']['low_risk'])} low")
    logger.info(f"  News feed: {len(dashboard_data['widgets']['news_feed'])} articles")

    return dashboard_data


if __name__ == "__main__":
    # Test mode
    logging.basicConfig(level=logging.INFO)
    print("Aggregator module ready")
