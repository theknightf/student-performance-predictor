// The API address comes from an environment variable
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getJson(path, options) {
  const res = await fetch(API_URL + path, options);
  if (!res.ok) throw new Error("request failed with status " + res.status);
  return res.json();
}
