import path from 'path';
import { fileURLToPath } from 'url';
import pkg from './next-i18next.config.js';
const { i18n } = pkg;

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,
  // Next 14.2.5's webpack config only auto-derives the "@/*" alias from
  // tsconfig.json when moduleResolution is "node"/"node10"/etc — it doesn't
  // recognize "bundler" (a newer TS mode), so the alias silently stops
  // resolving at build/runtime even though `tsc --noEmit` still passes
  // (type-checking and webpack bundling resolve modules differently). This
  // sets the alias explicitly so it works regardless of that tsconfig setting.
  webpack: (config) => {
    config.resolve.alias['@'] = projectRoot;
    return config;
  },
};

export default nextConfig;
