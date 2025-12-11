#!/usr/bin/env python3
"""
News Analyzer - Analyzes news relevance to markets using Claude AI with fallback
"""
import os
import json
import logging
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Check for Anthropic API
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic library not available, will use keyword fallback only")


CACHE_PATH = Path("data/news_analysis_cache.json")


def load_cache():
    """Load analysis cache from file"""
    if CACHE_PATH.exists():
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('cache', {})
    return {}


def save_cache(cache):
    """Save analysis cache to file"""
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'cache': cache}, f, indent=2, ensure_ascii=False)


def get_cache_key(news_title, market_id):
    """Generate cache key from news title and market ID"""
    content = f"{news_title}:{market_id}"
    return hashlib.md5(content.encode()).hexdigest()


def keyword_fallback_analysis(news_title, market_question, market_outcomes):
    """
    Simple keyword matching as backup when Claude AI is unavailable

    Returns:
        dict with relevance_score, affects_outcomes, impact_direction, confidence, reasoning
    """
    news_lower = news_title.lower()
    question_lower = market_question.lower()

    # Check for outcomes in news title
    matching_outcomes = []
    for outcome in market_outcomes:
        if outcome.lower() in news_lower:
            matching_outcomes.append(outcome)

    # Check keyword overlap
    question_keywords = set(question_lower.split()) - {'the', 'a', 'an', 'will', 'be', 'is', 'in', 'of', 'to', 'for', 'on', 'at'}
    news_keywords = set(news_lower.split())
    overlap = len(question_keywords & news_keywords)

    # Calculate simple relevance score
    relevance_score = 0
    if matching_outcomes:
        relevance_score += 5
    relevance_score += min(overlap * 0.5, 5)

    return {
        "relevance_score": min(relevance_score, 10),
        "affects_outcomes": matching_outcomes,
        "impact_direction": "neutral",
        "confidence": "low",
        "reasoning": f"Keyword match: {len(matching_outcomes)} outcomes, {overlap} keywords overlap",
        "analysis_method": "keyword_fallback"
    }


def analyze_with_claude(news_title, market_question, market_outcomes, client):
    """
    Analyze news relevance using Claude AI

    Returns:
        dict with analysis results
    """
    prompt = f"""Analyze if this news is relevant to the prediction market.

NEWS: "{news_title}"

MARKET: "{market_question}"
OUTCOMES: {', '.join(market_outcomes)}

Task:
1. Determine relevance score (0-10, where 10 = highly relevant)
2. If relevance >= 7, identify which outcome(s) it affects
3. Determine impact direction: positive, negative, or neutral
4. Provide confidence level: low, medium, high

Respond in JSON format:
{{
  "relevance_score": <0-10>,
  "affects_outcomes": ["outcome1", "outcome2"],
  "impact_direction": "positive|negative|neutral",
  "confidence": "low|medium|high",
  "reasoning": "brief explanation (1-2 sentences)"
}}

Only respond with JSON, no other text."""

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        result = json.loads(response.content[0].text)
        result['analysis_method'] = 'claude_ai'
        return result

    except Exception as e:
        logger.error(f"Claude AI analysis failed: {e}")
        return None


