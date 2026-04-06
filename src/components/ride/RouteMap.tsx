import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { RidePoint, RouteSummary } from '../../types/ride';

function toLatLng(route?: RouteSummary): LatLngExpression[] {
  if (!route) return [];
  return route.coordinates.map(([lng, lat]) => [lat, lng]);
}

type RouteMapProps = {
  pickup: RidePoint;
  destination?: RidePoint;
  route?: RouteSummary;
};

export function RouteMap({ pickup, destination, route }: RouteMapProps) {
  const routeLine = toLatLng(route);
  const center: LatLngExpression = routeLine.length > 0
    ? routeLine[0]
    : [pickup.latitude, pickup.longitude];

  return (
    <div className="overflow-hidden rounded-[20px] border border-aparu-border shadow-glow">
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} style={{ height: 240, width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[pickup.latitude, pickup.longitude]} />
        {destination ? <Marker position={[destination.latitude, destination.longitude]} /> : null}
        {routeLine.length > 1 ? <Polyline positions={routeLine} pathOptions={{ color: '#ffd700', weight: 5, opacity: 0.85 }} /> : null}
      </MapContainer>
    </div>
  );
}
