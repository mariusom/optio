const declarationBoundary = new Set(["export", "type", "const", "function", "interface", "import"]);
const opening = new Set(["{", "[", "("]);
const closing = new Set(["}", "]", ")"]);

const skipComment = (source, index, file) => {
  if (source.startsWith("//", index)) {
    const end = source.indexOf("\n", index);
    return end < 0 ? source.length : end;
  }
  const end = source.indexOf("*/", index + 2);
  if (end < 0) throw new Error(`${file}: unterminated block comment`);
  return end + 2;
};

const readString = (source, start, file) => {
  const quote = source[start];
  let raw = "";
  let index = start + 1;
  while (index < source.length && source[index] !== quote) {
    if (source.startsWith(`\\\\${quote}`, index)) {
      raw += quote;
      index += 3;
    } else if (source[index] === "\\") {
      raw += source[index] + (source[index + 1] ?? "");
      index += 2;
    } else raw += source[index++];
  }
  if (index >= source.length) throw new Error(`${file}: unterminated string literal`);
  const value = raw
    .replaceAll(`\\${quote}`, quote)
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll("\\\\", "\\");
  return [{ type: quote === "`" && raw.includes("${") ? "template" : "string", value }, index + 1];
};

const readIdentifier = (source, start) => {
  let index = start + 1;
  while (/[\w$]/.test(source[index] ?? "")) index++;
  return [{ type: "identifier", value: source.slice(start, index) }, index];
};

const tokenize = (source, file) => {
  const result = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) index++;
    else if (source.startsWith("//", index) || source.startsWith("/*", index))
      index = skipComment(source, index, file);
    else if (char === "'" || char === '"' || char === "`") {
      const [token, next] = readString(source, index, file);
      result.push(token);
      index = next;
    } else if (/[A-Za-z_$]/.test(char)) {
      const [token, next] = readIdentifier(source, index);
      result.push(token);
      index = next;
    } else {
      result.push({ type: "punctuation", value: char });
      index++;
    }
  }
  return result;
};

const initializerEnd = (input, start) => {
  let depth = 0;
  let index = start;
  while (index < input.length) {
    const value = input[index].value;
    if (depth === 0 && (value === ";" || (index > start && declarationBoundary.has(value)))) break;
    if (opening.has(value)) depth++;
    if (closing.has(value)) depth--;
    index++;
  }
  return index;
};

const stringPath = (initializer, index, context) => {
  const { name, file } = context;
  if (initializer[index - 1]?.value !== ":") return name;
  const key = initializer[index - 2];
  if (!key || (key.type !== "identifier" && key.type !== "string"))
    throw new Error(`${file}: cannot identify property containing ${name}'s string`);
  return `${name}.${key.value}`;
};

const initializerValues = (initializer, name, file) => {
  const values = [];
  for (let index = 0; index < initializer.length; index++) {
    if (initializer[index].type !== "string" || initializer[index + 1]?.value === ":") continue;
    values.push([stringPath(initializer, index, { name, file }), initializer[index].value]);
  }
  return values;
};

const findInitializer = (input, index, context) => {
  while (index < input.length && input[index].value !== "=") index++;
  if (index >= input.length) throw new Error(`${context.file}: ${context.name} has no initializer`);
  const start = index + 1;
  const end = initializerEnd(input, start);
  return [input.slice(start, end), end];
};

export const declarationStrings = (source, file) => {
  const input = tokenize(source, file);
  const found = new Map();
  for (let index = 0; index < input.length; index++) {
    if (input[index].value !== "const" || input[index + 1]?.type !== "identifier") continue;
    const name = input[index + 1].value;
    if (!/(?:Class|Variants|Sizes|Base)$/.test(name)) continue;
    const [initializer, initializerIndex] = findInitializer(input, index, { name, file });
    index = initializerIndex;
    if (initializer[0]?.type !== "string" && initializer[0]?.value !== "{") continue;
    for (const [path, value] of initializerValues(initializer, name, file)) {
      if (found.has(path)) throw new Error(`${file}: ambiguous style path ${path}`);
      found.set(path, value);
    }
  }
  return found;
};
