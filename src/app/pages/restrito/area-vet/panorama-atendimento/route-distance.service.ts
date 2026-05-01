import { Injectable } from '@angular/core';

export interface RouteDistanceResult {
  km: number;
  fonte: 'osrm' | 'haversine';
  erro?: string;
  /** Coordenadas [lat, lng] para desenhar a polyline no mapa (só OSRM). */
  pathLatLng?: [number, number][];
}

@Injectable({ providedIn: 'root' })
export class RouteDistanceService {
  /** Distância em linha reta entre dois pontos WGS84 (km). */
  haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Distância aproximada pela malha viária (serviço público OSRM).
   * Em falha de rede/CORS, devolve Haversine com aviso.
   */
  async distanciaPorRotaKm(lat1: number, lon1: number, lat2: number, lon2: number): Promise<RouteDistanceResult> {
    const fallback = (): RouteDistanceResult => ({
      km: this.haversineKm(lat1, lon1, lat2, lon2),
      fonte: 'haversine',
      erro: 'Rota indisponível; usando distância em linha reta.',
    });

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return fallback();
      const data = await res.json();
      const route = data?.routes?.[0];
      const meters = route?.distance;
      if (typeof meters !== 'number' || !Number.isFinite(meters)) return fallback();
      const km = Math.round((meters / 1000) * 100) / 100;
      const coords = route?.geometry?.coordinates as [number, number][] | undefined;
      const pathLatLng: [number, number][] | undefined = Array.isArray(coords)
        ? coords.map(([lng, lat]) => [lat, lng] as [number, number])
        : undefined;
      return { km, fonte: 'osrm', pathLatLng };
    } catch {
      return fallback();
    }
  }
}
