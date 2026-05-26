# MandateSeal — Asset Prompts

Kumpulan prompt untuk generate aset visual website **MandateSeal** (Midjourney, DALL·E 3, Stable Diffusion XL, Flux, Ideogram, dll).

## 0. Brand Reference (selalu sertakan di setiap prompt)

| Token | Nilai |
| --- | --- |
| Product | MandateSeal — trust layer for autonomous AI agents |
| Tagline | *Approve before. Prove after.* |
| Mood | Calm, precise, futuristic, audit-grade, enterprise-trustworthy |
| Theme | Dark mode only |
| Background | Deep space navy `#070A12`, panel `#0F172A` |
| Primary accent | Cyan-blue `#38BDF8` |
| Secondary accent | Violet `#8B5CF6` |
| Success | Emerald `#22C55E` |
| Warning | Amber `#FACC15` |
| Block / danger | Red `#EF4444` |
| Text | Off-white `#F8FAFC` |
| Typography vibe | Inter (UI) + JetBrains Mono (hashes, code) |
| Visual language | Dashed grids, glow halos, signed hashes (`0x9c31…`), holographic seal, soft bloom, neon edge lighting, glassy panels |

> **Negative prompt umum (SDXL/Flux):** `cartoonish, low contrast, washed out, stock photo people smiling at camera, watermark, jpeg artifacts, blurry text, ugly UI, dribbble cliché gradient, lens flare overload, anime, oversaturated`

---

## 1. Logo & Mark

### 1.1 Primary mark (shield + checkmark seal)
```
A minimal vector emblem of a heraldic shield containing a clean checkmark
in the center, two-tone gradient stroke from cyan #38BDF8 to violet #8B5CF6,
emerald #22C55E checkmark, flat geometric, 2px even stroke, no fill,
isolated on solid #070A12, perfectly centered, sharp vector lines,
logo design, 1:1, ultra crisp, no text.
```

### 1.2 Animated logo (Lottie/Rive reference still)
```
Storyboard of a shield emblem assembling from particle dust into a sharp
two-tone outline (cyan→violet), then a soft pulse ring expands outward
once, finally a green checkmark draws itself inside; dark background
#070A12, neon glow, 12 frames in a 4x3 grid, technical motion
reference sheet, monochrome dark.
```

### 1.3 Favicon (32px)
```
Pixel-perfect 32x32 favicon, shield outline with checkmark, cyan-violet
gradient stroke, solid dark background, optimized for small size,
no anti-aliasing artifacts, flat vector.
```

---

## 2. Hero / Landing

### 2.1 Hero background (split-screen mood)
```
Cinematic dark UI hero background for an AI infrastructure product called
MandateSeal. Wide aspect 21:9. Left third: faint dashed isometric grid
fading into pure black #070A12. Center: a translucent holographic seal
floating in mid-air, glowing cyan #38BDF8 inner core with violet #8B5CF6
outer halo, a soft emerald check mark inscribed inside, surrounded by
slowly drifting hash strings (0x9c31f7a4b81e6c9d…) rendered in JetBrains
Mono, very small, dim cyan tint. Right third: blurred bokeh of data nodes
and signed-receipt cards drifting in depth. Subtle volumetric light,
filmic depth of field, no people, no text other than tiny hashes,
8k, premium SaaS landing aesthetic.
```

### 2.2 Hero illustration — "Agent passing through the Seal"
```
Editorial 3D illustration: a stylized autonomous agent depicted as a sleek
geometric orb of liquid mercury, approaching a vertical translucent gate
shaped like a heraldic seal. The seal pulses cyan-to-violet. A green
checkmark beam emits from the seal toward the orb. Behind the gate, on
the other side, a hovering paper-thin "receipt" card floats with a
glowing hash signature. Dark navy void background #070A12, dashed grid
floor, soft rim lighting, octane render, 16:9, no text.
```

### 2.3 Hero alternate — "Two doors: Approve / Prove"
```
Symmetrical futuristic diptych: on the left a translucent cyan portal
labeled with a tiny icon of a clock + checkmark (pre-approval), on the
right a violet portal labeled with an icon of a sealed envelope (proof).
Between them, a thin emerald data line connects both. Floating in deep
space-navy background with constellation-like data dots. Editorial,
poster-like, minimal, 3:2, no human figures.
```

