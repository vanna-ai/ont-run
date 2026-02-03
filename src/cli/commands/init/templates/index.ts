// ============================================================================
// Template Exports
// ============================================================================

// TypeScript backend templates (legacy)
export { configTemplate, buildTemplate, tsconfigTemplate } from "./config.js";
export { serverTemplate, htmlTemplate } from "./server.js";
export { cssTemplate } from "./css.js";
export { frontendTemplate, appTemplate } from "./app.js";
export {
  layoutTemplate,
  vannaButtonTemplate,
  vannaCardTemplate,
  statsCardTemplate,
} from "./components.js";
export { homeRouteTemplate, dashboardRouteTemplate, aboutRouteTemplate } from "./routes.js";
export { healthCheckResolver, getUserResolver, deleteUserResolver, getSalesDataResolver } from "./resolvers.js";
export { skillTemplate } from "./skills.js";
export { gitignoreTemplate } from "./gitignore.js";
export { generateSdkScriptTemplate, readmeSdkSectionTemplate } from "./scripts.js";

// Go backend templates
export {
  goModTemplate,
  goMainTemplate,
  goOntologyConfigTemplate,
  goHealthCheckResolverTemplate,
  goGetUserResolverTemplate,
  goDeleteUserResolverTemplate,
  goGetSalesDataResolverTemplate,
  airTomlTemplate,
  goRootPackageJsonTemplate,
  goFrontendPackageJsonTemplate,
  goGitignoreTemplate,
  goReadmeTemplate,
  goViteConfigTemplate,
  goTsconfigTemplate,
  goIndexHtmlTemplate,
  goMainTsxTemplate,
  goIndexCssTemplate,
  goSkillTemplate,
} from "./go/index.js";
