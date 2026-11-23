---
version: alpha
name: Doop
description: A daily planning and focus workspace with the clarity of a desk planner.
colors:
  background: '#f8faf6'
  text: '#243a34'
  primary: '#286957'
typography:
  display:
    fontFamily: 'Georgia, serif'
    fontWeight: 700
  body:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
rounded:
  control: '0.5rem'
  panel: '1rem'
spacing:
  control-min: '2.75rem'
components:
  sidebar: {}
  navigation: {}
  dialog:
    textColor: '{colors.text}'
---

# Doop design context

## Overview

Doop serves students, professionals, and people building routines across desktop and mobile web. The workspace takes its cue from a desk planner. A quiet paper-toned canvas, ruled wordmark, and clear heading make it easy to orient yourself. Use plain labels and descriptive progress feedback. See the [PRD design requirements](PRD.md#14-uiux-requirements).

## Colors

[Global styles](../src/styles.css) own runtime tokens. The light canvas and forest text preserve the PRD's palette. The stronger light emerald keeps active text readable. Each theme defines `--theme-light` and `--theme-dark`. The browser's color scheme resolves those values into `--accent` independently of the selected theme. Active navigation, focus outlines, selected controls, and swatches resolve from these variables. Surfaces, foregrounds and borders use semantic tokens across all six themes.

## Typography

The Doop wordmark and English headings use Georgia. Body text and Arabic headings use the system stack to keep both scripts readable without external fonts.

## Layout

Desktop keeps the destination list in a collapsible sidebar. Below 48 rem it becomes a five-item bottom navigation bar with safe-area padding. The current destination uses an edge rule, tone, and accessible page state. Settings stays in the header at both widths. The same modal becomes a bottom sheet on narrow screens.

## Components

Use native links and buttons. Controls keep visible keyboard focus and a minimum 44 px block size. The dialog owns focus restoration, a localized close control, the modal backdrop, and responsive sizing. Controls and navigation move with document direction. See the [interaction contract](UX-CONTRACT.md).

Task management uses a ruled summary above one continuous list. Each row uses the shared surface, border, text, and accent roles. Overdue, validation, and delete controls use the semantic danger role with text labels. The form and Overview preview share the task row and control styles.
