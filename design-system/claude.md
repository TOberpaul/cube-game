# Model Overview

This system uses independent data attributes as the source of truth for UI decisions.

Each attribute controls exactly one axis.

Supported axes include:
- size
- color
- material
- emphasis
- container contrast
- content contrast
- interaction
- wcag
- mode
- relation

Attributes are composable. Some attributes inherit, others must be set explicitly.

Combined variants are derived from resolved attribute values and must not be treated as separate source values.

.adaptive is the required base class for adaptive UI elements.

Do not restyle properties already handled by .adaptive unless a specific visual requirement cannot be achieved otherwise.

Only override base properties when needed for an intentional component specific result, for example:
- removing a border
- applying a border on one side only
- creating a required visual exception

Do not duplicate .adaptive styles without purpose.
Prefer the base class output whenever possible.

# Zero Config Defaults

Everything works without any data attributes. The system provides CSS fallbacks at :root level for all defaults:
- Color: neutral
- Material: filled
- Size: md
- WCAG: aa
- Mode: automatic via prefers-color-scheme

You only set data attributes when you want to override a default.

Do not set default values explicitly. No data-color="neutral", no data-material="filled", no data-size="md".

# CSS Architecture

The system is pure CSS with no JavaScript required.

Core file:
- db-foundation.css — Color, material, contrast, interaction, emphasis, size, typography, layout spacing, relations

## Color Resolution Order

THEME → DATA-COLOR → DATA-MODE → DATA-MATERIAL → CONTRAST → FINAL TOKENS

Theme layer defines real color values using light-dark() for automatic mode switching.
Each color has a 0 to 14 scale plus origin, on-origin, transparent-full, and transparent-semi variants.

Data-color maps theme colors to semantic --data-mode-* variables.
Data-mode optionally forces light or dark for a subtree.
Data-material defines the surface treatment.
Contrast layers resolve container and content contrast.

## Final Output Tokens

These are the runtime CSS variables consumed by components:
- --db-background / --db-background-hovered / --db-background-pressed
- --db-text / --db-text-hovered / --db-text-pressed
- --db-border
- --db-visual / --db-visual-hovered / --db-visual-pressed

## Inheritance Mechanism

Attributes that inherit use --inherited-* CSS custom properties.
Parent sets both the local token and the --inherited-* variant.
Children without the attribute resolve to the --inherited-* value automatically.

# Attribute Definitions

## data-size

Allowed values: xs, sm, md, lg, xl
Controls: overall component size

Typically affects: min-height, padding, border-radius, font-size, line-height, gap, icon size

.adaptive sets min-height and min-width based on the resolved size.
Components never use fixed height or width. Their actual size emerges from content and padding.
min-height ensures the minimum size contract without constraining growth.

data-size is inherited by default and may be overridden locally.

Size tokens per variant:
- --size-container — Component height
- --size-icon — Icon dimensions
- --size-text / --size-text-min — Font size
- --size-line-height / --size-line-height-min — Line height
- --size-gap-min / --size-gap-max — Spacing between elements (max is always 2x min)
- --size-padding / --size-padding-min — Internal padding
- --size-border-radius / --size-border-radius-full — Corner radius

Size scale reference:
- xs: 20px container, 14px icon, 10.66px text
- sm: 24px container, 18px icon, 13.33px text
- md: 32px container, 20px icon, 16px text
- lg: 40px container, 24px icon, 18.66px text
- xl: 48px container, 28px icon, 21.33px text

## data-color

Allowed values: neutral, brand, action, yellow, orange, red, burgundy, pink, violet, blue, cyan, turquoise, light-green, green and additional theme-defined custom values

Controls: the color family of the component

Typically affects: background color, border color, text color, icon color

data-color defines the chromatic direction only.
It must not define size, material, emphasis, or contrast.

data-color is inherited by default and may be overridden locally.

## data-material

Allowed values: filled, filled-2, inverted, vibrant, origin, semi-transparent, transparent

Controls: the surface behavior of the component

Typically affects: background treatment, border visibility, transparency, surface intensity

data-material defines how the surface is rendered.
It must not define size, color, emphasis, or contrast.

data-material is inherited by default and may be overridden locally.

## data-emphasis

