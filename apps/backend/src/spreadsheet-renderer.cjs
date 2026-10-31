const fs = require("node:fs");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { createRequire } = require("node:module");

function rendererFile() {
  const output = path.resolve(__dirname, "../generated/spreadsheet.cjs");
  if (process.env.NODE_ENV !== "production") {
    // Development uses the same entry point bundled into the Docker image.
    const web = path.resolve(__dirname, "../../web");
    createRequire(path.join(web, "package.json"))("esbuild").buildSync({
      entryPoints: [path.join(web, "src/lib/spreadsheetServer.ts")],
      outfile: output, bundle: true, platform: "node", format: "cjs", target: "node24",
      tsconfig: path.join(web, "tsconfig.json"),
    });
  }
  if (!fs.existsSync(output)) throw new Error("spreadsheet_schedule_render_failed");
  return output;
}

function renderSpreadsheet(snapshot, language, theme) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "spreadsheet-worker.cjs"), {
      workerData: { renderer: rendererFile(), snapshot, language, theme },
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      worker.terminate();
      reject(new Error("spreadsheet_schedule_render_failed"));
    }, 120000);
    worker.once("message", (bytes) => {
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      if (bytes.error) reject(new Error(bytes.error));
      else resolve(Buffer.from(bytes));
    });
    worker.once("error", () => {
      finished = true;
      clearTimeout(timer);
      reject(new Error("spreadsheet_schedule_render_failed"));
    });
    worker.once("exit", () => {
      clearTimeout(timer);
      if (!finished) reject(new Error("spreadsheet_schedule_render_failed"));
    });
  });
}
module.exports = { renderSpreadsheet };
