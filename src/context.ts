import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { IHasher } from "./be/infra/hashing/IHasher";
import type { IAuthService } from "./be/user/IAuthService";
import type { ITagService } from "./be/tag/ITagService";

export type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

export type Variables = {
  db: NeonHttpDatabase;
  hasher: IHasher;
  authService: IAuthService;
  tagService: ITagService;
};
