/**
 * Tests for task #403 — the card-language picker inside the Conversation
 * Starters screen. These cover the picker component in isolation:
 *   - shows only the buddy's profile languages (not the full catalogue)
 *   - de-duplicates a language present in both spoken + learning
 *   - shows flag + native name per option
 *   - announces the active option as selected (accessibility)
 *   - reports the chosen language on press
 *
 * Screen-level scenarios (auto-select, collapse, persistence, deck reveal)
 * live in conversation-starters-picker.test.tsx.
 */
import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";

import {
  CardLanguagePicker,
  dedupeLanguages,
  type ProfileLanguage,
} from "../components/conversation-starters/card-language-picker";

jest.mock("@/components/container", () => {
  const { View } = require("react-native");
  return {
    Container: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

describe("#403 — dedupeLanguages", () => {
  it("returns the union of spoken + learning with each language once", () => {
    const languages: ProfileLanguage[] = [
      { language: "Dutch", type: "spoken" },
      { language: "Dutch", type: "learning" },
      { language: "Spanish", type: "learning" },
    ];
    expect(dedupeLanguages(languages)).toEqual(["Dutch", "Spanish"]);
  });

  it("preserves first-occurrence order", () => {
    const languages: ProfileLanguage[] = [
      { language: "Spanish", type: "spoken" },
      { language: "Dutch", type: "learning" },
    ];
    expect(dedupeLanguages(languages)).toEqual(["Spanish", "Dutch"]);
  });
});

describe("#403 — CardLanguagePicker", () => {
  describe("Scenario: Picker shows only profile languages", () => {
    it("offers only the buddy's languages, each with flag and native name", () => {
      render(
        <CardLanguagePicker
          languages={[
            { language: "Dutch", type: "learning" },
            { language: "Spanish", type: "spoken" },
          ]}
          activeLanguage={null}
          onSelect={jest.fn()}
        />,
      );

      // Only the two profile languages are offered.
      expect(screen.getByTestId("card-language-option-Dutch")).toBeTruthy();
      expect(screen.getByTestId("card-language-option-Spanish")).toBeTruthy();
      // A language NOT on the profile is never shown (full catalogue excluded).
      expect(
        screen.queryByTestId("card-language-option-French"),
      ).toBeNull();

      // Each shows its flag + native name.
      expect(screen.getByText("🇳🇱")).toBeTruthy();
      expect(screen.getByText("Nederlands")).toBeTruthy();
      expect(screen.getByText("🇪🇸")).toBeTruthy();
      expect(screen.getByText("Español")).toBeTruthy();
    });
  });

  describe("Scenario: Duplicate across spoken and learning is shown once", () => {
    it("renders a language present in both lists exactly once", () => {
      render(
        <CardLanguagePicker
          languages={[
            { language: "Dutch", type: "spoken" },
            { language: "Dutch", type: "learning" },
          ]}
          activeLanguage={null}
          onSelect={jest.fn()}
        />,
      );

      expect(screen.getAllByTestId("card-language-option-Dutch")).toHaveLength(
        1,
      );
    });
  });

  describe("Scenario: Selecting a language activates it", () => {
    it("reports the chosen language on press", () => {
      const onSelect = jest.fn();
      render(
        <CardLanguagePicker
          languages={[
            { language: "Dutch", type: "learning" },
            { language: "Spanish", type: "spoken" },
          ]}
          activeLanguage={null}
          onSelect={onSelect}
        />,
      );

      fireEvent.press(screen.getByTestId("card-language-option-Dutch"));
      expect(onSelect).toHaveBeenCalledWith("Dutch");
    });
  });

  describe("Accessibility: active option is announced as selected", () => {
    it("marks the active option with accessibilityState selected", () => {
      render(
        <CardLanguagePicker
          languages={[
            { language: "Dutch", type: "learning" },
            { language: "Spanish", type: "spoken" },
          ]}
          activeLanguage="Dutch"
          onSelect={jest.fn()}
        />,
      );

      expect(
        screen.getByTestId("card-language-option-Dutch").props
          .accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId("card-language-option-Spanish").props
          .accessibilityState.selected,
      ).toBe(false);
    });
  });
});
