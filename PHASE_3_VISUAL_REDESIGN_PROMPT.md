# Phase 3 — Reusable Visual Redesign Prompt

Use this only after the product works, including loading, success, empty, and error states.

## Goal

Redesign the interface boldly without removing, renaming, or changing any existing functionality. The finished product should feel specific to its purpose, remain responsive and accessible, and fall back to a fully visible working page if motion fails.

## 1. Map the project before editing

Before making changes:

1. Identify the files responsible for application behavior, data access, configuration, UI rendering, markup, and styling. Do not assume filenames such as `app.js` or `ui.js`; map the actual equivalents in this project.
2. Read the behavior and rendering flow end to end.
3. Record every JavaScript-referenced `id`, form field name, event target, exported function, function signature, and expected data shape.
4. Read the existing test and check files.
5. Check the working tree and preserve unrelated user changes.

If the product does not already work, stop and report the existing failure. This phase is visual refinement, not a behavior rewrite.

## 2. Non-negotiable functionality contract

Do not:

- rename or remove any JavaScript-referenced `id`, `name`, class, data attribute, or selector;
- change exported names, function names, parameters, return values, sync/async behavior, API routes, request payloads, response shapes, or rendered data fields;
- remove loading, empty, warning, success, or error states;
- replace native form semantics with non-semantic elements;
- animate a results container, status message, warning, empty state, or error state;
- install a dependency for layout, icons, animation, or a carousel;
- remove or weaken an existing test or check.

You may:

- rewrite the stylesheet;
- add presentation-only classes and wrappers;
- restructure markup while preserving semantic order and all behavior hooks;
- refine card markup inside the existing render functions without changing the data displayed;
- add one isolated `motion.js` file;
- add static, product-relevant explanatory content;
- add checks.

When a requested visual change conflicts with the functionality contract, preserve functionality and explain the adaptation.

## 3. Establish a product-specific direction

Derive the palette, type, spacing, and visual metaphor from what the product actually does and who uses it.

- Use one accent color for one consistent job, such as actions, focus, and current state.
- Keep semantic error and warning colors distinct from the accent.
- Use display type at `4rem` or larger on desktop and at least four times the body size.
- Let the hero occupy roughly 60–70% of the first viewport while leaving a visible cue that content continues.
- Use a real spacing scale and generous section separation.
- Give cards obvious internal hierarchy: context, title, metadata, summary, then action.
- Make different content types visually distinct instead of putting everything in identical rounded cards.
- Avoid default-looking cream/serif/terracotta palettes, repeated grey shadows, all-caps eyebrow labels, decorative button arrows, and gratuitous gradients.
- Use system fonts unless the project already has an approved font-loading strategy.

## 4. Essential responsive UI/UX

Implement the basics that every production page needs:

- mobile-first fluid widths with no horizontal page overflow;
- responsive type using `clamp()`;
- layouts that collapse cleanly at content-driven breakpoints;
- form controls and buttons at least `44px` high;
- persistent visible labels and useful helper text;
- visible `:focus-visible` rings with sufficient contrast;
- hover feedback that is never the only way to discover information;
- pressed states for buttons and links;
- disabled and busy states that remain readable;
- long URLs and user-provided text that wrap safely;
- touch layouts that do not depend on hover;
- contrast of at least 4.5:1 for body text;
- `prefers-reduced-motion: reduce` support;
- reserved dimensions or `aspect-ratio` for every image.

For card and tile hover, use a deliberate box-shadow effect tied to the accent color rather than a generic soft grey shadow. Keep any accompanying movement small, for example:

```css
.tile {
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.tile:hover {
  box-shadow: 12px 12px 0 color-mix(in srgb, var(--accent) 18%, transparent);
  transform: translate(-4px, -4px);
}

@media (hover: none) {
  .tile:hover { transform: none; }
}
```

## 5. Failure-safe motion

Motion must be additive. If motion code is deleted, blocked, unsupported, or throws, the product must remain fully visible and functional.

Put all motion behavior in one `motion.js` file. Wrap the entire file in a single `try`/`catch`. The script may add a `js` class to `<html>` at startup, but the catch block must remove it and force-reveal any waiting sections.

```js
(function () {
  const root = document.documentElement;
  root.classList.add("js");

  try {
    // Optional motion only. Guard every lookup.
  } catch (error) {
    root.classList.remove("js");
    document.querySelectorAll(".reveal")
      .forEach((element) => element.classList.add("is-visible"));
    console.warn("Motion disabled:", error);
  }
}());
```

Every hidden-until-revealed rule must begin with `.js`. Plain CSS must never hide content by default.

### Hero entrance

- Animate the hero once on load.
- Use a `24px` rise, `600ms` duration, and `100ms` stagger.
- Animate only `transform` and `opacity`.
- Keep the total sequence brief.

### Section reveal

- Apply `.reveal` only to top-level static sections present in the initial markup.
- Use one `IntersectionObserver` at approximately `0.15` threshold.
- Fade and rise by `28px` over `600ms`.
- Unobserve each section after it appears.
- Guard unsupported observers and reveal content immediately.
- Add a three-second failsafe that reveals anything still waiting.

### Rendered results

- Never animate the results container.
- Animate only newly inserted result children with CSS so replacement naturally restarts the animation.
- Keep empty, error, warning, and status elements outside this selector so they appear instantly at full opacity.
- Use a `60ms` stagger and cap the index at `8`.
- If changing render code is prohibited, assign `--i` with `:nth-child()` selectors instead of editing JavaScript.

```css
.js .results > * {
  animation: result-rise 420ms ease backwards;
  animation-delay: calc(var(--i, 0) * 60ms);
}

.js .results > :nth-child(n + 9) { --i: 8; }
```

## 6. Carousel — only when the product has gallery content

Do not add a carousel to search results, ranked lists, forms, or text-first content. Use it only for a small product-relevant gallery that benefits from viewing one item at a time.

When appropriate:

- use CSS `scroll-snap`, not JavaScript positioning;
- center the active item;
- keep the active item at full opacity and scale with a shadow;
- render neighboring items at `0.35` opacity and `0.82` scale;
- use a `400ms` transition;
- provide clearly labeled Previous and Next buttons without decorative arrows;
- support Left and Right arrow keys when the track is focused;
- make the track keyboard reachable with a role and accessible name;
- use a track-rooted `IntersectionObserver` to set `is-active`;
- guard every lookup and skip the feature silently when absent;
- show roughly one item at a time on small screens;
- disable smooth scrolling under reduced motion.

## 7. Verification

Run every existing test and every line in the project’s check file. Then verify:

1. All original behavior hooks and function signatures are unchanged.
2. Loading, success, empty, warning, and error states still work.
3. Empty and error states appear immediately at full opacity.
4. Results render correctly on a second and third request or search.
5. With JavaScript disabled, all static content is visible.
6. With reduced motion enabled, the page is still and usable.
7. Keyboard focus is visible and follows a logical order.
8. The carousel, when present, works with buttons and arrow keys.
9. Images, when present, do not cause layout shift.
10. Layouts work at approximately 375px, 768px, 1024px, and 1440px.
11. Tile hover produces the intended accent box-shadow on pointer devices without affecting touch use.
12. No console error is introduced.

If a check fails, make one focused fix and rerun it. If the fix would require changing product behavior, revert the visual change instead.

## 8. Delivery

Show the finished page, then report:

- the visual direction and why it fits the product;
- the files changed;
- the sections receiving reveal motion;
- whether a carousel was included and why;
- each check as pass, fail, or not applicable;
- any functionality-preserving adaptation made because this project’s filenames or DOM structure differed from the examples.
