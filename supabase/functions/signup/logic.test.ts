import { describe, expect, it, vi } from 'vitest'
import {
  MAX_BODY_BYTES,
  NOTICE_VERSION,
  handleSignup,
  isFormContentType,
  isValidEmail,
  messageId,
  normaliseEmail,
  outcomeFor,
  parseForm,
  parseSiteUrl,
  readBodyLimited,
  wantsJson,
  type SignupEnv,
  type SignupOutcome,
  type SignupResult,
  type SignupRpc,
} from './logic'

// Invented addresses on reserved domains only (example.com, example.org).
const SITE = 'https://shelfie.example'
const FORM = 'application/x-www-form-urlencoded'
const JSON_ACCEPT = 'application/json'
const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

interface PostOptions {
  contentType?: string | null
  method?: string
  accept?: string | null
}

/** A request like the browser's plain form post (or whatever the options say). */
function post(
  body: string,
  { contentType = FORM, method = 'POST', accept = HTML_ACCEPT }: PostOptions = {},
): Request {
  const headers = new Headers()
  if (contentType !== null) headers.set('content-type', contentType)
  if (accept !== null) headers.set('accept', accept)
  return new Request('https://functions.example/signup', {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? null : body,
  })
}

/** A request from the landing page's script. */
const fetchPost = (body: string): Request => post(body, { accept: JSON_ACCEPT })

function rpcReturning(result: SignupResult) {
  return vi.fn<SignupRpc>(async () => result)
}

function env(rpc: SignupRpc | null = rpcReturning('ok')): SignupEnv {
  return { siteUrl: SITE, rpc }
}

/** No default for siteUrl, so an explicit undefined stays undefined. */
function envWithSite(siteUrl: string | undefined, rpc: SignupRpc | null): SignupEnv {
  return { siteUrl, rpc }
}

function expectBaseHeaders(response: Response): void {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
}

/** The 303 a plain form post gets: back to the message on the landing page. */
function expectBackTo(response: Response, id: string): void {
  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe(`${SITE}/#${id}`)
  expectBaseHeaders(response)
}

async function expectJson(
  response: Response,
  status: number,
  result: SignupOutcome,
): Promise<void> {
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toBe('application/json')
  expect(response.headers.get('access-control-allow-origin')).toBe(SITE)
  expect(response.headers.get('location')).toBeNull()
  expect(await response.json()).toEqual({ result })
  expectBaseHeaders(response)
}

describe('NOTICE_VERSION', () => {
  it('is v1 and is sent with every sign-up', async () => {
    expect(NOTICE_VERSION).toBe('v1')
    const rpc = rpcReturning('ok')
    await handleSignup(post('email=ana%40example.com&website=&form=hero'), env(rpc))
    expect(rpc).toHaveBeenCalledWith('ana@example.com', 'v1')
  })
})

