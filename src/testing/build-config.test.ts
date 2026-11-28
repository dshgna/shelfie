// The two builds' settings: the web build stays at /app/ with the PWA (and dist/_headers, which
// build-site.mjs writes, is unchanged); the native build is relative, has no PWA, and is the folder
// Capacitor serves.

import type { Plugin, PluginOption, UserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import capacitorConfig from '../../capacitor.config'
import { APP_BASE } from '../../security-headers'
import viteConfig, { NATIVE_MODE, NATIVE_OUT_DIR } from '../../vite.config'

async function configFor(mode: string): Promise<UserConfig> {
  if (typeof viteConfig !== 'function') throw new Error('vite.config.ts should export a function')
  return viteConfig({ mode, command: 'build' })
}

async function pluginNames(options: PluginOption[] | undefined): Promise<string[]> {
  const names: string[] = []
  const walk = async (option: PluginOption): Promise<void> => {
    const value = await option
    if (!value) return
    if (Array.isArray(value)) {
      for (const inner of value) await walk(inner)
      return
    }
    names.push((value as Plugin).name)
  }
  for (const option of options ?? []) await walk(option)
  return names
}

describe('vite.config.ts', () => {
  it('web build: base /app/, dist/app, with the PWA', async () => {
    const config = await configFor('production')
    expect(config.base).toBe(APP_BASE)
    expect(config.base).toBe('/app/')
    expect(config.build?.outDir).toBe('dist/app')
    const names = await pluginNames(config.plugins)
    expect(names.some((name) => name.startsWith('vite-plugin-pwa'))).toBe(true)
  })

  it('native build: base ./, dist/native, and no PWA at all', async () => {
    const config = await configFor(NATIVE_MODE)
    expect(config.base).toBe('./')
    expect(config.build?.outDir).toBe(NATIVE_OUT_DIR)
    expect(NATIVE_OUT_DIR).toBe('dist/native')
    const names = await pluginNames(config.plugins)
    expect(names.filter((name) => name.includes('pwa'))).toEqual([])
    expect(names.some((name) => name.includes('react'))).toBe(true)
  })
})

describe('capacitor.config.ts', () => {
  it('serves the native build, and only from the app bundle', () => {
    expect(capacitorConfig.webDir).toBe(NATIVE_OUT_DIR)
    // No live-reload server and no cleartext traffic.
    expect(capacitorConfig.server).toBeUndefined()
    expect(JSON.stringify(capacitorConfig)).not.toMatch(/cleartext|"url"/i)
  })
})
