import { describe, it, expect, beforeEach } from 'vitest'
import {
  getLastPickedLocation,
  setLastPickedLocation,
  clearLastPickedLocation,
} from './lastPickedLocation'

/**
 * Issue#158: 投稿ダイアログで「ユーザーが能動的に選んだ前回位置」をセッション内メモリに保持する。
 * localStorage は使わず（＝リロードで消える）、モジュールレベル変数で保持する純粋なストア。
 */
describe('lastPickedLocation', () => {
  beforeEach(() => {
    // モジュールレベル変数はテスト間で共有されるため毎回クリアする
    clearLastPickedLocation()
  })

  it('未設定のときは null を返す', () => {
    expect(getLastPickedLocation()).toBeNull()
  })

  it('set した位置を get で取り出せる', () => {
    setLastPickedLocation({ lat: 35.68, lng: 139.76 })
    expect(getLastPickedLocation()).toEqual({ lat: 35.68, lng: 139.76 })
  })

  it('set は最新の値で上書きされる', () => {
    setLastPickedLocation({ lat: 35.68, lng: 139.76 })
    setLastPickedLocation({ lat: 34.7, lng: 135.5 })
    expect(getLastPickedLocation()).toEqual({ lat: 34.7, lng: 135.5 })
  })

  it('clear で null に戻る', () => {
    setLastPickedLocation({ lat: 35.68, lng: 139.76 })
    clearLastPickedLocation()
    expect(getLastPickedLocation()).toBeNull()
  })

  it('get が返すオブジェクトを書き換えても内部状態は壊れない（コピーを返す）', () => {
    setLastPickedLocation({ lat: 35.68, lng: 139.76 })
    const first = getLastPickedLocation()
    if (first) {
      first.lat = 0
      first.lng = 0
    }
    expect(getLastPickedLocation()).toEqual({ lat: 35.68, lng: 139.76 })
  })
})
