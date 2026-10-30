const key = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function validate(input) {
  const { merchant_name, provider_name, domain } = input;
  const row_id = input.row_id || "";
  const start_month = input.start_month || "";
  const scope = input.scope || "";
  const updated_at = input.updated_at || "";
  if (typeof row_id !== "string" || (row_id && !/^[a-z0-9]{15}$/.test(row_id)) ||
    typeof start_month !== "string" || !["", "from", "month", "year"].includes(scope) ||
    (scope === "year" && !start_month.endsWith("-01")) ||
    typeof updated_at !== "string" || (updated_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updated_at)) ||
    (scope ? !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(start_month) : !!start_month || !!row_id))
    throw new Error("merchant_logo_invalid");
  if (
    typeof merchant_name !== "string" ||
    !merchant_name.trim() ||
    merchant_name.length > 250 ||
    !key(merchant_name) ||
    typeof provider_name !== "string" ||
    !provider_name.trim() ||
    provider_name.length > 160 ||
    typeof domain !== "string" ||
    domain.length > 253
  )
    throw new Error("merchant_logo_invalid");
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) ||
    /\.(local|lan|internal|localhost|test|invalid|example|home|arpa)$/.test(
      host,
    )
  )
    throw new Error("merchant_logo_invalid");
  return {
    merchant_key: key(merchant_name),
    merchant_name: merchant_name.trim(),
    provider_name: provider_name.trim(),
    domain: host,
    row_id,
    start_month,
    scope,
    updated_at,
  };
}
module.exports = { key, validate };
