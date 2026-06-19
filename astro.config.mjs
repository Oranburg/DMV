import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Deployed at https://oranburg.law/DMV/ (GitHub Pages project path).
export default defineConfig({
  site: "https://oranburg.law",
  base: "/DMV",
  trailingSlash: "ignore",
  integrations: [react()],
});
