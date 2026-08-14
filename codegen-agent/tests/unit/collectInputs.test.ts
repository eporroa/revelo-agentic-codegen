import { describe, it, expect } from "vitest";
import { missingFields, shouldPromptInteractively } from "@/ui/collectInputs.js";

describe("missingFields", () => {
  it("returns all three when nothing is supplied", () => {
    expect(missingFields({})).toEqual(["spec", "boilerplate", "out"]);
  });

  it("returns only the fields not supplied", () => {
    expect(missingFields({ spec: "./spec.txt" })).toEqual(["boilerplate", "out"]);
  });

  it("returns an empty array when everything is supplied", () => {
    expect(
      missingFields({ spec: "a", boilerplate: "b", out: "c" })
    ).toEqual([]);
  });
});

describe("shouldPromptInteractively", () => {
  it("is false when non-TTY and every field is present", () => {
    expect(
      shouldPromptInteractively({ spec: "a", boilerplate: "b", out: "c" }, false)
    ).toBe(false);
  });

  it("is true when non-TTY but a field is missing", () => {
    expect(shouldPromptInteractively({ spec: "a" }, false)).toBe(true);
  });

  it("is true when TTY, even if every field is present", () => {
    expect(
      shouldPromptInteractively({ spec: "a", boilerplate: "b", out: "c" }, true)
    ).toBe(true);
  });

  it("is true when TTY and fields are missing", () => {
    expect(shouldPromptInteractively({}, true)).toBe(true);
  });
});
