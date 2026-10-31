const { parentPort, workerData } = require("node:worker_threads");
try {
  const { renderSpreadsheet } = require(workerData.renderer);
  const bytes = renderSpreadsheet(workerData.snapshot, workerData.language, workerData.theme);
  parentPort.postMessage(bytes, [bytes.buffer]);
} catch {
  parentPort.postMessage({ error: "spreadsheet_schedule_render_failed" });
}
