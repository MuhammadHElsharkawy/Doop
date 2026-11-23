---
version: alpha
name: Doop
description: A daily planning and focus workspace with the clarity of a desk planner.
colors:
  background: '#f8faf6'
  text: '#243a34'
  primary: '#347f6d'
typography:
  display:
    fontFamily: 'Georgia, serif'
    fontWeight: 700
  body:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
omitted:
  - section: spacing
    reason: 'The smoke page uses Tailwind spacing utilities. Shared spacing is a M1 decision.'
  - section: rounded
    reason: 'The smoke page has no containers or controls with rounded corners.'
  - section: components
    reason: 'Shared product components begin in M1.'
---

# Doop design context

## Overview

Doop serves students, professionals, and people building routines. Use the visual hierarchy of a desk planner so users can spot their next action at a glance. Use plain labels and keep progress feedback descriptive. The product targets English and Arabic readers across desktop and mobile browsers. See the [PRD design requirements](PRD.md#14-uiux-requirements).

## Colors

The M0 page uses warm off-white for the canvas, deep forest for text, and primary emerald for the heading's single rule. These roles come from the PRD's candidate palette. [src/styles.css](../src/styles.css) owns the runtime values in `--page-background`, `--page-text`, and `--page-accent`. Full theme and appearance tokens belong to the [M1 design foundation](03-IMPLEMENTATION-ROADMAP.md#m1--shell-and-design-foundation).

## Typography

The smoke page uses a serif Doop heading and local system fonts for body copy. Arabic typography belongs to M1.

## Layout

The smoke page has a compact reading column, with spacing and type sizes set by Tailwind utilities in [the root component](../src/app/app.component.ts). It has no interactive elements. Navigation, shared controls, and product layouts begin in M1.
