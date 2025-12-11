#!/usr/bin/env python3
"""
Risk Calculator - Calculates risk-reward metrics for market outcomes
"""
import math
import logging
from copy import deepcopy

logger = logging.getLogger(__name__)


def calculate_risk_reward_score(probability, price, volume):
    """
    Calculate risk-reward score using EV, Kelly Criterion, and liquidity

    Args:
        probability: float (0-1), win probability
        price: float (0-1), price in dollars (0.18 = 18¢)
        volume: float, trading volume in USD

    Returns:
        dict with score, multiplier, ev, kelly, volume_weight
    """
    # 1. Multiplier
    multiplier = 1 / price if price > 0 else 0

    # 2. Expected Value
    # EV = (probability × payout) - cost
    # payout = stake × multiplier, cost = stake (normalized to 1)
    ev = (probability * multiplier) - 1

    # 3. Kelly Criterion
    # f = (bp - q) / b, where b = multiplier - 1, p = probability, q = 1 - p
    if multiplier > 1:
        b = multiplier - 1
        kelly_fraction = ((b * probability) - (1 - probability)) / b if b > 0 else 0
        kelly_fraction = max(0, min(kelly_fraction, 1))  # Clamp [0, 1]
    else:
        kelly_fraction = 0

    # 4. Liquidity weight (logarithmic scale)
    if volume > 0:
        # log scale: log10(volume) normalized to [0, 1]
        # $10k = 0.5, $100k = 0.75, $1M = 1.0
        volume_weight = min(max((math.log10(volume) - 4) / 3, 0.1), 1.0)
    else:
        volume_weight = 0.1

    # 5. Final score
    # In efficient prediction markets, price ≈ true probability, so EV ≈ 0
    # We use multiplier and volume as main ranking factors
    # Score = (multiplier - 1) × volume_weight (higher multiplier + volume = better)
    score = max(0, multiplier - 1) * volume_weight

    return {
        'score': round(score, 6),
        'multiplier': round(multiplier, 2),
        'expected_value': round(ev, 4),
        'kelly_fraction': round(kelly_fraction, 4),
        'volume_weight': round(volume_weight, 4)
    }


def categorize_risk(probability, multiplier):
    """
    Categorize outcome by risk level

    Returns: 'medium', 'low', 'extreme', 'safe', or 'other'
    """
    if 0.05 <= probability <= 0.10 and 10 <= multiplier <= 20:
        return 'medium'
    elif 0.10 < probability <= 0.20 and 5 <= multiplier <= 10:
        return 'low'
    elif probability < 0.05 and multiplier > 20:
        return 'extreme'
    elif probability > 0.60 and multiplier < 2:
        return 'safe'
    else:
        return 'other'


def enrich_with_risk_metrics(markets_data):
    """
    Add risk metrics to all outcomes in all markets

    Polymarket API structure:
    - Each event group has multiple markets under 'markets' key
    - Each market has outcomes and outcomePrices like: ["0.07", "0.93"]

    Args:
        markets_data: list of event group dicts

    Returns:
        list of enriched markets (flattened from nested structure)
    """
    enriched_markets = []

    for event_group in markets_data:
        nested_markets = event_group.get('markets', [])

        for market in nested_markets:
            # Parse outcomes and prices
            outcomes_str = market.get('outcomes', '[]')
            prices_str = market.get('outcomePrices', '[]')

            try:
                outcomes_list = eval(outcomes_str) if isinstance(outcomes_str, str) else outcomes_str
                prices_list = eval(prices_str) if isinstance(prices_str, str) else prices_str
            except:
                logger.warning(f"Failed to parse outcomes/prices for market {market.get('id')}")
                continue

            # Get market-level data
            market_volume = float(market.get('volume', 0))
            market_url = f"https://polymarket.com/event/{market.get('slug', '')}"
            market_question = market.get('question', '')
            market_end_date = market.get('endDate', '')

            # Process each outcome
            market_outcomes = []
            for outcome_name, price_str in zip(outcomes_list, prices_list):
                try:
                    price = float(price_str)
                    probability = price  # In prediction markets, price ≈ probability

                    # Calculate metrics
                    risk_metrics = calculate_risk_reward_score(probability, price, market_volume)

                    # Add risk category
                    risk_category = categorize_risk(probability, risk_metrics['multiplier'])
                    risk_metrics['risk_category'] = risk_category

                    market_outcomes.append({
                        'name': outcome_name,
                        'price': price,
                        'probability': probability,
                        'volume': market_volume,
                        'risk_metrics': risk_metrics
                    })
                except Exception as e:
                    logger.warning(f"Failed to process outcome {outcome_name}: {e}")
                    continue

            # Create enriched market record
            enriched_markets.append({
                'question': market_question,
                'url': market_url,
                'end_date': market_end_date,
                'volume': market_volume,
                'outcomes': market_outcomes,
                'event_title': event_group.get('title', ''),
                'market_id': market.get('id'),
                'image': market.get('image', event_group.get('image', ''))
            })

    logger.info(f"Enriched {len(enriched_markets)} markets with risk metrics")
    return enriched_markets


if __name__ == "__main__":
    # Test mode
    logging.basicConfig(level=logging.INFO)

    # Test data
    test_cases = [
        {"prob": 0.07, "price": 0.07, "volume": 1500000, "desc": "Medium risk"},
        {"prob": 0.15, "price": 0.15, "volume": 2000000, "desc": "Low risk"},
        {"prob": 0.03, "price": 0.03, "volume": 500000, "desc": "Extreme risk"},
        {"prob": 0.75, "price": 0.75, "volume": 5000000, "desc": "Safe bet"},
    ]

    print("\nRisk Calculator Test:")
    print("=" * 60)

    for tc in test_cases:
        result = calculate_risk_reward_score(tc['prob'], tc['price'], tc['volume'])
        category = categorize_risk(tc['prob'], result['multiplier'])

        print(f"\n{tc['desc']}:")
        print(f"  Probability: {tc['prob']*100:.1f}%")
        print(f"  Multiplier: {result['multiplier']}x")
        print(f"  Expected Value: {result['expected_value']}")
        print(f"  Kelly Fraction: {result['kelly_fraction']}")
        print(f"  Volume Weight: {result['volume_weight']}")
        print(f"  Score: {result['score']}")
        print(f"  Category: {category}")
