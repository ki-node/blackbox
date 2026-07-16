export const RUNTIME_CONTEXTS = ["web", "embedded"] as const;

export type RuntimeContext = (typeof RUNTIME_CONTEXTS)[number];

/**
 * Returns whether a value is a supported compile-time runtime context.
 */
export function isRuntimeContext(value: unknown): value is RuntimeContext {
  return RUNTIME_CONTEXTS.includes(value as RuntimeContext);
}

/**
 * Creates the immutable capability set for a build context.
 */
export function createRuntime(context: RuntimeContext) {
  return Object.freeze({
    context,
    isEmbedded: context === "embedded",
    isWeb: context === "web",
    allowsFullscreen: context === "web",
    supportsPwa: context === "web",
  });
}

const buildContext =
  typeof __BLACKBOX_RUNTIME_CONTEXT__ === "string" &&
  isRuntimeContext(__BLACKBOX_RUNTIME_CONTEXT__)
    ? __BLACKBOX_RUNTIME_CONTEXT__
    : "web";

export const runtime = createRuntime(buildContext);
