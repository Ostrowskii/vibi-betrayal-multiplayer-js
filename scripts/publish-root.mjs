import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const distHtml = resolve(distDir, "dev.html");
const distBuildDir = resolve(distDir, "build");
const rootHtml = resolve(root, "index.html");
const rootBuildDir = resolve(root, "build");

async function main() {
  const html = await readFile(distHtml, "utf8");
  await writeFile(rootHtml, html, "utf8");

  await rm(rootBuildDir, { recursive: true, force: true });
  await mkdir(rootBuildDir, { recursive: true });
  await cp(distBuildDir, rootBuildDir, { recursive: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
