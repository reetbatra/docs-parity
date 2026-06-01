import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The analysis pipeline imports the full TypeScript compiler at runtime to
  // parse source files. Keep it external so Next doesn't bundle the whole
  // compiler into the serverless function.
  serverExternalPackages: ["typescript"],
};

export default nextConfig;
