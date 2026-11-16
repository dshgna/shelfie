import { describe, expect, it, vi } from 'vitest'
import {
  MAX_BODY_BYTES,
  NOTICE_VERSION,
  handleSignup,
  isFormContentType,
  isValidEmail,
  normaliseEmail,
  parseForm,
  parseSiteUrl,
  readBodyLimited,
  responseForResult,
  type SignupEnv,
  type SignupResult,
  type SignupRpc,
} from './logic'

// Invented addresses on reserved domains only (example.com, example.org).
const SITE = 'https://shelfie.example'
const FORM = 'application/x-www-form-urlencoded'

function post(body: string, contentType: string | null = FORM, method = 'POST'): Request {
  const headers = new Headers()
  if (contentType !== null) headers.set('content-type', contentType)
  return new Request('https://functions.example/signup', {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? null : body,
  })
}

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

describe('NOTICE_VERSION', () => {
  it('is v1 and is sent with every sign-up', async () => {
    expect(NOTICE_VERSION).toBe('v1')
    const rpc = rpcReturning('ok')
    await handleSignup(post('email=ana%40example.com&website='), env(rpc))
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

  it('sends an invalid address to /signup-error/ without calling the database', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post('email=not-an-address&website='), env(rpc))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/signup-error/`)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('treats a missing email field as invalid', async () => {
    const response = await handleSignup(post('website='), env())
    expect(response.headers.get('location')).toBe(`${SITE}/signup-error/`)
  })
})

describe('form parsing', () => {
  it('reads email and website, decoding + and %xx', () => {
    expect(parseForm('email=ana%2Bshelf%40example.com&website=&other=x')).toEqual({
      email: 'ana+shelf@example.com',
      website: '',
    })
    expect(parseForm('email=a+b%40example.com')).toEqual({ email: 'a b@example.com', website: '' })
  })

  it('takes the first value when a field repeats', () => {
    expect(parseForm('email=a%40example.com&email=b%40example.com').email).toBe('a@example.com')
  })
})

describe('honeypot', () => {
  it('pretends to succeed when website is filled in, and stores nothing', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(
      post('email=bot%40example.com&website=https%3A%2F%2Fspam.example'),
      env(rpc),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/thanks/`)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('counts even a single space as filled in', async () => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post('email=bot%40example.com&website=%20'), env(rpc))
    expect(response.headers.get('location')).toBe(`${SITE}/thanks/`)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('also hides an invalid address behind the success redirect', async () => {
    const response = await handleSignup(post('email=nonsense&website=x'), env())
    expect(response.headers.get('location')).toBe(`${SITE}/thanks/`)
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
    const first = await handleSignup(post('email=ana%40example.com&website='), env(rpc))
    const again = await handleSignup(post('email=ANA%40example.com&website='), env(rpc))
    expect([first.status, again.status]).toEqual([303, 303])
    expect(again.headers.get('location')).toBe(first.headers.get('location'))
    expect([...again.headers]).toEqual([...first.headers])
    expect(stored).toEqual(new Set(['ana@example.com']))
  })
})

describe('request checks', () => {
  it.each(['GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('answers %s with 405', async (method) => {
    const rpc = rpcReturning('ok')
    const response = await handleSignup(post('email=ana%40example.com', FORM, method), env(rpc))
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
    const response = await handleSignup(post(body, contentType), env(rpc))
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
    const response = await handleSignup(post(body), env())
    expect(response.status).toBe(303)
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
      const response = await handleSignup(
        post('email=ana%40example.com&website='),
        envWithSite(siteUrl, rpc),
      )
      expect(response.status).toBe(500)
      expect(response.headers.get('location')).toBeNull()
      expect(await response.text()).toBe('')
      expectBaseHeaders(response)
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('answers 500 before checking the method', async () => {
    const response = await handleSignup(
      post('', FORM, 'GET'),
      envWithSite(undefined, rpcReturning('ok')),
    )
    expect(response.status).toBe(500)
  })
})

describe('database results', () => {
  it("'ok' redirects to /thanks/", async () => {
    const response = await handleSignup(post('email=ana%40example.com'), env(rpcReturning('ok')))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/thanks/`)
    expectBaseHeaders(response)
  })

  it("'invalid' redirects to /signup-error/", async () => {
    const response = await handleSignup(
      post('email=ana%40example.com'),
      env(rpcReturning('invalid')),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/signup-error/`)
    expectBaseHeaders(response)
  })

  it("'rate_limited' is a 429 with an empty body", async () => {
    const response = await handleSignup(
      post('email=ana%40example.com'),
      env(rpcReturning('rate_limited')),
    )
    expect(response.status).toBe(429)
    expect(response.headers.get('location')).toBeNull()
    expect(await response.text()).toBe('')
    expectBaseHeaders(response)
  })

  it('an unexpected result is a 500 with no detail', () => {
    for (const result of [null, undefined, '', 'OK', 'error', 42, { ok: true }]) {
      const response = responseForResult(SITE, result)
      expect(response.status, String(result)).toBe(500)
      expect(response.headers.get('location')).toBeNull()
    }
  })

  it('a failed database call is a 500 with no detail', async () => {
    const rpc = vi.fn<SignupRpc>(async () => {
      throw new Error('connection refused')
    })
    const response = await handleSignup(post('email=ana%40example.com'), env(rpc))
    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
    expectBaseHeaders(response)
  })

  it('missing Supabase settings are a 500, after the request checks', async () => {
    const response = await handleSignup(post('email=ana%40example.com'), env(null))
    expect(response.status).toBe(500)
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
    await handleSignup(post('email=ana%40example.com&website=x'), env())
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })
})
