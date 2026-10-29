import { x as require_jsx_runtime, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as useCurrentUserState, t as PortalHome } from "./portal-home-DBToIGhf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CANkZuEG.js
var import_jsx_runtime = require_jsx_runtime();
function LoginRoute() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalHome, {});
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalHome, {});
}
//#endregion
export { LoginRoute as component };
