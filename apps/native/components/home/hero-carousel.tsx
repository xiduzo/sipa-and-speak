import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from "react-native";

import { needsAction, type HomeState } from "./home-state";
import { GOLD } from "./tokens";

type Props = {
  heros: HomeState[];
  renderHero: (state: HomeState) => React.ReactNode;
};

const DOT_SIZE = 6;
const DOT_GAP = 6;

export function HeroCarousel({ heros, renderHero }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<HomeState>>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width === 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [width, index],
  );

  const jumpTo = useCallback(
    (i: number) => {
      if (width === 0) return;
      listRef.current?.scrollToOffset({ offset: i * width, animated: true });
      setIndex(i);
    },
    [width],
  );

  if (heros.length === 0) return null;
  if (heros.length === 1) {
    return <View testID="hero-carousel">{renderHero(heros[0]!)}</View>;
  }

  return (
    <View testID="hero-carousel" onLayout={handleLayout}>
      {width > 0 && (
        <FlatList
          ref={listRef}
          data={heros}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={heroKey}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={{ width }}>{renderHero(item)}</View>
          )}
        />
      )}
      <View
        testID="hero-carousel-dots"
        className="flex-row items-center justify-center mt-3"
        style={{ gap: DOT_GAP }}
      >
        {heros.map((state, i) => {
          const active = i === index;
          const action = i !== index && needsAction(state);
          return (
            <Pressable
              key={heroKey(state, i)}
              testID={
                action
                  ? `hero-carousel-dot-action-${i}`
                  : `hero-carousel-dot-${i}`
              }
              onPress={() => jumpTo(i)}
              hitSlop={8}
              style={{
                width: active ? DOT_SIZE * 2 : DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: active
                  ? GOLD
                  : action
                    ? GOLD
                    : "rgba(0,0,0,0.18)",
                opacity: active ? 1 : action ? 0.85 : 1,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function heroKey(state: HomeState, fallback?: number): string {
  switch (state.kind) {
    case "post":
      return `post-${state.meetup.meetupId}`;
    case "confirmed":
      return `confirmed-${state.meetup.meetupId}`;
    case "waiting":
      return `waiting-${state.proposal.id}`;
    case "matchfound":
      return `match-${state.match.matchId}`;
    case "nomeetup":
      return `nomeetup-${fallback ?? 0}`;
  }
}
