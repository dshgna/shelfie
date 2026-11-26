// "Safari on iPhone", "Chrome on Mac": the browser and device family only, read from the user
// agent on the device. Never the full user-agent string, a version number or an IP address, and
// nothing is sent anywhere.

const BROWSERS: readonly [RegExp, string][] = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\b(OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
]

const DEVICES: readonly [RegExp, string][] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'Chromebook'],
  [/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
]

const find = (table: readonly [RegExp, string][], userAgent: string) =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1]

export function deviceName(userAgent: string): string {
  const browser = find(BROWSERS, userAgent)
  const device = find(DEVICES, userAgent)
  if (browser && device) return `${browser} on ${device}`
  return browser ?? device ?? 'This browser'
}
