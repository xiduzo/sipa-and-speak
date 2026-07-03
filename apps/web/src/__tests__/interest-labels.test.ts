import { describe, expect, it } from "vitest";

import { interestLabel } from "@/utils/interest-labels";

// Guards the partner page against regressing to raw interest slugs
// (drift fixed vs. the native app, whose canonical list lives in
// apps/native/utils/interest-labels.ts).
describe("interestLabel", () => {
  it("maps slugs to the same human labels the native app shows", () => {
    expect(interestLabel("modern_art")).toBe("Art");
    expect(interestLabel("tech_coding")).toBe("Tech");
    expect(interestLabel("grocery_shopping")).toBe("Grocery shopping");
    expect(interestLabel("pronunciation_practice")).toBe("Pronunciation");
  });

  it("passes unknown slugs through", () => {
    expect(interestLabel("underwater_basket_weaving")).toBe(
      "underwater_basket_weaving",
    );
  });
});
