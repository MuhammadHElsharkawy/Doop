# Doop interaction contract

The [PRD](PRD.md) and [milestone roadmap](03-IMPLEMENTATION-ROADMAP.md) define product behavior. This contract records the shared behavior implemented in M1.

## Canonical UI map

| Capability      | Canonical owner                       | Behavior                                                                                                                                                                                                                       | Evidence                          |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Navigation      | Root shell and Angular Router         | Overview is the default. Five destinations use one navigation landmark, with current-page semantics and keyboard focus at the destination after navigation. Settings opens separately.                                         | Browser shell test                |
| Modal and sheet | Shared dialog component               | Native modal semantics isolate the background. Escape and the localized close button dismiss the overlay and return focus to the launcher. Mobile uses the same modal as a bottom sheet.                                       | Browser settings test             |
| Single choice   | Native radio groups in Settings       | Visible labels and legends announce the setting and selected value. Browser keyboard conventions apply in both directions.                                                                                                     | Browser settings test             |
| Scrollbar       | Global stylesheet                     | Uses tokenized colors with the platform fallback in forced colors.                                                                                                                                                             | Global CSS                        |
| Preferences     | Preferences and localization services | Settings apply immediately and persist locally. Language updates copy, document direction and route titles. Appearance and palette are independent. A failed write keeps preferences usable in-session and displays a warning. | Unit and browser preference tests |

The five destination routes share a clearly labeled placeholder. Their feature-specific interactions will be defined when those milestones begin.
