import { readFileSync } from "node:fs";
const base = new URL("./fixtures/thumbnails/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", base), "utf8"),
);
// Only preprocessed catalog assets are embedded. No external URL is fetched at runtime.
const images = new Map(
  Object.entries(manifest).map(([url, file]) => {
    if (!/^[a-f0-9]{20}\.jpg$/.test(file))
      throw new Error("Invalid thumbnail filename");
    return [
      url,
      `data:image/jpeg;base64,${readFileSync(new URL(file, base)).toString("base64")}`,
    ];
  }),
);
export const thumbnailSource = (url) => images.get(url) ?? null;
