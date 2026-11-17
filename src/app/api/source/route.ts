import type { NextRequest } from "next/server";
import {
  buildSourceZip,
  getAssetManifest,
  readInspectableFile,
  type BundleMode,
} from "@/lib/source-bundle";

export const dynamic = "force-dynamic";

const VALID_MODES = new Set<BundleMode>(["full", "site", "app-kit"]);

/**
 * GET /api/source?download=full|site|app-kit — скачивание готового ZIP-архива.
 * GET /api/source?source=site|kit&file=<path>&raw=0|1 — просмотр или скачивание одного файла.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const download = searchParams.get("download");

  if (download) {
    const mode: BundleMode = VALID_MODES.has(download as BundleMode)
      ? (download as BundleMode)
      : "full";
    try {
      const zip = buildSourceZip(mode);
      const assets = getAssetManifest();
      const bundled = assets.filter((a) => a.exists).length;
      return new Response(new Uint8Array(zip.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zip.filename}"`,
          "Content-Length": String(zip.byteLength),
          "Cache-Control": "no-store",
          "X-File-Count": String(zip.fileCount),
          "X-Archive-Bytes": String(zip.byteLength),
          "X-Binary-Assets": String(bundled),
        },
      });
    } catch {
      return Response.json({ error: "Не удалось собрать ZIP-архив" }, { status: 500 });
    }
  }

  const filePath = searchParams.get("file");
  if (filePath) {
    const source = searchParams.get("source") === "kit" ? "kit" : "site";
    const found = readInspectableFile(source, filePath);
    if (!found) {
      return Response.json({ error: "Файл не найден или недоступен для текстового просмотра" }, { status: 404 });
    }
    if (searchParams.get("raw") === "1") {
      const base = found.path.split("/").pop() || "file.txt";
      const safeName = base.replace(/[^a-zA-Z0-9._-]/g, "_");
      return new Response(found.content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json(found, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const assets = getAssetManifest();
  return Response.json({
    ok: true,
    downloads: {
      full: "/api/source?download=full",
      site: "/api/source?download=site",
      appKit: "/api/source?download=app-kit",
    },
    binaryAssets: assets,
    binaryAssetsTotalBytes: assets.reduce((sum, a) => sum + a.size, 0),
    missingAssets: assets.filter((a) => !a.exists).map((a) => a.path),
  });
}
