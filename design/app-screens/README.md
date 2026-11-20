# App screens (reference only)

Downloaded 15 Nov 2026 from the claude.ai design canvas "Shelfie Design: logo, phone screens and motion". Canvas Page 2 is the current design (Tailwind look); Page 1 and Page 3 are the earlier Tailwind-versus-Ionic work.

These are canvas source files. They use the canvas's own `support.js` and `{{placeholders}}`, so they do not open as normal web pages. Read them for markup, spacing, copy and behaviour. Do not import them, and do not use them as the source for tokens or copy (see CLAUDE.md, Design rules). The canvas also loads fonts from Google Fonts; the app must not (fonts are bundled).

## current/ (follow these)

### phone (390 x 844; two are full-scroll boards)
| File | Canvas title |
|---|---|
| `current/phone/J-Loading-Phone.dc.html` | 1 · Loading (phone) |
| `current/phone/J-Shelves-Phone.dc.html` | 2 · Shelves (phone) |
| `current/phone/J-Fill-Orders-Phone.dc.html` | 3a · Fill my shelves: orders (full scroll) |
| `current/phone/J-Fill-Reading-Phone.dc.html` | 3b · Fill my shelves: reading |
| `current/phone/J-Fill-Review-Phone.dc.html` | 3c · Fill my shelves: review |
| `current/phone/J-Fill-Done-Phone.dc.html` | 3d · Fill my shelves: done |
| `current/phone/J-Item-Flip-Phone.dc.html` | 4 · Item flip (press Play, then Flip) |
| `current/phone/J-Shop-Now-Phone.dc.html` | 5 · Shop now with greener suggestions (full scroll) |

### web (1280 wide)
| File | Canvas title |
|---|---|
| `current/web/J-Shelves-Web.dc.html` | 2 · Shelves (web) |
| `current/web/J-Fill-Orders-Web.dc.html` | 3a · Fill my shelves: orders (web) |
| `current/web/J-Fill-Review-Web.dc.html` | 3b · Fill my shelves: review (web) |
| `current/web/J-Fill-Done-Web.dc.html` | 3c · Fill my shelves: done (web) |
| `current/web/J-Item-Flip-Web.dc.html` | 4 · Item flip (web, press Play, then Flip) |
| `current/web/J-Shop-Now-Web.dc.html` | 5 · Shop now with greener suggestions (web) |

### theme
| File | Canvas title |
|---|---|
| `current/theme/J-Icon-Options.dc.html` | Product Icon Ideas |
| `current/theme/J-Palette.dc.html` | Colour Palette |
| `current/theme/J-Pill-Options.dc.html` | Shelf Tab Ideas |

Not designed yet: web Loading and web Fill my shelves "reading" screens, tablet widths, dark mode, Settings, sign-in and sync screens.

## archive/ (do not build from these)
The Ionic exploration (iOS, Android, web split pane) and the first Tailwind-versus-Ionic comparison. They use the old jar colours, the yellow lid, pink cheeks and Ionic components, which were dropped (see docs/decisions.md and 02-thread-design.md).
| File | Canvas title |
|---|---|
| `archive/Desktop-Ionic.dc.html` | Ionic · desktop 1280, with Shelfie title, mascot and leaves |
| `archive/Desktop-Tailwind.dc.html` | Tailwind · desktop 1280 |
| `archive/I-Fill-Orders-Android.dc.html` | 3a · Fill: add orders · Android |
| `archive/I-Fill-Orders-iOS.dc.html` | 3a · Fill: add orders · iOS |
| `archive/I-Fill-Reading-Android.dc.html` | 3b · Fill: reading · Android |
| `archive/I-Fill-Reading-iOS.dc.html` | 3b · Fill: reading · iOS |
| `archive/I-Fill-Review-Android.dc.html` | 3c · Fill: review · Android |
| `archive/I-Fill-Review-Web.dc.html` | 3 · Fill: review · web |
| `archive/I-Fill-Review-iOS.dc.html` | 3c · Fill: review · iOS |
| `archive/I-Item-Flip-Android.dc.html` | 4 · Item flip · Android (Play, then Flip) |
| `archive/I-Item-Flip-Web.dc.html` | 4 · Item flip · web (Play, then Flip) |
| `archive/I-Item-Flip-iOS.dc.html` | 4 · Item flip · iOS (Play, then Flip) |
| `archive/I-Shelves-Android.dc.html` | 2 · Shelves · Android |
| `archive/I-Shelves-Web.dc.html` | 2 · Shelves · web |
| `archive/I-Shelves-iOS.dc.html` | 2 · Shelves · iOS |
| `archive/I-Splash.dc.html` | 1 · Splash (shared) |
| `archive/Main.dc.html` | Tailwind · Shelfie look |
| `archive/Phone-Ionic-Android.dc.html` | Ionic · Android mode, with Shelfie title, mascot and leaves |
| `archive/Phone-Ionic-iOS.dc.html` | Ionic · iOS mode, with Shelfie title, mascot and leaves |

`canvas.json` is the original canvas index. Its keys are the flat file names; the files are sorted into folders here.
