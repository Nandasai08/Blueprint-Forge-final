import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkDatabaseConnection } from "../lib/supabase";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res): Promise<void> => {
  const databaseConnected = await checkDatabaseConnection();
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "error",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

export default router;
