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
'use strict'
;(function () {
  const RESULTS = ['ok', 'invalid', 'rate_limited', 'error']

  for (const box of document.querySelectorAll('[data-signup]')) {
    const form = box.querySelector('form')
    const email = form && form.querySelector('input[name="email"]')
    const button = form && form.querySelector('button[type="submit"]')
    const status = box.querySelector('[data-signup-status]')
    if (!form || !email || !button || !status) continue

    let sending = false

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
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new URLSearchParams(new FormData(form)),
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
        })
        const answer = await response.json()
        if (answer && RESULTS.includes(answer.result)) result = answer.result
      } catch {
        result = 'error'
      } finally {
        sending = false
        button.removeAttribute('aria-disabled')
      }
      show(result)
    })
  }
})()
