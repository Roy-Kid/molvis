import { describe, expect, it } from "@rstest/core";
import { isViewportHidden } from "../../src/lib/viewport-visibility";

describe("isViewportHidden", () => {
  describe("basics", () => {
    it("is not hidden while intersecting a visible box", () => {
      expect(
        isViewportHidden({
          isIntersecting: true,
          boundingClientRect: { width: 800, height: 600 },
        }),
      ).toBe(false);
    });

    it("is hidden when off-screen with a non-zero box", () => {
      expect(
        isViewportHidden({
          isIntersecting: false,
          boundingClientRect: { width: 800, height: 600 },
        }),
      ).toBe(true);
    });
  });

  describe("edge", () => {
    it("does not treat a 0-width layout frame as hidden", () => {
      // Opening the left compute rail collapses the canvas flex slot to
      // width 0; IntersectionObserver { threshold: 0 } reports
      // isIntersecting: false even though the viewer is still on screen.
      expect(
        isViewportHidden({
          isIntersecting: false,
          boundingClientRect: { width: 0, height: 400 },
        }),
      ).toBe(false);
    });

    it("does not treat a 0-height layout frame as hidden", () => {
      expect(
        isViewportHidden({
          isIntersecting: false,
          boundingClientRect: { width: 400, height: 0 },
        }),
      ).toBe(false);
    });

    it("does not treat a 0-area box as hidden", () => {
      expect(
        isViewportHidden({
          isIntersecting: false,
          boundingClientRect: { width: 0, height: 0 },
        }),
      ).toBe(false);
    });

    it("is not hidden while intersecting even a tiny box", () => {
      expect(
        isViewportHidden({
          isIntersecting: true,
          boundingClientRect: { width: 1, height: 1 },
        }),
      ).toBe(false);
    });
  });
});
