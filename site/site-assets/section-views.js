// How far down the landing page visitors get: one Umami `section-view` event per section per page
// view, carrying only the section's name (owner, 21 Nov 2026). Nothing else: no scroll depth,
// positions, screen size, timings or anything about the visitor.
//
// A section counts as seen when it is in the middle band of the window (rootMargin -40% top and
// bottom, so tall sections count on small phones too) for at least 600 ms without leaving. A
// section scrolled past quickly (for example after a top-nav link) doesn't count. Hidden sections
// (such as the reviews placeholder) are never observed, and a section hidden before its timer ends
// doesn't count either. Each section is unobserved once it has counted; the observer stops when
// every visible section has. A blocked or missing Umami never causes an error.
'use strict'
;(function () {
  const DWELL_MS = 600
  const NAMES = [
    'hero',
    'sound-familiar',
    'how-it-works',
    'every-cupboard',
    'greener-home',
    'privacy',
    'reviews',
    'pricing',
    'faq',
    'closing',
  ]

  const track = (name, data) => {
    try {
      window.umami?.track(name, data)
    } catch {
      // Umami blocked or missing: nothing to count.
    }
  }

  if (!('IntersectionObserver' in window)) return

  const isShown = (el) => el.closest('[hidden]') === null && el.getClientRects().length > 0

  const sections = [...document.querySelectorAll('[data-section]')].filter(
    (el) => NAMES.includes(el.dataset.section) && isShown(el),
  )
  if (sections.length === 0) return

  const timers = new Map()
  let remaining = sections.length

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target
        if (!entry.isIntersecting) {
          clearTimeout(timers.get(el))
          timers.delete(el)
          continue
        }
        if (timers.has(el)) continue
        timers.set(
          el,
          setTimeout(() => {
            timers.delete(el)
            if (!isShown(el)) return
            observer.unobserve(el)
            track('section-view', { section: el.dataset.section })
            remaining -= 1
            if (remaining === 0) observer.disconnect()
          }, DWELL_MS),
        )
      }
    },
    { rootMargin: '-40% 0px -40% 0px' },
  )

  for (const el of sections) observer.observe(el)
})()