---

## 3. Open Graph / Social Cards (1200×630)

### 3.1 OG default
```
Dark mode social share card, 1200x630, MandateSeal branding. Left side
60%: bold headline "Trust layer for autonomous AI agents." in Inter
ExtraBold off-white, beneath it monospace tagline "Approve before. Prove
after." in dim cyan. Bottom-left tiny MandateSeal shield logo. Right side
40%: a glowing translucent receipt card tilted 8 degrees, showing two
truncated hashes 0x9c31…e0d5 / sig_mandateseal_8f29…, faint violet halo
behind. Background: pure #070A12 with a faint cyan radial glow from
top-left, subtle dashed grid. Premium enterprise tech aesthetic, sharp
typography, generous whitespace.
```

### 3.2 OG variant — Launch announcement
```
Same template as 3.1, but headline reads "Console v0.1 is live."
Subline: "Bound your agents. Prove every action." Add a small pulsing
green "LIVE" pill badge top-right. Same palette and grid.
```

### 3.3 Twitter / X header (1500×500)
```
Ultra-wide dark banner, MandateSeal wordmark centered-left in white Inter
ExtraBold, tagline "Approve before. Prove after." in cyan mono below it.
Right half: 5 floating glassy receipt cards staggered in 3D depth, each
showing partial hashes, soft violet glow trailing between them like a
signature thread. Deep navy background, dashed grid, no people. 1500x500.
```

---

## 4. Section Illustrations

### 4.1 Problem section — "Unbounded agent"
```
Editorial dark illustration: a chaotic swirl of small geometric agents
(orbs and tetrahedra) firing arrows of action in every direction without
constraint, money symbols and API call tokens scattered around, all
drifting outside a thin broken hexagonal boundary. Color: muted reds
#EF4444 and amber #FACC15 on dark navy. Conveys "risk without mandate."
Flat-illustration meets subtle 3D, 16:9, no text.
```

### 4.2 Product flow — "Mandate → Action → Receipt"
```
Horizontal 3-step diagram illustration on dark background #070A12.
Step 1: a glowing cyan scroll labeled with tiny "MANDATE" icon
(constraint rules). Step 2: a violet orb (the agent) crossing through a
translucent seal gate. Step 3: an emerald receipt card with a wax-seal
hash on it. Each step connected by an animated dashed flow line glowing
left-to-right. Minimal, isometric, premium SaaS infographic style,
21:9 wide.
```

### 4.3 Decision engine — "Policy evaluation"
```
Stylized 3D rendering of a transparent cube floating in dark space,
each face etched with a different policy rule in monospace
("max_spend = $2.00", "approval_threshold = $5.00",
"allowed_tools = [http, fs.read]"). Inside the cube, a small glowing
agent orb is being scanned by horizontal cyan light beams. Soft
volumetric glow, no text other than the rules etched, dark navy
background, 4:3.
```

### 4.4 Receipt card — "Cryptographic proof"
```
Hero close-up of a single floating receipt card tilted 6 degrees, made of
brushed obsidian glass with a violet inner light, embossed with a small
wax-seal-style MandateSeal shield in the top-right corner. The card
surface shows a structured field layout (Agent, Action, Cost, Decision,
Signature) rendered in faint JetBrains Mono characters with a long
truncated hash. Soft violet shadow beneath, deep navy background, macro
photography style, 3:2.
```

### 4.5 Dashboard console mockup background
```
Faint, very low-contrast background texture: thousands of monospace hash
characters scrolling in vertical columns like a calm version of digital
rain, all in 6% opacity cyan on #070A12, plus a subtle dashed grid
overlay. Designed to sit behind a dark dashboard UI without competing
with foreground content. Seamless tile, 1920x1080.
```

---

## 5. Iconography (line-style, 24px grid)

Generate as a sprite sheet. Always: `1.75px stroke, rounded line caps,
24x24 viewbox, currentColor stroke, no fill, flat geometric, dark
background preview`.

