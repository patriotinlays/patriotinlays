# Logo sources

- `build.py` regenerates `logo-horizontal.svg` and `logo-horizontal-white.svg` from the Merriweather and Montserrat fonts
  (text outlined to paths; see `FONT-LICENSE.txt`). It expects the fonts under `/usr/share/fonts/truetype/sand-box/google/`.
- `preview.py` renders the favicons (`favicon-32.png`, `favicon-16.png`, `apple-touch-icon-180.png`) from `favicon.svg`, plus a preview sheet.
- `og_image.py` makes the 1200x630 social share image `og-image.png`.

Run them from this folder, then copy the outputs into `src/assets/` (the site build copies them to `dist/`):
`cp logo-horizontal-white.svg logo-horizontal.svg icon.svg favicon.svg favicon-32.png favicon-16.png apple-touch-icon-180.png og-image.png ../../src/assets/`
