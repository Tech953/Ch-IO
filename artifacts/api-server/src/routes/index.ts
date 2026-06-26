import { Router, type IRouter } from "express";
import healthRouter from "./health";
import personalityRouter from "./personality";
import memoriesRouter from "./memories";
import journalRouter from "./journal";
import personasRouter from "./personas";
import beliefsRouter from "./beliefs";
import evolutionRouter from "./evolution";
import initiativeRouter from "./initiative";
import hieroRouter from "./hiero";
import statsRouter from "./stats";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(personalityRouter);
router.use(memoriesRouter);
router.use(journalRouter);
router.use(personasRouter);
router.use(beliefsRouter);
router.use(evolutionRouter);
router.use(initiativeRouter);
router.use(hieroRouter);
router.use(statsRouter);
router.use(openaiRouter);

export default router;
