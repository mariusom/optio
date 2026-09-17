const customTokens = (localValue, novaValue) => {
  const novaTokens = new Set(novaValue.split(/\s+/));
  return localValue
    .split(/\s+/)
    .filter((token) => !novaTokens.has(token) && !token.startsWith("rounded-"));
};

const resolveOutput = (resolved, localValue, novaValue) =>
  `${resolved} ${customTokens(localValue, novaValue).join(" ")}`.trim();

const assignOutput = (target, entry, context) => {
  const { style, value, output, path } = entry;
  const previousOutput = target.table[style][value];
  if (previousOutput !== undefined && previousOutput !== output) {
    const owner = context.duplicateOwners.get(value);
    const previousPath = target.owners[style][value];
    if (owner === previousPath) return;
    if (owner !== path)
      throw new Error(
        `${context.component}: ${path} conflicts with ${previousPath} in ${style}: ${value}`,
      );
  }
  target.table[style][value] = output;
  target.owners[style][value] = path;
};

const transformPath = (target, localEntry, context) => {
  const [path, value] = localEntry;
  const nova = context.sources.nova.get(path);
  if (nova === undefined)
    throw new Error(`${context.localFile}: ${path} is absent from the nova registry`);
  for (const style of context.styles) {
    const resolved = context.sources[style].get(path);
    if (resolved === undefined)
      throw new Error(`${context.component}: ${path} is absent from the ${style} registry`);
    if (style === "nova") continue;
    const output = resolveOutput(resolved, value, nova);
    if (output !== value) assignOutput(target, { style, value, output, path }, context);
  }
};

export const createRegistry = (styles) => ({
  table: Object.fromEntries(styles.map((style) => [style, {}])),
  owners: Object.fromEntries(styles.map((style) => [style, {}])),
  matched: 0,
});

export const addComponent = (target, local, context) => {
  const transformContext = { ...context };
  for (const entry of local) transformPath(target, entry, transformContext);
  target.matched += local.size;
};
