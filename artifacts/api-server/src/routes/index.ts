import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import customizationsRouter from "./customizations";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import usersRouter from "./users";
import adminRouter from "./admin";
import adminExtraRouter from "./adminExtra";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(customizationsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(adminExtraRouter);
router.use(paymentsRouter);

export default router;