describe('email', () => {
  it.each([
    'ana@example.com',
    'ana.b+shelf@example.co.uk',
    "o'neil@example.org",
    'a@b.example',
    'x_y-z@sub.example.com',
    'ana@xn--bcher-kva.example',
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    '',
    'ana',
    'ana@',
    '@example.com',
    'ana@example',
    'ana@@example.com',
    'ana@ex@ample.com',
    'ana example@example.com',
    'ana@exa mple.com',
    '.ana@example.com',
    'ana.@example.com',
    'an..a@example.com',
    'ana@-example.com',
    'ana@example-.com',
    'ana@example..com',
    'ana@example.c',
    'ana@example.123',
    'ana@ex_ample.com',
    'anä@example.com',
    'ana@exämple.com',
    '"ana"@example.com',
    `${'a'.repeat(65)}@example.com`,
    `ana@${'a'.repeat(64)}.com`,
    `ana@${'abcdefghi.'.repeat(25)}com`,
  ])('rejects %j', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('trims outer spaces and lower-cases, so casing and spaces give one address', () => {
    expect(normaliseEmail('  Ana.B@Example.COM \t')).toBe('ana.b@example.com')
    expect(isValidEmail(normaliseEmail('  Ana.B@Example.COM \t'))).toBe(true)
  })

  it('stores the normalised address', async () => {
    const rpc = rpcReturning('ok')
    await handleSignup(post('email=%20%20Ana%40Example.COM%20&website='), env(rpc))
    expect(rpc).toHaveBeenCalledWith('ana@example.com', NOTICE_VERSION)
  })

  it('answers an invalid address as invalid, without calling the database', async () => {
    const rpc = rpcReturning('ok')
    expectBackTo(
      await handleSignup(post('email=not-an-address&form=hero'), env(rpc)),
      'signup-hero-invalid',
    )
    await expectJson(await handleSignup(fetchPost('email=nope'), env(rpc)), 400, 'invalid')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('treats a missing email field as invalid', async () => {
    expectBackTo(await handleSignup(post('website=&form=end'), env()), 'signup-end-invalid')
  })
})

describe('form parsing', () => {
  it('reads email, website and form, decoding + and %xx', () => {
    expect(parseForm('email=ana%2Bshelf%40example.com&website=&form=end&other=x')).toEqual({
      email: 'ana+shelf@example.com',
      website: '',
      form: 'end',
    })
    expect(parseForm('email=a+b%40example.com').email).toBe('a b@example.com')
  })

  it('takes the first value when a field repeats', () => {
    expect(parseForm('email=a%40example.com&email=b%40example.com').email).toBe('a@example.com')
  })

  it.each([
    ['form=hero', 'hero'],
    ['form=end', 'end'],
    ['', 'hero'],
    ['form=', 'hero'],
    ['form=HERO', 'hero'],
    ['form=footer', 'hero'],
    ['form=end%22%3E%3Cscript%3E', 'hero'],
  ])('reads %j as the %s form; nothing else ever reaches the redirect', (body, form) => {
    expect(parseForm(body).form).toBe(form)
  })
})

describe('message ids', () => {
  it('names each message after its form and outcome', () => {
    expect(messageId('hero', 'ok')).toBe('signup-hero-ok')
    expect(messageId('end', 'invalid')).toBe('signup-end-invalid')
    expect(messageId('hero', 'rate_limited')).toBe('signup-hero-rate-limited')
    expect(messageId('end', 'error')).toBe('signup-end-error')
  })
})

describe('honeypot', () => {
  it('pretends to succeed when website is filled in, and stores nothing', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(
      post('email=bot%40example.com&website=https%3A%2F%2Fspam.example&form=end'),
      env(rpc),
    )
    expectBackTo(response, 'signup-end-ok')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('pretends to succeed to the script too', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(fetchPost('email=bot%40example.com&website=x'), env(rpc))
    await expectJson(response, 200, 'ok')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('counts even a single space as filled in', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post('email=bot%40example.com&website=%20'), env(rpc))
    expectBackTo(response, 'signup-hero-ok')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('also hides an invalid address behind the success answer', async () => {
    expectBackTo(await handleSignup(post('email=nonsense&website=x'), env()), 'signup-hero-ok')
  })
})

describe('repeated email', () => {
  it('gets the same response as the first sign-up, so nobody can tell who signed up', async () => {
    // A stand-in for public.signup_add: it stores each address once and answers 'ok' both times.
    const stored = new Set<string>()
    const rpc: SignupRpc = async (email) => {
      stored.add(email)
      return 'ok'
    }
    for (const send of [post, fetchPost]) {
      const first = await handleSignup(send('email=ana%40example.com&website='), env(rpc))
      const again = await handleSignup(send('email=ANA%40example.com&website='), env(rpc))
      expect(again.status).toBe(first.status)
      expect([...again.headers]).toEqual([...first.headers])
      expect(await again.text()).toBe(await first.text())
    }
    expect(stored).toEqual(new Set(['ana@example.com']))
  })
})

describe('request checks', () => {
  it.each(['GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('answers %s with 405', async (method) => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post('email=ana%40example.com', { method }), env(rpc))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(await response.text()).toBe('')
    expectBaseHeaders(response)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['application/json', '{"email":"ana@example.com"}'],
    ['multipart/form-data; boundary=x', 'email=ana%40example.com'],
    ['text/plain', 'email=ana%40example.com'],
    [null, 'email=ana%40example.com'],
  ])('answers content type %s with 400', async (contentType, body) => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post(body, { contentType }), env(rpc))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('')
    expectBaseHeaders(response)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts the form content type with a charset and in any case', () => {
    expect(isFormContentType('application/x-www-form-urlencoded; charset=UTF-8')).toBe(true)
    expect(isFormContentType('Application/X-WWW-Form-Urlencoded')).toBe(true)
    expect(isFormContentType('application/x-www-form-urlencoded-x')).toBe(false)
  })

  it('accepts a body just under 2 KB', async () => {
    const prefix = 'email=ana%40example.com&website=&pad='
    const body = prefix + 'x'.repeat(MAX_BODY_BYTES - 1 - prefix.length)
    expect(new TextEncoder().encode(body).byteLength).toBe(MAX_BODY_BYTES - 1)
    expect((await handleSignup(post(body), env())).status).toBe(303)
  })

  it('answers a body of 2 KB or more with 400, without calling the database', async () => {
    const rpc = rpcReturning('ok')
    const body = `email=ana%40example.com&website=&pad=${'x'.repeat(MAX_BODY_BYTES)}`
    const response = await handleSignup(post(body), env(rpc))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('answers a declared Content-Length of 2 KB or more with 400 before reading', async () => {
    const request = new Request('https://functions.example/signup', {
      method: 'POST',
      headers: { 'content-type': FORM, 'content-length': String(MAX_BODY_BYTES) },
      body: 'email=ana%40example.com',
    })
    expect((await handleSignup(request, env())).status).toBe(400)
  })

  it('stops reading a streamed body as soon as it reaches 2 KB', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new Uint8Array(1024))
      },
    })
    expect(await readBodyLimited(stream)).toBeNull()
    expect(pulled).toBeLessThanOrEqual(3)
  })

  it('rejects a body that is not valid UTF-8', async () => {
    const stream = new Blob([new Uint8Array([0x65, 0x3d, 0xff, 0xfe])]).stream()
    expect(await readBodyLimited(stream)).toBeNull()
  })

  it('reads a missing body as empty', async () => {
    expect(await readBodyLimited(null)).toBe('')
  })

  it('lets only the landing page read the answers (CORS), also on refusals', async () => {
    for (const response of [
      await handleSignup(fetchPost('email=ana%40example.com'), env()),
      await handleSignup(post('x', { method: 'PUT' }), env()),
      await handleSignup(post('x', { contentType: 'text/plain' }), env()),
    ]) {
      expect(response.headers.get('access-control-allow-origin')).toBe(SITE)
      expect(response.headers.get('vary')).toBe('Origin, Accept')
      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    }
  })
})

