//#region node_modules/.nitro/vite/services/ssr/assets/access-BgTZ6yz7.js
var ADMIN_EMAIL = "dataongole@gmail.com";
function normalizeEmail(email) {
	return email.trim().toLowerCase();
}
/** Student IDs are the mailbox name, e.g. o234747 from o234747@rguktong.ac.in. */
function studentIdFromEmail(email) {
	return normalizeEmail(email).split("@")[0] ?? "";
}
function roleForEmail(email) {
	const e = normalizeEmail(email);
	if (!e || e.includes(" ") || !e.includes("@")) return null;
	if (e === "dataongole@gmail.com") return "admin";
	const [local, domain, ...rest] = e.split("@");
	if (!local || rest.length > 0 || domain !== "rguktong.ac.in") return null;
	if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(local)) return null;
	return "student";
}
//#endregion
export { studentIdFromEmail as i, normalizeEmail as n, roleForEmail as r, ADMIN_EMAIL as t };
