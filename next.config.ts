import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pin the project root so a stray package-lock.json in a parent folder
  // (for example the home directory) is not mistaken for this project's.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
