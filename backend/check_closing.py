#!/usr/bin/env python3
import json
from datetime import datetime, timezone

# Load enriched markets
with open('data/markets_with_metrics.json', 'r') as f:
    markets_data = json.load(f)['markets']

now = datetime.now(timezone.utc)
candidates = []

for market in markets_data:
    end_date_str = market.get('end_date', '')
    if not end_date_str:
        continue

    try:
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        hours_until_close = (end_date - now).total_seconds() / 3600

        # Check markets closing in 30 days
        if 0 < hours_until_close <= 720:  # 30 days = 720 hours
            for outcome in market.get('outcomes', []):
                prob = outcome.get('probability', 0)
                mult = outcome.get('risk_metrics', {}).get('multiplier', 0)

                # Check if meets criteria
                if 0.60 <= prob <= 0.90 and mult >= 1.1:
                    candidates.append({
                        'question': market.get('question', '')[:60],
                        'outcome': outcome.get('name', ''),
                        'prob': prob,
                        'mult': round(mult, 2),
                        'hours': round(hours_until_close, 1)
                    })
    except:
        continue

print(f'Всего кандидатов для closing soon: {len(candidates)}')
print()

if candidates:
    print('Топ-10:')
    for i, c in enumerate(sorted(candidates, key=lambda x: x['hours'])[:10], 1):
        print(f'{i}. {c["question"]}... ({c["outcome"]})')
        print(f'   Prob: {c["prob"]:.2%}, Mult: {c["mult"]}x, Hours: {c["hours"]}h')
        print()
else:
    print('❌ Нет рынков, соответствующих критериям:')
    print('   - Вероятность: 60-90%')
    print('   - Множитель: >= 1.1x')
    print('   - Закрытие: в течение 30 дней')
    print()
    print('Давайте проверим, есть ли рынки хотя бы без ограничения вероятности...')
    print()

    # Check without probability restriction
    candidates_relaxed = []
    for market in markets_data:
        end_date_str = market.get('end_date', '')
        if not end_date_str:
            continue

        try:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            hours_until_close = (end_date - now).total_seconds() / 3600

            if 0 < hours_until_close <= 720:
                for outcome in market.get('outcomes', []):
                    mult = outcome.get('risk_metrics', {}).get('multiplier', 0)
                    if mult >= 1.1:
                        candidates_relaxed.append({
                            'question': market.get('question', '')[:60],
                            'outcome': outcome.get('name', ''),
                            'prob': outcome.get('probability', 0),
                            'mult': round(mult, 2),
                            'hours': round(hours_until_close, 1)
                        })
        except:
            continue

    if candidates_relaxed:
        print(f'С расслабленными критериями: {len(candidates_relaxed)} кандидатов')
        print()
        print('Топ-10 (любая вероятность, mult >= 1.1x):')
        for i, c in enumerate(sorted(candidates_relaxed, key=lambda x: x['hours'])[:10], 1):
            print(f'{i}. {c["question"]}... ({c["outcome"]})')
            print(f'   Prob: {c["prob"]:.2%}, Mult: {c["mult"]}x, Hours: {c["hours"]}h')
            print()
