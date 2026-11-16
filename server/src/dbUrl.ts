/** Heroku Postgres requires TLS. Add it unless the URL already says how to connect (local/Docker databases stay plain). */
export function dbUrl(raw: string): string {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "db"].includes(url.hostname);
  if (!local && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "no-verify");
  return url.toString();
}