```
A monochrome line-icon sprite sheet on dark background #070A12, 6x2 grid
of 24x24 icons, each rendered in soft cyan #38BDF8 stroke at 1.75px,
rounded caps, no fill, perfectly aligned to pixel grid:
1) shield with checkmark
2) wax seal with ribbon
3) document with hash lines
4) gavel of approval
5) hourglass + check
6) wallet with spending cap bar
7) tool wrench inside a hex policy frame
8) receipt scroll with QR
9) signature waveform
10) lock + key combined
11) clock with rewind arrow (audit trail)
12) agent orb with antenna
Crisp vector, exportable to SVG.
```

---

## 6. UI Patterns / Decorative

### 6.1 Dashed grid tile
```
Seamless tile, 64x64, transparent background, a single thin dashed line
forming an L in the corner using #243047, perfectly tileable, for use as
CSS background-image on a dark dashboard.
```

### 6.2 Hash text reel (decorative ribbon)
```
A long horizontal ribbon of truncated hexadecimal hashes
(0x9c31f7a4…, sig_mandateseal_8f29…, 0x7b21…e9aa), rendered in JetBrains
Mono, dim cyan #38BDF8 at 35% opacity on transparent background,
designed to loop horizontally, 1920x80, no decoration, pure text texture.
```

### 6.3 Glow node (single radial accent)
```
A single soft radial glow, cyan #38BDF8 at center fading to transparent
within 600px radius, on transparent background, 1024x1024 PNG, used as
ambient background accent.
```

---

## 7. Photography Direction (if real photos are ever used)

```
Editorial product photography, low-key dark studio, single key light from
top-left at 5500K, subject is a brushed-metal seal stamp resting on a
black slate surface, the stamp head engraved with the MandateSeal shield,
shallow depth of field f/2.0, 50mm prime, faint cyan rim light from
behind. No human hands. Mood: precision, authority, calm.
```

---

## 8. Empty / Error / Loading States

### 8.1 Empty state — "No receipts yet"
```
Minimal centered illustration: an outline of a tilted empty receipt card
floating, dashed border in muted #243047, a small cyan dot pulsing inside
where the signature would go. Soft single-line text below would later
read "No receipts yet." Dark background #070A12, very minimal, 1:1.
```

### 8.2 Error / blocked action
```
Centered illustration of a translucent shield with a soft red #EF4444
inner glow, a single horizontal block line crossing through it, a
truncated hash dimming out below. Dark navy background, minimal,
no text, 1:1, conveys "action blocked by mandate."
```

### 8.3 Loading — policy evaluating
```
A thin glowing cyan-to-violet horizontal line that travels left-to-right
inside a dark capsule, leaving a faint trailing glow; animation
reference grid 8 frames horizontal. Conveys "policy_check in progress."
```

---

## 9. Marketing One-Pager (PDF cover)

```
A4 portrait cover, deep navy background #070A12 with a soft cyan-violet
radial glow at the top. Centered: large MandateSeal shield emblem at 30%
of page height. Below in Inter ExtraBold off-white: "Trust layer for
autonomous AI agents." Smaller mono caption in cyan:
"Approve before. Prove after." Bottom edge: faint dashed grid line and
tiny mono footer "mandateseal.io · v0.1 console". Premium, restrained,
generous negative space, no other decoration.
```

---

## 10. Prompt Engineering Tips

- **Selalu sebut palet hex** — model image jauh lebih akurat dengan kode warna eksplisit.
- **Tegaskan "no text"** kecuali memang ingin tipografi (Ideogram/Flux paling bagus untuk teks).
- **Pakai aspect ratio** sesuai use case: `--ar 16:9` (hero), `--ar 21:9` (banner), `--ar 1:1` (logo/OG square), `--ar 1200:630` (OG).
- **Hindari klise** dark-tech: "matrix rain", "robot face", "blue hexagon HUD" — sebutkan secara eksplisit di negative prompt.
- **Konsistensi seal** — selalu deskripsikan emblem yang sama: *heraldic shield + cyan-violet gradient stroke + emerald checkmark* agar brand tetap recognizable lintas aset.
- **Untuk Midjourney v6+** tambahkan `--style raw --stylize 250` agar tidak terlalu painterly.
- **Untuk Flux/SDXL** tambahkan `, ultra sharp, 8k, photoreal materials, cinematic lighting` di akhir.

---

*File ini adalah referensi internal — perbarui setiap kali brand language berubah.*
