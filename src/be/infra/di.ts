import { createContainer, asValue, asClass, InjectionMode, type AwilixContainer } from "awilix";
import { drizzle } from "drizzle-orm/neon-http";
import { BunHasher } from "./hashing/BunHasher";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { IHasher } from "./hashing/IHasher";
import { registerUserDomain } from "../user";
import { registerTagDomain } from "../tag";

// Define the shape of our dependencies
export interface Cradle {
  db: NeonHttpDatabase;
  hasher: IHasher;
  [key: string]: unknown;
}

export const createAppContainer = (): AwilixContainer<Cradle> => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
  });

  // 1. Register Infrastructure
  container.register({
    db: asValue(drizzle(process.env.DATABASE_URL!)),
    // In the future, we can check process.env.PLATFORM to choose WebHasher
    hasher: asClass(BunHasher).singleton(),
  });

  // 2. Register Domains
  registerUserDomain(container);
  registerTagDomain(container);

  return container;
};
