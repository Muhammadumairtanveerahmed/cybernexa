import { Router } from "express";
import authRoutes from "./auth.routes.js";
import publicRoutes from "./public.routes.js";
import portalRoutes from "./portal.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/portal", portalRoutes);
router.use("/", publicRoutes);

export default router;
