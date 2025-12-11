#!/usr/bin/env python3
"""
News Fetcher - Fetches crypto news from RSS feeds
"""
import feedparser
import requests
import logging
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

RSS_SOURCES = {
    'chaingpt': 'https://api.chaingpt.org/ai-news/rss',
    'cointelegraph': 'https://cointelegraph.com/rss',
    'decrypt': 'https://decrypt.co/feed',
    'cryptonews': 'https://crypto.news/feed'
}


def fetch_crypto_news(hours=48):
    """
    Fetch crypto news from RSS feeds for the last N hours

    Args:
        hours: int, how many hours back to fetch (default 48)

    Returns:
        list of news dicts
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    all_news = []
    seen_titles = set()

    logger.info(f"Fetching news from last {hours} hours...")

    for source_name, feed_url in RSS_SOURCES.items():
        try:
            logger.info(f"Fetching from {source_name}...")
            # Fetch with requests first (feedparser doesn't handle User-Agent well)
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()

            # Parse the fetched content
            feed = feedparser.parse(response.content)

            for entry in feed.entries:
                # Parse published date
                published = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    published = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)

                # Skip if too old
                if published and published < cutoff_time:
                    continue

                # Extract data
                title = entry.get('title', '').strip()
                link = entry.get('link', '')
                summary = entry.get('summary', '')

                # Deduplicate by title
                if title and title not in seen_titles:
                    seen_titles.add(title)

                    all_news.append({
                        'title': title,
                        'link': link,
                        'published_at': published.isoformat() if published else None,
                        'source': source_name,
                        'summary': summary[:200] if summary else ''
                    })

            logger.info(f"  Found {len([n for n in all_news if n['source'] == source_name])} from {source_name}")

        except Exception as e:
            logger.error(f"Failed to fetch from {source_name}: {e}")
            continue

    # Sort by published date (newest first)
    all_news.sort(key=lambda x: x['published_at'] or '', reverse=True)

    logger.info(f"Total news fetched: {len(all_news)}")

    # Save raw news
    save_news(all_news)

    return all_news


def save_news(news_list):
    """Save raw news to file"""
    news_path = Path("data/news_raw.json")
    news_path.parent.mkdir(parents=True, exist_ok=True)

    news_data = {
        "news": news_list,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total_count": len(news_list)
    }

    with open(news_path, 'w', encoding='utf-8') as f:
        json.dump(news_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved news to {news_path}")


if __name__ == "__main__":
    # Test mode
    logging.basicConfig(level=logging.INFO)
    news = fetch_crypto_news(hours=48)

    print(f"\n✓ Fetched {len(news)} news articles")

    if news:
        print(f"\nFirst 3 articles:")
        for i, article in enumerate(news[:3], 1):
            print(f"\n{i}. {article['title']}")
            print(f"   Source: {article['source']}")
            print(f"   Published: {article['published_at']}")
