// Shared language → flag emoji + 2-letter code lookup.

const LANGUAGE_FLAGS: Record<string, string> = {
  Afrikaans: "🇿🇦", Albanian: "🇦🇱", Arabic: "🇸🇦", Armenian: "🇦🇲",
  Azerbaijani: "🇦🇿", Bengali: "🇧🇩", Bulgarian: "🇧🇬", Catalan: "🇪🇸",
  Chinese: "🇨🇳", Croatian: "🇭🇷", Czech: "🇨🇿", Danish: "🇩🇰",
  Dutch: "🇳🇱", English: "🇬🇧", Estonian: "🇪🇪", Finnish: "🇫🇮",
  French: "🇫🇷", Georgian: "🇬🇪", German: "🇩🇪", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Hindi: "🇮🇳", Hungarian: "🇭🇺", Icelandic: "🇮🇸",
  Indonesian: "🇮🇩", Italian: "🇮🇹", Japanese: "🇯🇵", Kazakh: "🇰🇿",
  Korean: "🇰🇷", Latvian: "🇱🇻", Lithuanian: "🇱🇹", Macedonian: "🇲🇰",
  Malay: "🇲🇾", Maltese: "🇲🇹", Norwegian: "🇳🇴", Persian: "🇮🇷",
  Polish: "🇵🇱", Portuguese: "🇵🇹", Romanian: "🇷🇴", Russian: "🇷🇺",
  Serbian: "🇷🇸", Slovak: "🇸🇰", Slovenian: "🇸🇮", Spanish: "🇪🇸",
  Swedish: "🇸🇪", Thai: "🇹🇭", Turkish: "🇹🇷", Ukrainian: "🇺🇦",
  Urdu: "🇵🇰", Vietnamese: "🇻🇳", Welsh: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

const LANGUAGE_CODES: Record<string, string> = {
  Afrikaans: "AF", Albanian: "AL", Arabic: "AR", Armenian: "AM",
  Azerbaijani: "AZ", Bengali: "BN", Bulgarian: "BG", Catalan: "CA",
  Chinese: "ZH", Croatian: "HR", Czech: "CS", Danish: "DA",
  Dutch: "NL", English: "EN", Estonian: "ET", Finnish: "FI",
  French: "FR", Georgian: "KA", German: "DE", Greek: "EL",
  Hebrew: "HE", Hindi: "HI", Hungarian: "HU", Icelandic: "IS",
  Indonesian: "ID", Italian: "IT", Japanese: "JA", Kazakh: "KK",
  Korean: "KO", Latvian: "LV", Lithuanian: "LT", Macedonian: "MK",
  Malay: "MS", Maltese: "MT", Norwegian: "NO", Persian: "FA",
  Polish: "PL", Portuguese: "PT", Romanian: "RO", Russian: "RU",
  Serbian: "SR", Slovak: "SK", Slovenian: "SL", Spanish: "ES",
  Swedish: "SV", Thai: "TH", Turkish: "TR", Ukrainian: "UK",
  Urdu: "UR", Vietnamese: "VI",
};

const LANGUAGE_NATIVE_NAME: Record<string, string> = {
  Dutch: "Nederlands",
  English: "English",
  Italian: "Italiano",
  Spanish: "Español",
  French: "Français",
  German: "Deutsch",
  Portuguese: "Português",
  Polish: "Polski",
  Russian: "Русский",
  Chinese: "中文",
  Japanese: "日本語",
  Korean: "한국어",
  Arabic: "العربية",
  Turkish: "Türkçe",
  Greek: "Ελληνικά",
  Swedish: "Svenska",
  Norwegian: "Norsk",
  Danish: "Dansk",
  Finnish: "Suomi",
  Czech: "Čeština",
  Hungarian: "Magyar",
  Romanian: "Română",
  Ukrainian: "Українська",
  Hebrew: "עברית",
  Hindi: "हिन्दी",
  Vietnamese: "Tiếng Việt",
  Thai: "ไทย",
  Indonesian: "Bahasa Indonesia",
};

export function getLanguageFlag(language: string, fallback = "🏳️"): string {
  return LANGUAGE_FLAGS[language] ?? fallback;
}

export function getLanguageCode(language: string): string {
  return LANGUAGE_CODES[language] ?? language.slice(0, 2).toUpperCase();
}

export function getNativeName(language: string): string {
  return LANGUAGE_NATIVE_NAME[language] ?? language;
}
