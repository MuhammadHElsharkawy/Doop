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

Tasks and Overview share one TaskForm and the shell dialog. The form uses the dialog's full-height sheet variant on mobile. Saving closes the dialog and keeps the originating view. Failed writes preserve the draft. Deletion uses the same dialog with Cancel focused first. Overview shows up to five unfinished tasks and offers undo for its most recent completion while the view remains open.

Progress opens on the last seven days. Presets use the local calendar and custom dates use native date inputs. The report shows its selected period above the totals. Large custom periods show the full-period totals with daily activity paged by 30 days. Each chart value is also available as text in the daily activity table.

Settings extends the shell dialog with autosaved timer and sound fields, a reference for existing keyboard interactions, and local data actions. Import and Clear All Data use the shared confirmation dialog with Cancel focused first. Invalid files stay outside confirmation. Replacement errors leave confirmation open for retry or cancellation.

Destructive confirmation dialogs expose the warning as their accessible description. Backup feedback distinguishes imports that exceed the browser restore budget from invalid backup data. A replacement invalidates pending timer actions, including in a tab that missed the notification.

Overview shows the local greeting and date, then the three Daily Summary metrics. Today's Tasks and Today's Habits sit side by side on desktop and stack on smaller screens. Focus Goal and Quick Actions follow them. Add Task and Add Habit open their shared editors and return focus to the launcher. Start Focus is a navigation link. Unavailable metrics show an unavailable state, and focus data can be retried without hiding the planning sections.

Focus keeps the timer as the primary surface. Presets and the shared duration dialog set the next Pomodoro. The break settings dialog uses native numeric fields and a native select for the transition mode. The shared Stop dialog pauses the active session and focuses Continue first. Cancel and Escape restore its earlier running or paused state. Focus completion, break state, and timer errors are announced separately from the changing time. Manual and recovered completions offer Start break and Skip break. The running break keeps the timer and break controls in view. The interface explains browser suspension and background alert limits.

An unsuccessful timer write leaves the persisted state intact and offers retry. A keyboard retry that succeeds restores focus to the primary control. A failed retry keeps focus on Retry. A stale command refreshes the timer and announces the conflict. Invalid timing data produces a distinct alert and remains in storage. See the [Focus transition table](FOCUS-TRANSITIONS.md).

Break settings show the allowed ranges in validation feedback. If continuing a paused session fails, Focus explains that it remains paused and Retry repeats the resume.

Before starting Pomodoro or Stopwatch, Focus offers a native task select with No task as the default. A task that becomes unavailable before Start is rejected with feedback, and the user can select again. A session shows the title captured on start until it is saved.

Focus shows the daily goal and eligible Focus Time alongside a native goal field. History uses a native date input with an All dates action. History displays saved partials with a separate outcome label. Session removal uses the shared confirmation dialog with Cancel focused first. Failed deletion keeps the dialog and action available. Successful deletion returns focus to the date filter.

The ambient sound controls use a native select and range field. Changing tracks stops playback. Play requires an explicit action, including after reload. Playback is independent of timer controls and internal navigation while the browser allows it. The selection and volume persist, with retry when saving fails.

Task filters, sorting, and priority use native selects. Due dates use a native date input whose picker follows the device and browser. Doop labels and displays dates in the selected app language and persists the date-only value. The task list uses responsive rows with text labels for priority, status, and actions.

Habits and Overview share the HabitForm and Today's Habits. The form uses the same full-height mobile sheet and native date input, plus native radios and weekday checkboxes. Arabic weekdays start with Saturday and follow the document direction. The Habits consistency period is a native select. Save and delete follow the Tasks dialog and error patterns. Completion and undo keep focus on the same row. Archive and restore move the row between active and archived lists. Overview shows all of today's occurrences in a contained scroll area and provides a link to Habits. See [habit requirements](PRD.md#7-habit-management-requirements) and [Overview requirements](PRD.md#55-todays-habits).

The shell owns workspace storage feedback. Opening uses a status announcement. A blocked upgrade explains how to release it. A connection or read failure shows a localized alert with a retry button. Retry returns keyboard focus to the main landmark and repeats the failed open or read. Write failures explain how to repeat the original action and stay visible until that action succeeds. The shell remains navigable during a failure.

Habits opens on Today. Each scheduled habit stays in its row after completion. All habits defaults to Active and provides an Archived filter, per-habit history disclosures, and a separate completion history that includes deleted habits. Arrow keys switch tabs and move through row actions. Escape dismisses the action menu.
