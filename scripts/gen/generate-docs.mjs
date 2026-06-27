// Generates the four ENGRAM project PDFs (proposal, developer guide, readme,
// user manual) using pdfkit's built-in fonts. Run from the repo root:
//   node scripts/gen/generate-docs.mjs
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "docs");
fs.mkdirSync(OUT, { recursive: true });

const DATE = "June 26, 2026";

const C = {
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  cyan: "#06B6D4",
  cyanBright: "#22D3EE",
  cyanDark: "#0E7490",
  amber: "#B45309",
  border: "#CBD5E1",
  borderLight: "#E2E8F0",
  coverBg: "#0A0F1A",
  coverPanel: "#111A2B",
  coverText: "#F8FAFC",
  codeBg: "#0B1220",
  codeInk: "#CBD5E1",
  codeAccent: "#22D3EE",
};

const MARGINS = { top: 96, bottom: 66, left: 64, right: 64 };

function createDoc(meta) {
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGINS,
    bufferPages: true,
    autoFirstPage: true,
    info: { Title: meta.title, Author: "ENGRAM / PYRI", Subject: meta.docType },
  });
  const W = doc.page.width;
  const H = doc.page.height;
  const left = MARGINS.left;
  const right = W - MARGINS.right;
  const contentW = right - left;
  const topY = MARGINS.top;
  const bottomLimit = H - MARGINS.bottom;
  const ctx = { doc, meta, W, H, left, right, contentW, topY, bottomLimit };

  drawCover(ctx);
  doc.on("pageAdded", () => drawHeader(ctx));
  return ctx;
}