Allowed values: strong, regular, weak

Controls: the visual prominence of the content

Typically affects: text prominence, icon prominence, content visibility

data-emphasis defines content prominence only.
It must not define size, color, material, or contrast.

data-emphasis is inherited by default and may be overridden locally.

## data-container-contrast

Allowed values: min, max

Controls: the contrast level of the container

Typically affects: container visibility, surface separation, contrast strength against the surrounding context

data-container-contrast defines container contrast only.
It must not define size, color, material, emphasis, or content contrast.

data-container-contrast does not inherit and must be set explicitly where needed.

Default: min

## data-content-contrast

Allowed values: min, max

Controls: the contrast level of the content

Typically affects: content visibility, content readability, contrast strength against the container

data-content-contrast defines content contrast only.
It must not define size, color, material, emphasis, or container contrast.

data-content-contrast does not inherit and must be set explicitly where needed.

Default: max

## data-interactive

Allowed values: true

Controls: interactive behavior

Typically affects: hover states, pressed states, cursor behavior, interactive feedback

data-interactive enables interactive visual states.
Use it for clickable or pressable elements.

data-interactive does not define size, color, material, emphasis, or contrast.

data-interactive does not inherit and should be set explicitly on the interactive element.

## data-wcag

Allowed values: aa, aaa

Controls: the accessibility contrast standard

Typically affects: contrast mapping, contrast thresholds, material and contrast token resolution

data-wcag defines the active accessibility contrast level.
It does not define size, color, material, emphasis, or interaction.

data-wcag is set globally on the html element and acts as the active global contrast standard.

## data-mode

Allowed values: light, dark

Controls: the forced light or dark mode for a subtree

Typically affects: theme value resolution, light and dark appearance, mode dependent color output

data-mode forces a visual mode for the current subtree.
Without data-mode, mode is resolved automatically through prefers-color-scheme.

data-mode is inherited by default and may be overridden locally.

Do not set data-mode globally. Let prefers-color-scheme handle it.
Use data-mode only to force a specific mode on a subtree.

## data-relation

Allowed values: smaller-3, smaller-2, smaller, main, bigger, bigger-2

Controls: the relative size shift based on the inherited or explicit base size

Typically affects: resolved component size, resolved padding, resolved border-radius, resolved typography, resolved icon size

data-relation modifies size relative to the current size context.
It should be used to create local size hierarchy without replacing the inherited base size.

Relation mapping:
- smaller-3: shift down 3 steps
- smaller-2: shift down 2 steps
- smaller: shift down 1 step
- main: no change (default)
- bigger: shift up 1 step
- bigger-2: shift up 2 steps

Example: data-size="md" + data-relation="smaller" resolves visually to sm.

data-relation works without data-size. It resolves relative to the inherited parent size context.

data-relation does not define color, material, emphasis, contrast, or interaction.

data-relation may be set locally where relative size adjustment is needed.

# Inheritance Summary

Inherits from parent (set once, children get it):
- data-size
- data-color
- data-material
- data-emphasis
- data-mode

Global only:
- data-wcag

Does not inherit (set explicitly per element):
- data-container-contrast
- data-content-contrast
- data-interactive

# Usage Rules

## Size Usage Rules

Use the same data-size for components that should align or attach directly.

Use one size step down for nested elements when a smaller inner element is intended.

## Color Usage Rules

Use data-color to define the color family only.

Do not use data-color to express material, emphasis, or contrast.

Use the inherited data-color by default.

Only override data-color locally when a child element must intentionally use a different color family than its parent.

## Material Usage Rules

Use data-material to define surface behavior only.

Do not use data-material to express size, color, emphasis, or contrast.

Use the inherited data-material by default.

Only override data-material locally when a child element requires a different surface treatment than its parent.

## Emphasis Usage Rules

Use data-emphasis to define content prominence only.

Do not use data-emphasis to express size, color, material, or contrast.

Use the inherited data-emphasis by default.

Only override data-emphasis locally when a child element requires a different level of prominence than its parent.

## Container Contrast Usage Rules

Use data-container-contrast to define the contrast level of the container only.

Use the default container contrast behavior unless a different contrast level is required.

Set data-container-contrast explicitly only on elements that require a different container contrast level.

