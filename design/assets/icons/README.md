# Shelfie jar-style icons: additions (20 Nov 2026)

Five icons drawn to match the app's little jars (`JAR_ART` / `unitIcon`): eucalyptus body, wooden lid, cream label. First used on the landing page.

| File                        | Use                                                                           |
| --------------------------- | ----------------------------------------------------------------------------- |
| shelfie-icon-lock.svg       | Privacy: what Shelfie keeps (padlock on the label)                            |
| shelfie-icon-never.svg      | Privacy: what it never does (the app's crossed-circle "no" sign on the label) |
| shelfie-icon-export.svg     | Export / leave any time (the app's box icon with an up arrow)                 |
| shelfie-icon-ai-help.svg    | AI import and shopping assistant (jar with a speech bubble)                   |
| shelfie-icon-pantry-tin.svg | New unit shape for pantry items: tin / can, with the stock gauge              |
| shelfie-icon-switch.svg     | Privacy: you decide what we count (a switch on the label)                     |

All are 40 x 48 (the app's icon viewBox) and use fixed light colours from the palette (wood #cfa57c, eucalyptus #82b5a3, cream #fff7e6, gauge track #e9d7c4, sprout #4f9a62, accent #0e6f6b, danger #b3261e). Per rule 6 in 06-design-system, product icons keep their light colours in dark mode, so there are no dark variants.

## Tin as a unit shape (for pantry items)

The app currently maps `can` to the jar shape. To give tins their own shape, add to `JAR_ART` (using the app's existing classes) and point the pantry units at it:

```js
can: ['<rect class="j-wood" x="6" y="6" width="28" height="6" rx="3"/><rect class="j-eu" x="7" y="11" width="26" height="35" rx="4"/><rect class="j-wood" x="7" y="16" width="26" height="2"/><rect class="j-wood" x="7" y="42" width="26" height="2"/>', 9, 24, 22, 16],
```

and in `JAR_KIND`: `can: 'can', tin: 'can'`. `unitIcon()` then adds the cream label and the gauge itself.
