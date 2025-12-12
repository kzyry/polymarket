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

// Get best outcome (closest to 100%)
function getBestOutcome(market) {
  let bestOutcome = null
  let maxProb = -1

  // New format from trending-markets.json
  if (market.outcomes && Array.isArray(market.outcomes) && market.outcomes.length > 0) {
    // Get the outcome with highest probability
    bestOutcome = market.outcomes.reduce((max, outcome) =>
      outcome.probability > max.probability ? outcome : max
    , market.outcomes[0])

    const yesProb = bestOutcome.probability
    const noProb = 1 - yesProb

    return {
      name: bestOutcome.name,
      probability: yesProb,
      yesMultiplier: yesProb > 0 ? formatMultiplier(1 / yesProb) : '~',
      noMultiplier: noProb > 0 ? formatMultiplier(1 / noProb) : '~'
    }
  }

  // Old format from polymarket_snapshot.json
  if (market.markets && market.markets.length > 0) {
    // Check if it's a simple Yes/No market (only 1 sub-market)
    const isSimpleYesNo = market.markets.length === 1

    // For group markets with many options, collect all and find max
    const allOptions = []

    market.markets.forEach(m => {
      try {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : (m.outcomePrices || [0, 0])
        const yesPrice = parseFloat(prices[0]) || 0
        const noPrice = parseFloat(prices[1]) || 0

        // Clean up question text - remove title prefix
        let questionText = m.question.replace(market.title, '').trim()

        // For "What price will X hit in 2025?" format, extract the price range from the question
        // Example: "What price will Bitcoin hit in 2025? Bitcoin reach $90,000 - $99,999"
        const priceRangeMatch = questionText.match(/\$[\d,]+\s*-\s*\$[\d,]+/i)
        const singlePriceMatch = questionText.match(/\$[\d,]+(?!\s*-)/i)

        if (priceRangeMatch) {
          // Found price range like "$90,000 - $99,999"
          questionText = priceRangeMatch[0]
        } else if (singlePriceMatch) {
          // Found single price like "$95,000"
          questionText = singlePriceMatch[0]
        } else {
          // Standard cleanup for other formats
          questionText = questionText
            .replace(/^Will\s+/i, '')
            .replace(/^What\s+price\s+will\s+\w+\s+hit\s+in\s+\d{4}\?\s*/i, '')
            .replace(/(?:Bitcoin|Ethereum)\s+(?:reach|hit)\s+/i, '')
            .replace(/\s+by\s+December.*$/i, '')
            .replace(/\s+in\s+2025\??$/i, '')
            .replace(/\?$/, '')
            .trim()
        }

        // Add Yes option
        allOptions.push({
          name: questionText || 'Yes',
          probability: yesPrice,
          yesMultiplier: yesPrice > 0 ? formatMultiplier(1 / yesPrice) : '~',
          noMultiplier: noPrice > 0 ? formatMultiplier(1 / noPrice) : '~'
        })

        // For simple Yes/No markets, also add No option
        if (isSimpleYesNo) {
          allOptions.push({
            name: 'No',
            probability: noPrice,
            yesMultiplier: noPrice > 0 ? formatMultiplier(1 / noPrice) : '~',
            noMultiplier: yesPrice > 0 ? formatMultiplier(1 / yesPrice) : '~'
          })
        }
      } catch (e) {
        console.error('Error parsing outcome:', e)
      }
    })

    // Special handling for Bitcoin and Ethereum price markets - use same tier logic as cards
    if (market.title && (market.title.includes('Bitcoin') || market.title.includes('Ethereum')) &&
        market.title.includes('price')) {
      // Filter by tier (same as card rendering logic)
      // Tier 1: Good range (1-99%)
      const tier1 = allOptions.filter(opt => opt.probability > 0.01 && opt.probability < 0.99)

      // Tier 2: Close to range (0.1-1% or 99-99.9%)
      const tier2 = allOptions.filter(opt =>
        (opt.probability >= 0.001 && opt.probability <= 0.01) ||
        (opt.probability >= 0.99 && opt.probability < 0.999)
      )

      // Combine: take tier1 first, then tier2 if needed
      let filteredOptions = [...tier1]
      if (filteredOptions.length === 0) {
        filteredOptions = [...tier2]
      }

      // Sort by probability and take first
      filteredOptions.sort((a, b) => b.probability - a.probability)
      bestOutcome = filteredOptions[0] || allOptions[0]
    } else {
      // For other markets, sort by probability descending and take first (highest)
      allOptions.sort((a, b) => b.probability - a.probability)
      bestOutcome = allOptions[0]
    }
  }

  return bestOutcome || { name: 'N/A', probability: 0, multiplier: '~' }
}

