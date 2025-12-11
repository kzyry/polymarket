// Pure JavaScript - No Vue needed
const formatVolume = (volume) => {
  if (volume >= 1_000_000) return (volume / 1_000_000).toFixed(1) + 'M'
  if (volume >= 1_000) return (volume / 1_000).toFixed(0) + 'K'
  return volume.toString()
}

const calculateProfit = (multiplier) => {
  return (100 * multiplier).toFixed(0)
}

const formatMultiplier = (value) => {
  const num = parseFloat(value)
  if (isNaN(num) || num === 0) return '~'

  // If >= 10, show as integer (no decimals)
  if (num >= 10) {
    return Math.round(num).toString()
  }

  // If < 10, show one decimal but remove .0
  const formatted = num.toFixed(1)
  return formatted.endsWith('.0') ? Math.round(num).toString() : formatted
}

const getImpactIcon = (direction) => {
  switch (direction) {
    case 'positive': return '🟢'
    case 'negative': return '🔴'
    case 'neutral': return '🟡'
    default: return ''
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Render functions
function renderOpportunityCard(item, index, rank) {
  const isNo = item.outcome_name.toLowerCase() === 'no'
  const badgeClass = isNo ? 'outcome-badge outcome-badge--no' : 'outcome-badge outcome-badge--yes'

  return `
    <div class="opportunity-card">
      <div class="opportunity-card__header">
        ${item.image ? `<img src="${item.image}" alt="${item.market_title}" class="opportunity-card__image" />` : `<span class="opportunity-card__rank">#${rank}</span>`}
        <a href="${item.market_url}" target="_blank" rel="noopener" class="opportunity-card__market">
          ${item.market_title}
        </a>
        <div class="${badgeClass}">
          <span class="outcome-badge__outcome">${item.outcome_name}</span>
          <span class="outcome-badge__separator">/</span>
          <span class="outcome-badge__probability">${(item.probability * 100).toFixed(1)}%</span>
          <span class="outcome-badge__separator">/</span>
          <span class="outcome-badge__multiplier">${item.multiplier}x</span>
        </div>
      </div>
    </div>
  `
}

// Closing Soon widget removed - not useful

function renderNewsItem(item) {
  return `
    <div class="news-item">
      <div class="news-item__title">${item.news_title}</div>
      <div class="news-item__affects">
        <span class="news-item__label">Affects:</span>
        <a href="${item.market_url}" target="_blank" rel="noopener" class="news-item__market">
          ${item.market_title}
        </a>
      </div>
    </div>
  `
}

function renderTrendingEvent(market) {
  // Parse outcomes if it's a group with nested markets
  let outcomes = []

  if (market.markets && market.markets.length > 0) {
    // Special case: if only 1 market with Yes/No outcomes, show both as separate rows
    if (market.markets.length === 1) {
      const m = market.markets[0]
      try {
        const outcomesArr = JSON.parse(m.outcomes || '[]')
        const prices = JSON.parse(m.outcomePrices || '[]')

        if (outcomesArr.length === 2 && outcomesArr[0] === 'Yes' && outcomesArr[1] === 'No') {
          const yesPrice = parseFloat(prices[0]) || 0
          const noPrice = parseFloat(prices[1]) || 0

          outcomes = [
            {
              question: 'Yes',
              yesPercent: Math.round(yesPrice * 100),
              yesMultiplier: yesPrice > 0 ? formatMultiplier(1 / yesPrice) : '~',
              noMultiplier: '~',
              sortValue: yesPrice
            },
            {
              question: 'No',
              yesPercent: Math.round(noPrice * 100),
              yesMultiplier: noPrice > 0 ? formatMultiplier(1 / noPrice) : '~',
              noMultiplier: '~',
              sortValue: noPrice
            }
          ]

          // Early return for Yes/No markets
          if (outcomes.length > 0) {
            return `
              <div class="trending-card trending-card--with-outcomes">
                <div class="trending-card__header">
                  <img src="${market.icon || market.image}" alt="" class="trending-card__icon" />
                  <a href="https://polymarket.com/event/${market.slug}" target="_blank" rel="noopener" class="trending-card__title">
                    ${market.title}
                  </a>
                </div>

                <div class="trending-card__outcomes">
                  ${outcomes.map(outcome => `
                    <div class="outcome-row">
                      <div class="outcome-row__name">${outcome.question}</div>
                      <div class="outcome-row__stats">
                        <div class="outcome-row__percent-bar">
                          <div class="outcome-row__percent-fill" style="width: ${outcome.yesPercent}%"></div>
                          <span class="outcome-row__percent-text">${outcome.yesPercent}%</span>
                        </div>
                        <div class="outcome-row__multipliers">
                          <span class="outcome-row__multiplier outcome-row__multiplier--yes">${outcome.yesMultiplier}x</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="trending-card__footer">
                  <div class="trending-card__info">
                    <span class="trending-card__volume">
                      <img src="./images/volume.svg" alt="" class="trending-card__icon-small" />
                      $${formatVolume(market.volume24hr)} Vol
                    </span>
                    <span class="trending-card__date">
                      <img src="./images/time.svg" alt="" class="trending-card__icon-small" />
                      ${formatDate(market.endDate)}
                    </span>
                  </div>
                  <a href="https://polymarket.com/event/${market.slug}" target="_blank" rel="noopener" class="trending-card__trade">
                    Trade ↗
                  </a>
                </div>
              </div>
            `
          }
        }
      } catch (e) {
        console.error('Error parsing Yes/No market:', e)
      }
    }

    // Regular group market logic:
    // Separate outcomes into tiers
    const allMarkets = market.markets.map(m => {
      try {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : (m.outcomePrices || [0, 0])
        const yesPrice = parseFloat(prices[0]) || 0
        return { market: m, yesPrice }
      } catch (e) {
        return { market: m, yesPrice: 0 }
      }
    })

    // Tier 1: Good range (1-99%)
    const tier1 = allMarkets.filter(({ yesPrice }) => yesPrice > 0.01 && yesPrice < 0.99)

    // Tier 2: Close to range (0.1-1% or 99-99.9%)
    const tier2 = allMarkets.filter(({ yesPrice }) =>
      (yesPrice >= 0.001 && yesPrice <= 0.01) || (yesPrice >= 0.99 && yesPrice < 0.999)
    )

    // Combine: take tier1 first, then tier2 if needed
    let marketsToShow = [...tier1]
    if (marketsToShow.length < 5) {
      marketsToShow = [...marketsToShow, ...tier2].slice(0, Math.min(allMarkets.length, 5))
    }

    // If still less than 5, add any remaining
    if (marketsToShow.length < 5) {
      const used = new Set(marketsToShow.map(m => m.market.question))
      const remaining = allMarkets.filter(m => !used.has(m.market.question))
      marketsToShow = [...marketsToShow, ...remaining].slice(0, 5)
    }

    const finalMarkets = marketsToShow.map(m => m.market)

    outcomes = finalMarkets
      .map(m => {
        let prices = [0, 0]
        try {
          if (typeof m.outcomePrices === 'string') {
            prices = JSON.parse(m.outcomePrices)
          } else if (Array.isArray(m.outcomePrices)) {
            prices = m.outcomePrices
          }
        } catch (e) {}

        const yesPrice = parseFloat(prices[0]) || 0
        const noPrice = parseFloat(prices[1]) || 0

        // Clean up question text
        let cleanQuestion = m.question
          .replace(market.title, '')
          .replace(/^Will\s+/i, '')
          .replace(/\s+by\s+December.*$/i, '')
          .replace(/\?$/, '')
          .trim()

        const yesPercent = Math.round(yesPrice * 100)
        const yesMultiplier = yesPrice > 0 ? formatMultiplier(1 / yesPrice) : '~'
        const noMultiplier = noPrice > 0 ? formatMultiplier(1 / noPrice) : '~'

        return {
          question: cleanQuestion,
          yesPercent,
          yesMultiplier,
          noMultiplier,
          sortValue: yesPrice
        }
      })
      .sort((a, b) => b.sortValue - a.sortValue) // Sort by highest probability first
      .slice(0, 5) // Take top 5

    // Debug: log final outcomes for Ethereum market
    if (market.title.includes('Ethereum')) {
      console.log('Ethereum outcomes after processing:', outcomes.map(o => ({
        question: o.question,
        yesPercent: o.yesPercent,
        yesMultiplier: o.yesMultiplier
      })))
    }
  }

  const hasOutcomes = outcomes.length > 0

  return `
    <div class="trending-card ${hasOutcomes ? 'trending-card--with-outcomes' : ''}">
      <div class="trending-card__header">
        <img src="${market.icon || market.image}" alt="" class="trending-card__icon" />
        <a href="https://polymarket.com/event/${market.slug}" target="_blank" rel="noopener" class="trending-card__title">
          ${market.title}
        </a>
      </div>

      ${hasOutcomes ? `
        <div class="trending-card__outcomes">
          ${outcomes.map(outcome => `
            <div class="outcome-row">
              <div class="outcome-row__name">${outcome.question}</div>
              <div class="outcome-row__stats">
                <div class="outcome-row__percent-bar">
                  <div class="outcome-row__percent-fill" style="width: ${outcome.yesPercent}%"></div>
                  <span class="outcome-row__percent-text">${outcome.yesPercent}%</span>
                </div>
                <div class="outcome-row__multipliers">
                  <span class="outcome-row__multiplier outcome-row__multiplier--yes">${outcome.yesMultiplier}x</span>
                  <span class="outcome-row__multiplier outcome-row__multiplier--no">${outcome.noMultiplier}x</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="trending-card__image-wrapper">
          <img src="${market.image || market.icon}" alt="${market.title}" class="trending-card__image" />
        </div>
      `}

      <div class="trending-card__footer">
        <div class="trending-card__info">
          <span class="trending-card__volume">
            <img src="./images/volume.svg" alt="" class="trending-card__icon-small" />
            $${formatVolume(market.volume24hr)} Vol
          </span>
          <span class="trending-card__date">
            <img src="./images/time.svg" alt="" class="trending-card__icon-small" />
            ${formatDate(market.endDate)}
          </span>
        </div>
        <a href="https://polymarket.com/event/${market.slug}" target="_blank" rel="noopener" class="trending-card__trade">
          Trade ↗
        </a>
      </div>
    </div>
  `
}

function renderDashboard(data, trendingMarkets = []) {
  const { widgets, metadata } = data

  let html = `
    <!-- Widget 1: Risk Categories -->
    <div class="widget widget--full">
      <div class="risk-grid">
        <!-- Extreme Risk -->
        <div class="risk-category">
          <h3 class="risk-category__title">
            Extreme Risk
            <span class="risk-category__subtitle"><20x</span>
          </h3>

          ${widgets.risk_categories.medium_risk.length > 0
            ? widgets.risk_categories.medium_risk.map((item, i) =>
                renderOpportunityCard(item, i, i + 1)
              ).join('')
            : '<div class="empty-state">No extreme risk opportunities found</div>'
          }
        </div>

        <!-- High Risk -->
        <div class="risk-category">
          <h3 class="risk-category__title">
            High Risk
            <span class="risk-category__subtitle"><10x</span>
          </h3>

          ${widgets.risk_categories.low_risk.length > 0
            ? widgets.risk_categories.low_risk.map((item, i) =>
                renderOpportunityCard(item, i, i + 1)
              ).join('')
            : '<div class="empty-state">No high risk opportunities found</div>'
          }
        </div>
      </div>
    </div>

    <!-- Widgets Row -->
    <div class="widgets-row">
      <!-- Widget: News Feed (Full Width) -->
      <div class="widget">
        <div class="widget__header">
          <h2 class="widget__title">Market-Moving News</h2>
          <p class="widget__subtitle">Last 48 hours</p>
        </div>

        <div class="news-list news-list--horizontal">
          ${widgets.news_feed.length > 0
            ? widgets.news_feed.map(item => renderNewsItem(item)).join('')
            : '<div class="empty-state"><span class="error-message">⚠️ No news analysis available</span><p>Unable to analyze news relevance</p></div>'
          }
        </div>
      </div>
    </div>

    <!-- Trending Events -->
    <div class="widget widget--full">
      <div class="widget__header">
        <h2 class="widget__title">Top Trending Events</h2>
        <p class="widget__subtitle">Highest 24h volume</p>
      </div>

      <div class="trending-grid">
        ${trendingMarkets.length > 0
          ? trendingMarkets.map(market => renderTrendingEvent(market)).join('')
          : '<div class="empty-state">No trending events available</div>'
        }
      </div>
    </div>

    <!-- Crypto Events -->
    <div class="widget widget--full">
      <div class="widget__header">
        <h2 class="widget__title">Top Crypto Events</h2>
        <p class="widget__subtitle">Highest 24h volume</p>
      </div>

      <div class="trending-grid">
        ${widgets.crypto_events && widgets.crypto_events.length > 0
          ? widgets.crypto_events.map(market => renderTrendingEvent(market)).join('')
          : '<div class="empty-state">No crypto events available</div>'
        }
      </div>
    </div>
  `

  document.getElementById('main').innerHTML = html
}

// Load data
async function loadDashboard() {
  try {
    const [dashboardResponse, snapshotResponse] = await Promise.all([
      fetch('./data/dashboard_data.json'),
      fetch('./data/polymarket_snapshot.json')
    ])

    if (!dashboardResponse.ok) throw new Error('Failed to load dashboard data')
    if (!snapshotResponse.ok) throw new Error('Failed to load snapshot data')

    const dashboardData = await dashboardResponse.json()
    const snapshotData = await snapshotResponse.json()

    // Get top 6 trending markets by volume24hr
    const trendingMarkets = snapshotData.markets
      .filter(m => m.volume24hr > 0)
      .sort((a, b) => b.volume24hr - a.volume24hr)
      .slice(0, 6)

    // Get top 6 crypto events (filter by crypto-related keywords)
    const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol', 'dogecoin', 'doge', 'ripple', 'xrp', 'cardano', 'ada', 'polygon', 'matic', 'avalanche', 'avax', 'polkadot', 'dot', 'shiba', 'litecoin', 'ltc', 'chainlink', 'link', 'uniswap', 'uni', 'stellar', 'xlm', 'cosmos', 'atom', 'algorand', 'algo', 'near', 'aptos', 'apt', 'sui', 'blockchain', 'defi', 'nft', 'web3']

    const cryptoMarkets = snapshotData.markets
      .filter(m => {
        if (m.volume24hr <= 0) return false
        const titleLower = m.title.toLowerCase()
        const descLower = (m.description || '').toLowerCase()
        return cryptoKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword))
      })
      .sort((a, b) => b.volume24hr - a.volume24hr)
      .slice(0, 6)

    // Add crypto_events to widgets
    dashboardData.widgets.crypto_events = cryptoMarkets

    // Hide loading
    document.getElementById('loading').style.display = 'none'

    // Show content
    document.getElementById('main').style.display = 'block'

    // Render
    renderDashboard(dashboardData, trendingMarkets)

  } catch (e) {
    // Hide loading
    document.getElementById('loading').style.display = 'none'

    // Show error
    document.getElementById('error').style.display = 'block'
    document.getElementById('error-message').textContent = e.message
    console.error('Error loading data:', e)
  }
}

// Start
document.addEventListener('DOMContentLoaded', loadDashboard)