Do not use data-container-contrast to express size, color, material, emphasis, or content contrast.

## Content Contrast Usage Rules

Use data-content-contrast to define the contrast level of the content only.

Do not use data-content-contrast to express size, color, material, emphasis, or container contrast.

Use the default content contrast behavior unless a different content contrast level is required.

Set data-content-contrast explicitly only on elements that require a different content contrast level.

# Component Tokens vs Layout Tokens

The size system provides two sets of spacing tokens for different purposes.

## Component Tokens

For the inside of a component and tightly coupled element pairs.

- --size-padding / --size-padding-min — Internal padding of a component
- --size-gap-min / --size-gap-max — Gap inside a component (icon to label in a button, label to input in a form field)

Use component tokens when elements form a single visual unit.
Examples: padding inside a button, gap between icon and text in a button, gap between a label and its input.

## Layout Tokens

For the space between and around independent components.

- --layout-spacing — Standard layout padding
- --layout-spacing-min — Compact layout gap (between sibling components)
- --layout-spacing-max — Generous layout padding

Layout spacing tokens react to data-size. There is no separate data-spacing attribute.

Layout spacing values per size:
- xs: 16px / 8px / 32px
- sm: 20px / 10px / 40px
- md: 24px / 12px / 48px
- lg: 32px / 16px / 64px
- xl: 48px / 24px / 96px

Use layout tokens when the space is between independent components or defines container structure.
Examples: padding of a card or section, gap between buttons in a button row, gap between cards in a grid.

Do not replace .adaptive completely.
Use targeted overrides for layout specific spacing only.

# Typography

.adaptive uses size based typography tokens by default.

For headings and text styles, use the dedicated typography tokens instead of deriving typography from component size alone.

Available tokens:
- var(--h1-size) / var(--h1-line-height)
- var(--h2-size) / var(--h2-line-height)
- var(--h3-size) / var(--h3-line-height)
- var(--h4-size) / var(--h4-line-height)
- var(--h5-size) / var(--h5-line-height)
- var(--h6-size) / var(--h6-line-height)
- var(--body-size) / var(--body-line-height)
- var(--body-small-size) / var(--body-small-line-height)

Typography tokens react to data-size. Set data-size="lg" on a section and all headings and body text inside scale up automatically.

Use typography tokens when the element expresses text hierarchy or reading style rather than component sizing.

Do not use heading or body typography tokens to replace component size behavior globally.
Use them only for text specific styling.

# Composition Rules

Use the same data-size for components that should align or attach directly.

Use a smaller data-size or data-relation="smaller" for nested elements when a smaller inner element is intended.

Attached elements should appear as part of one continuous composition.

Nested elements should remain visually contained within their parent.
Inner adaptive elements often use data-relation="smaller" when a visually smaller nested element is intended.

Size also resolves related visual properties such as padding, height, and border radius.

# Attached Edge Cases

Attached compositions may require targeted visual overrides.

Allowed examples include:
- removing a border between attached elements
- applying a border on one side only
- adjusting border-radius on attached sides
- removing padding on attached sides when needed

Use these overrides only to support the attached composition.

Do not restyle the full element if a targeted edge adjustment is sufficient.

# CSS Patterns

Component pattern (only overrides that differ from .adaptive):

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--size-padding);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  font-family: inherit;
}

Layout container pattern (only overrides that differ from .adaptive):

.card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

Layout between components:

.button-row {
  display: flex;
  gap: var(--layout-spacing-min);
}

Icon pattern:

.icon {
  width: var(--size-icon);
  height: var(--size-icon);
  fill: none;
  stroke: currentColor;
  color: var(--db-visual);
}

# Component Authoring Rule

Before writing any CSS property on a component, ask:
Does .adaptive already set this property?

If yes → Do NOT set it again.
Only set it if the component needs a DIFFERENT value than what .adaptive provides.

.adaptive provides:
- padding → only override if the component needs different padding (e.g. padding: 0)
- min-height / min-width → never re-set, components derive their size from content and padding
- background → never re-set, it comes from the token chain
- color → never re-set, it comes from the token chain
- border → only override to remove it (border: none) or change to one side only
- border-radius → only override if a different radius is needed (e.g. border-radius-full)
- font-size → only override if the component uses a different size token (e.g. --size-text-min)
- line-height → only override if the component uses a different token
- gap → only override if the component needs a different gap token

