// src/i18n/request.ts — locale resolution (cookie-based, no URL routing)
import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

export default getRequestConfig(async () => {
  const locale = cookies().get("fs_locale")?.value === "es" ? "es" : "en"
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Incremental-migration safety: untranslated keys render as their English source
    onError: () => {},
    getMessageFallback: ({ key }) => key,
  }
})
