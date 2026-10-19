const {
  onRecordCreateRequest,
  onRecordEnrich,
  onRecordUpdateRequest,
} = require("../runtime.cjs");
const domainPath = __dirname;

const PROTECTED_COLLECTIONS = ["fixer_settings"];

// Enrichment runs for every record response (list, view, create, update,
// realtime, and expanded records). Hide after e.next() so Monline's default
// enrichment cannot re-enable the field for a privileged request.
onRecordEnrich(
  (e) => {
    e.next();
    e.record.hide("api_key");
  },
  ...PROTECTED_COLLECTIONS,
);

// api_key_configured is derived from the value Monline is about to persist;
// never trust a client-supplied boolean that can drift from the actual secret.
onRecordCreateRequest(
  (e) => {
    e.record.set(
      "api_key_configured",
      String(e.record.get("api_key") || "").trim() !== "",
    );
    e.next();
  },
  ...PROTECTED_COLLECTIONS,
);
onRecordUpdateRequest(
  (e) => {
    e.record.set(
      "api_key_configured",
      String(e.record.get("api_key") || "").trim() !== "",
    );
    e.next();
  },
  ...PROTECTED_COLLECTIONS,
);
