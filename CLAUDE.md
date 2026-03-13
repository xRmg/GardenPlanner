# Garden Planner — AI Design Context

> Persistent design guidance for all AI-assisted design and development decisions.
> Last updated: 2026-03-13

---

## Design Context

### Users

**Profile**: Young, smart gardeners seeking an intelligent planning and management tool. They want practical assistance without complexity—an app that makes gardening easier, not harder.

**Context**: Users garden on their own terms, whether it's a small urban balcony, a backyard vegetable patch, or a shared allotment. They value autonomy, privacy (self-hosted option), and decision-support over rigid rules.

**Job to be done**: Plan plantings strategically, track garden events and care, receive weather and AI-driven suggestions, and maintain a personal plant catalogue without friction or overwhelm.

---

### Brand Personality

**3-word summary**: **Nature, Modern, Easy-to-use**

**Voice & tone**:
- Friendly but not cutesy
- Confident yet approachable  
- Helpful without being instrusive
- Conversational but respectful of the user's time

**Emotional goals**:
- Confidence in gardening decisions
- Calm, uncomplicated workflow
- Delighted by smart suggestions that *actually help*
- Pride in a well-kept, organized garden

---

### Aesthetic Direction

**Visual tone**: Contemporary, minimal, and intuitive with a slightly technical edge. Clean & modern, with organic warmth—never rustic, ornate, or vintage.

**Influences**:
- Minimal, purpose-driven interfaces (e.g., iOS, Linear, Figma)
- Nature-inspired but modern color palettes (vibrant greens, earthy accents)
- Grid-based layouts with breathing room (not cramped)
- Playful micro-interactions without being whimsical

**Anti-references** (explicitly avoid):
- ❌ Old-fashioned or gothic aesthetics
- ❌ Heavily textured, rustic, or vintage motifs
- ❌ Ornate or decorative patterns
- ❌ Cluttered or busy layouts
- ❌ Overly whimsical illustration styles
- ❌ "Grandma's garden" vibes — no cottage-core, floral borders, or nostalgic warmth

**Current palette** (adheres to brief):
- **Primary**: Vibrant garden green (`#22c55e`) — alive, modern, growth-focused
- **Secondary**: Lime green (`#a3e635`) — accent, technical highlight
- **Accent**: Cream gold (`#fef3ce`) — warm but not rustic
- **Neutrals**: Clean light backgrounds (`#f8fafc`) and dark foreground (`#0c1c15`)
- **Dark mode**: Professional oklch-based palette for accessibility

---

### Design Principles

These principles guide all decisions: layout, color, typography, interactions, and copy.

1. **Modern yet alive** — Vibrant garden colors feel contemporary, not nostalgic. Minimal layouts prevent overwhelm. Breathing room > busy decorations.

2. **Clarity before ornament** — Every visual element serves the user's job. No ornate icons, no decorative textures, no "charming" clutter. Efficiency first.

3. **Smart defaults + transparency** — Suggestions and AI assistance feel like a helpful colleague, not magic. Users know why they're seeing each suggestion. Fail gracefully offline.

4. **Playful precision** — Micro-interactions (button states, success confirmations, smooth transitions) delight without distraction. Fun is in the *precision*, not the ornamentation.

5. **Accessibility as design** — Light mode primary (garden in daylight sensibility), dark mode as complete alternative. Focus states, color contrast, and reduced-motion support are built-in, not afterthoughts.

---

### Technology Foundation

| Layer          | Choice                                           | Notes                                          |
| -------------- | ------------------------------------------------ | ---------------------------------------------- |
| **Language**   | TypeScript 5.7 + React 19                        | Type safety + modern React idioms              |
| **Build**      | Vite 6 + Tailwind CSS v4                         | Fast, modern, utility-first styling            |
| **Components** | Radix UI primitives + shadcn/ui                  | Accessible, unstyled base layer                |
| **Typography** | Inter (300–700)                                  | Modern, clear, highly legible sans-serif       |
| **Icons**      | Lucide React                                     | Clean, contemporary icon set                   |
| **Color vars** | CSS custom properties (light + dark oklch modes) | Future-proof, WCAG AA/AAA compliant            |
| **Forms**      | react-hook-form + Zod                            | Type-safe validation, minimal boilerplate      |

