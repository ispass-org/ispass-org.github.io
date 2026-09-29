# ISPASS logo

The ISPASS identity, redrawn from the long-standing logo used on ispass.org:
a **staircase of horizontal bars** beside and beneath a **blue ISPASS
wordmark**. The structure is unchanged — upper bars step in beside the letters,
lower bars run underneath them — with the geometry regularised, the wordmark
set in a contemporary grotesque, and every variant produced as clean vector
artwork.

The logo identifies **the symposium**, not one edition. It is the same every
year. The edition ("2027") is set beside it as text by the site header, never
baked into the artwork.

## Files

| File | Use |
| --- | --- |
| `ispass-logo.svg` / `.png` | **Primary.** Light backgrounds. |
| `ispass-logo-reversed.svg` / `.png` | Dark backgrounds. |
| `ispass-logo-mono.svg` | One-colour: print, embroidery, fax-grade reproduction. Recolour freely. |
| `ispass-mark.svg` | The staircase alone, transparent background. |
| `ispass-mark-tile.svg`, `ispass-mark-512.png` | The staircase on a blue rounded tile: avatars, app icons. |
| `../favicon.svg` | Browser tab icon. A three-bar optical size of the mark — see below. |
| `../apple-touch-icon.png` | 180px home-screen icon. |

On the website itself the logo is inlined by
[`src/components/Logo.astro`](../../src/components/Logo.astro) so it can switch
colours with the theme. Its path data is copied from `ispass-logo.svg`.

## Colour

The colours are **sampled from the original ISPASS logo artwork**, not chosen:
the wordmark's dominant pixel value is `#00007E`, and the original stylesheet
used `#000080` for headings and links. The bars are the artwork's `#303030`.

| | Light background | Dark background |
| --- | --- | --- |
| Wordmark | ISPASS Navy `#000080` | `#9DB8F2` |
| Bars | Charcoal `#303030` | `#E9EDF3` |

Contrast on white: 16.0:1 (navy) and 13.2:1 (charcoal) — both far above WCAG
AAA.

ISPASS Navy is also the website's default accent colour. An edition may choose
a different accent in `conference.yaml`, but **the logo itself stays ISPASS
Navy.** The website is light-background only; the reversed file exists for
slides, posters and merchandise on dark grounds.

## Construction

Units below are relative to the wordmark's cap height = 100.

- **Wordmark:** "ISPASS" in Archivo Black, outlined to paths, tracked +8/1000 em.
- **Bars:** 13 thick with 16 between them — so the four upper bars span exactly
  the cap height, top bar aligned to the cap line and bottom bar to the baseline.
- **Staircase:** each lower bar starts 24 further left. Seven bars in all: four
  stop 20 short of the "I", three run to the end of the final "S".
- **Mark:** the same staircase squared up — four bars sharing a right edge.
- **Favicon:** three heavier bars. Thin bars smear into a grey wedge at 16px, so
  the tab icon uses fewer, thicker ones. This is the same mark at an optical
  size, not a different symbol.

## Clear space and minimum size

- Keep clear space on every side at least the height of the **"I"** — do not let
  text or other logos intrude.
- Minimum width of the full logo: **120px** on screen, **30mm** in print. Below
  that, use the mark.

## Please don't

- Recolour the wordmark and bars differently from the table above (the mono file
  exists for single-colour needs).
- Stretch, skew, rotate or add effects (shadows, outlines, gradients).
- Rearrange the bars, drop the lower bars, or put the year inside the artwork.
- Reset the wordmark in another typeface.
- Place the primary logo on a busy photograph or a mid-tone background — use the
  reversed version on a solid dark ground instead.

## Typeface licence

The wordmark is outlined from **Archivo Black**, Copyright 2017 The Archivo
Black Project Authors, licensed under the **SIL Open Font License 1.1**. The OFL
permits using the font's glyphs in a logo. The licence text is included as
[`ArchivoBlack-OFL.txt`](ArchivoBlack-OFL.txt). No font file is shipped or
loaded by the website — the letters are plain vector paths.
