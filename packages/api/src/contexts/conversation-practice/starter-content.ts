/**
 * Hand-curated conversation-starter content (Task #404, Feature #378, Epic #375).
 *
 * Static, version-controlled content — no database table, no migration. Each
 * selectable language carries at least 30 basic, conversational question cards.
 * Every card has `text` in that language and a non-empty English `translation`
 * (for English, `translation === text`). Card order is stable: it is the source
 * array order, which never changes between requests.
 */

export interface StarterCard {
  /** Stable, unique id (language-prefixed, e.g. "nl-001"). */
  id: string;
  /** Question text in the card's language. */
  text: string;
  /** English translation; non-empty (equals `text` for English). */
  translation: string;
}

/**
 * The 30 basic conversation-starter questions, in English. Every other curated
 * language is a translation of this same ordered set, so the deck position
 * indicator lines up across languages.
 */
const ENGLISH_STARTERS: readonly string[] = [
  "How are you today?",
  "What is your name?",
  "Where are you from?",
  "What do you do for work?",
  "What did you do this weekend?",
  "Do you have any brothers or sisters?",
  "What is your favourite food?",
  "Do you like coffee or tea?",
  "What music do you like?",
  "What is your favourite film?",
  "Do you have any pets?",
  "What do you like to do in your free time?",
  "Have you travelled anywhere nice recently?",
  "What is your favourite season?",
  "Do you prefer the city or the countryside?",
  "What languages do you speak?",
  "Why are you learning this language?",
  "What is the weather like today?",
  "What time do you usually wake up?",
  "Do you play any sports?",
  "What did you have for breakfast?",
  "What is your favourite book?",
  "Do you like to cook?",
  "What is your dream holiday?",
  "What makes you happy?",
  "Do you have any plans for the weekend?",
  "What is your favourite place in this city?",
  "How do you usually get to work?",
  "What is something new you learned recently?",
  "What are you looking forward to this week?",
];

