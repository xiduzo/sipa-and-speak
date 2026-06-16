import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { trpc } from "@/utils/trpc";

type CardDeckProps = {
  /** The active card language to browse cards in (from the #403 picker). */
  language: string;
};

/**
 * Lets a buddy flip through the curated conversation-starter cards for the
 * active language, one card at a time.
 *
 * Cards come from `content.starters.listByLanguage` (#404). The current
 * position is held in screen-local `useState`, clamped to
 * `[0, cards.length - 1]`, with no wrap-around — mirroring the index-based
 * stepper in `apps/native/app/match.tsx`. Switching language remounts a fresh
 * deck (the parent keys this component by language), so the index always
 * starts back at the first card.
 */
export function CardDeck({ language }: CardDeckProps) {
  const cardsQuery = useQuery(
    trpc.content.starters.listByLanguage.queryOptions({ language }),
  );

  if (cardsQuery.isPending) {
    return <DeckLoading />;
  }

  if (cardsQuery.isError) {
    return <DeckError />;
  }

  const cards = cardsQuery.data?.cards ?? [];

  if (cards.length === 0) {
    return <DeckEmpty language={language} />;
  }

  return <DeckBrowser cards={cards} language={language} />;
}

type Card = { id: string; text: string; translation: string };

function DeckBrowser({
  cards,
  language,
}: {
  cards: Card[];
  language: string;
}) {
  const [index, setIndex] = useState(0);
  const lastIndex = cards.length - 1;

  // Defensive reset: if the same mounted deck ever receives a shorter card set
  // for a new language, keep the index inside bounds and back at the start.
  useEffect(() => {
    setIndex(0);
  }, [language]);

  const safeIndex = Math.min(index, lastIndex);
  const current = cards[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === lastIndex;

  // Per-card reveal: tapping flips between the chosen-language `text` and the
  // English `translation`. Reset to the chosen language whenever the active
  // card changes so the reveal never leaks across Next/Previous.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
  }, [safeIndex, language]);

  // When the chosen language is English there is nothing to translate — the
  // card already carries identical `text`/`translation`. Hide the affordance
  // and make tapping a no-op so the card never looks broken.
  const canTranslate = current.translation !== current.text;
  const showTranslation = canTranslate && revealed;

  function toggleReveal() {
    if (!canTranslate) return;
    setRevealed((r) => !r);
  }

  return (
    <View testID="card-deck" className="w-full items-center">
      <Pressable
        testID="card-deck-card"
        accessibilityRole="button"
        accessibilityLabel={
          canTranslate
            ? showTranslation
              ? "Card, showing English translation. Tap to show the original."
              : "Card. Tap to reveal the English translation."
            : undefined
        }
        accessibilityState={{ expanded: canTranslate ? showTranslation : false }}
        disabled={!canTranslate}
        onPress={toggleReveal}
        className="w-full items-center justify-center rounded-3xl bg-muted px-6 py-12"
      >
        <Text
          testID="card-deck-text"
          className="text-center text-2xl font-semibold text-foreground"
        >
          {showTranslation ? current.translation : current.text}
        </Text>

        {canTranslate ? (
          <Text
            testID="card-deck-translation-hint"
            className="mt-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {showTranslation ? "Tap to show original" : "Tap to translate"}
          </Text>
        ) : null}
      </Pressable>

      <Text
        testID="card-deck-position"
        className="mt-4 text-center text-sm text-muted-foreground"
      >
        {`${safeIndex + 1} / ${cards.length}`}
      </Text>

      <View className="mt-6 w-full flex-row justify-between gap-3">
        <StepperButton
          testID="card-deck-previous"
          label="Previous"
          disabled={isFirst}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
        />
        <StepperButton
          testID="card-deck-next"
          label="Next"
          disabled={isLast}
          onPress={() => setIndex((i) => Math.min(lastIndex, i + 1))}
        />
      </View>
    </View>
  );
}

function StepperButton({
  testID,
  label,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-1 rounded-full px-6 py-3 ${
        disabled ? "bg-muted" : "bg-primary"
      }`}
    >
      <Text
        className={`text-center text-sm font-semibold ${
          disabled ? "text-muted-foreground" : "text-primary-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DeckLoading() {
  return (
    <Text
      testID="card-deck-loading"
      className="text-center text-sm text-muted-foreground"
    >
      Loading cards…
    </Text>
  );
}

function DeckError() {
  return (
    <View testID="card-deck-error" className="items-center">
      <Text className="text-center text-lg font-semibold text-foreground">
        Couldn't load cards
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        Something went wrong loading your conversation starters. Please try
        again.
      </Text>
    </View>
  );
}

function DeckEmpty({ language }: { language: string }) {
  return (
    <View testID="card-deck-empty" className="items-center">
      <Text className="text-center text-lg font-semibold text-foreground">
        No cards yet
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        We don't have conversation starters for {language} yet. Check back soon.
      </Text>
    </View>
  );
}
