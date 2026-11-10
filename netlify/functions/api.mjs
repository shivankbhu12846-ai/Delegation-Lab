// Delegation Lab – API endpoint (served at /api/*).
// Data is kept in Netlify Blobs (store "delegation-lab"). Secrets come from environment variables:
//   EXPERIMENTER_PASSWORD, GRADER_PASSWORD, AI_API_KEY, AI_PROVIDER, AI_MODEL
import { getStore } from "@netlify/blobs";
import { createHandler } from "../lib/core.mjs";

export default async (req) => {
  const store = getStore({ name: "delegation-lab", consistency: "strong" });
  return createHandler({ store, env: process.env })(req);
};

export const config = { path: "/api/*" };