function drawCover(ctx) {
  const { doc, meta, W, H, left, right, contentW } = ctx;
  doc.save();
  doc.rect(0, 0, W, H).fill(C.coverBg);
  // faint top panel
  doc.rect(0, 0, W, 210).fill(C.coverPanel);
  // cyan accent rules
  doc.rect(left, 150, 56, 4).fill(C.cyanBright);

  // kicker
  doc
    .font("Courier-Bold")
    .fontSize(10)
    .fillColor(C.cyanBright)
    .text("ENGRAM // COGNITIVE ARCHITECTURE", left, 100, {
      characterSpacing: 2,
      lineBreak: false,
    });

  // title block
  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(C.coverText)
    .text(meta.title, left, 300, { width: contentW, lineGap: 2 });

  doc
    .font("Courier-Bold")
    .fontSize(13)
    .fillColor(C.cyanBright)
    .text(meta.docType.toUpperCase(), left, doc.y + 14, {
      width: contentW,
      characterSpacing: 1,
    });

  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#94A3B8")
    .text(meta.subtitle, left, doc.y + 14, { width: contentW - 40, lineGap: 3 });

  // bottom meta
  const by = H - 130;
  doc.rect(left, by, contentW, 1).fill("#1E2A3F");
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(C.coverText)
    .text("PYRI — AI Persona Framework", left, by + 14, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#94A3B8")
    .text(`Version ${meta.version}   •   ${DATE}   •   ${meta.tag}`, left, by + 14, {
      width: contentW,
      align: "right",
    });
  doc
    .font("Courier")
    .fontSize(8.5)
    .fillColor("#64748B")
    .text(meta.foot, left, by + 36, { width: contentW });
  doc.restore();
}

function drawHeader(ctx) {
  const { doc, meta, left, right, contentW } = ctx;
  const y = 44;
  doc.save();
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(C.cyanDark)
    .text("ENGRAM", left, y, { lineBreak: false, characterSpacing: 1 });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(C.muted)
    .text(meta.docType.toUpperCase(), left, y, { width: contentW, align: "right" });
  doc
    .moveTo(left, y + 13)
    .lineTo(right, y + 13)
    .lineWidth(0.5)
    .strokeColor(C.border)
    .stroke();
  doc.restore();
  doc.x = left;
  doc.y = ctx.topY;
}

function drawFooters(ctx) {
  const { doc, meta, H, left, right, contentW } = ctx;
  const range = doc.bufferedPageRange();
  const total = range.start + range.count;
  const contentPages = range.count - 1; // exclude cover
  for (let i = range.start + 1; i < total; i++) {
    doc.switchToPage(i);
    const n = i - range.start;
    const fy = H - 46;
    doc.save();
    doc
      .moveTo(left, fy)
      .lineTo(right, fy)
      .lineWidth(0.5)
      .strokeColor(C.border)
      .stroke();
    doc.font("Helvetica").fontSize(8).fillColor(C.muted);
    // The footer sits below the bottom margin (fy > page.maxY). pdfkit only
    // runs its "add a page because y > maxY" check when `width` is set (the
    // LineWrapper path), so neither footer text may pass `width` — otherwise
    // every footer drawn would append a trailing header-only blank page. The
    // page number is right-aligned manually instead of via { width, align }.
    doc.text(meta.title, left, fy + 7, { lineBreak: false });
    const pageLabel = `${n} / ${contentPages}`;
    doc.text(pageLabel, right - doc.widthOfString(pageLabel), fy + 7, {
      lineBreak: false,
    });
    doc.restore();
  }
}

// --- block helpers ---
function need(ctx, h) {
  if (ctx.doc.y + h > ctx.bottomLimit) ctx.doc.addPage();
}

function h1(ctx, txt) {
  const { doc } = ctx;
  need(ctx, 56);
  doc.moveDown(0.9);
  const y = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(C.ink)
    .text(txt, ctx.left, y, { width: ctx.contentW });
  const after = doc.y;
  doc
    .save()
    .moveTo(ctx.left, after + 3)
    .lineTo(ctx.left + 54, after + 3)
    .lineWidth(2)
    .strokeColor(C.cyan)
    .stroke()
    .restore();
  doc.y = after + 9;
}

function h2(ctx, txt) {
  const { doc } = ctx;
  need(ctx, 30);
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .fillColor(C.cyanDark)
    .text(txt, ctx.left, doc.y, { width: ctx.contentW });
  doc.moveDown(0.25);
}

function lead(ctx, txt) {
  const { doc } = ctx;
  need(ctx, 24);
  doc
    .font("Helvetica-Oblique")
    .fontSize(11)
    .fillColor(C.muted)
    .text(txt, ctx.left, doc.y, { width: ctx.contentW, lineGap: 3 });
  doc.moveDown(0.6);
}

function p(ctx, txt) {
  const { doc } = ctx;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(C.body)
    .text(txt, ctx.left, doc.y, { width: ctx.contentW, align: "left", lineGap: 3 });
  doc.moveDown(0.5);
}

function ul(ctx, items) {
  const { doc } = ctx;
  for (const it of items) {
    need(ctx, 16);
    const y = doc.y;
    const bold = typeof it === "object";
    const head = bold ? it.h : null;
    const text = bold ? it.t : it;
    doc.font("Helvetica").fontSize(10.5).fillColor(C.cyan).text("•", ctx.left, y, {
      width: 12,
      lineBreak: false,
    });
    doc.fillColor(C.body);
    if (head) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(C.ink)
        .text(head + "  ", ctx.left + 16, y, { continued: true });
      doc.font("Helvetica").fillColor(C.body).text(text, { width: ctx.contentW - 16, lineGap: 2 });
    } else {
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(C.body)
        .text(text, ctx.left + 16, y, { width: ctx.contentW - 16, lineGap: 2 });
    }
    doc.moveDown(0.3);
  }
  doc.moveDown(0.2);
}

function code(ctx, lines) {
  const { doc } = ctx;
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  const pad = 9;
  const w = ctx.contentW;
  const textW = w - pad * 2;
  doc.font("Courier").fontSize(8.6);
  const h = doc.heightOfString(text, { width: textW, lineGap: 2 }) + pad * 2;
  need(ctx, h + 8);
  const y = doc.y;
  doc.save();
  doc.roundedRect(ctx.left, y, w, h, 4).fill(C.codeBg);
  doc.roundedRect(ctx.left, y, 3, h, 1).fill(C.codeAccent);
  doc.restore();
  doc
    .font("Courier")
    .fontSize(8.6)
    .fillColor(C.codeInk)
    .text(text, ctx.left + pad, y + pad, { width: textW, lineGap: 2 });
  doc.y = y + h;
  doc.moveDown(0.6);
}

