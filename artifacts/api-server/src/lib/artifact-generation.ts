import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Engram } from "@workspace/db";
import type { ArtifactKind } from "@workspace/db/schema";
import { authorDocument, type AuthoredDocument } from "./engram-generation";
import {
  generateImage,
  generateVideo,
  GenerationUnavailableError,
} from "./generation-client";

/**
 * Thrown when a requested artifact kind has no available provider (e.g. image/video
 * generation when no online provider is configured). The worker turns this into a
 * "failed" job with a clear message instead of crashing — and PDF, which always has
 * a local provider, is never affected.
 */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export interface GeneratedArtifact {
  data: Buffer;
  mimeType: string;
  filename: string;
  provider: string;
  summary: string | null;
}

export interface GenerateArtifactInput {
  engram: Engram;
  kind: ArtifactKind;
  title: string;
  prompt: string;
  worldModelSummary?: string;
}

/**
 * The generation provider seam — the OUTPUT mirror of the media-extraction seam.
 * PDF is ALWAYS available locally (pure-JS pdf-lib, bundles cleanly, works fully
 * offline). image/video require an online provider wired in a later phase; until
 * then they fail closed with a clear message via ProviderUnavailableError.
 */
export async function generateArtifact(
  input: GenerateArtifactInput,
): Promise<GeneratedArtifact> {
  switch (input.kind) {
    case "pdf":
      return generatePdf(input);
    case "image":
      return generateImageArtifact(input);
    case "video":
      return generateVideoArtifact(input);
    default:
      throw new ProviderUnavailableError(
        `Unsupported artifact kind: ${String(input.kind)}`,
      );
  }
}

/**
 * Build the visual prompt fed to the image/video provider. The engram's persona +
 * recalled world model frame the request so generated media is in-character, not a
 * generic stock render.
 */
function buildVisualPrompt(input: GenerateArtifactInput): string {
  const parts = [input.title.trim(), input.prompt.trim()].filter(Boolean);
  if (input.worldModelSummary?.trim()) {
    parts.push(`Context the author is aware of: ${input.worldModelSummary.trim()}`);
  }
  return parts.join("\n\n");
}

async function generateImageArtifact(
  input: GenerateArtifactInput,
): Promise<GeneratedArtifact> {
  try {
    const out = await generateImage(buildVisualPrompt(input));
    return {
      data: out.data,
      mimeType: out.mimeType,
      filename: `${slugify(input.title)}.${extForMime(out.mimeType, "png")}`,
      provider: out.provider,
      summary: `Image generated from: ${input.title}`.slice(0, 280),
    };
  } catch (err) {
    throw mapGenerationError(err);
  }
}

async function generateVideoArtifact(
  input: GenerateArtifactInput,
): Promise<GeneratedArtifact> {
  try {
    const out = await generateVideo(buildVisualPrompt(input));
    return {
      data: out.data,
      mimeType: out.mimeType,
      filename: `${slugify(input.title)}.${extForMime(out.mimeType, "mp4")}`,
      provider: out.provider,
      summary: `Video generated from: ${input.title}`.slice(0, 280),
    };
  } catch (err) {
    throw mapGenerationError(err);
  }
}

/**
 * A missing online provider is an expected, fail-closed condition (offline desktop /
 * no integration), so surface it as ProviderUnavailableError — the worker marks the
 * job "failed" with the message instead of crashing. Any other error propagates as-is.
 */
function mapGenerationError(err: unknown): unknown {
  if (err instanceof GenerationUnavailableError) {
    return new ProviderUnavailableError(err.message);
  }
  return err;
}

function extForMime(mimeType: string, fallback: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  return map[mimeType.split(";")[0].trim()] ?? fallback;
}

async function generatePdf(
  input: GenerateArtifactInput,
): Promise<GeneratedArtifact> {
  const doc = await authorDocument({
    engram: input.engram,
    title: input.title,
    prompt: input.prompt,
    worldModelSummary: input.worldModelSummary,
  });
  const data = await renderDocumentToPdf(doc);
  return {
    data,
    mimeType: "application/pdf",
    filename: `${slugify(doc.title || input.title)}.pdf`,
    provider: "local-pdf-lib",
    summary: doc.summary,
  };
}

function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `artifact-${Date.now()}`;
}

// --- PDF layout (pdf-lib has no text flow; we lay out + paginate by hand) ---

const PAGE_WIDTH = 595.28; // A4 portrait, in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * pdf-lib's standard fonts are WinAnsi (CP1252) encoded and THROW on any glyph they
 * can't encode (e.g. smart quotes, em dashes, emoji from model output). Map the
 * common typographic characters to ASCII and strip anything still unencodable so a
 * stray Unicode glyph can never fail an entire generation job.
 */
function toWinAnsi(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

export async function renderDocumentToPdf(
  doc: AuthoredDocument,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(doc.title));
  pdf.setAuthor(toWinAnsi(doc.byline));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawParagraph = (
    text: string,
    f: PDFFont,
    size: number,
    color = rgb(0, 0, 0),
    gapAfter = 6,
  ): void => {
    const lineHeight = size * 1.35;
    for (const rawLine of toWinAnsi(text).split("\n")) {
      for (const line of wrapText(rawLine, f, size, CONTENT_WIDTH)) {
        if (y - lineHeight < MARGIN) {
          page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = PAGE_HEIGHT - MARGIN;
        }
        page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color });
        y -= lineHeight;
      }
    }
    y -= gapAfter;
  };

  drawParagraph(doc.title, bold, 22, rgb(0.05, 0.05, 0.08), 4);
  drawParagraph(doc.byline, italic, 11, rgb(0.4, 0.4, 0.45), 12);
  if (doc.summary) drawParagraph(doc.summary, italic, 12, rgb(0.2, 0.2, 0.25), 12);
  for (const section of doc.sections) {
    if (section.heading)
      drawParagraph(section.heading, bold, 14, rgb(0.05, 0.05, 0.08), 4);
    if (section.body)
      drawParagraph(section.body, font, 11.5, rgb(0.1, 0.1, 0.12), 10);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Greedy word-wrap to a pixel width, hard-breaking any single word too long to fit. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
