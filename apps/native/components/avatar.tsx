import { Image, Text, View } from "react-native";

import {
  avatarTone,
  firstInitial,
  initials,
} from "@/utils/profile-presentation";

export type AvatarProps = {
  name: string;
  image: string | null;
  size: number;
  /** Initials font size. */
  fontSize?: number;
  /** Render a single leading initial instead of first+last. */
  single?: boolean;
  /**
   * Background of the circle. Defaults to `avatarTone(name)`; pass an explicit
   * color for screens with a fixed palette, or null to defer to `className`.
   */
  tone?: string | null;
  /** Initials text color. Omitted → inherit the default text color. */
  color?: string;
  letterSpacing?: number;
  /** Applied to the circle (e.g. 0.85 for locked chats). */
  opacity?: number;
  /** Extra classes for the circle (e.g. "bg-muted" together with tone={null}). */
  className?: string;
  /** Classes for the initials text. Defaults to "font-jakarta". */
  textClassName?: string;
  imageTestID?: string;
  placeholderTestID?: string;
};

/**
 * The one avatar: a toned circle showing the photo when present, otherwise
 * the person's initials. Sizing/palette differences between screens are
 * parameterized — the tone/initials derivation lives in
 * `utils/profile-presentation.ts`.
 */
export function Avatar({
  name,
  image,
  size,
  fontSize,
  single,
  tone,
  color,
  letterSpacing,
  opacity,
  className,
  textClassName,
  imageTestID,
  placeholderTestID,
}: AvatarProps) {
  const backgroundColor = tone === null ? undefined : (tone ?? avatarTone(name));
  return (
    <View
      testID={image ? undefined : placeholderTestID}
      className={`items-center justify-center rounded-full ${className ?? ""}`}
      style={{ width: size, height: size, backgroundColor, opacity }}
    >
      {image ? (
        <Image
          testID={imageTestID}
          source={{ uri: image }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          className={textClassName ?? "font-jakarta"}
          style={{ fontSize, color, letterSpacing }}
        >
          {single ? firstInitial(name) : initials(name)}
        </Text>
      )}
    </View>
  );
}
