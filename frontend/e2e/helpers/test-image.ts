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
 * createImageBitmapで読み込み可能な10x10 PNG画像を生成
 */
export function saveTestImage(
  filePath: string,
  width: number = 10,
  height: number = 10,
  color: [number, number, number] = [0, 128, 255]
): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const zlib = require('zlib')

  // Raw image data: filter byte (0=None) + RGB pixels per row
  const rawData = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 3 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3
      rawData[offset] = color[0]
      rawData[offset + 1] = color[1]
      rawData[offset + 2] = color[2]
    }
  }
  const deflated = zlib.deflateSync(rawData)

  // CRC32 calculation
  const crc32Table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    crc32Table[i] = c
  }
  function crc32(buf: Buffer): number {
    let crc = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) {
      crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    }
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function pngChunk(type: string, data: Buffer): Buffer {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
    return Buffer.concat([len, typeBytes, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflated),
    pngChunk('IEND', Buffer.alloc(0)),
  ])

  fs.writeFileSync(filePath, png)
}
