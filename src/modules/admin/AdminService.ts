import { eq, desc, count, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../../db";
import { CacheServiceUpstash } from "../../lib/cache";

export interface IAdminService {
  getAllUsers(limit: number, offset: number): Promise<any[]>;
  updateUserRole(userId: string, role: "USER" | "ADMIN"): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  getSystemStats(): Promise<any>;
}

export class AdminServiceImpl implements IAdminService {
  async getAllUsers(limit: number, offset: number) {
    const db = getDb();
    return await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.username,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        isDeleted: schema.user.isDeleted,
      })
      .from(schema.user)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.user.createdAt));
  }

  async updateUserRole(userId: string, role: "USER" | "ADMIN") {
    const db = getDb();
    const result = await db
      .update(schema.user)
      .set({ role })
      .where(eq(schema.user.id, userId))
      .returning();
    return result.length > 0;
  }

  async deleteUser(userId: string) {
    const db = getDb();
    // Soft delete
    const result = await db
      .update(schema.user)
      .set({ isDeleted: true })
      .where(eq(schema.user.id, userId))
      .returning();
    return result.length > 0;
  }

  async getSystemStats() {
    const cacheKey = CacheServiceUpstash.generateKey("admin", "stats");
    const cached = await CacheServiceUpstash.get<any>(cacheKey);
    if (cached) return cached;

    const db = getDb();
    const [userCount] = await db.select({ count: count() }).from(schema.user);
    const [contentCount] = await db.select({ count: count() }).from(schema.contents);
    const [tagCount] = await db.select({ count: count() }).from(schema.userTags);
    
    const stats = {
      users: userCount?.count ?? 0,
      contents: contentCount?.count ?? 0,
      tags: tagCount?.count ?? 0,
    };

    await CacheServiceUpstash.set(cacheKey, stats, 60); // Cache for 60 seconds

    return stats;
  }
}
