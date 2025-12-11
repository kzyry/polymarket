#!/usr/bin/env python3
"""
Polymarket Dashboard - Main Pipeline
Orchestrates data collection, analysis, and aggregation
"""
import logging
import sys
import json
from datetime import datetime
from pathlib import Path

# Import components
from scraper import fetch_polymarket_markets
from risk_calculator import enrich_with_risk_metrics
from news_fetcher import fetch_crypto_news
from news_analyzer import analyze_news_relevance
from aggregator import build_dashboard_data

# Setup logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'pipeline.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def main():
    """Main pipeline execution"""
    start_time = datetime.now()
    logger.info("=" * 60)
    logger.info("Polymarket Dashboard Pipeline Started")
    logger.info("=" * 60)

    try:
        # Step 1: Fetch Polymarket markets
        logger.info("[1/5] Fetching Polymarket markets...")
        markets_data = fetch_polymarket_markets()

        if not markets_data:
            logger.error("No markets fetched, aborting pipeline")
            return 1

        logger.info(f"✓ Fetched {len(markets_data)} markets")

        # Step 2: Calculate risk metrics
        logger.info("[2/5] Calculating risk metrics...")
        markets_with_metrics = enrich_with_risk_metrics(markets_data)
        logger.info(f"✓ Enriched {len(markets_with_metrics)} markets with risk scores")

        # Step 3: Fetch crypto news
        logger.info("[3/5] Fetching crypto news (last 48h)...")
        news_data = fetch_crypto_news(hours=48)
        logger.info(f"✓ Fetched {len(news_data)} news articles")

        # Step 4: Analyze news relevance
        logger.info("[4/5] Analyzing news relevance...")
        news_analysis = analyze_news_relevance(news_data, markets_with_metrics)
        logger.info(f"✓ Analyzed {news_analysis['stats']['total_analyzed']} news-market pairs")
        logger.info(f"  - Claude AI: {news_analysis['stats']['claude_ai']}")
        logger.info(f"  - Keyword fallback: {news_analysis['stats']['keyword_fallback']}")
        logger.info(f"  - Cached: {news_analysis['stats']['cached']}")

        # Step 5: Build final dashboard data
        logger.info("[5/5] Building dashboard data...")
        dashboard_data = build_dashboard_data(
            markets_with_metrics,
            news_analysis
        )

        # Save to frontend/data/
        output_path = Path("../frontend/data/dashboard_data.json")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(dashboard_data, f, indent=2, ensure_ascii=False)

        logger.info(f"✓ Dashboard data saved to {output_path}")

        # Summary
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info("=" * 60)
        logger.info(f"✅ Pipeline completed successfully in {elapsed:.1f}s")
        logger.info(f"Dashboard ready at: frontend/index.html")
        logger.info("=" * 60)

        return 0

    except Exception as e:
        logger.error(f"❌ Pipeline failed: {str(e)}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
