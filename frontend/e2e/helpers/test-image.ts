import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

/**
 * テスト用画像ヘルパー
 * 事前に生成されたフィクスチャ画像を使用
 */

// ES Module環境での__dirname相当を取得
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// フィクスチャディレクトリ
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')

/**
 * テスト用画像のパスを取得
 */
export function getTestImagePath(
  type: 'small' | 'large' | 'invalid' = 'small'
): string {
  switch (type) {
    case 'small':
      return path.join(FIXTURES_DIR, 'test-image-small.png')
    case 'large':
      return path.join(FIXTURES_DIR, 'test-image-large.png')
    case 'invalid':
      return path.join(FIXTURES_DIR, 'test-image-invalid.gif')
    default:
      return path.join(FIXTURES_DIR, 'test-image-small.png')
  }
}

/**
 * フィクスチャが存在することを確認
 */
export function ensureFixtures(): void {
  const smallPath = getTestImagePath('small')
  const largePath = getTestImagePath('large')
  const invalidPath = getTestImagePath('invalid')

  if (!fs.existsSync(smallPath)) {
    console.warn(`Warning: ${smallPath} does not exist. Run the fixture generation script first.`)
  }
  if (!fs.existsSync(largePath)) {
    console.warn(`Warning: ${largePath} does not exist. Run the fixture generation script first.`)
  }
  if (!fs.existsSync(invalidPath)) {
    console.warn(`Warning: ${invalidPath} does not exist. Run the fixture generation script first.`)
  }
}

/**
 * テスト用画像を保存（ユーティリティ関数）
 */
export function saveTestImage(
  filePath: string,
  width: number = 100,
  height: number = 100,
  color: [number, number, number] = [0, 128, 255]
): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // 最小限のPNG画像を作成（1x1ピクセル）
  const MINIMAL_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0x00, 0x00, 0xff, 0x00,
    0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82
  ])

  fs.writeFileSync(filePath, MINIMAL_PNG)
}