Do not use height or width to force component dimensions. Component size emerges from content + padding. The min-height from .adaptive ensures the minimum size contract.

If a property is NOT in .adaptive (e.g. display, cursor, font-weight, white-space, overflow, position, text-decoration, font-family), set it freely.

When in doubt: do not set the property. If .adaptive handles it, trust .adaptive.

# Inverted Material Rule

- `data-material="inverted"` MUST always be combined with `data-container-contrast="max"`.
- Inverted is the standard material for checked/active states (checkbox, radio, toggle).
- In CSS, checked states use `--data-mode-1` (background) and `--data-mode-14` (foreground) — these correspond to inverted + container-contrast max tokens.

# Authoring Rules for AI

Use existing component APIs, .adaptive, and supported data-* attributes as the primary styling mechanism.

Do not use inline styles unless a specific visual requirement cannot be achieved otherwise.

Do not create new ad hoc styling classes unless a specific visual requirement cannot be achieved otherwise.

Prefer inheritance over redundant local attribute declarations.

Only set or override a data-* attribute when the element must intentionally differ from its inherited context.

Do not recreate design system behavior outside the foundation model if it can already be expressed through existing system primitives.

Use rem not px. 16px equals 1rem.

Use gap and padding only. No margins.

Do not use var() fallbacks. Fallbacks are defined at :root level.

Do not use !important. The system is designed to work without it.

Do not use JavaScript for theming. Everything is CSS based.

# Examples

<body>
  <button class="adaptive">Root fallback defaults</button>
</body>

<section data-material="vibrant">
  <button class="adaptive">Inherited vibrant material</button>
</section>

<section data-material="vibrant">
  <button class="adaptive" data-material="filled">Local material override</button>
</section>

<div data-color="brand" data-size="lg">
  <div class="adaptive">Inherits brand color and lg size</div>
  <div class="adaptive" data-material="vibrant">Overrides material only</div>
</div>

<div class="adaptive" data-size="lg">
  <span class="adaptive input__label" data-relation="smaller">Visually md inside lg parent</span>
</div>

<div data-mode="dark">
  <div class="adaptive" data-material="vibrant" data-color="brand">
    Dark mode forced for this subtree
  </div>
</div>

<button class="adaptive" data-material="vibrant" data-interactive>
  Interactive button with hover and pressed states
</button>

## Do

- Use .adaptive for adaptive UI elements.
- Use data-* attributes as the source of truth for UI decisions.
- Use inheritance as the default behavior.
- Override locally only when an element must intentionally differ from its inherited context.
- Use existing design system primitives whenever possible.

## Don't

- Do not use inline styles without a specific visual reason.
- Do not create new ad hoc styling classes without a specific visual reason.
- Do not duplicate values already provided through inheritance.
- Do not use one attribute to express another.
- Do not recreate design system behavior outside the foundation model when it can already be expressed through existing primitives.
- Do not set default values explicitly.

# Page Building Workflow

When asked to build a page, follow this process:

## 1. Choose a Template

Every page starts from a template. Pick the one that matches the request:

- **landingpage** → Marketing pages, product pages, feature showcases
- **dashboard** → Data views, admin panels, KPI overviews, analytics
- **content-page** → Articles, documentation, detail pages, blog posts
- **form-page** → Contact forms, registration, surveys, settings pages
- **page** → Minimal base layout when no specific template fits

Reference the matching HTML file in templates/ for the full structure.

## 2. Compose from Modules

Templates are built from modules. Use the existing module patterns from modules/:

- **header** → Top navigation with logo, nav links, and actions
- **hero** → Large intro section with headline, text, CTA buttons, and optional media
- **feature-grid** → Grid of feature cards with icons, titles, and descriptions
- **testimonial** → Customer quotes in a grid layout
- **cta** → Call-to-action banner with headline and buttons
- **stats-row** → KPI cards in a row (value, label, trend tag)
- **sidebar** → Vertical navigation for dashboards
- **form-section** → Form layout with rows, fields, and action buttons
- **footer** → Multi-column footer with links and copyright

