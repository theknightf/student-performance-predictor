// The API address comes from an environment variable (falls back to the deployed backend)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://spp-api-drab.vercel.app";

export async function getJson(path, options) {
  const res = await fetch(API_URL + path, options);
  if (!res.ok) throw new Error("request failed with status " + res.status);
  return res.json();
}
