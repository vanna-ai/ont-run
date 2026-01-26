// ============================================================================
// Template Exports
// ============================================================================

export { configTemplate, buildTemplate, bunfigTemplate, tsconfigTemplate } from "./config.js";
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
export { healthCheckResolver, getUserResolver, deleteUserResolver } from "./resolvers.js";
export { skillTemplate } from "./skills.js";
export { gitignoreTemplate } from "./gitignore.js";

// Chat templates
export {
  authSessionTemplate,
  authRoutesTemplate,
  mcpClientTemplate,
  chatHandlerTemplate,
  chatTypesTemplate,
  authContextTemplate,
  chatContextTemplate,
  loginScreenTemplate,
  floatingChatTemplate,
} from "./chat.js";
