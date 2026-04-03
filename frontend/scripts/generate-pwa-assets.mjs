/**
 * Issue#70: PWAアセット（アイコン・スプラッシュ画像）生成スクリプト
 *
 * Playwrightのブラウザを使い、HTMLをレンダリングしてPNGにキャプチャする。
 * 使用方法: npx playwright test --config=scripts/generate-pwa-assets.mjs (ではなく直接実行)
 *   node scripts/generate-pwa-assets.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'icons')
const SPLASH_DIR = join(ROOT, 'public', 'splash')

mkdirSync(ICONS_DIR, { recursive: true })
mkdirSync(SPLASH_DIR, { recursive: true })

// SplashScreen.tsx と同じ SVG（白いピン+カメラ、黒背景用）
const ICON_SVG = `
<svg viewBox="56 60 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M256 80C180 80 120 140 120 216c0 96 136 228 136 228s136-132 136-228C392 140 332 80 256 80z" fill="white"/>
  <rect x="182" y="190" width="148" height="86" rx="12" fill="black"/>
  <rect x="224" y="170" width="56" height="28" rx="6" fill="black"/>
  <circle cx="256" cy="230" r="30" fill="white"/>
  <circle cx="256" cy="230" r="18" fill="black"/>
  <circle cx="316" cy="208" r="6" fill="white" opacity="0.6"/>
</svg>`

// マスカブル用 SVG（周囲にパディングを追加、安全領域80%に収める）
const MASKABLE_SVG = `
<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="black"/>
  <g transform="translate(105, 80) scale(0.6)">
    <path d="M256 80C180 80 120 140 120 216c0 96 136 228 136 228s136-132 136-228C392 140 332 80 256 80z" fill="white"/>
    <rect x="182" y="190" width="148" height="86" rx="12" fill="black"/>
    <rect x="224" y="170" width="56" height="28" rx="6" fill="black"/>
    <circle cx="256" cy="230" r="30" fill="white"/>
    <circle cx="256" cy="230" r="18" fill="black"/>
    <circle cx="316" cy="208" r="6" fill="white" opacity="0.6"/>
  </g>
</svg>`

function iconHtml(svg, size) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;width:${size}px;height:${size}px;background:#000;display:flex;align-items:center;justify-content:center;">
<div style="width:${Math.round(size * 0.7)}px;height:${Math.round(size * 0.7)}px;">${svg}</div>
</body></html>`
}

function maskableHtml(size) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;width:${size}px;height:${size}px;background:#000;display:flex;align-items:center;justify-content:center;">
<div style="width:${size}px;height:${size}px;">${MASKABLE_SVG}</div>
</body></html>`
}

function splashHtml(width, height) {
  const iconSize = Math.min(width, height) * 0.21
  const fontSize = Math.min(width, height) * 0.08
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;width:${width}px;height:${height}px;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
<div style="width:${iconSize}px;height:${iconSize}px;margin-bottom:${fontSize * 0.6}px;">${ICON_SVG}</div>
<div style="color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${fontSize}px;letter-spacing:-0.02em;">Photlas</div>
</body></html>`
}

// アイコンサイズ定義
const ICON_SIZES = [
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

// スプラッシュ画面定義 (CSS pixels * DPR = actual pixels)
const SPLASH_SCREENS = [
  // iPhone
  { name: 'iphone-se.png', w: 375, h: 667, dpr: 2 },
  { name: 'iphone-8plus.png', w: 414, h: 736, dpr: 3 },
  { name: 'iphone-x.png', w: 375, h: 812, dpr: 3 },
  { name: 'iphone-xr.png', w: 414, h: 896, dpr: 2 },
  { name: 'iphone-xsmax.png', w: 414, h: 896, dpr: 3 },
  { name: 'iphone-12mini.png', w: 360, h: 780, dpr: 3 },
  { name: 'iphone-12.png', w: 390, h: 844, dpr: 3 },
  { name: 'iphone-12promax.png', w: 428, h: 926, dpr: 3 },
  { name: 'iphone-14pro.png', w: 393, h: 852, dpr: 3 },
  { name: 'iphone-14promax.png', w: 430, h: 932, dpr: 3 },
  { name: 'iphone-15.png', w: 393, h: 852, dpr: 3 },
  { name: 'iphone-15plusmax.png', w: 430, h: 932, dpr: 3 },
  { name: 'iphone-16pro.png', w: 402, h: 874, dpr: 3 },
  { name: 'iphone-16promax.png', w: 440, h: 956, dpr: 3 },
  // iPad Portrait
  { name: 'ipad-mini-portrait.png', w: 744, h: 1133, dpr: 2 },
  { name: 'ipad-10-portrait.png', w: 820, h: 1180, dpr: 2 },
  { name: 'ipad-pro11-portrait.png', w: 834, h: 1194, dpr: 2 },
  { name: 'ipad-pro129-portrait.png', w: 1024, h: 1366, dpr: 2 },
  { name: 'ipad-pro13-portrait.png', w: 1032, h: 1376, dpr: 2 },
  // iPad Landscape
  { name: 'ipad-mini-landscape.png', w: 1133, h: 744, dpr: 2 },
  { name: 'ipad-10-landscape.png', w: 1180, h: 820, dpr: 2 },
  { name: 'ipad-pro11-landscape.png', w: 1194, h: 834, dpr: 2 },
  { name: 'ipad-pro129-landscape.png', w: 1366, h: 1024, dpr: 2 },
  { name: 'ipad-pro13-landscape.png', w: 1376, h: 1032, dpr: 2 },
]

async function main() {
  const browser = await chromium.launch()

  // アイコン生成
  for (const icon of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } })
    const html = icon.maskable ? maskableHtml(icon.size) : iconHtml(ICON_SVG, icon.size)
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: join(ICONS_DIR, icon.name), type: 'png' })
    await page.close()
    console.log(`✓ ${icon.name} (${icon.size}x${icon.size})`)
  }

  // スプラッシュ画像生成
  for (const splash of SPLASH_SCREENS) {
    const actualW = splash.w * splash.dpr
    const actualH = splash.h * splash.dpr
    const page = await browser.newPage({
      viewport: { width: actualW, height: actualH },
      deviceScaleFactor: 1,
    })
    await page.setContent(splashHtml(actualW, actualH), { waitUntil: 'load' })
    await page.screenshot({ path: join(SPLASH_DIR, splash.name), type: 'png' })
    await page.close()
    console.log(`✓ ${splash.name} (${actualW}x${actualH})`)
  }

  await browser.close()
  console.log('\nDone! All PWA assets generated.')
}

main().catch(console.error)