describe('JSON or redirect', () => {
  it.each([
    ['application/json', true],
    ['application/json, text/plain, */*', true],
    ['text/html, application/json;q=0.9', true],
    [HTML_ACCEPT, false],
    ['*/*', false],
    ['', false],
    [null, false],
  ])('Accept %j asks for JSON: %s', (accept, json) => {
    expect(wantsJson(accept)).toBe(json)
  })
})

describe('SITE_URL', () => {
  it.each([
    'https://shelfie.example',
    'https://www.shelfie.example',
    'https://shelfie.example:8443',
  ])('accepts the exact https origin %s', (value) => {
    expect(parseSiteUrl(value)).toBe(value)
  })

  it.each([
    undefined,
    '',
    'shelfie.example',
    'http://shelfie.example',
    'ftp://shelfie.example',
    'https://shelfie.example/',
    'https://shelfie.example/app',
    'https://shelfie.example?x=1',
    'https://shelfie.example#top',
    'https://user:pass@shelfie.example',
    'https://Shelfie.Example',
    'https://shelfie.example:443',
    ' https://shelfie.example',
    'https://',
  ])('rejects %j', (value) => {
    expect(parseSiteUrl(value)).toBeNull()
  })

  it.each([undefined, 'http://shelfie.example', 'https://shelfie.example/'])(
    'answers 500 and does nothing when SITE_URL is %j',
    async (siteUrl) => {
      const rpc = rpcReturning('ok')
      for (const send of [post, fetchPost]) {
        const response = await handleSignup(
          send('email=ana%40example.com&website='),
          envWithSite(siteUrl, rpc),
        )
        expect(response.status).toBe(500)
        expect(response.headers.get('location')).toBeNull()
        expect(response.headers.get('access-control-allow-origin')).toBeNull()
        expect(await response.text()).toBe('')
        expectBaseHeaders(response)
      }
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('answers 500 before checking the method', async () => {
    const response = await handleSignup(
      post('', { method: 'GET' }),
      envWithSite(undefined, rpcReturning('ok')),
    )
    expect(response.status).toBe(500)
  })
})

describe('database results', () => {
  it.each([
    ['ok', 'hero', 'signup-hero-ok'],
    ['ok', 'end', 'signup-end-ok'],
    ['invalid', 'hero', 'signup-hero-invalid'],
    ['rate_limited', 'end', 'signup-end-rate-limited'],
  ] as const)("'%s' from the %s form sends a plain post back to #%s", async (result, form, id) => {
    const response = await handleSignup(
      post(`email=ana%40example.com&website=&form=${form}`),
      env(rpcReturning(result)),
    )
    expectBackTo(response, id)
    expect(await response.text()).toBe('')
  })

  it.each([
    ['ok', 200],
    ['invalid', 400],
    ['rate_limited', 429],
  ] as const)("'%s' is JSON %d for the script", async (result, status) => {
    const response = await handleSignup(
      fetchPost('email=ana%40example.com&form=end'),
      env(rpcReturning(result)),
    )
    await expectJson(response, status, result)
  })

  it('maps anything unexpected to error', () => {
    expect(outcomeFor('ok')).toBe('ok')
    for (const result of [null, undefined, '', 'OK', 'error', 42, { ok: true }]) {
      expect(outcomeFor(result), String(result)).toBe('error')
    }
  })

  it('an unexpected result is the error message', async () => {
    const rpc = vi.fn<SignupRpc>(async () => 'surprise' as SignupResult)
    expectBackTo(await handleSignup(post('email=ana%40example.com'), env(rpc)), 'signup-hero-error')
    await expectJson(
      await handleSignup(fetchPost('email=ana%40example.com'), env(rpc)),
      500,
      'error',
    )
  })

  it('a failed database call is the error message, with no detail', async () => {
    const rpc = vi.fn<SignupRpc>(async () => {
      throw new Error('connection refused')
    })
    const plain = await handleSignup(post('email=ana%40example.com&form=end'), env(rpc))
    expectBackTo(plain, 'signup-end-error')
    expect(await plain.text()).toBe('')
    await expectJson(
      await handleSignup(fetchPost('email=ana%40example.com'), env(rpc)),
      500,
      'error',
    )
  })

  it('missing Supabase settings are the error message, after the request checks', async () => {
    expectBackTo(
      await handleSignup(post('email=ana%40example.com'), env(null)),
      'signup-hero-error',
    )
    expect((await handleSignup(post('x', { method: 'GET' }), env(null))).status).toBe(405)
  })
})

describe('privacy', () => {
  it('never logs the address or the body', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    )
    const failing = vi.fn<SignupRpc>(async () => {
      throw new Error('boom ana@example.com')
    })
    await handleSignup(post('email=ana%40example.com&website='), env())
    await handleSignup(post('email=ana%40example.com&website='), env(failing))
    await handleSignup(fetchPost('email=ana%40example.com&website='), env(failing))
    await handleSignup(post('email=ana%40example.com&website=x'), env())
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })

  it('never puts the address in a redirect or a JSON answer', async () => {
    const plain = await handleSignup(post('email=ana%40example.com'), env())
    const json = await handleSignup(fetchPost('email=ana%40example.com'), env())
    expect(plain.headers.get('location')).not.toContain('ana')
    expect(await json.text()).not.toContain('ana')
  })
})