Reference the matching HTML file in modules/ for the exact markup.

## 3. Use Components

Modules are built from components. Use the existing component patterns from components/:

accordion, avatar, badge, breadcrumb, button, card, check, divider, headline, icon, input, link, list, modal, notification, pagination, progress, section, select, table, tabs, tag, textarea, toggle, tooltip

Reference the matching HTML file in components/ for all variants and correct markup.

## Key Rules for Page Building

Always use the HTML reference files as the source of truth for markup structure.

Do not invent new component markup. Use what exists.

Do not create new CSS classes when existing components cover the need.

Do not write new CSS unless the page requires a layout or element that does not exist in the system.

Adapt content and data attributes to the topic — not the structure. The structure comes from the templates and modules.

Every element that renders visually must use class="adaptive" plus the component class.

Every interactive element must have data-interactive.

Set data-color, data-material, data-emphasis, and data-size only when overriding the inherited context.

Include all required CSS files via link tags: foundation.css + each component/module CSS used on the page.

## Icons

Use Lucide Icons (https://lucide.dev/icons/) as the icon system.

Include icons as inline SVG directly in the HTML markup. Do not use an icon font or external sprite file.

All Lucide SVGs must use these attributes to integrate with the design system:
- class="icon" (or be inside an .icon-wrapper)
- width and height are controlled by the parent via var(--size-icon) — do not set fixed dimensions on the SVG
- Use fill="none", stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round" (Lucide defaults)

The icon color inherits from the parent's --db-visual token automatically via currentColor.

Example:
```html
<button class="adaptive button" data-interactive data-material="origin" data-color="action">
  <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  Add Item
</button>
```

Do not use filled icon styles. Lucide icons are stroke-based.

Pick icons that clearly communicate the intended meaning. Prefer common, universally understood icons.

## Output Location

Generated pages must never be placed inside the design-system/ folder. The design system contains only reusable primitives (foundation, components, modules, templates). It is not a place for project-specific output.

Place all generated pages outside the design-system/ folder, for example in a top-level pages/ directory.

CSS link paths must be relative from the page location to the design-system/ folder (e.g. ../design-system/foundation.css).

## Output Format

When building a page, output a single self-contained HTML file that:
- Links to foundation.css and all required component/module/template CSS files
- Uses correct relative paths from the page location to the design-system/ folder
- Is immediately openable in a browser
- Contains realistic placeholder content matching the requested topic

# Border Override Rule

When a component needs a border on only one side, first reset the `.adaptive` border with `border: none`, then apply the specific side border.

```css
.component {
  border: none;
  border-right: var(--size-1) solid var(--db-border);
}
```

`.adaptive` sets `border` on all sides. Adding only `border-right` without resetting first results in borders on all sides.

# data-relation Scope Rule

`data-relation` is only for content sub-elements inside components (labels, hints, sub-text).

Do not use `data-relation` on standalone components like buttons in modules or templates. Use `data-size` directly for those.

Valid: `<span class="adaptive input__label" data-relation="smaller-3">Label</span>` inside an input.
Invalid: `<button class="adaptive button" data-relation="smaller">` inside a hero module.

# Size via Relation, Not CSS Tokens

When a sub-element inside a component needs to be smaller (e.g. labels, hints), do not hardcode `--size-text-min` or `--size-line-height-min` in CSS. Instead, make the element `adaptive` and use `data-relation` in HTML.

This keeps sizing in the attribute system and scales correctly with inherited `data-size`.

Add `min-height: 0` in CSS for sub-elements that should not have the `.adaptive` min-height.

# Origin Background Rule

On `data-material="origin"` surfaces, only use `data-material="origin"` children. Other materials like `semi-transparent` or `transparent` will not have correct contrast.

# Thin Elements Override

Elements that should be visually thin (dividers, progress bars) need `min-height: 0` to override the `.adaptive` min-height default.

# Focus Style

All `[data-interactive]:focus-visible` elements use a double focus ring (white inner, black outer) for visibility on any background. Do not override focus styles on individual components.

# Icon Alignment

When icons need to align with text, use a wrapper with `height: var(--size-line-height)` and `display: flex; align-items: center`.
