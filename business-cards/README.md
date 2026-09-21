# Jonathan Hill — 1minus1 business card

Front and back artwork for Jonathan Hill's business card, built from the 1minus1 brand
system as used in the **Creds Deck** Figma file (`figma.com/slides/5cBnjK3pkcCJiD3BRO7M2L`).

| Front | Back |
|---|---|
| ![front](output/front.png) | ![back](output/back.png) |

## Spec

- Trim size 85 × 55 mm (UK standard), 3 mm bleed on all sides, 5 mm safe margin.
- Artwork files are 91 × 61 mm including bleed. Crop marks are not included; the trim box is
  the 85 × 55 mm rectangle inset 3 mm from each edge.
- `output/jonathan-hill-business-card.pdf` is a two-page print PDF (page 1 front, page 2 back),
  fully vector. `front.svg` / `back.svg` are the editable vector sources.
- Colours come from the deck's variable collection: purple `#140128`, lime `#CAFF60`,
  violet `#9860FF`, white. Supply to print as RGB or ask the printer to convert; the lime is
  outside most CMYK gamuts so a fluorescent / Pantone spot match is worth asking about.

## What came from the deck

Everything on the card is the deck's own system, not a look-alike:

- **OffBit Bold** lettering for `JONATHAN` (solid) and `HILL` (outlined, the deck's
  `THIS IS 1MINUS1` treatment). The letters are sampled pixel-for-pixel from the deck's
  OffBit headlines and stored in `assets/offbit-bold.json`; the build traces them into vector
  outlines.
- **Neue Power Bold** contact text, exported as outlined vectors from the deck's
  "Thank you" and "Letter from Jon" slides (`assets/text-*.svg`).
- The **1minus1 wordmark** vector, the pixel **stairs** background, the pixel **checker**
  glyph, the **bits** smiley pill, the violet **smiley** sticker and the white oval
  **1minus1** sticker from the title slide.
- Contact details (email, phone, Founder / CEO) as they appear on the deck's Thank You slide.

Because OffBit, Neue Power and Nohemi are licensed desktop fonts, no font files are needed to
open or print these files. To change any wording, either re-export the new text from Figma
(select the text layer → Export → SVG) into `assets/`, or for OffBit words use letters that
exist in `assets/offbit-bold.json` (A B C D E H I J K L N O R S T U).

## Rebuilding

```bash
node build.mjs                 # writes front.svg, back.svg, index.html
node render.mjs                # writes output/*.png and the print PDF (needs Playwright + Chromium)
```

`index.html` is a preview page showing both sides with the trim line; printing it from a
browser also produces the two-page PDF.
