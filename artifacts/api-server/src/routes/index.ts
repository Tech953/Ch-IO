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
import expressionsRouter from "./expressions";
import statsRouter from "./stats";
import openaiRouter from "./openai";
import engramsRouter from "./engrams";

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
router.use(expressionsRouter);
router.use(statsRouter);
router.use(openaiRouter);
router.use(engramsRouter);

export default router;
