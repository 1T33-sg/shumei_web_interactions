import boundary from './anhui-boundary.json'
import type { Entity } from '../types/api'

export const mapWidth = 800, mapHeight = 510
type Coordinates = { longitude: number; latitude: number }
export interface GeoNode extends Coordinates {
  entity: Entity; x: number; y: number
  labelX: number; labelY: number; labelAnchor: 'start' | 'end'
}

const boundaryRings = boundary.features[0]!.geometry.coordinates.map(ring => ring.map(point => ({ longitude: point[0]!, latitude: point[1]! })))
const radians = Math.PI / 180
function mercator(longitude: number, latitude: number) {
  return { x: longitude * radians, y: -Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2)) }
}
const projectedBoundary = boundaryRings.flat().map(point => mercator(point.longitude, point.latitude))
const bounds = {
  left: Math.min(...projectedBoundary.map(point => point.x)), right: Math.max(...projectedBoundary.map(point => point.x)),
  top: Math.min(...projectedBoundary.map(point => point.y)), bottom: Math.max(...projectedBoundary.map(point => point.y)),
}
const scale = Math.min((mapWidth - 220) / (bounds.right - bounds.left), (mapHeight - 60) / (bounds.bottom - bounds.top))
export function projectCoordinates(longitude: number, latitude: number) {
  const point = mercator(longitude, latitude)
  return {
    x: Number((mapWidth / 2 + (point.x - (bounds.left + bounds.right) / 2) * scale).toFixed(2)),
    y: Number((mapHeight / 2 + (point.y - (bounds.top + bounds.bottom) / 2) * scale).toFixed(2)),
  }
}
export const boundaryPath = boundaryRings.map(ring => ring.map((point, index) => {
  const { x, y } = projectCoordinates(point.longitude, point.latitude)
  return `${index ? 'L' : 'M'}${x} ${y}`
}).join(' ') + 'Z').join(' ')

// These GCJ-02 POIs share the boundary's coordinate system; offsets apply only to labels.
const knownLocations: Record<string, Coordinates & { type: Entity['type'] }> = {
  '合肥南站': { longitude: 117.291131, latitude: 31.798383, type: 'rail_station' },
  '黄山北站': { longitude: 118.273139, latitude: 29.815110, type: 'rail_station' },
  '合肥新桥机场': { longitude: 116.978347, latitude: 31.985386, type: 'airport' },
  '合肥新桥国际机场': { longitude: 116.978347, latitude: 31.985386, type: 'airport' },
}
function insideRing(longitude: number, latitude: number, ring: Coordinates[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!
    if ((a.latitude > latitude) !== (b.latitude > latitude) && longitude < (b.longitude - a.longitude) * (latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) inside = !inside
  }
  return inside
}
function validLocation(longitude: unknown, latitude: unknown): longitude is number {
  return typeof longitude === 'number' && typeof latitude === 'number' && Number.isFinite(longitude) && Number.isFinite(latitude)
    && insideRing(longitude, latitude, boundaryRings[0]!) && !boundaryRings.slice(1).some(ring => insideRing(longitude, latitude, ring))
}
export function locateTransportEntities(entities: Entity[]): { nodes: GeoNode[]; unlocated: Entity[] } {
  const nodes: GeoNode[] = [], unlocated: Entity[] = []
  for (const entity of entities) {
    const known = knownLocations[entity.name]
    const provided = entity.longitude !== undefined || entity.latitude !== undefined
    const location = provided ? entity : known?.type === entity.type ? known : undefined
    if (!location || !validLocation(location.longitude, location.latitude)) { unlocated.push(entity); continue }
    const { longitude, latitude } = location as Coordinates
    const position = projectCoordinates(longitude, latitude)
    const labelAnchor = entity.type === 'airport' ? 'end' : 'start'
    nodes.push({ entity, longitude, latitude, ...position, labelX: labelAnchor === 'end' ? -28 : 28, labelY: entity.type === 'airport' ? -32 : entity.name === '合肥南站' ? 30 : -6, labelAnchor })
  }
  return { nodes, unlocated }
}
