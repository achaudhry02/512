import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const standaloneNextRoot = path.join(standaloneRoot, ".next");
const standalonePublicRoot = path.join(standaloneRoot, "public");

if (!existsSync(standaloneRoot)) {
  throw new Error("Missing .next/standalone. Run npm run build before packaging Electron.");
}

await mkdir(standaloneNextRoot, { recursive: true });

if (existsSync(path.join(root, ".next", "static"))) {
  await cp(path.join(root, ".next", "static"), path.join(standaloneNextRoot, "static"), {
    recursive: true,
    force: true,
  });
}

if (existsSync(path.join(root, "public"))) {
  await cp(path.join(root, "public"), standalonePublicRoot, {
    recursive: true,
    force: true,
  });
}

console.log("Prepared Next.js standalone output for Electron packaging.");