// View mode state
let viewMode = localStorage.getItem('trendingViewMode') || 'grid'

function setViewMode(mode) {
  viewMode = mode
  localStorage.setItem('trendingViewMode', mode)

  // Update button active states
  document.querySelectorAll('.view-toggle__btn').forEach(btn => {
    btn.classList.remove('view-toggle__btn--active')
  })

  const activeBtn = mode === 'grid'
    ? document.querySelector('.view-toggle__btn[onclick*="grid"]')
    : document.querySelector('.view-toggle__btn[onclick*="table"]')

  if (activeBtn) {
    activeBtn.classList.add('view-toggle__btn--active')
  }

  // Re-render trending section
  const container = document.querySelector('.trending-container')
  if (container && window.currentTrendingMarkets) {
    container.innerHTML = renderTrendingContent(window.currentTrendingMarkets)
    attachSortHandlers()
  }
}

// Render functions
function renderOpportunityCard(item, index, rank) {
  const isNo = item.outcome_name.toLowerCase() === 'no'
  const badgeClass = isNo ? 'outcome-badge outcome-badge--no' : 'outcome-badge outcome-badge--yes'

  return `
    <a href="${item.market_url}" target="_blank" rel="noopener" class="opportunity-card">
      <div class="opportunity-card__header">
        ${item.image ? `<img src="${item.image}" alt="${item.market_title}" class="opportunity-card__image" />` : `<span class="opportunity-card__rank">#${rank}</span>`}
        <span class="opportunity-card__market">
          ${item.market_title}
        </span>
        <div class="${badgeClass}">
          <span class="outcome-badge__outcome">${item.outcome_name}</span>
          <span class="outcome-badge__separator">/</span>
          <span class="outcome-badge__probability">${(item.probability * 100).toFixed(1)}%</span>
          <span class="outcome-badge__separator">/</span>
          <span class="outcome-badge__multiplier">${item.multiplier}x</span>
        </div>
      </div>
    </a>
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
  // Use new trending-markets.json structure
  let outcomes = []

  // Check if this is new format (from trending-markets.json)
  if (market.outcomes && Array.isArray(market.outcomes)) {
    // New format - use top 3-4 outcomes
    outcomes = market.outcomes.slice(0, 4).map(outcome => {
      const yesProb = outcome.probability
      const noProb = 1 - yesProb
      return {
        question: outcome.name,
        yesPercent: Math.round(yesProb * 100),
        yesMultiplier: yesProb > 0 ? formatMultiplier(1 / yesProb) : '~',
        noMultiplier: noProb > 0 ? formatMultiplier(1 / noProb) : '~',
        sortValue: yesProb
      }
    })

    return `
      <div class="trending-card trending-card--with-outcomes">
        <div class="trending-card__header">
          <img src="${market.icon || market.image}" alt="" class="trending-card__icon" />
          <a href="${market.url}" target="_blank" rel="noopener" class="trending-card__title">
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
                  <span class="outcome-row__multiplier outcome-row__multiplier--no">${outcome.noMultiplier}x</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="trending-card__footer">
          <div class="trending-card__info">
            <span class="trending-card__volume">
              <img src="./images/volume.svg" alt="" class="trending-card__icon-small" />
              $${formatVolume(market.metrics.total_volume)} Vol
            </span>
            <span class="trending-card__date">
              <img src="./images/time.svg" alt="" class="trending-card__icon-small" />
              ${formatDate(market.end_date)}
            </span>
          </div>
          <a href="${market.url}" target="_blank" rel="noopener" class="trending-card__trade">
            Trade ↗
          </a>
        </div>
      </div>
    `
  }

  // Old format fallback (from polymarket_snapshot.json)
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

// Table sorting state
let tableSortColumn = 'volume'
let tableSortDirection = 'desc'

function sortTableData(markets, column) {
  const sorted = [...markets]

  sorted.sort((a, b) => {
    let aVal, bVal

    switch(column) {
      case 'event':
        aVal = a.title.toLowerCase()
        bVal = b.title.toLowerCase()
        return tableSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)

      case 'outcome':
        const aOutcome = getBestOutcome(a)
        const bOutcome = getBestOutcome(b)
        aVal = aOutcome.name.toLowerCase()
        bVal = bOutcome.name.toLowerCase()
        return tableSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)

      case 'probability':
        const aProbOutcome = getBestOutcome(a)
        const bProbOutcome = getBestOutcome(b)
        aVal = aProbOutcome.probability
        bVal = bProbOutcome.probability
        break

      case 'volume':
        // Support both old and new formats
        aVal = a.metrics?.total_volume || a.volume24hr || 0
        bVal = b.metrics?.total_volume || b.volume24hr || 0
        break

      case 'endDate':
        // Support both old and new formats
        aVal = new Date(a.end_date || a.endDate || 0).getTime()
        bVal = new Date(b.end_date || b.endDate || 0).getTime()
        break

      default:
        return 0
    }

    return tableSortDirection === 'asc' ? aVal - bVal : bVal - aVal
  })

  return sorted
}

