// A cookie rather than SQLite, so the server can resolve it while rendering and avoid a flash.
export const themePreferences = ["system", "light", "dark"] as const

export type ThemePreference = (typeof themePreferences)[number]

export const THEME_COOKIE = "prospector-theme"

export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && themePreferences.some((theme) => theme === value)
}

export function parseThemePreference(value: string | undefined): ThemePreference {
  return isThemePreference(value) ? value : "system"
}

export function themeClassName(preference: ThemePreference): "dark" | undefined {
  return preference === "dark" ? "dark" : undefined
}

// Reads the same cookie the server read, so the two can never disagree.
export const themeResolverScript = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/);
var p=m?decodeURIComponent(m[1]):"system";
var q=window.matchMedia("(prefers-color-scheme: dark)");
var a=function(){document.documentElement.classList.toggle("dark",p==="dark"||(p==="system"&&q.matches))};
a();if(p==="system"&&q.addEventListener)q.addEventListener("change",a);
}catch(e){}})()`
