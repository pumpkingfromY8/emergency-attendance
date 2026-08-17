import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Supabase environment variables are not configured.");
}

export const supabase = createClient(url || "", anonKey || "");

export const OFFICE = {
  lat: Number(import.meta.env.VITE_OFFICE_LAT || 0),
  lng: Number(import.meta.env.VITE_OFFICE_LNG || 0),
  radius: Number(import.meta.env.VITE_GEOFENCE_RADIUS_METERS || 100)
};