function kv(ctx, rows) {
  const { doc } = ctx;
  const keyW = 168;
  const gap = 12;
  const valW = ctx.contentW - keyW - gap;
  for (const [k, v] of rows) {
    doc.font("Courier").fontSize(8.6);
    const kh = doc.heightOfString(k, { width: keyW, lineGap: 2 });
    doc.font("Helvetica").fontSize(9.5);
    const vh = doc.heightOfString(v, { width: valW, lineGap: 2 });
    const rh = Math.max(kh, vh) + 9;
    need(ctx, rh);
    const y = doc.y;
    doc
      .font("Courier")
      .fontSize(8.6)
      .fillColor(C.cyanDark)
      .text(k, ctx.left, y, { width: keyW, lineGap: 2 });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(C.body)
      .text(v, ctx.left + keyW + gap, y, { width: valW, lineGap: 2 });
    doc.y = y + rh;
    doc
      .save()
      .moveTo(ctx.left, doc.y - 4)
      .lineTo(ctx.right, doc.y - 4)
      .lineWidth(0.4)
      .strokeColor(C.borderLight)
      .stroke()
      .restore();
  }
  doc.moveDown(0.5);
}

function callout(ctx, title, bodyText, accent = C.cyan) {
  const { doc } = ctx;
  const pad = 11;
  const w = ctx.contentW;
  const textW = w - pad * 2 - 6;
  doc.font("Helvetica-Bold").fontSize(10);
  const th = title ? doc.heightOfString(title, { width: textW }) : 0;
  doc.font("Helvetica").fontSize(10);
  const bh = doc.heightOfString(bodyText, { width: textW, lineGap: 2 });
  const h = th + (title ? 5 : 0) + bh + pad * 2;
  need(ctx, h + 8);
  const y = doc.y;
  doc.save();
  doc.fillColor(accent).fillOpacity(0.06).rect(ctx.left, y, w, h).fill();
  doc.fillOpacity(1).rect(ctx.left, y, 4, h).fill(accent);
  doc.restore();
  let ty = y + pad;
  if (title) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(accent)
      .text(title, ctx.left + pad + 6, ty, { width: textW });
    ty = doc.y + 3;
  }
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(C.body)
    .text(bodyText, ctx.left + pad + 6, ty, { width: textW, lineGap: 2 });
  doc.y = y + h;
  doc.moveDown(0.6);
}

const RENDER = { h1, h2, lead, p, ul, code, kv, callout: (ctx, b) => callout(ctx, b.title, b.body, b.accent) };

function renderBlocks(ctx, blocks) {
  for (const b of blocks) {
    if (b.t === "h1") h1(ctx, b.x);
    else if (b.t === "h2") h2(ctx, b.x);
    else if (b.t === "lead") lead(ctx, b.x);
    else if (b.t === "p") p(ctx, b.x);
    else if (b.t === "ul") ul(ctx, b.x);
    else if (b.t === "code") code(ctx, b.x);
    else if (b.t === "kv") kv(ctx, b.x);
    else if (b.t === "callout") callout(ctx, b.title, b.x, b.accent);
    else if (b.t === "space") ctx.doc.moveDown(b.x ?? 0.5);
  }
}

function buildAndSave(meta, blocks) {
  return new Promise((resolve, reject) => {
    const ctx = createDoc(meta);
    const stream = fs.createWriteStream(path.join(OUT, meta.file));
    ctx.doc.pipe(stream);
    ctx.doc.addPage();
    ctx.doc.x = ctx.left;
    ctx.doc.y = ctx.topY;
    renderBlocks(ctx, blocks);
    drawFooters(ctx);
    ctx.doc.flushPages();
    ctx.doc.end();
    stream.on("finish", () => resolve(meta.file));
    stream.on("error", reject);
  });
}

// shorthand block constructors
const H1 = (x) => ({ t: "h1", x });
const H2 = (x) => ({ t: "h2", x });
const LEAD = (x) => ({ t: "lead", x });
const P = (x) => ({ t: "p", x });
const UL = (x) => ({ t: "ul", x });
const CODE = (x) => ({ t: "code", x });
const KV = (x) => ({ t: "kv", x });
const NOTE = (x, title = "Note", accent = C.cyan) => ({ t: "callout", x, title, accent });
const WARN = (x, title = "Important") => ({ t: "callout", x, title, accent: C.amber });

import { PROPOSAL } from "./content/proposal.mjs";
import { DEVELOPER } from "./content/developer.mjs";
import { README } from "./content/readme.mjs";
import { MANUAL } from "./content/manual.mjs";

const helpers = { H1, H2, LEAD, P, UL, CODE, KV, NOTE, WARN, C, DATE };

async function main() {
  const docs = [PROPOSAL, DEVELOPER, README, MANUAL].map((f) => f(helpers));
  for (const d of docs) {
    const file = await buildAndSave(d.meta, d.blocks);
    const size = fs.statSync(path.join(OUT, file)).size;
    console.log(`  wrote docs/${file}  (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log("Done. 4 PDFs generated in ./docs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
