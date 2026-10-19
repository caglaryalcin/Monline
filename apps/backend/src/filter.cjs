// A small, parameterized expression parser. Neither identifiers nor values from
// API queries are interpolated into SQL without validation.
const { BadRequestError } = require("./errors.cjs");
function compileFilter(input, fields, bindings = {}) {
  if (input == null || input === "" || input === "1=1")
    return { sql: "1=1", values: [] };
  if (typeof input !== "string" || input.length > 8192)
    throw new BadRequestError("Filter too complex");
  const tokens = [];
  let offset = 0;
  // Quoted literals are scanned separately; escaped quotes never trigger regex backtracking.
  const pattern =
    /(\{:\w+\}|&&|\|\||!=|>=|<=|[=~><()]|-?\d+(?:\.\d+)?|[A-Za-z_]\w*)/y;
  while (offset < input.length) {
    while (offset < input.length && /\s/.test(input[offset])) offset++;
    if (offset === input.length) break;
    const quote = input[offset];
    if (quote === '"' || quote === "'") {
      const start = offset++;
      let closed = false;
      while (offset < input.length) {
        const character = input[offset++];
        if (character === "\\") {
          if (offset === input.length) break;
          offset++;
        } else if (character === quote) {
          closed = true;
          break;
        }
      }
      if (!closed) throw new BadRequestError("Invalid filter");
      tokens.push(input.slice(start, offset));
    } else {
      pattern.lastIndex = offset;
      const match = pattern.exec(input);
      if (!match) throw new BadRequestError("Invalid filter");
      tokens.push(match[1]);
      offset = pattern.lastIndex;
    }
    if (tokens.length > 250) throw new BadRequestError("Filter too complex");
  }
  if (!tokens.length) return { sql: "1=1", values: [] };
  let cursor = 0;
  const values = [];
  const literal = () => {
    const token = tokens[cursor++];
    let value;
    if (!token) throw new BadRequestError("Invalid filter value");
    if (token.startsWith("{:")) {
      const key = token.slice(2, -1);
      if (!Object.hasOwn(bindings, key))
        throw new BadRequestError("Missing filter value");
      value = bindings[key];
    } else if (/^["']/.test(token)) {
      value = token.slice(1, -1).replace(/\\([\\"'])/g, "$1");
    } else if (token === "true" || token === "false")
      value = token === "true" ? 1 : 0;
    else if (token === "null") value = null;
    else if (/^-?\d/.test(token)) value = Number(token);
    else throw new BadRequestError("Invalid filter value");
    values.push(typeof value === "boolean" ? Number(value) : value);
    return "?";
  };
  const atom = () => {
    if (tokens[cursor] === "(") {
      cursor++;
      const sql = or();
      if (tokens[cursor++] !== ")") throw new BadRequestError("Invalid filter");
      return "(" + sql + ")";
    }
    const name = tokens[cursor++];
    if (!fields.has(name)) throw new BadRequestError("Unknown filter field");
    const operator = tokens[cursor++];
    if (!["=", "!=", ">", "<", ">=", "<=", "~"].includes(operator))
      throw new BadRequestError("Invalid filter operator");
    const slot = literal();
    if (operator === "~") {
      values[values.length - 1] =
        "%" +
        String(values[values.length - 1]).replace(/[\\%_]/g, "\\$&") +
        "%";
      return '"' + name + "\" LIKE ? ESCAPE '\\'";
    }
    if (values[values.length - 1] === null && ["=", "!="].includes(operator))
      return '"' + name + '" IS ' + (operator === "!=" ? "NOT " : "") + slot;
    return '"' + name + '" ' + operator + " " + slot;
  };
  const and = () => {
    let sql = atom();
    while (tokens[cursor] === "&&") {
      cursor++;
      sql += " AND " + atom();
    }
    return sql;
  };
  const or = () => {
    let sql = and();
    while (tokens[cursor] === "||") {
      cursor++;
      sql += " OR " + and();
    }
    return sql;
  };
  const sql = or();
  if (cursor !== tokens.length) throw new BadRequestError("Invalid filter");
  return { sql, values };
}
function compileSort(input, fields) {
  if (!input) return "";
  return (
    " ORDER BY " +
    input
      .split(",")
      .map((part) => {
        const value = part.trim(),
          name = value.replace(/^[-+]/, "");
        if (!fields.has(name)) throw new BadRequestError("Unknown sort field");
        return '"' + name + '" ' + (value.startsWith("-") ? "DESC" : "ASC");
      })
      .join(", ")
  );
}
module.exports = { compileFilter, compileSort };
