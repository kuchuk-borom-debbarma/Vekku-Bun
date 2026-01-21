import { Hono } from "hono";
import { getAdminService } from "./index";
import { verifyJwt } from "../../lib/jwt";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: {
    id: string;
    role: string;
  };
};

const adminRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ADMIN MIDDLEWARE
adminRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

  const token = authHeader.split(" ")[1];
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyJwt(token);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  if (payload.role !== "ADMIN") {
    return c.json({ error: "Forbidden: Admins only" }, 403);
  }

  c.set("user", {
    id: payload.sub as string,
    role: payload.role as string,
  });

  await next();
});

// GET /api/admin/users
adminRouter.get("/users", async (c) => {
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;
  
  const adminService = getAdminService();
  const users = await adminService.getAllUsers(limit, offset);
  return c.json({ data: users });
});

// PATCH /api/admin/users/:id/role
adminRouter.patch("/users/:id/role", async (c) => {
  const userId = c.req.param("id");
  const { role } = await c.req.json();

  if (!["USER", "ADMIN"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  const adminService = getAdminService();
  const success = await adminService.updateUserRole(userId, role);
  
  if (!success) return c.json({ error: "User not found" }, 404);
  return c.json({ message: "Role updated" });
});

// DELETE /api/admin/users/:id
adminRouter.delete("/users/:id", async (c) => {
  const userId = c.req.param("id");
  const adminService = getAdminService();
  
  const success = await adminService.deleteUser(userId);
  if (!success) return c.json({ error: "User not found" }, 404);
  
  return c.json({ message: "User soft-deleted" });
});

// GET /api/admin/stats
adminRouter.get("/stats", async (c) => {
  const adminService = getAdminService();
  const stats = await adminService.getSystemStats();
  return c.json(stats);
});

export { adminRouter };
