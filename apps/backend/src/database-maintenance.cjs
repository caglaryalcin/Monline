const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { BadRequestError, ForbiddenError } = require("./errors.cjs");

function registerDatabaseMaintenanceApi(app, repository, auth) {
  app.post("/api/admin/database-maintenance", async (req, res) => {
    if (!auth.isAdmin(req.user))
      throw new ForbiddenError("Admin access required");
    const action = req.body?.action;
    if (action !== "check" && action !== "optimize")
      throw new BadRequestError("Unsupported database maintenance action");
    if (repository.databaseOperation)
      return res.status(409).json({ message: "database_maintenance_busy" });
    repository.databaseOperation = "maintenance";
    try {
      // Use a separate thread so database checks and VACUUM do not block the
      // HTTP event loop or health checks. SQLite manages concurrent access.
      const result = await new Promise((resolve, reject) => {
        const worker = new Worker(
          path.join(__dirname, "database-maintenance-worker.cjs"),
          {
            workerData: { directory: repository.directory, action },
          },
        );
        let received = false;
        let result;
        worker.once("message", (message) => {
          received = true;
          result = message;
        });
        worker.once("error", reject);
        worker.once("exit", (code) => {
          if (code !== 0 || !received)
            reject(new Error("Maintenance worker failed"));
          else resolve(result);
        });
      });
      if (result.error)
        return res
          .status(
            result.error === "database_maintenance_busy"
              ? 409
              : result.error === "database_maintenance_disk_space"
                ? 507
                : 500,
          )
          .json({
            message: result.error,
            data: { safetyBackup: result.safetyBackup },
          });
      res.json({ action, ...result });
    } finally {
      repository.databaseOperation = null;
    }
  });
}

module.exports = { registerDatabaseMaintenanceApi };
