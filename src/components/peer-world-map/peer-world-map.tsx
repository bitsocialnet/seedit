import { WORLD_MAP_DOTS } from '../../data/world-map-dots';
import { getCountryFlagPosition, getCountryLabel, normalizeCountryCode } from '../../lib/country-flags';
import { getApproximateLatLon, type PeerMapLocation } from '../../lib/peer-geo';
import { transparentPixelSrc } from '../../lib/p2p-stats';
import styles from './peer-world-map.module.css';

type MapPeer = {
  address: string;
  id: string;
  location?: PeerMapLocation;
  peerId: string;
  role?: 'leecher' | 'seeder';
};

// Square side per land dot, sized to cover most of a grid cell so the rasterized
// Natural Earth land mask (src/data/world-map-dots.ts) reads as a halftone map.
const DOT_SIZE = WORLD_MAP_DOTS.step * 0.6;
const PEER_MARKER_SIZE = 3;
const PEER_MARKER_OFFSET = PEER_MARKER_SIZE / 2;

// Equirectangular projection shared with the peer markers below: x = lon + 180,
// y = 90 - lat. Expand the land bitmap into one <path> of small squares so the
// backdrop is a single static node instead of thousands of elements.
const LAND_PATH = (() => {
  const { step, lonMin, latMax, cols, rows, bitmap } = WORLD_MAP_DOTS;
  const binary = atob(bitmap);
  const square = `h${DOT_SIZE}v${DOT_SIZE}h${-DOT_SIZE}z`;
  const fmt = (value: number) => +value.toFixed(2);
  let path = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (!((binary.charCodeAt(index >> 3) >> (7 - (index & 7))) & 1)) continue;
      const lon = lonMin + (col + 0.5) * step;
      const lat = latMax - (row + 0.5) * step;
      path += `M${fmt(lon + 180 - DOT_SIZE / 2)} ${fmt(90 - lat - DOT_SIZE / 2)}${square}`;
    }
  }
  return path;
})();

const PeerWorldMap = ({ peers }: { peers: MapPeer[] }) => {
  const plotted: { id: string; label?: string; peerId: string; role?: 'leecher' | 'seeder'; x: number; y: number }[] = [];
  for (const peer of peers) {
    const location = peer.location ?? getApproximateLatLon(peer.address);
    if (location) plotted.push({ id: peer.id, label: peer.location?.label, peerId: peer.peerId, role: peer.role, x: location.lon + 180, y: 90 - location.lat });
  }

  if (!plotted.length) return null;

  return (
    <div className={styles.peerWorldMap}>
      <svg className={styles.peerWorldMapSvg} viewBox='0 8 360 140' shapeRendering='crispEdges' role='img' aria-label='Approximate peer locations'>
        <path className={styles.landDot} d={LAND_PATH} />
        {plotted.map((peer) => (
          <rect
            className={styles.peerMarker}
            data-peer-role={peer.role}
            height={PEER_MARKER_SIZE}
            key={peer.id}
            width={PEER_MARKER_SIZE}
            x={peer.x - PEER_MARKER_OFFSET}
            y={peer.y - PEER_MARKER_OFFSET}
          >
            <title>{peer.label ? `${peer.peerId} - ${peer.label}` : peer.peerId}</title>
          </rect>
        ))}
      </svg>
      <div className={styles.peerWorldMapCaption}>approximate IP locations</div>
    </div>
  );
};

/** A country's flag from the sprite sheet, named for assistive technology; nothing for an unknown country. */
export const CountryFlag = ({ countryCode }: { countryCode: string | undefined }) => {
  const flagPosition = getCountryFlagPosition(normalizeCountryCode(countryCode));
  if (!flagPosition) return null;
  const countryLabel = getCountryLabel(countryCode);
  return (
    <img
      alt={countryLabel}
      aria-label={countryLabel}
      className={styles.peerFlag}
      src={transparentPixelSrc}
      style={{ backgroundPosition: `-${flagPosition.x}px -${flagPosition.y}px` }}
      title={countryLabel}
    />
  );
};

export default PeerWorldMap;
