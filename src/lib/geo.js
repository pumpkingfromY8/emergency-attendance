import { OFFICE } from "./supabase";

function toRad(v) { return v * Math.PI / 180; }

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser does not support GPS/geolocation."));
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const distance = distanceMeters(latitude, longitude, OFFICE.lat, OFFICE.lng);
        resolve({ latitude, longitude, accuracy, distance, inside: distance <= OFFICE.radius });
      },
      err => reject(new Error(
        err.code === 1 ? "Location permission was denied." :
        err.code === 2 ? "Your location could not be determined." :
        "GPS request timed out."
      )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}