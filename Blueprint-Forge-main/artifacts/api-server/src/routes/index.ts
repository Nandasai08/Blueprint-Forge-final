import { Router, type IRouter } from "express";
import healthRouter from "./health";
import civicRouter from "./civic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(civicRouter);

export default router;
