# MindHome authored NuTuenSai presence

Human-supplied sources are copied without raster editing. Cool Air is from
`/Users/peeranatmuangsamrit/Desktop/mindhome-msxai/assets/nutuensai/mindhome_panels/`.
The current Sun & Shade and Rain & Green revisions are from
`/Users/peeranatmuangsamrit/Desktop/Screenshots/Screenshots_2026_10/`.
Each PNG is 941 × 1672. The public copies and source files have identical SHA-256 hashes:

| Condition | Source filename | Public copy under `public/mindhome/presence/` | SHA-256 |
| --- | --- | --- | --- |
| Cool Air | `nutuensai_panel_01_welcome_presence.png` | `welcome-presence.png` | `ea8bc5a6105427c7a53d67971965c6d3802b08a4e2aa20868c1eaeab6ca45446` |
| Sun & Shade | `nutuen ฤดูร้อน.png` | `listening-mirror.png` | `0c6e348057a62c0cbb44efa39fa5b895198c552e37b4baac116eddb30ffeab0e` |
| Rain & Green | `nutuen ฤดูฝน.png` | `pause-agency.png` | `a4751c5b512cfe9aba51fb754c86e7901590ab6cc851caf2f64c779c808db4c0` |

The three adjacent `*-mask.svg` files are authored presentation masks. They feather
the existing raster boundaries and fade the lower figure into the environment;
they do not modify the source photographs or infer a depth map. The listening
mask retains a restrained fragment of the source glass panel. These approximate
silhouettes are subject to Human visual review, particularly hair/hand edges.

The short visual revision replaces only the Sun & Shade and Rain & Green PNG
copies and their masks. The current rain mask preserves the purple umbrella's
full source silhouette, with separate desktop, portrait and short-landscape
placement. Its footprint stays to the left of the pavilion and leaves the path
and reflection card open. The Sun & Shade mask follows the new closer pose and
retains a faint part of the source glass. Cool Air's image, mask and placement
are unchanged. Reflection cards now use translucent soft white and near-black
text. No reveal, crossfade or environmental-event timing was changed.

All three supplied identity SVGs were inspected. The existing plain MindHome
heading is retained, so no identity asset is shipped or repeated over the scenes.

The environment completes its existing 2500 ms condition crossfade before the
incoming presence begins a 1100 ms opacity reveal (320 ms delay). The authored
reflection follows with a 620 ms fade (850 ms delay). Outgoing content fades for
220–240 ms before the environmental crossfade begins. Reduced Motion removes
these delays and reveals. CSS owns the finite presentation transitions; no new
RAF, scheduler, or JavaScript timer is introduced.

Three reusable DOM images are loaded on the first MindHome entry and remain
cached for subsequent choices/visits. A failed portrait remains hidden while the
environment, reflection and controls remain usable. No Three.js resources are
added. Portrait layouts keep the whole photographic stage and let the masked
foreground figure extend into the slate-teal field, with copy beside it and
condition controls below. Desktop/short landscape retain the sentence inside the
photograph, away from the pavilion.

## Change inventory

Modified:

- `src/mindhome/MindHomeView.ts`
- `src/mindhome/content.ts`
- `src/styles/mindhome.css`
- `e2e/mindhome-destination.spec.ts`
- `qa/mindhome.production.spec.ts`
- `playwright.production.config.ts`

Added:

- `public/mindhome/presence/welcome-presence.png`
- `public/mindhome/presence/listening-mirror.png`
- `public/mindhome/presence/pause-agency.png`
- `public/mindhome/presence/welcome-mask.svg`
- `public/mindhome/presence/listening-mask.svg`
- `public/mindhome/presence/agency-mask.svg`
- `qa/mindhome-presence.production.spec.ts`
- `docs/mindhome-presence-assets.md`
