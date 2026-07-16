import { defineConfig, type Plugin } from "vite";
import type { RuntimeContext } from "./src/runtime";

function runtimeHtml(context: RuntimeContext): Plugin {
  return {
    name: "blackbox-runtime-html",
    transformIndexHtml(html) {
      let output = html.replace(
        '<html lang="de">',
        `<html lang="de" data-runtime-context="${context}">`,
      );
      if (context === "web") return output;

      output = output
        .replace(/\s*<meta\s+[^>]*name="mobile-web-app-capable"[^>]*>/g, "")
        .replace(
          /\s*<meta\s+[^>]*name="apple-mobile-web-app-capable"[^>]*>/g,
          "",
        )
        .replace(
          /\s*<meta\s+[^>]*name="apple-mobile-web-app-status-bar-style"[^>]*>/g,
          "",
        )
        .replace(/\s*<meta\s+[^>]*name="apple-mobile-web-app-title"[^>]*>/g, "")
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, "")
        .replace(/\s*<link rel="manifest"[^>]*>/g, "")
        .replace(
          /\s*<button class="utility-button" type="button" data-install>[\s\S]*?<\/button>/,
          "",
        )
        .replace(/\s*<a class="wordmark"[\s\S]*?<\/a>/, "")
        .replace(/\s*<dialog\s+class="install-dialog"[\s\S]*?<\/dialog>/, "");
      return output;
    },
  };
}

export default defineConfig(({ mode }) => {
  const context: RuntimeContext = mode === "embedded" ? "embedded" : "web";

  return {
    base: context === "embedded" ? "./" : "/blackbox/",
    publicDir: context === "embedded" ? false : "public",
    plugins: [runtimeHtml(context)],
    define: {
      __BLACKBOX_RUNTIME_CONTEXT__: JSON.stringify(context),
    },
    build: {
      outDir: context === "embedded" ? "dist-embedded" : "dist",
      emptyOutDir: true,
    },
  };
});
