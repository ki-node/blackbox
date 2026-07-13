const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("SITE_URL is required");

const attempts = 12;
const retryDelay = 5_000;

async function fetchUntilOk(url, label) {
  let lastFailure = "no response";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return response;
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${lastFailure}`);
}

const response = await fetchUntilOk(siteUrl, "Deployment");
const html = await response.text();
for (const marker of [
  "BLACK BOX",
  'data-module="power"',
  "data-transmission",
]) {
  if (!html.includes(marker))
    throw new Error(`Deployment is missing ${marker}`);
}

const iconTag = html.match(
  /<link\b[^>]*\brel=["'][^"']*\bicon\b[^"']*["'][^>]*>/i,
)?.[0];
const iconHref = iconTag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
if (!iconHref) throw new Error("Deployment is missing its icon link");

await fetchUntilOk(new URL(iconHref, siteUrl), "Icon");
console.log(`Verified ${siteUrl}`);
