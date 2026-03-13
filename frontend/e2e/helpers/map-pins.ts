import { Page, expect } from '@playwright/test'

/**
 * Issue#55: Symbol Layer移行後のE2Eテスト用ヘルパー
 *
 * Symbol Layerで描画されたピンはDOMに存在しないため、
 * Mapbox GL JSの queryRenderedFeatures API を使用して
 * ピンの検出とクリックを行う。
 */

/** Symbol LayerのレイヤーID */
const UNCLUSTERED_LAYER_ID = 'unclustered-point'
const CLUSTER_LAYER_ID = 'clusters'

interface PinFeature {
  type: string
  geometry: { type: string; coordinates: [number, number] }
  properties: Record<string, any>
}

interface PinsAndClusters {
  pins: PinFeature[]
  clusters: PinFeature[]
  pinCount: number
  clusterCount: number
}

/**
 * 地図上に表示されているピンとクラスタを取得する
 */
export async function findPinsAndClusters(page: Page): Promise<PinsAndClusters> {
  const result = await page.evaluate(({ unclusteredLayer, clusterLayer }) => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    if (!map?.queryRenderedFeatures) {
      return { pins: [], clusters: [] }
    }

    const pins = map.queryRenderedFeatures(undefined, { layers: [unclusteredLayer] })
      .map((f: any) => ({
        type: f.type,
        geometry: f.geometry,
        properties: f.properties,
      }))

    const clusters = map.queryRenderedFeatures(undefined, { layers: [clusterLayer] })
      .map((f: any) => ({
        type: f.type,
        geometry: f.geometry,
        properties: f.properties,
      }))

    return { pins, clusters }
  }, { unclusteredLayer: UNCLUSTERED_LAYER_ID, clusterLayer: CLUSTER_LAYER_ID })

  return {
    pins: result.pins,
    clusters: result.clusters,
    pinCount: result.pins.length,
    clusterCount: result.clusters.length,
  }
}

/**
 * 最初のピンをクリックする
 * Symbol LayerのフィーチャーからピクセルQ座標を算出してクリック
 */
export async function clickFirstPin(page: Page): Promise<boolean> {
  const point = await page.evaluate(({ layerId }) => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    if (!map?.queryRenderedFeatures || !map?.project) return null

    const features = map.queryRenderedFeatures(undefined, { layers: [layerId] })
    if (features.length === 0) return null

    const coords = features[0].geometry.coordinates
    const projected = map.project(coords)
    return { x: projected.x, y: projected.y }
  }, { layerId: UNCLUSTERED_LAYER_ID })

  if (!point) return false

  await page.mouse.click(point.x, point.y)
  return true
}

/**
 * 最初のクラスタをクリックする
 */
export async function clickFirstCluster(page: Page): Promise<boolean> {
  const point = await page.evaluate(({ layerId }) => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    if (!map?.queryRenderedFeatures || !map?.project) return null

    const features = map.queryRenderedFeatures(undefined, { layers: [layerId] })
    if (features.length === 0) return null

    const coords = features[0].geometry.coordinates
    const projected = map.project(coords)
    return { x: projected.x, y: projected.y }
  }, { layerId: CLUSTER_LAYER_ID })

  if (!point) return false

  await page.mouse.click(point.x, point.y)
  return true
}

/**
 * ピンまたはクラスタが表示されるのを待機する
 */
export async function waitForPinsOrClusters(page: Page, timeout: number = 10000): Promise<PinsAndClusters> {
  let result: PinsAndClusters = { pins: [], clusters: [], pinCount: 0, clusterCount: 0 }

  await expect(async () => {
    result = await findPinsAndClusters(page)
    expect(result.pinCount + result.clusterCount).toBeGreaterThan(0)
  }).toPass({ timeout })

  return result
}
