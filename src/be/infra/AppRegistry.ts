import { Hono } from "hono";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { IHasher } from "./hashing/IHasher";

export type AppContext = {
  db: NeonHttpDatabase;
  hasher: IHasher;
};

// A function that adds routes to an app, with access to dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteSetup = (app: Hono<any>, ctx: AppContext) => void;

const routeRegistrations: RouteSetup[] = [];

// Domain calls this to "schedule" its routes
export const registerRoutes = (fn: RouteSetup) => {
  routeRegistrations.push(fn);
};

// Main entry point calls this to apply all routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyRegistrations = (app: Hono<any>, ctx: AppContext) => {
  routeRegistrations.forEach((fn) => fn(app, ctx));
};
