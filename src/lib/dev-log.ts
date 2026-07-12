export function devInfo(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (details === undefined) console.info(message);
  else console.info(message, details);
}
