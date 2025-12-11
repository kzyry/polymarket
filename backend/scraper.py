#!/usr/bin/env python3
"""
Polymarket Scraper - Fetches market data from Gamma API
"""
import requests
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

GAMMA_API_BASE = "https://gamma-api.polymarket.com"
MARKETS_LIMIT = 500  # Fetch more markets to find diverse closing soon options


def fetch_polymarket_markets(limit=MARKETS_LIMIT, max_retries=3):
    """
    Fetch active markets from Polymarket Gamma API

    Returns:
        list: Deduplicated markets from trending and crypto categories
    """
    url = f"{GAMMA_API_BASE}/events"
    params = {
        "limit": limit,
        "offset": 0,
        "closed": "false",
        "active": "true"
    }

    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching markets from Gamma API (attempt {attempt + 1}/{max_retries})...")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            all_markets = response.json()
            logger.info(f"Received {len(all_markets)} total markets")

            # Strategy: Sort by volume24hr and filter crypto by keywords
            # (API no longer provides trending/crypto tags)

            # Sort by volume descending
            sorted_markets = sorted(
                all_markets,
                key=lambda m: m.get('volume24hr', 0),
                reverse=True
            )

            # Top 100 by volume = "trending"
            trending_markets = sorted_markets[:100]

            # Crypto detection keywords
            crypto_keywords = {
                'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol',
                'xrp', 'ripple', 'cardano', 'ada', 'polygon', 'matic', 'doge',
                'dogecoin', 'shiba', 'avalanche', 'avax', 'polkadot', 'dot',
                'chainlink', 'link', 'uniswap', 'uni', 'litecoin', 'ltc',
                'binance', 'bnb', 'tether', 'usdt', 'usdc', 'dai', 'stablecoin',
                'defi', 'nft', 'web3', 'blockchain', 'token', 'coin'
            }

            crypto_markets = []
            for market in all_markets:
                title = market.get('title', '').lower()
                desc = market.get('description', '').lower()

                # Check if any crypto keyword is in title or description
                if any(kw in title or kw in desc for kw in crypto_keywords):
                    crypto_markets.append(market)
                    if len(crypto_markets) >= 50:
                        break

            # Find markets closing within 60 days
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            closing_soon_cutoff = now + timedelta(days=60)

            closing_soon_markets = []
            for market in all_markets:
                end_date_str = market.get('endDate', '')
                if end_date_str:
                    try:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                        if now < end_date <= closing_soon_cutoff:
                            closing_soon_markets.append(market)
                            if len(closing_soon_markets) >= 30:
                                break
                    except:
                        pass

            logger.info(f"Filtered: {len(trending_markets)} trending (by volume), {len(crypto_markets)} crypto (by keywords), {len(closing_soon_markets)} closing soon (60 days)")

            # Deduplicate by market ID (trending has priority, then crypto, then closing soon)
            seen_ids = set()
            final_markets = []

            for market in trending_markets + crypto_markets + closing_soon_markets:
                market_id = market.get('id')
                if market_id and market_id not in seen_ids:
                    final_markets.append(market)
                    seen_ids.add(market_id)

            logger.info(f"Final deduplicated markets: {len(final_markets)}")

            # Save snapshot
            save_snapshot(final_markets)

            return final_markets

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                logger.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logger.error("All retry attempts failed")
                return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return []

    return []


def save_snapshot(markets):
    """Save raw markets data to snapshot file"""
    snapshot_path = Path("data/polymarket_snapshot.json")
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)

    snapshot = {
        "markets": markets,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(markets)
    }

    with open(snapshot_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved snapshot to {snapshot_path}")


if __name__ == "__main__":
    # Test mode
    logging.basicConfig(level=logging.INFO)
    markets = fetch_polymarket_markets()
    print(f"\n✓ Fetched {len(markets)} markets")

    if markets:
        print(f"\nFirst market example:")
        print(json.dumps(markets[0], indent=2)[:500])
