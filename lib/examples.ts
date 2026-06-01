/**
 * Pre-filled "Run on a famous repo" examples. One click, no thinking required —
 * this is the share-driver: people try it instantly on a project they know.
 */
export interface ExampleRepo {
  name: string;
  description: string;
  repoUrl: string;
  docsUrl: string;
}

export const EXAMPLE_REPOS: ExampleRepo[] = [
  {
    name: "Vercel AI SDK",
    description: "The TypeScript toolkit for building AI apps",
    repoUrl: "https://github.com/vercel/ai",
    docsUrl: "https://ai-sdk.dev/docs/introduction",
  },
  {
    name: "Prisma",
    description: "Next-generation Node.js & TypeScript ORM",
    repoUrl: "https://github.com/prisma/prisma",
    docsUrl: "https://www.prisma.io/docs/orm/prisma-client",
  },
  {
    name: "Hono",
    description: "Ultrafast web framework for the edge",
    repoUrl: "https://github.com/honojs/hono",
    docsUrl: "https://hono.dev/docs/",
  },
  {
    name: "Zod",
    description: "TypeScript-first schema validation",
    repoUrl: "https://github.com/colinhacks/zod",
    docsUrl: "https://zod.dev/",
  },
];