def analyze_news_relevance(news_data, markets_with_metrics):
    """
    Analyze relevance of news to markets with rate limiting and caching

    Args:
        news_data: list of news articles
        markets_with_metrics: list of markets with outcomes

    Returns:
        dict with news_market_mapping and stats
    """
    # Initialize Claude client if available
    claude_client = None
    api_key = os.getenv('ANTHROPIC_API_KEY')

    if ANTHROPIC_AVAILABLE and api_key:
        try:
            claude_client = anthropic.Anthropic(api_key=api_key)
            logger.info("Claude AI client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Claude AI: {e}")

    # Load cache
    cache = load_cache()

    # Stats
    stats = {
        'total_analyzed': 0,
        'claude_ai': 0,
        'keyword_fallback': 0,
        'errors': 0,
        'cached': 0
    }

    news_market_mapping = []

    # Rate limiting
    request_count = 0
    start_time = time.time()

    # Limit to top 10 news
    top_news = news_data[:10]

    logger.info(f"Analyzing {len(top_news)} news articles against {len(markets_with_metrics)} markets...")

    for news_idx, news in enumerate(top_news):
        news_title = news.get('title', '')
        news_link = news.get('link', '')

        for market in markets_with_metrics:
            market_id = market.get('market_id', '')  # Changed from 'id' to 'market_id'
            market_question = market.get('question', '')
            market_url = market.get('url', '')

            # Get outcome names
            outcomes = market.get('outcomes', [])
            outcome_names = [o.get('name', '') for o in outcomes if o.get('name')]

            if not outcome_names:
                continue

            # Check cache
            cache_key = get_cache_key(news_title, market_id)
            if cache_key in cache:
                result = cache[cache_key]
                stats['cached'] += 1
            else:
                # Try Claude AI first
                result = None
                if claude_client:
                    # Rate limiting check
                    if request_count >= 50:
                        elapsed = time.time() - start_time
                        if elapsed < 60:
                            wait_time = 60 - elapsed
                            logger.info(f"Rate limit: waiting {wait_time:.1f}s...")
                            time.sleep(wait_time)
                        start_time = time.time()
                        request_count = 0

                    result = analyze_with_claude(news_title, market_question, outcome_names, claude_client)
                    if result:
                        stats['claude_ai'] += 1
                        request_count += 1

                # Fallback to keyword matching
                if not result:
                    result = keyword_fallback_analysis(news_title, market_question, outcome_names)
                    stats['keyword_fallback'] += 1

                # Cache result
                cache[cache_key] = result

            stats['total_analyzed'] += 1

            # Only keep if relevance >= 3 (lowered threshold for keyword matching)
            if result.get('relevance_score', 0) >= 3:
                news_market_mapping.append({
                    'news_id': news_idx,
                    'news_title': news_title,
                    'news_link': news_link,
                    'market_id': market_id,
                    'market_question': market_question,
                    'market_url': market_url,
                    'relevance_score': result['relevance_score'],
                    'affects_outcomes': result['affects_outcomes'],
                    'impact_direction': result['impact_direction'],
                    'confidence': result['confidence'],
                    'reasoning': result['reasoning'],
                    'analysis_method': result['analysis_method']
                })

        logger.info(f"Analyzed news {news_idx + 1}/{len(top_news)}")

    # Save cache
    save_cache(cache)

    # Save results
    save_analysis(news_market_mapping, stats)

    logger.info(f"Analysis complete: {stats}")

    return {
        'news_market_mapping': news_market_mapping,
        'stats': stats,
        'analyzed_at': datetime.now(timezone.utc).isoformat()
    }


def save_analysis(mappings, stats):
    """Save analysis results to file"""
    analysis_path = Path("data/news_analyzed.json")
    analysis_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        'news_market_mapping': mappings,
        'stats': stats,
        'analyzed_at': datetime.now(timezone.utc).isoformat()
    }

    with open(analysis_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved analysis to {analysis_path}")


if __name__ == "__main__":
    # Test mode with mock data
    logging.basicConfig(level=logging.INFO)

    mock_news = [
        {"title": "Bitcoin reaches new all-time high", "link": "http://example.com/1"},
        {"title": "Ethereum completes major upgrade", "link": "http://example.com/2"}
    ]

    mock_markets = [
        {
            "id": "btc-price",
            "question": "Will Bitcoin reach $100k in 2025?",
            "url": "http://polymarket.com/btc",
            "outcomes": [
                {"name": "Yes"},
                {"name": "No"}
            ]
        }
    ]

    result = analyze_news_relevance(mock_news, mock_markets)
    print(f"\n✓ Analyzed {result['stats']['total_analyzed']} news-market pairs")
    print(f"  Found {len(result['news_market_mapping'])} relevant matches")
