const BILL_TYPES = ["electricity", "water", "internet", "gas", "mobile"];
function validBillType(value) {
  return value == null || value === "" || BILL_TYPES.includes(value);
}
module.exports = { BILL_TYPES, validBillType };