---

### Light Mode as Primary

Garden Planner defaults to light mode, reflecting the sensibility of gardening in daylight. Dark mode is a full, complete alternative (not a thin overlay) using professional oklch notation for perfect color harmony in reduced light.

Both modes must:
- Pass WCAG AA contrast minimums
- Preserve color semantics (green = growth/action, red = caution/destructive)
- Feel equally refined and intentional

---

### Motion & Micro-Interactions

Animations should:
- ✨ **Delight** with smooth, purposeful transitions (button press, modal entrance, list reorder)
- 🎯 **Clarify** relationships (parent → child, drag operations)
- 🤐 **Respect** reduced-motion preferences (`prefers-reduced-motion`)
- 🚀 **Be lightweight** — no fluff, no 3D rotations, no decorative flourishes

No ornate animations. Every motion has a job.

---

### Copywriting

Keep language:
- **Clear**: Avoid jargon. Explain AI-generated suggestions plainly.
- **Honest**: If a feature needs internet or AI, say so. Embrace "no internet, works offline."
- **Encouraging**: "Plant a seed" is better than "add plant to inventory."
- **Concise**: Respect reading time. Inline help is better than long modals.

---

### Spacing & Layout

All spacing uses Tailwind's default scale (4px base). Garden Planner favors:
- Generous padding on mobile (16px+)
- Clear visual hierarchy through spacing, not decoration
- Asymmetric grids when it serves readability (not for novelty)
- Breathing room around interactive elements (buttons, inputs, cards)

---

### Future Phases & Design Continuity

As Garden Planner evolves (internationalization, shared plant library, hosted SaaS):

✅ **Light mode + vibrant greens + human-friendly copy** remain non-negotiable.
✅ **Modern sans-serif + minimal ornament** scale to multi-language interfaces.
✅ **Technical edge + organic warmth** work whether data is local or synced from cloud.

Anti-patterns to avoid in future work:
- ❌ Adding ornate chapter heading fonts (e.g., Playfair, Fraunces)
- ❌ Introducing vintage or rustic textures (paper grain, wood, farmhouse vibes)
- ❌ Cramming too many feature dialogs into one view
- ❌ Losing the "technical precision" edge when adding more natural elements

---

## References & Inspiration

**Apps/Sites that capture the right feeling**:
- Linear (modern, minimal, purposeful)
- iOS apps (clean, breathing room, refined)
- Figma (technical but approachable, beautiful defaults)
- Minimal gardening/plant apps (Planta, GardenTags) — *directionally*, though their designs trend slightly more whimsical than our target

**Design systems to study**:
- shadcn/ui (unstyled, composable, developer-friendly)
- Radix UI (accessibility-first primitives)
- Tailwind CSS (utility-first thinking)

---

## Accessibility & Inclusion

**Baseline**: WCAG AA compliance on all interactive elements (contrast, focus states, keyboard nav).

**Opt-in enhancements**:
- Dark mode with perfect oklch-based harmony
- Reduced-motion variants for all animations (fade instead of slide)
- Large-text mode via system zoom (future: built-in text size settings)
- Colorblind-safe palette (avoid red-green as sole differentiator)

---

## Implementation Checklist

When designing or proposing new features:

- [ ] Does it use Inter (no ornate display fonts)?
- [ ] Is layout minimal, breathing, not cramped?
- [ ] Are colors from the vibrant garden palette (greens, golds, clean neutrals)?
- [ ] Do animations respect reduced-motion preferences?
- [ ] Is copy clear, concise, and encouraging?
- [ ] Does it scale to light + dark modes equally?
- [ ] Does it avoid rustic, ornate, or vintage aesthetics?
- [ ] Is the technical character preserved (not overly whimsical)?
- [ ] Are accessibility requirements met (WCAG AA, focus, keyboard nav)?

---

**Design guidance: established; ready for Phase 2 (i18n) and beyond.**