function handleSort(column) {
  if (tableSortColumn === column) {
    tableSortDirection = tableSortDirection === 'asc' ? 'desc' : 'asc'
  } else {
    tableSortColumn = column
    tableSortDirection = 'desc'
  }

  setViewMode('table') // Trigger re-render
}

function attachSortHandlers() {
  document.querySelectorAll('.table-header-sortable').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column
      handleSort(column)
    })
  })
}

function renderTrendingTable(markets) {
  const sortedMarkets = sortTableData(markets, tableSortColumn)

  const getSortIcon = (column) => {
    if (tableSortColumn !== column) return '↕'
    return tableSortDirection === 'asc' ? '↑' : '↓'
  }

  return `
    <table class="trending-table">
      <thead>
        <tr>
          <th>Event</th>
          <th>Best Outcome</th>
          <th class="table-header-sortable" data-column="probability">
            Probability ${getSortIcon('probability')}
          </th>
          <th class="table-header-sortable" data-column="volume">
            Volume ${getSortIcon('volume')}
          </th>
          <th class="table-header-sortable" data-column="endDate">
            End Date ${getSortIcon('endDate')}
          </th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${sortedMarkets.map(market => {
          const bestOutcome = getBestOutcome(market)
          const probability = Math.round(bestOutcome.probability * 100)

          return `
            <tr>
              <td class="table-cell-event">
                <img src="${market.icon || market.image}" alt="" class="table-icon" />
                <span>${market.title}</span>
              </td>
              <td class="table-cell-outcome">${bestOutcome.name}</td>
              <td class="table-cell-probability">
                <div class="table-probability-container">
                  <div class="table-progress-bar">
                    <div class="table-progress-fill" style="width: ${probability}%"></div>
                    <span class="table-progress-text">${probability}%</span>
                  </div>
                  <div class="table-multipliers">
                    <span class="table-multiplier table-multiplier--yes">${bestOutcome.yesMultiplier}x</span>
                    <span class="table-multiplier table-multiplier--no">${bestOutcome.noMultiplier}x</span>
                  </div>
                </div>
              </td>
              <td class="table-cell-volume">$${formatVolume(market.metrics?.total_volume || market.volume24hr)}</td>
              <td class="table-cell-date">${formatDate(market.end_date || market.endDate)}</td>
              <td class="table-cell-action">
                <a href="${market.url || `https://polymarket.com/event/${market.slug}`}"
                   target="_blank"
                   rel="noopener"
                   class="table-trade-btn">
                  Trade ↗
                </a>
              </td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
  `
}

function renderTrendingContent(markets) {
  window.currentTrendingMarkets = markets

  if (viewMode === 'table') {
    return renderTrendingTable(markets)
  } else {
    return `
      <div class="trending-grid">
        ${markets.length > 0
          ? markets.map(market => renderTrendingEvent(market)).join('')
          : '<div class="empty-state">No trending events available</div>'
        }
      </div>
    `
  }
}

function renderDashboard(data, trendingMarkets = [], selectedMarkets = null) {
  const { widgets, metadata } = data

  let html = ''

  // Add Selected Markets Widget if available
  if (selectedMarkets && selectedMarkets.markets && selectedMarkets.markets.length > 0) {
    html += `
    <!-- Selected Markets Widget -->
    <div class="selected-markets widget widget--full">
      <div class="selected-markets__header">
        <h3 class="risk-category__title">
          Main Events
          <span class="risk-category__subtitle">Top markets</span>
        </h3>
      </div>
      <div class="selected-markets__container">
        ${renderSelectedMarketsContent(selectedMarkets.markets)}
      </div>
    </div>
    `
  }

  html += `
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
        <div class="widget__header-left">
          <h2 class="widget__title">Top Trending Events</h2>
          <p class="widget__subtitle">Highest 24h volume</p>
        </div>
        <div class="widget__header-right">
          <div class="view-toggle">
            <button class="view-toggle__btn ${viewMode === 'grid' ? 'view-toggle__btn--active' : ''}"
                    onclick="setViewMode('grid')">
              Grid View
            </button>
            <button class="view-toggle__btn ${viewMode === 'table' ? 'view-toggle__btn--active' : ''}"
                    onclick="setViewMode('table')">
              Table View
            </button>
          </div>
        </div>
      </div>

      <div class="trending-container">
        ${renderTrendingContent(trendingMarkets)}
      </div>
    </div>

  `

  document.getElementById('main').innerHTML = html

  // Store trending markets for view mode switching
  window.currentTrendingMarkets = trendingMarkets

  // Attach event listeners for table sorting
  if (viewMode === 'table') {
    attachSortHandlers()
  }
}

// Render Selected Markets Content
function renderSelectedMarketsContent(markets) {
  if (!markets || markets.length === 0) return ''

  return markets.map(market => {
    // Get leading outcome
    const leadingOutcome = market.outcomes.reduce((max, outcome) =>
      outcome.probability > max.probability ? outcome : max
    , market.outcomes[0])

    const probability = Math.round(leadingOutcome.probability * 100)
    const imageUrl = market.icon || market.image || ''

    return `
      <a href="${market.url}" target="_blank" class="selected-market">
        <div class="selected-market__header">
          <img src="${imageUrl}" alt="" class="selected-market__icon" />
          <h3 class="selected-market__title">${market.title}</h3>
        </div>
        <div class="selected-market__outcome">
          <div class="selected-market__outcome-name">${leadingOutcome.name}</div>
          <div class="selected-market__stats">
            <div class="selected-market__prob-bar">
              <div class="selected-market__prob-fill" style="width: ${probability}%"></div>
              <span class="selected-market__prob-text">${probability}%</span>
            </div>
          </div>
        </div>
        <div class="selected-market__footer">
          <span class="selected-market__volume">
            <img src="./images/volume.svg" alt="" class="selected-market__icon-small" />
            $${formatVolume(market.metrics.total_volume)} Vol
          </span>
          <span class="selected-market__date">
            <img src="./images/time.svg" alt="" class="selected-market__icon-small" />
            ${formatDate(market.end_date)}
          </span>
        </div>
      </a>
    `
  }).join('')
}

// Load data
async function loadDashboard() {
  try {
    const [dashboardResponse, selectedMarketsResponse, trendingMarketsResponse] = await Promise.all([
      fetch('./data/dashboard_data.json'),
      fetch('./data/selected-markets.json'),
      fetch('./data/trending-markets.json')
    ])

    if (!dashboardResponse.ok) throw new Error('Failed to load dashboard data')
    if (!selectedMarketsResponse.ok) throw new Error('Failed to load selected markets data')
    if (!trendingMarketsResponse.ok) throw new Error('Failed to load trending markets data')

    const dashboardData = await dashboardResponse.json()
    const selectedMarketsData = await selectedMarketsResponse.json()
    const trendingMarketsData = await trendingMarketsResponse.json()

    // Sort all 30 trending markets by volume (highest to lowest)
    const trendingMarkets = trendingMarketsData.markets
      .sort((a, b) => b.metrics.total_volume - a.metrics.total_volume)

    // Hide loading
    document.getElementById('loading').style.display = 'none'

    // Show content
    document.getElementById('main').style.display = 'block'

    // Render
    renderDashboard(dashboardData, trendingMarkets, selectedMarketsData)

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