/** Localised question text, in the exact same order as `ENGLISH_STARTERS`. */
const TRANSLATIONS: Record<string, readonly string[]> = {
  English: ENGLISH_STARTERS,
  Dutch: [
    "Hoe gaat het vandaag met je?",
    "Wat is je naam?",
    "Waar kom je vandaan?",
    "Wat voor werk doe je?",
    "Wat heb je dit weekend gedaan?",
    "Heb je broers of zussen?",
    "Wat is je lievelingseten?",
    "Hou je van koffie of thee?",
    "Naar welke muziek luister je graag?",
    "Wat is je favoriete film?",
    "Heb je huisdieren?",
    "Wat doe je graag in je vrije tijd?",
    "Ben je onlangs ergens leuks geweest?",
    "Wat is je favoriete seizoen?",
    "Hou je meer van de stad of het platteland?",
    "Welke talen spreek je?",
    "Waarom leer je deze taal?",
    "Wat voor weer is het vandaag?",
    "Hoe laat sta je meestal op?",
    "Doe je aan sport?",
    "Wat heb je als ontbijt gegeten?",
    "Wat is je favoriete boek?",
    "Hou je van koken?",
    "Wat is je droomvakantie?",
    "Waar word je blij van?",
    "Heb je plannen voor het weekend?",
    "Wat is je favoriete plek in deze stad?",
    "Hoe ga je meestal naar je werk?",
    "Wat heb je onlangs nieuws geleerd?",
    "Waar kijk je deze week naar uit?",
  ],
  Spanish: [
    "¿Cómo estás hoy?",
    "¿Cómo te llamas?",
    "¿De dónde eres?",
    "¿A qué te dedicas?",
    "¿Qué hiciste este fin de semana?",
    "¿Tienes hermanos o hermanas?",
    "¿Cuál es tu comida favorita?",
    "¿Prefieres el café o el té?",
    "¿Qué música te gusta?",
    "¿Cuál es tu película favorita?",
    "¿Tienes mascotas?",
    "¿Qué te gusta hacer en tu tiempo libre?",
    "¿Has viajado a algún lugar bonito últimamente?",
    "¿Cuál es tu estación favorita?",
    "¿Prefieres la ciudad o el campo?",
    "¿Qué idiomas hablas?",
    "¿Por qué estás aprendiendo este idioma?",
    "¿Qué tiempo hace hoy?",
    "¿A qué hora te levantas normalmente?",
    "¿Practicas algún deporte?",
    "¿Qué desayunaste?",
    "¿Cuál es tu libro favorito?",
    "¿Te gusta cocinar?",
    "¿Cuáles son tus vacaciones soñadas?",
    "¿Qué te hace feliz?",
    "¿Tienes planes para el fin de semana?",
    "¿Cuál es tu lugar favorito de esta ciudad?",
    "¿Cómo vas normalmente al trabajo?",
    "¿Qué has aprendido de nuevo últimamente?",
    "¿Qué esperas con ganas esta semana?",
  ],
  German: [
    "Wie geht es dir heute?",
    "Wie heißt du?",
    "Woher kommst du?",
    "Was machst du beruflich?",
    "Was hast du dieses Wochenende gemacht?",
    "Hast du Geschwister?",
    "Was ist dein Lieblingsessen?",
    "Magst du lieber Kaffee oder Tee?",
    "Welche Musik magst du?",
    "Was ist dein Lieblingsfilm?",
    "Hast du Haustiere?",
    "Was machst du gern in deiner Freizeit?",
    "Warst du in letzter Zeit irgendwo Schönes?",
    "Was ist deine Lieblingsjahreszeit?",
    "Magst du lieber die Stadt oder das Land?",
    "Welche Sprachen sprichst du?",
    "Warum lernst du diese Sprache?",
    "Wie ist das Wetter heute?",
    "Wann stehst du normalerweise auf?",
    "Treibst du Sport?",
    "Was hast du zum Frühstück gegessen?",
    "Was ist dein Lieblingsbuch?",
    "Kochst du gern?",
    "Was ist dein Traumurlaub?",
    "Was macht dich glücklich?",
    "Hast du Pläne für das Wochenende?",
    "Was ist dein Lieblingsort in dieser Stadt?",
    "Wie kommst du normalerweise zur Arbeit?",
    "Was hast du in letzter Zeit Neues gelernt?",
    "Worauf freust du dich diese Woche?",
  ],
  French: [
    "Comment vas-tu aujourd'hui ?",
    "Comment t'appelles-tu ?",
    "D'où viens-tu ?",
    "Que fais-tu dans la vie ?",
    "Qu'as-tu fait ce week-end ?",
    "As-tu des frères ou des sœurs ?",
    "Quel est ton plat préféré ?",
    "Préfères-tu le café ou le thé ?",
    "Quelle musique aimes-tu ?",
    "Quel est ton film préféré ?",
    "As-tu des animaux de compagnie ?",
    "Qu'aimes-tu faire pendant ton temps libre ?",
    "As-tu voyagé quelque part de joli récemment ?",
    "Quelle est ta saison préférée ?",
    "Préfères-tu la ville ou la campagne ?",
    "Quelles langues parles-tu ?",
    "Pourquoi apprends-tu cette langue ?",
    "Quel temps fait-il aujourd'hui ?",
    "À quelle heure te lèves-tu d'habitude ?",
    "Pratiques-tu un sport ?",
    "Qu'as-tu mangé au petit-déjeuner ?",
    "Quel est ton livre préféré ?",
    "Aimes-tu cuisiner ?",
    "Quelles sont tes vacances de rêve ?",
    "Qu'est-ce qui te rend heureux ?",
    "As-tu des projets pour le week-end ?",
    "Quel est ton endroit préféré dans cette ville ?",
    "Comment vas-tu au travail d'habitude ?",
    "Qu'as-tu appris de nouveau récemment ?",
    "Qu'attends-tu avec impatience cette semaine ?",
  ],
};

/** Two-letter id prefix per curated language, matching `language-flags` codes. */
const ID_PREFIX: Record<string, string> = {
  English: "en",
  Dutch: "nl",
  Spanish: "es",
  German: "de",
  French: "fr",
};

function buildCards(language: string): StarterCard[] {
  const texts = TRANSLATIONS[language];
  if (!texts) return [];
  const prefix = ID_PREFIX[language] ?? language.slice(0, 2).toLowerCase();
  return texts.map((text, index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    text,
    translation: ENGLISH_STARTERS[index] ?? text,
  }));
}

/**
 * Curated cards keyed by language. Built once at module load so the array
 * identity — and therefore the order — is stable across every request.
 */
export const STARTER_CARDS: Readonly<Record<string, readonly StarterCard[]>> =
  Object.fromEntries(
    Object.keys(TRANSLATIONS).map((language) => [language, buildCards(language)]),
  );

/** Languages that currently have curated content. */
export const CURATED_LANGUAGES: readonly string[] = Object.keys(STARTER_CARDS);

/**
 * Ordered curated cards for a language, or an empty array when the language has
 * no curated content yet (so the deck can show a "no cards yet" state).
 */
export function getStartersForLanguage(language: string): readonly StarterCard[] {
  return STARTER_CARDS[language] ?? [];
}
