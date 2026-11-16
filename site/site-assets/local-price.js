// Shows "about <price> a month" under the Plus price for visitors outside the UK, in their own
// currency. Ported from the landing page canvas. It runs only on this device: the region comes
// from the browser's language setting, and nothing is sent anywhere (the site's CSP allows no
// outside connections). Without JavaScript the line stays hidden and the page still works.
//
// The rates are fixed approximations from the canvas, not live rates: update them by hand, or
// replace this with app-store price tiers once those exist.
'use strict'
;(function () {
  const PLUS_GBP = 2.99
  const RATES = { USD: 1.35, EUR: 1.16, CAD: 1.87, AUD: 1.89, NZD: 2.28 }
  const EURO_REGIONS = [
    'IE',
    'DE',
    'FR',
    'ES',
    'IT',
    'NL',
    'BE',
    'AT',
    'PT',
    'FI',
    'LU',
    'GR',
    'SK',
    'SI',
    'EE',
    'LV',
    'LT',
    'MT',
    'CY',
    'HR',
  ]
  const OTHER_CURRENCIES = { US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD' }

  function visitorRegion() {
    try {
      const tag = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-GB'
      return new Intl.Locale(tag).maximize().region || 'GB'
    } catch {
      return 'GB'
    }
  }

  /** The Plus price in the region's currency, or '' for the UK and unsupported regions. */
  function localPrice(region) {
    const currency =
      region === 'GB' ? 'GBP' : EURO_REGIONS.includes(region) ? 'EUR' : OTHER_CURRENCIES[region]
    if (!currency || currency === 'GBP' || !RATES[currency]) return ''
    const locale = currency === 'USD' || currency === 'EUR' ? `en-${region}` : 'en-GB'
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
        PLUS_GBP * RATES[currency],
      )
    } catch {
      return ''
    }
  }

  const line = document.getElementById('local-price')
  const price = localPrice(visitorRegion())
  if (line && price) {
    line.textContent = `about ${price} a month`
    line.hidden = false
  }
})()
