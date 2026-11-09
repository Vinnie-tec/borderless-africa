# Borderless Africa

## Styling

The app uses SCSS: `src/app/globals.scss` contains shared design tokens and
base styles, while component styles live in `.module.scss` files. Keep the
visual system consistent by using the existing CSS custom properties for
surfaces, text, borders, and the Science Blue accent rather than introducing
new one-off colors.

Inter is the default reading font and Roboto is used for display typography;
both are loaded and self-hosted through `next/font` in the root layout. The
theme toggle applies `data-theme="light"` or `data-theme="dark"` to the root
element and saves the selection in local storage. With no saved selection, the
system color-scheme preference is used.
