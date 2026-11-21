// The landing page's sign-up forms, with JavaScript: post to the sign-up edge function with
// fetch, then show the result inline, under the form that was used, without leaving the page.
//
// Without JavaScript the same form posts normally; the function answers with a redirect back to
// this page at #signup-<form>-<result>, and site.css shows that message with :target. The
// wording lives only in index.html (the [data-result] paragraphs); this script copies it into the
// form's live region so screen readers announce it.
//
// Privacy: the address goes only to the sign-up function (the site CSP allows nothing else),
// with no cookies and no referrer, and is never stored on the device or logged.
//
// Umami events (owner, 21 Nov 2026), each carrying only `section` ('hero' or 'end') and, for
// errors, a short `reason`. Never the address or anything else typed:
//  - notify-open: the first time someone focuses a form's email box, once per form per visit;
//  - notify-signup: only after the sign-up function answered 'ok' (never on click);
//  - notify-error: when it didn't, with reason 'invalid', 'rate_limited', 'error' or 'network'.
// A filled-in honeypot sends no event at all. Umami itself skips visitors with Do Not Track
// (data-do-not-track on its script tag), and a blocked or missing Umami never breaks the form.
'use strict'
;(function () {
  const RESULTS = ['ok', 'invalid', 'rate_limited', 'error']
  const SECTIONS = ['hero', 'end']

  const track = (name, data) => {
    try {
      window.umami?.track(name, data)
    } catch {
      // Umami blocked or missing: the form works the same without it.
    }
  }

  for (const box of document.querySelectorAll('[data-signup]')) {
    const form = box.querySelector('form')
    const email = form && form.querySelector('input[name="email"]')
    const button = form && form.querySelector('button[type="submit"]')
    const status = box.querySelector('[data-signup-status]')
    if (!form || !email || !button || !status) continue

    const named = form.querySelector('input[name="form"]')
    const section = named && SECTIONS.includes(named.value) ? named.value : 'hero'
    const honeypot = form.querySelector('input[name="website"]')
    // A bot that fills in the honeypot gets the normal answer, but nothing is counted.
    const isBot = () => honeypot !== null && honeypot.value !== ''

    let sending = false
    let opened = false

    email.addEventListener('focus', () => {
      if (opened || isBot()) return
      opened = true
      track('notify-open', { section })
    })

    function show(result) {
      const message = box.querySelector(`[data-result="${result}"]`)
      status.dataset.result = result
      status.textContent = message ? message.textContent.trim() : ''
      if (result === 'invalid') {
        email.setAttribute('aria-invalid', 'true')
        email.focus()
      } else {
        email.removeAttribute('aria-invalid')
      }
      if (result === 'ok') form.reset()
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (sending) return
      sending = true
      button.setAttribute('aria-disabled', 'true')
      status.textContent = ''
      delete status.dataset.result
      let result = 'error'
      let reason
      const counted = !isBot()
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new URLSearchParams(new FormData(form)),
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
        })
        let answer = null
        try {
          answer = await response.json()
        } catch {
          answer = null
        }
        if (answer && RESULTS.includes(answer.result)) result = answer.result
        reason = result
      } catch {
        // fetch itself failed: offline, blocked, or the function couldn't be reached.
        result = 'error'
        reason = 'network'
      } finally {
        sending = false
        button.removeAttribute('aria-disabled')
      }
      if (counted) {
        if (result === 'ok') track('notify-signup', { section })
        else track('notify-error', { section, reason })
      }
      show(result)
    })
  }
})()
