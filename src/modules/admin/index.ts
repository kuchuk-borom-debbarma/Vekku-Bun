import { AdminServiceImpl } from "./AdminService";

let adminService: AdminServiceImpl | null = null;

export const getAdminService = () => {
  if (!adminService) {
    adminService = new AdminServiceImpl();
  }
  return adminService;
};
