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

Tasks and Overview share one TaskForm and the shell dialog. The form uses the dialog's full-height sheet variant on mobile. Saving closes the dialog and keeps the originating view. Failed writes preserve the draft. Deletion uses the same dialog with Cancel focused first. Overview shows up to five unfinished tasks and offers undo for its most recent completion while the view remains open. Habits, Focus, and Progress retain their clearly labeled placeholders.

Task filters, sorting, and priority use native selects. Due dates use a native date input whose picker follows the device and browser. Doop labels and displays dates in the selected app language and persists the date-only value. The task list uses responsive rows with text labels for priority, status, and actions.

The shell owns workspace storage feedback. Opening uses a status announcement. A blocked upgrade explains how to release it. A connection or read failure shows a localized alert with a retry button. Retry returns keyboard focus to the main landmark and repeats the failed open or read. Write failures explain how to repeat the original action and stay visible until that action succeeds. The shell remains navigable during a failure.
