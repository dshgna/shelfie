// Placeholder: delete together with smoke.ts once the first real module is ported.
import { describe, expect, it } from 'vitest'
import { isOut } from './smoke'

describe('isOut', () => {
  it.each([
    { quantity: 0, expected: true },
    { quantity: -1, expected: true },
    { quantity: 1, expected: false },
    { quantity: 2.5, expected: false },
  ])('isOut($quantity) is $expected', ({ quantity, expected }) => {
    expect(isOut(quantity)).toBe(expected)
  })

  it('runs in Node, where browser globals do not exist', () => {
    // eslint-disable-next-line no-restricted-globals -- this test checks that they do NOT exist
    expect(['window', 'document'].filter((name) => name in globalThis)).toEqual([])
  })
})
