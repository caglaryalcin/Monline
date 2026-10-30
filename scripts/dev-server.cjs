const path = require("node:path");
const { betaEnvironment } = require("./local-runtime.cjs");

const root = path.resolve(__dirname, "..");
Object.assign(process.env, betaEnvironment(root, process.env));
require(path.join(root, "apps/backend/src/server.cjs"));
