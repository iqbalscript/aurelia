import { NextResponse } from "next/server";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import { auth } from "@/lib/auth";
import { MAX_FILE_SIZE, isImage } from "@/lib/attachments";

export const runtime = "nodejs";

// PDF.js's Node fallback dynamically imports its worker. Configure the worker
// with an absolute package path so Turbopack doesn't resolve it relative to a
// generated server chunk (where the worker file does not exist).
PDFParse.setWorker(
  pathToFileURL(
    join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
  ).href
);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // Images: keep as base64, no extraction needed — sent straight to vision models.
  if (isImage(mimeType)) {
    return NextResponse.json({
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      base64: buffer.toString("base64"),
    });
  }

  // PDF
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return NextResponse.json({
        filename: file.name,
        mimeType,
        sizeBytes: file.size,
        extractedText: data.text.trim(),
      });
    } catch (err) {
      console.error("PDF extraction failed:", err);
      return NextResponse.json({ error: "Failed to read PDF" }, { status: 422 });
    } finally {
      await parser.destroy();
    }
  }

  // DOCX
  if (mimeType.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({
        filename: file.name,
        mimeType,
        sizeBytes: file.size,
        extractedText: result.value.trim(),
      });
    } catch (err) {
      console.error("DOCX extraction failed:", err);
      return NextResponse.json({ error: "Failed to read DOCX" }, { status: 422 });
    }
  }

  // Plain text-ish formats (txt, md, csv, json) — read directly
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    file.name.match(/\.(txt|md|csv|json)$/i)
  ) {
    return NextResponse.json({
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      extractedText: buffer.toString("utf-8"),
    });
  }

  return NextResponse.json(
    { error: `Unsupported file type: ${mimeType}` },
    { status: 415 }
  );
}
