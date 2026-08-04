import { describe, expect, it } from "@rstest/core";
import { categoricalColorAt, getColorMap } from "../../../src/artist/palette";
import {
  chainColor,
  DEFAULT_RIBBON_STYLE,
  spectrumColor,
  ssColor,
} from "../../../src/artist/ribbon/ribbon_style";

describe("ribbon_style palette alignment", () => {
  it("defaults to chain coloring (multi-chain figures)", () => {
    expect(DEFAULT_RIBBON_STYLE.colorMode).toBe("chain");
    expect(DEFAULT_RIBBON_STYLE.widthScale).toBe(0.95);
  });

  it("maps SS colors onto tableau-soft ordinals (display/sRGB)", () => {
    // Ribbon colors are gamma-encoded for StandardMaterial; they must
    // differ from the linear palette values used by atom impostors.
    expect(ssColor("helix")).not.toEqual(categoricalColorAt(2));
    expect(ssColor("sheet")).not.toEqual(categoricalColorAt(5));
    expect(ssColor("coil")).not.toEqual(categoricalColorAt(8));
    // Still distinct SS swatches.
    expect(ssColor("helix")).not.toEqual(ssColor("sheet"));
    expect(ssColor("sheet")).not.toEqual(ssColor("coil"));
  });

  it("uses categorical ordinals for chain colors (display/sRGB)", () => {
    expect(chainColor(0)).not.toEqual(chainColor(1));
    expect(chainColor(0)).not.toEqual(categoricalColorAt(0));
  });

  it("samples viridis for spectrum coloring (display/sRGB)", () => {
    const viridis = getColorMap("viridis");
    expect(spectrumColor(0)).not.toEqual(viridis.sample(0));
    expect(spectrumColor(0)).not.toEqual(spectrumColor(1));
  });

  it("uses coil palette color as the uniform default", () => {
    expect([...DEFAULT_RIBBON_STYLE.uniformColor]).toEqual(ssColor("coil"));
  });
});
