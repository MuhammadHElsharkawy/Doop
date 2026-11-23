# Product Requirements Document (PRD)

# Doop --- Productivity Workspace

**Document Version:** 1.3\
**Status:** Draft --- MVP Definition\
**Product Type:** Personal Productivity Application\
**MVP Platform:** Responsive Web Application (desktop, tablet, mobile browsers)\
**Next Planned Platform:** Native Android and iOS applications after web MVP validation\
**Supported Layouts:** Desktop, Tablet, Mobile\
**Previous Version:** Focusly PRD v1.1\
**Document Purpose:** Product scope, behavior, functional requirements,
data requirements, and MVP acceptance criteria

------------------------------------------------------------------------

## Document Change Log

  -----------------------------------------------------------------------
  Version                             Summary
  ----------------------------------- -----------------------------------
  1.0                                 Initial focus timer and
                                      task-management definition

  1.1                                 Expanded Pomodoro, Stopwatch, task,
                                      history, and settings requirements

  1.2                                 Repositioned Doop as a broader
                                      productivity workspace

  1.3                                 Confirmed web-first delivery and
                                      native mobile roadmap; unified
                                      creation forms; revised skipped-break
                                      rules, historical records, session
                                      recovery, and analytics definitions
  -----------------------------------------------------------------------

## 1. Product Overview

### 1.1 Product Description

Doop is a productivity workspace designed to help users organize their
daily activities, build consistent habits, stay focused, and understand
their productivity over time.

It brings task management, habit tracking, focus sessions, and
productivity insights together in one unified workspace.

The application provides five main destinations:

1.  Overview
2.  Tasks
3.  Habits
4.  Focus
5.  Progress

Settings are accessible separately from the main navigation.

### 1.2 Problem Statement

People who want to stay productive often rely on separate applications
to manage tasks, remember recurring activities, run focus timers, and
review their progress. Moving between disconnected tools creates
friction and makes it harder to maintain a consistent daily workflow.

Doop addresses this by bringing daily planning, task management, habit
tracking, focus tools, and personal productivity history into one
coherent workspace.

### 1.3 Product Vision

To make organizing work, building productive habits, and maintaining
focus a simple and consistent part of everyday life.

### 1.4 Target Audience

Doop is designed for people who want a practical way to organize their
work and personal development activities.

Primary audiences include:

-   **Students:** People managing lectures, assignments, revision,
    projects, and independent study.
-   **Employees and professionals:** People organizing responsibilities
    and maintaining focus during work.
-   **Productivity-minded individuals:** People who want to build
    consistent routines, manage tasks, and understand their progress.

The product is intended for a broad audience rather than one profession
or academic discipline.

### 1.5 Core Value Proposition

Doop helps users plan what matters, build consistency, focus on their
work, and track their progress --- all in one place.

### 1.6 Product Principles

Doop should follow these principles:

-   **Clear daily direction:** Users should quickly understand what
    needs attention today.
-   **Low-friction actions:** Common actions should require as few steps
    as reasonably possible.
-   **Distraction-free focus:** The Focus destination should prioritize
    the active session and minimize unrelated information.
-   **Useful progress, not pressure:** Statistics should help users
    understand their activity without relying on competitive or punitive
    mechanics.
-   **Consistent behavior:** Completing an item in one destination must
    update relevant information throughout the application.
-   **Local-first privacy:** MVP data remains on the user's device
    unless the user explicitly exports it.

------------------------------------------------------------------------

## 2. Product Goals and Success Measures

### 2.1 Primary Product Goals

1.  Give users a clear overview of their daily productivity.
2.  Allow users to create, organize, complete, and review tasks.
3.  Help users build recurring habits and track completion consistency.
4.  Provide reliable Pomodoro Timer and Stopwatch tools.
5.  Allow focus sessions to be associated with tasks when useful.
6.  Track daily focus goals using eligible completed focus sessions.
7.  Provide useful historical productivity statistics.
8.  Keep the experience responsive, accessible, and distraction-free.
9.  Preserve user data locally and support backup and restoration.

### 2.2 Product Success Measures

The following can be used to evaluate product usefulness:

  -----------------------------------------------------------------------
  Measure                             Definition
  ----------------------------------- -----------------------------------
  Focus Session Completion Rate       Eligible completed focus sessions
                                      divided by eligible completed plus
                                      saved partial Timer sessions.
                                      Discarded sessions are excluded
                                      from both numerator and denominator

  Sessions per Active User            Average number of eligible
                                      completed focus sessions per active
                                      user

  Task Completion Rate                Completed tasks divided by tasks
                                      tracked in the selected measurement
                                      period, using a clearly defined
                                      reporting method

  Habit Completion Rate               Completed scheduled habit
                                      occurrences divided by scheduled
                                      habit occurrences

  Returning Usage                     Percentage of users who return to
                                      use the application after their
                                      first use
  -----------------------------------------------------------------------

These are product evaluation measures. The MVP does not require
analytics tracking, account creation, or sending personal activity data
to a server.

### 2.3 Product Analytics Scope

Basic personal analytics displayed to the user in the Progress
destination are included in the MVP.

Advanced forecasting, AI-generated recommendations, external analytics
integrations, and social comparisons are excluded.

------------------------------------------------------------------------

## 3. MVP Scope

### 3.1 In-Scope Features

The MVP includes:

1.  Overview dashboard.
2.  Task management.
3.  Habit management and recurring schedules.
4.  Habit completion history and consistency metrics.
5.  Pomodoro focus timer.
6.  Stopwatch.
7.  Short and long break timers.
8.  Configurable Pomodoro cycle.
9.  Optional ambient sound player.
10. Focus session history.
11. Daily focus goal tracking.
12. Progress dashboard and basic analytics.
13. Application settings.
14. Local data persistence.
15. Local data export and import.
16. Responsive desktop, tablet, and mobile web layouts.
17. English and Arabic localization, including RTL support.
18. Light, dark, and system themes.

### 3.2 Out-of-Scope Features

The following are excluded from the initial MVP:

-   User authentication and user profiles.
-   Cloud synchronization and cross-device sync.
-   Collaboration, shared tasks, and shared habits.
-   Social feeds, leaderboards, and public profiles.
-   AI productivity assistant or AI-generated recommendations.
-   Calendar integrations.
-   Subscription and payment systems.
-   Advanced forecasting and predictive analytics.
-   Task subtasks, dependencies, categories, and tags.
-   Multiple simultaneous ambient sound layers.
-   Push notifications and scheduled reminders.
-   Native Android and iOS applications in the initial release. They are
    planned for a subsequent phase after web MVP validation.
-   PWA-specific offline installation features unless separately
    approved.

### 3.3 Scope Clarifications

-   Pomodoro focus and break timers, automatic/manual transitions,
    configurable cycle frequency, and break skipping are MVP features.
-   Basic productivity charts and historical analytics are MVP features;
    advanced analytics remain out of scope.
-   Habit completion rates and completion history are in the MVP. Advanced
    streak calculations are deferred to a later release.
-   A habit reminder/notification system is not included in the MVP.
-   Export/import is a local backup capability, not cloud
    synchronization.

------------------------------------------------------------------------

## 4. Application Structure and Navigation

### 4.1 Main Destinations

The application has five primary destinations:

  -----------------------------------------------------------------------
  Destination                         Responsibility
  ----------------------------------- -----------------------------------
  Overview                            Daily planning, quick completion
                                      actions, and concise daily summary

  Tasks                               Full task creation, organization,
                                      editing, and deletion

  Habits                              Habit creation, scheduling,
                                      management, and completion history

  Focus                               Pomodoro Timer, Stopwatch, breaks,
                                      ambient sounds, and session history

  Progress                            Historical productivity statistics
                                      and trends
  -----------------------------------------------------------------------

Settings are accessed separately and are not a sixth primary
destination.

### 4.2 Desktop Navigation

-   Use a collapsible sidebar.
-   Display the five primary destinations in the sidebar.
-   Provide a clear active navigation state.
-   Keep Settings accessible from the application shell.
-   The Overview destination is the default landing page.

### 4.3 Mobile Navigation

-   Use bottom navigation for the five primary destinations.
-   Keep navigation labels and icons understandable.
-   Ensure the main content remains usable on narrow screens.
-   The Focus destination must remain optimized for the active timer and
    its controls.

### 4.4 Navigation and State Consistency

Navigating between destinations must not unintentionally stop or reset
an active focus session.

Ambient sound playback must remain independent of navigation and timer
state, subject to browser and operating-system restrictions.

------------------------------------------------------------------------

## 5. Overview Requirements

### 5.1 Purpose

Overview is the user's daily command center. It combines daily planning
and a concise productivity summary.

It should answer two questions:

-   What should I focus on today?
-   How is my day progressing?

Overview is not intended to replace the detailed Tasks, Habits, Focus,
or Progress destinations.

### 5.2 Overview Sections and Order

The recommended desktop structure is:

1.  Greeting and current local date.
2.  Daily Summary.
3.  Main content area containing Today's Tasks and Today's Habits side
    by side.
4.  Bottom area containing Focus Goal and Quick Actions.

On mobile, these sections stack vertically in the same logical order.

### 5.3 Daily Summary

Display exactly three primary metrics:

  -----------------------------------------------------------------------
  Metric                              Definition
  ----------------------------------- -----------------------------------
  Tasks Completed                     Number of tasks due today that are
                                      completed / total tasks due today

  Habits Completed                    Completed habits / active habits
                                      scheduled for today

  Focus Time                          Total duration of eligible
                                      completed Pomodoro focus sessions
                                      and saved Stopwatch sessions
                                      completed today
  -----------------------------------------------------------------------

Rules:

-   Daily calculations use the user's local calendar date.
-   Tasks without a due date and overdue tasks can appear in the task
    list but are not included in the denominator for the Tasks Completed
    metric.
-   A task due today contributes to the denominator whether it is
    pending or completed.
-   A task completed before today but due today remains a completed task
    in the due-today metric.
-   Habit totals include only active habits scheduled for the current
    local date.
-   Focus Time includes naturally completed Pomodoro focus sessions and
    saved Stopwatch sessions.
-   Partial Timer sessions and discarded sessions do not contribute to
    Focus Time.

### 5.4 Today's Tasks

Overview displays a concise list of incomplete tasks.

Display priority order:

1.  Overdue tasks.
2.  Tasks due today.
3.  Tasks without a due date.

Within the same group, higher-priority tasks should appear before
lower-priority tasks. Other ties may use the most recently updated task
as a secondary ordering rule.

Requirements:

-   Display a small, useful subset of tasks (normally up to five) to
    keep Overview concise.
-   Provide a link to view all tasks.
-   Each task row shows its title, priority, and due-date information
    when available.
-   Users can complete a task directly from Overview.
-   Provide an undo opportunity after accidental completion.
-   Creating, editing, and deleting tasks remain part of task
    management. The Overview may provide an Add Task quick action that
    opens the task creation interface.
-   Overview does not provide full task editing or deletion controls.

### 5.5 Today's Habits

Overview displays every active habit scheduled for the current local
date.

Requirements:

-   Do not impose a fixed five-item limit.
-   Use a contained scrollable list when the number of scheduled habits
    exceeds the available space.
-   Show each habit's name and completion state.
-   Users can complete or undo completion directly from Overview.
-   Provide a link to the Habits destination.
-   Do not display habits that are not scheduled for the current date.
-   Edit, archive, and delete habits in the Habits destination. The
    Overview Add Habit quick action opens the shared creation form.

### 5.6 Focus Goal

Display:

-   Completed eligible focus sessions / daily goal.
-   A progress indicator.
-   Remaining sessions where the goal has not been reached.
-   A clear indication when the goal has been reached.

Counting rules:

-   Naturally completed Pomodoro focus sessions count.
-   Saved Stopwatch sessions count.
-   Partial Timer sessions do not count.
-   Discarded sessions do not count.
-   Break sessions do not count.
-   The progress indicator must not exceed 100%, even if the user
    exceeds the goal.

The default daily goal is six eligible completed focus sessions.

### 5.7 Quick Actions

Provide these actions:

-   **Start Focus:** Navigate to the Focus destination. Do not
    automatically start a Timer or Stopwatch session. The user chooses
    the mode there.
-   **Add Task:** Open the shared task creation form without leaving Overview.
-   **Add Habit:** Open the shared habit creation form without leaving Overview.

The forms must be the same components, fields, validation, and save behavior
used by the Tasks and Habits destinations. On desktop, prefer a dialog; on
mobile, prefer a full-screen sheet. After saving, close the form, stay on
the originating destination, and update the displayed data immediately.
Editing and deleting remain available only on the relevant dedicated page.

### 5.8 Overview Empty States

-   If no tasks are due or available, explain that the user can add
    tasks from the Tasks destination.
-   If no habits are scheduled today, explain that the user can manage
    schedules in Habits.
-   If no focus sessions have been completed today, show zero progress
    without treating it as an error.
-   Empty states should be calm and actionable, not punitive.

------------------------------------------------------------------------

## 6. Task Management Requirements

### 6.1 Purpose

The Tasks destination is the primary place to create, organize, edit,
complete, and delete independent tasks.

Tasks represent work that the user intends to finish. They are not
recurring activities.

### 6.2 Task Properties

  -----------------------------------------------------------------------
  Property                Type                    Requirement
  ----------------------- ----------------------- -----------------------
  ID                      Unique identifier       Required

  Title                   String                  Required

  Priority                Low / Medium / High     Required; default
                                                  Medium

  Due Date                Local date-only value   Optional
                          or null                 

  Expected Sessions       Positive integer or     Optional
                          null                    

  Status                  Pending / Completed     Required; default
                                                  Pending

  Created At              Date-time               Automatic

  Updated At              Date-time               Automatic

  Completed At            Date-time or null       Set when completed;
                                                  cleared when reopened
  -----------------------------------------------------------------------

Actual completed session count is derived from eligible linked focus
session records rather than stored as an independent source of truth.

### 6.3 Task List Structure

Use one unified task list rather than separate permanent columns for
pending and completed tasks.

Provide these filters:

-   All.
-   Pending.
-   Completed.
-   Overdue.

Provide sorting options:

-   Due date.
-   Priority.
-   Recently created.
-   Recently updated.

Default sorting:

1.  Tasks with the earliest due date first.
2.  Higher priority before lower priority when due dates are equal.
3.  Tasks without a due date after dated tasks.

Remember the user's last selected filter and sorting preference locally.

The list should include summary information for total, pending, and
completed tasks.

### 6.4 Task Creation and Editing

Requirements:

-   Users can create tasks from the Tasks destination.
-   The Overview Add Task quick action may open the same creation
    interface.
-   Users can edit tasks only from the Tasks destination.
-   The creation/editing interface uses the same reusable form.
-   Title is required and cannot contain only whitespace.
-   Priority defaults to Medium.
-   Due date is optional and date-only.
-   Expected focus sessions are optional and must be a positive integer
    when provided.
-   Validation messages must explain how to correct invalid values.

### 6.5 Task Completion

-   Users can complete a task from Overview or Tasks.
-   Users can reopen a completed task from Tasks.
-   Overview completion should provide an undo action.
-   Completion state changes must update relevant Overview and Progress
    information immediately.
-   Completed tasks remain available through the Completed filter.

### 6.6 Task Deletion

-   Users can delete tasks from the Tasks destination.
-   Deletion requires confirmation.
-   Deleting a task must not delete historical focus sessions associated
    with it.
-   Historical sessions must preserve the task title snapshot.
-   When a task is deleted, historical sessions may retain the former
    task ID as a historical reference, but must not require the deleted
    task record to render.

### 6.7 Overdue Rules

The stored task status is only Pending or Completed. Overdue is derived
for display.

A task is overdue when:

-   It has a due date.
-   It remains pending.
-   The user's local calendar date is later than the due date.

A task due today remains on time throughout that local calendar day. It
becomes overdue at the beginning of the following local calendar day.

Completing an overdue task changes its displayed state to Completed.

No scheduled status-update job is required.

### 6.8 Task and Focus Integration

-   A focus session may optionally be associated with one task.
-   Users can start a focus session without selecting a task.
-   A task may have multiple associated focus sessions.
-   Eligible completed Pomodoro focus sessions and saved Stopwatch
    sessions count toward the task's actual session count.
-   Partial Timer sessions do not count toward task session progress.
-   The task may display expected versus completed sessions when an
    expected session target exists.
-   Historical focus sessions preserve a snapshot of the task title as
    it existed when the session was recorded.
-   Deleting a task does not delete its associated historical sessions.

### 6.9 Task Scope Exclusions

The MVP does not include:

-   Subtasks or nested tasks.
-   Task dependencies.
-   Task categories or tags.
-   Shared tasks.
-   Recurring tasks. Recurring activities are handled by Habits.

------------------------------------------------------------------------

## 7. Habit Management Requirements

### 7.1 Purpose

The Habits destination helps users create recurring activities and track
their consistency.

Habits represent activities the user intends to repeat according to a
schedule, unlike tasks, which are independent items to finish.

Habit examples may include reading, studying, practicing a language, or
learning a skill.

### 7.2 Habit Properties

  Property      Type                    Requirement
  ------------- ----------------------- -----------------------------
  ID            Unique identifier       Required
  Name          String                  Required
  Description   String or null          Optional
  Start Date    Local date-only value   Required; defaults to today
  Schedule      Selected weekdays       Required
  Status        Active / Archived       Required; default Active
  Created At    Date-time               Automatic
  Updated At    Date-time               Automatic

A schedule must support:

-   Every day.
-   Selected weekdays.
-   Any custom combination of weekdays.

The MVP does not require arbitrary interval rules such as every 10 days.

### 7.3 Habit List and Daily View

The Habits destination should provide:

-   A clear Add Habit action.
-   A summary of total active habits.
-   Today's scheduled habits and completion progress.
-   A list of active habits with their schedules and consistency
    information.
-   Access to archived habits and completion history.

Users can complete and undo a habit directly from the Habits
destination.

### 7.4 Habit Creation and Editing

-   Users can create habits from the Habits destination.
-   Name is required and cannot contain only whitespace.
-   Description is optional.
-   Start date defaults to the current local date.
-   A schedule is required.
-   Users can edit habit details and schedules.
-   Schedule changes apply immediately from the current local date. A
    habit with a future start date remains inactive until that date.
-   Reminder notifications are not part of the MVP.

### 7.5 Habit Completion

Each completion record represents one habit completed on one scheduled
local calendar date.

Requirements:

-   A habit can be completed at most once per scheduled date.
-   Users can undo a completion.
-   Completion is available from Overview and Habits.
-   Completing or undoing a habit updates Overview and Progress
    immediately.
-   A habit is not considered missed until its scheduled local calendar
    day has ended without completion.
-   Unscheduled days do not create missed occurrences.

### 7.6 Habit History

-   Preserve individual completion records.
-   Show completion history by date.
-   Preserve historical records when a habit is archived or deleted.
-   Historical records must retain a habit name snapshot so they remain
    understandable if the original habit is deleted.
-   Editing a schedule preserves every completion record, including a
    completion for today if the new schedule excludes today.

To calculate historical completion rates correctly after schedule
changes, the application must retain the effective schedule for each
date. Schedule edits preserve eligibility for dates before today.
Repeated edits on the same local date use one effective schedule
version for that date. Overview reflects the edited schedule
immediately.

### 7.7 Habit Consistency Metrics

The MVP includes completion rate, total completed scheduled days, and
recent completion history. Completion rate is completed scheduled
occurrences divided by eligible scheduled occurrences in the selected
period, excluding future dates and inactive/archived periods. A zero
denominator displays a neutral empty state rather than a percentage.
If the schedule changes to exclude today, an existing completion still
appears in history and is excluded from scheduled completion totals. If
another edit includes today again, the same completion counts once.

Current/best streaks are deferred to a later release. If added later,
streaks must use consecutive scheduled occurrences, not calendar days.

### 7.8 Archive and Delete

-   Users can archive a habit when they no longer want it in their
    active daily lists.
-   Archived habits stop appearing in Overview and active daily lists.
-   Archived habits retain their completion history.
-   Users can restore an archived habit.
-   Users can permanently delete a habit after confirmation.
-   Deleting a habit must not delete historical completion records.
-   Historical completion records must remain renderable using their
    stored habit name snapshot.

------------------------------------------------------------------------

## 8. Focus Requirements

### 8.1 Purpose

The Focus destination is the distraction-free workspace where users run
focus sessions.

It includes:

1.  Pomodoro Timer.
2.  Stopwatch.
3.  Break Timer.
4.  Ambient Sound Player.
5.  Focus Session History.

The active timer should remain the primary visual element. Overview
statistics, task-management controls, and detailed analytics should not
compete with the timer.

### 8.2 Focus Modes

The user must be able to choose between:

-   Pomodoro Timer.
-   Stopwatch.

Starting Focus from Overview navigates to the Focus destination but does
not automatically start either mode.

### 8.3 Pomodoro Timer Defaults

  Setting                                                 Default
  -------------------------------------------------- ------------
  Focus duration                                       25 minutes
  Short break                                           5 minutes
  Long break                                           15 minutes
  Completed Timer focus sessions before long break              4
  Break transition                                      Automatic

### 8.4 Focus Duration Selection

Provide quick presets:

-   25 minutes.
-   45 minutes.
-   60 minutes.

Custom focus duration:

-   Minimum: 5 minutes.
-   Maximum: 8 hours.
-   Increment: 5 minutes.
-   Support hour and minute selection where needed.
-   Provide Apply and Cancel actions.
-   Cancel preserves the previously selected duration.
-   Make the editable duration discoverable on pointer and touch
    devices.

### 8.5 Timer Controls and States

The Timer must support:

-   Start.
-   Pause.
-   Resume.
-   Stop.
-   Add 5 Minutes while running.

Each Add 5 Minutes activation adds exactly five minutes to the remaining
focus time. It may be used repeatedly.

Timer states:

-   Idle.
-   Running.
-   Paused.
-   Completed.
-   Stopped.

The timer must calculate remaining time from timestamps and persisted
state rather than relying solely on a continuously running JavaScript
interval.

### 8.6 Timer Completion

When a Pomodoro focus timer reaches zero naturally, the application
must:

1.  Mark the focus session as completed.
2.  Save it to history.
3.  Update the daily Focus Goal.
4.  Update Focus Time in Overview.
5.  Update Progress analytics.
6.  Update associated task session progress, if applicable.
7.  Advance the Pomodoro cycle.
8.  Provide completion feedback.
9.  Apply the configured break transition behavior.

A naturally completed Timer focus session is an eligible completed
session.

### 8.7 Stopping a Timer Early

Stopping a running or paused focus Timer before it reaches zero must
display a confirmation flow with:

-   Save as Partial.
-   Discard.
-   Continue Session.

Rules:

-   A saved partial Timer session appears in history and is marked
    Partial.
-   Partial sessions do not count toward the daily Focus Goal.
-   Partial sessions do not count toward Focus Time in Overview or
    completed-session analytics.
-   Partial sessions do not count toward task completed-session
    progress.
-   Partial sessions do not advance the Pomodoro cycle.
-   A discarded session is not saved to history.

### 8.8 Pomodoro Cycle

Only naturally completed Pomodoro focus Timer sessions advance the
Pomodoro cycle.

Saved Stopwatch sessions do not advance the Pomodoro cycle.

Partial and discarded Timer sessions do not advance the cycle.

Rules:

-   The default long break becomes due after four successfully completed
    Pomodoro focus sessions.
-   Other break opportunities in the cycle use the short break.
-   Skipping a break does not erase completed focus sessions or mark the
    break as completed.
-   When a long break is due, completing **or skipping** it ends the
    current cycle and resets the counter to zero.
-   Skipping a short break does not reset the cycle.
-   The number of focus sessions required before a long break is
    configurable.
-   Short breaks allow 1–60 minutes, long breaks 1–120 minutes, and
    the long-break frequency 1–12 completed focus sessions.

The cycle state must persist across refreshes and application restarts.

### 8.9 Break Transition Behavior

Users can choose:

-   **Automatic:** Start the appropriate break automatically after a
    focus Timer session completes.
-   **Manual:** Show completion feedback and wait for the user to start
    the appropriate break.

When manual transition is selected, the break must not start until the
user chooses to start it.

### 8.10 Break Skipping

Users can skip a break:

-   Before it starts.
-   While it is running.

Skipping a break does not undo a completed focus session, decrement the
Pomodoro cycle count, or mark the break as completed.

Skipping a long break starts a new Pomodoro cycle immediately. Skipping
a short break leaves the completed-focus-session count unchanged.

### 8.11 Stopwatch

The Stopwatch has no predefined duration.

Requirements:

-   Start.
-   Pause.
-   Resume.
-   Stop.
-   Display elapsed time.
-   Optional task association.
-   Preserve active state during refreshes or temporary interruptions.

When the user stops the Stopwatch, ask whether to save or discard the
session.

A Stopwatch session may be saved only when its measured elapsed duration
is at least one second. Zero-duration sessions may only be discarded.

A saved Stopwatch session:

-   Is recorded in history.
-   Is considered a completed focus session for daily goal and
    productivity statistics.
-   Counts toward Focus Time.
-   Counts toward associated task session progress when a task is
    linked.
-   Does not advance the Pomodoro cycle.

A discarded Stopwatch session is not saved and does not count toward
goals or analytics.

### 8.12 Break Timer

During a break, show a simplified interface containing:

-   Remaining break time.
-   Break type (short or long).
-   Skip Break action.
-   Clear indication that the user is on a break.

Do not display unrelated productivity metrics or task-management content
in the active break interface.

### 8.13 Ambient Sound Player

MVP sound options:

-   Rain.
-   Coffee Shop.
-   Ocean Waves.
-   Forest.

Requirements:

-   Play, pause, and stop a sound.
-   Change the selected sound.
-   Adjust volume from 0% to 100%.
-   Display the selected sound and playback state.
-   Play only one ambient sound at a time.
-   Changing sounds stops the previous sound.
-   Ambient playback is independent of timer state.
-   Pausing or stopping the timer does not automatically pause ambient
    sound.
-   Sound playback should remain active during internal navigation where
    the platform permits.
-   Persist the selected sound and volume preference.
-   Use original or properly licensed audio assets.
-   Respect browser autoplay restrictions and platform audio
    limitations.

### 8.14 Focus Session History

History is part of the Focus destination.

Each saved session should display:

-   Session type: Pomodoro Timer or Stopwatch.
-   Associated task title snapshot, if any.
-   Planned duration, when applicable.
-   Actual duration.
-   Start timestamp.
-   End timestamp.
-   Outcome: Completed or Partial.

Requirements:

-   Save eligible sessions automatically or after explicit Stopwatch
    save confirmation.
-   Sort newest sessions first.
-   Allow filtering by date.
-   Make Partial sessions visually distinguishable.
-   Keep historical records after task deletion.
-   Allow an individual history record to be deleted after confirmation.
-   Deleting a history record recalculates derived task progress, daily
    Focus Goal totals, Focus Time, and relevant Progress statistics.
-   Deleting a history record does not retroactively rewind or rewrite
    the already-advanced Pomodoro cycle state.
-   Discarded sessions do not appear in history because they are not
    persisted.

### 8.15 Focus Session Counting Summary

  -----------------------------------------------------------------------
  Session     History     Daily Focus Overview    Task actual Pomodoro
  outcome                 Goal        Focus Time  sessions    cycle
  ----------- ----------- ----------- ----------- ----------- -----------
  Naturally   Yes         Counts      Counts      Counts if   Advances
  completed                                       linked      
  Pomodoro                                                    
  Timer                                                       

  Saved       Yes         Counts      Counts      Counts if   Does not
  Stopwatch                                       linked      advance

  Saved       Yes         Does not    Does not    Does not    Does not
  partial                 count       count       count       advance
  Timer                                                       

  Discarded   No          Does not    Does not    Does not    Does not
  Timer                   count       count       count       advance

  Discarded   No          Does not    Does not    Does not    Does not
  Stopwatch               count       count       count       advance

  Break       Not a focus Does not    Does not    Does not    Does not
              session     count       count       count       advance
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Progress Requirements

### 9.1 Purpose

Progress helps users understand their productivity over time.

It should provide historical context and useful trends rather than
duplicate the daily command-center role of Overview.

### 9.2 Time Filters

Support:

-   Today.
-   Last 7 days.
-   Last 30 days.
-   This month.
-   Custom date range.

Use the user's local calendar and timezone when grouping activity by
date.

### 9.3 Productivity Overview

Display a concise set of metrics for the selected period:

-   Total eligible focus time.
-   Number of completed focus sessions.
-   Number of completed tasks.
-   Habit completion rate.

The selected period must be visible so users understand what the metrics
represent.

### 9.4 Focus Analytics

Include:

-   Total eligible focus time.
-   Completed Pomodoro Timer sessions.
-   Saved Stopwatch sessions.
-   Focus time trends by day.
-   Session duration information where useful.

Partial and discarded sessions must not be included in completed-session
totals or eligible focus time.

### 9.5 Task Analytics

Include:

-   Tasks completed during the selected period.
-   Current pending tasks.
-   Current overdue tasks.
-   Task completion rate where the denominator can be defined
    accurately.

Task completion activity is attributed to the task's completion date.

Do not treat tasks without due dates as overdue.

### 9.6 Habit Analytics

Include:

-   Habit completion rate.
-   Completed scheduled occurrences.
-   Total scheduled occurrences.
-   Recent scheduled completion history for individual habits.
    Current and best streaks are planned for a later release.
-   Recent completion history.

Use the schedule that was effective on each historical date when
calculating scheduled occurrences.

### 9.7 Analytics Rules

-   Focus analytics use eligible completed Pomodoro and saved Stopwatch
    sessions.
-   Partial and discarded sessions are excluded from completed focus
    statistics.
-   Task analytics use task completion timestamps for current completed
    tasks. Reopening a task removes it from completed counts; the MVP does
    not report lifetime completion events. Soft-deleted tasks retain their
    last status and completion timestamp for historical reporting.
-   Habit analytics use scheduled occurrences, not all calendar days.
-   Unscheduled habit days are not treated as missed.
-   Historical task and habit records remain available after their
    parent items are deleted.
-   A session is attributed to the local date of its end timestamp, not
    split across midnight. Its entire eligible duration is counted on
    that date; the same rule applies to daily goal and task progress.
-   All date grouping uses the user's local timezone.
-   Charts must include clear labels and accessible textual summaries.
-   Empty periods should display zero or an appropriate empty state, not
    misleading percentages.

### 9.8 Progress Scope Exclusions

The MVP does not include:

-   Leaderboards.
-   Social comparisons.
-   Points, levels, or reward systems.
-   Achievement badges.
-   AI-generated insights.
-   Predictive analytics.
-   Productivity forecasts.

Future habit streaks would be descriptive measurements of consistency and are not a
gamification system.

------------------------------------------------------------------------

## 10. Settings Requirements

### 10.1 Settings Categories

#### General

-   Language: English or Arabic.
-   Appearance mode: Light, Dark, or System.
-   Color theme: a scalable token-based selection of six color families,
    including emerald and slate; final names and palettes are design-system
    choices. Color theme is independent of appearance mode.
-   Week-start preference may follow the selected locale by default.

#### Focus and Pomodoro

-   Default focus duration.
-   Short break duration.
-   Long break duration.
-   Number of successfully completed Pomodoro focus sessions before a
    long break.
-   Automatic or manual break transition.
-   Daily focus goal.

#### Sound

-   Preferred ambient sound.
-   Volume level.

#### Keyboard Shortcuts

-   Display supported keyboard shortcuts.
-   Explain the behavior of each supported shortcut.
-   Shortcuts must not interfere with normal text entry or assistive
    technology.

#### Data Management

-   Export application data.
-   Import a previous backup.
-   Clear all application data after explicit confirmation.

### 10.2 Settings Behavior

-   Save settings automatically.
-   Apply theme changes immediately.
-   Apply language changes throughout the supported interface.
-   Support appropriate RTL layout when Arabic is selected.
-   Validate values before saving.
-   Persist settings across application restarts.
-   Changing a setting must not unintentionally reset historical data or
    an active session.

### 10.3 Data Export and Import

Export:

-   Provide a versioned JSON backup containing the user's local
    application data.
-   Include tasks, habits, habit schedule history, habit completion
    records, focus session history, and settings.
-   Do not include transient runtime-only data that cannot be safely
    restored.

Import:

-   Validate the backup format and schema version before applying it.
-   Explain that importing replaces the current local application data.
-   Require explicit confirmation before replacement.
-   Do not partially overwrite data if validation fails.
-   Provide a clear success or failure message.

### 10.4 Clear All Data

-   Require explicit confirmation.
-   Clearly explain that the action removes local application data.
-   Do not provide a one-click destructive action without confirmation.

------------------------------------------------------------------------

## 11. Data Model

The data model below defines the logical entities and their
responsibilities. Exact implementation types may vary, but the business
rules must remain consistent.

### 11.1 Task

``` ts
interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null; // Local date-only value: YYYY-MM-DD
  expectedSessions: number | null;
  status: 'pending' | 'completed';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null; // Soft deletion preserves historical reporting
}
```

Rules:

-   `status` is only `pending` or `completed`.
-   Overdue is derived from status, due date, and the current local
    date.
-   Actual completed session count is derived from eligible linked
    FocusSession records.
-   Deleting a task must not delete its historical sessions. Task deletion
uses soft deletion for historical reporting, with deleted items hidden
from active lists. Clear All Data remains the explicit irreversible erase.

### 11.2 Habit

``` ts
interface Habit {
  id: string;
  name: string;
  description: string | null;
  startDate: string; // Local date-only value: YYYY-MM-DD
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null; // Soft deletion; excluded from active UI
}
```

### 11.3 Habit Schedule Version

``` ts
interface HabitScheduleVersion {
  id: string;
  habitId: string;
  weekdays: number[]; // Application-defined weekday convention
  effectiveFrom: string; // Local date-only value
  effectiveTo: string | null; // Exclusive end date; null means current
  createdAt: string;
}
```

Schedule changes create a new version. Historical schedule versions are
retained so historical completion rates can be calculated using the
schedule that applied at the time.

### 11.4 Habit Completion

``` ts
interface HabitCompletion {
  id: string;
  habitId: string;
  habitNameSnapshot: string;
  scheduledDate: string; // Local date-only value: YYYY-MM-DD
  completedAt: string;
}
```

Rules:

-   A habit may have at most one completion record per scheduled date.
-   Deleting or archiving a habit must not delete its historical
    completion records.
-   The habit name snapshot preserves readable history after deletion.

### 11.5 Focus Session

``` ts
interface FocusSession {
  id: string;
  taskId: string | null;
  taskTitleSnapshot: string | null;
  type: 'timer' | 'stopwatch';
  plannedDurationSeconds: number | null;
  actualDurationSeconds: number;
  startedAt: string;
  endedAt: string;
  completionLocalDate: string; // YYYY-MM-DD at completion
  completionTimezoneOffsetMinutes: number;
  status: 'completed' | 'partial';
  countsTowardDailyGoal: boolean;
  countsTowardTaskProgress: boolean;
}
```

Rules:

-   A naturally completed Pomodoro Timer session has status `completed`.
-   A saved Stopwatch session has status `completed`.
-   A Timer stopped early and saved has status `partial`.
-   Discarded sessions are not persisted.
-   Breaks are not stored as focus sessions in normal focus history.
-   Task title snapshots preserve readable history after task deletion.
-   Eligibility flags should be derived consistently from session type
    and outcome; they must not be allowed to contradict the counting
    rules in Section 8.15.

### 11.6 User Settings

``` ts
interface UserSettings {
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
  colorTheme: string; // One of six configured color families
  weekStartsOn: 0 | 1 | 6; // Locale default, user override if offered
  language: 'en' | 'ar';
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
  focusSessionsBeforeLongBreak: number;
  breakTransition: 'automatic' | 'manual';
  ambientSound: string | null;
  ambientVolume: number;
}
```

### 11.7 Pomodoro Cycle State

Persist the current Pomodoro cycle state, including:

-   Number of successfully completed Pomodoro focus sessions in the
    current cycle.
-   Whether a long break is currently due.
-   Whether a break is running or awaiting manual start, where
    applicable.
-   State required to resume the correct next break after refresh.

The cycle is advanced only by naturally completed Pomodoro focus Timer
sessions. A long break resets the cycle when it is completed or explicitly
skipped. Skipping a short break does not reset the cycle.

### 11.8 Active Session State

Persist enough information to recover an active Timer, Stopwatch, or
break after refresh or temporary interruption.

The active state should include, as applicable:

-   Session identifier.
-   Task reference and title snapshot.
-   Session type.
-   Planned duration.
-   Start timestamp.
-   Pause timestamp or pause state.
-   Accumulated elapsed or paused duration.
-   Current state.
-   Any data needed to calculate remaining or elapsed time accurately.

Implementation details may vary by platform. Timer accuracy must be
based on timestamps and persisted state, not on an interval assumed to
run continuously in the background.

### 11.9 Derived Data

The following values should be derived from source records wherever
practical:

-   Task actual completed session count.
-   Task overdue state.
-   Daily task summary.
-   Daily habit summary.
-   Daily Focus Goal progress.
-   Overview Focus Time.
-   Progress metrics and charts.
-   Habit completion rate and recent history.

Derived values should not become separate conflicting sources of truth.

------------------------------------------------------------------------

## 12. Persistence, Privacy, and Data Integrity

### 12.1 Local-First Persistence

The MVP stores application data locally on the user's device.

Recommended storage responsibilities:

-   Use IndexedDB or an equivalent structured local database for tasks,
    habits, schedule versions, completion records, focus history, and
    active session state.
-   Use lightweight browser storage for small preferences only where
    appropriate.
-   Keep persistence behind a data-access layer so the storage
    implementation can evolve without rewriting feature behavior.

### 12.2 Privacy

-   No account is required.
-   Personal productivity records remain on the user's device.
-   The MVP does not require cloud synchronization.
-   Do not transmit task titles, habit names, or focus history to
    external services as part of normal operation.
-   Any future external data transfer requires explicit product
    requirements and user-facing disclosure.

### 12.3 Data Integrity

-   Prevent duplicate completion records for the same habit and
    scheduled date.
-   Prevent duplicate focus history records when a session completes or
    is saved.
-   Validate imported data before replacing local data.
-   Preserve historical snapshots when parent tasks or habits are
    deleted.
-   Use schema versioning and migrations for future data-model changes.
-   Ensure deleting a history record recalculates all affected derived
    statistics.
-   Do not retroactively modify the Pomodoro cycle state when an old
    history record is deleted.

### 12.4 Date and Time Handling

-   Store event timestamps in a consistent timestamp format.
-   Assign a completed session to the local date of `endedAt`; do not
    divide one session across two calendar days.
-   For historical consistency, persist the local completion date and
    timezone offset at completion rather than regrouping old events when
    the user travels.
-   For a Timer deadline observed in a live document, use the device
    timezone at observation and resolve the offset at the exact deadline.
    For an unobserved deadline, use the timezone persisted when the
    running segment began. Existing snapshots without timezone context
    use UTC for this fallback.
-   Store date-only values, such as task due dates and habit scheduled
    dates, separately from timestamps.
-   Interpret daily boundaries using the user's local timezone.
-   Handle daylight-saving changes where the platform's timezone rules
    apply.
-   Recalculate current-day views when the local date or timezone
    changes, without rewriting historical event dates.
-   Do not use a date-time timestamp where a date-only value is
    required.

### 12.5 Session Recovery and Historical Data Rules

-   Persist active Timer, Stopwatch, and break state after every meaningful
    transition. The elapsed time calculation uses timestamps, never the
    assumption that background intervals continue running.
-   While a Timer document stays alive, measure elapsed time with its
    monotonic clock. On reopening, recover from the persisted wall-clock
    anchor. A browser cannot reliably distinguish time elapsed while
    closed from a system clock adjustment made during that period.
-   On reopening after a running Timer's deadline, mark it naturally
    completed **once**, at its scheduled deadline, and show the appropriate
    completed-session/break decision. Never create duplicate records.
-   A running Stopwatch continues elapsed-time calculation across a closed
    browser; a paused Stopwatch remains paused. Inform users that browser
    storage clearing or device shutdown may prevent recovery.
-   For a break that expired while closed, mark the break finished once;
    do not automatically start a subsequent focus session while closed.
-   Deletion of tasks and habits is soft deletion: hide the item in active
    interfaces, preserve necessary status/schedule snapshots and historical
    statistics, and allow explicit full erasure through Clear All Data.
-   Archive/restore and deletion effective dates determine which habit
    days were eligible for historical completion-rate denominators.
    Schedule versions retain the weekday rules applicable to each day.
-   Reopening a task removes its current completed status and timestamp;
    this MVP does not maintain a separate task-completion-event ledger.
-   Deleting an individual focus history record removes its contribution
    from all derived metrics, but never rewinds the already-established
    Pomodoro cycle state.
-   Product success metrics are conceptual and do not require telemetry.
    Session completion rate excludes discarded sessions because they are
    not persisted; if true started-session rates are needed later, they
    require an explicitly approved privacy-respecting event model.

### 12.6 Cross-Platform Delivery Strategy

-   **Release 1:** Responsive web application, including mobile browser
    layouts, all five destinations, local data persistence, and JSON backup.
-   **Release 2:** Native Android and iOS apps, informed by validated web
    flows. Reuse domain rules and design principles where practical; do not
    assume browser storage can be directly shared with native apps.
-   **Release 3 (conditional):** Accounts and cloud synchronization if
    cross-device continuity is a validated user need.
-   No automatic sync is promised between web and native apps until the
    synchronization phase. Import/export may provide a manual migration
    path only if compatible formats are implemented and tested.
-   Avoid web-specific business logic and keep persistence behind an
    interface so future native implementations can share the rules.

### 12.7 Data Loss Considerations

Local browser storage may be cleared by the user or browser. The
application should provide export/import backup functionality and
communicate that backups are the user's responsibility.

------------------------------------------------------------------------

## 13. User Flows

### 13.1 First-Time User Flow

1.  User opens Doop.
2.  Overview is displayed.
3.  The application initializes default settings and a daily focus goal
    of six sessions.
4.  Overview explains how to add tasks and habits.
5.  User creates tasks from Tasks or the Overview Add Task action.
6.  User creates recurring habits from Habits.
7.  User can navigate to Focus and choose Pomodoro Timer or Stopwatch.
8.  No registration is required.

### 13.2 Daily Planning Flow

1.  User opens Overview.
2.  User reviews the three Daily Summary metrics.
3.  User reviews prioritized incomplete tasks.
4.  User completes tasks directly from Overview as appropriate.
5.  User reviews all habits scheduled for today.
6.  User completes habits directly from Overview.
7.  User reviews Focus Goal progress.
8.  User chooses Start Focus when ready to work.

### 13.3 Task Creation Flow

1.  User opens Tasks or selects Add Task from Overview.
2.  The task form is displayed.
3.  User enters a title.
4.  User selects or accepts the default priority.
5.  User optionally selects a due date.
6.  User optionally enters an expected focus-session count.
7.  User saves the task.
8.  The task appears in the unified task list.

### 13.4 Habit Creation Flow

1.  User opens Habits.
2.  User selects Add Habit.
3.  User enters the habit name.
4.  User optionally enters a description.
5.  User selects a start date.
6.  User chooses a recurring schedule.
7.  User saves the habit.
8.  The habit appears in the active habit list and in Overview on
    scheduled days.

### 13.5 Focus Timer Flow

1.  User opens Focus.
2.  User chooses Pomodoro Timer.
3.  User optionally associates a task.
4.  User chooses a preset or custom duration.
5.  User optionally selects an ambient sound.
6.  User starts the focus Timer.
7.  User may pause, resume, or add five minutes.
8.  The Timer reaches zero naturally.
9.  The session is saved as completed.
10. Daily Focus Goal, Overview, Progress, and associated task progress
    are updated.
11. The application applies the configured automatic or manual break
    behavior.

### 13.6 Partial Timer Flow

1.  User starts a focus Timer.
2.  User chooses Stop before the Timer reaches zero.
3.  The application asks whether to save as Partial, Discard, or
    Continue.
4.  If saved, the partial session appears in history but does not count
    toward goals, completed focus time, task completed-session progress,
    or the Pomodoro cycle.
5.  If discarded, no history record is created.

### 13.7 Stopwatch Flow

1.  User opens Focus.
2.  User chooses Stopwatch.
3.  User optionally associates a task.
4.  User starts the Stopwatch.
5.  User may pause and resume.
6.  User stops the Stopwatch.
7.  User chooses Save or Discard.
8.  If saved, the session is recorded as completed and updates eligible
    statistics.
9.  If discarded, no history record is created.

### 13.8 Habit Completion Flow

1.  User opens Overview or Habits.
2.  The application displays habits scheduled for the current local
    date.
3.  User completes a habit.
4.  A completion record is saved for that scheduled date.
5.  Overview and Progress are updated.
6.  User may undo the completion.

### 13.9 Data Backup Flow

1.  User opens Settings.
2.  User chooses Export Data.
3.  The application generates a versioned JSON backup.
4.  User saves the backup outside the application.
5.  To restore, user chooses Import Data.
6.  The application validates the file and explains that existing local
    data will be replaced.
7.  User confirms.
8.  The application restores the validated backup.

------------------------------------------------------------------------

## 14. UI/UX Requirements

### 14.1 Design Principles

The application must be:

-   Clean and balanced.
-   Modern and professional.
-   Friendly and welcoming.
-   Minimal and distraction-free.
-   Consistent across destinations.
-   Responsive and accessible.

### 14.2 Visual Identity Direction

The agreed visual direction is Clean & Balanced.

The considered palette direction combines emerald/green, mint, and soft
yellow accents with warm off-white and deep forest neutrals.

Candidate colors discussed:

  Role             Candidate
  ---------------- -----------
  Deep Emerald     `#347F6D`
  Mint             `#8DCFBB`
  Soft Yellow      `#FFE59A`
  Warm Off-White   `#F8FAF6`
  Deep Forest      `#243A34`

These are candidate design tokens, not a finalized full design system.
The final design system must validate contrast and define semantic
colors for light and dark appearance modes. Six interchangeable color
themes (including emerald and slate) must use semantic tokens rather
than hardcoded colors; the remaining palette choices are delegated to
visual design and can be refined without changing business logic.

### 14.3 Application Shell

-   Desktop uses a collapsible sidebar.
-   Mobile uses bottom navigation.
-   Overview is the default landing page.
-   The five primary destinations remain easy to identify.
-   Settings remain accessible without competing with primary
    navigation.

### 14.4 Overview Hierarchy

-   Greeting and date at the top.
-   Three Daily Summary metrics directly below.
-   Today's Tasks and Today's Habits form the main content area on
    desktop.
-   Focus Goal and Quick Actions form the lower content area.
-   Mobile stacks the content vertically.
-   Today's Habits uses a scrollable list when necessary.

### 14.5 Tasks and Habits Interaction

-   Task and habit completion controls must be easy to use.
-   Provide immediate visual feedback.
-   Provide undo for accidental completion.
-   Keep management controls in their dedicated destinations.
-   Use clear priority and due-date indicators without relying on color
    alone.

### 14.6 Focus Experience

-   Timer is the primary visual element.
-   Timer controls are easy to reach.
-   The selected task is visible but secondary.
-   Sound controls are available but visually secondary.
-   Avoid Overview statistics and unrelated dashboard content during
    focus.
-   Break mode uses a simplified interface.

### 14.7 Progress Experience

-   Make the selected time range visible.
-   Label chart axes and metrics clearly.
-   Avoid chart clutter.
-   Provide text equivalents or summaries for important chart
    information.
-   Do not use gamified reward patterns.

### 14.8 Interaction and Feedback

-   Use subtle animations only where they improve understanding.
-   Provide clear feedback after actions.
-   Use confirmation for destructive actions.
-   Display validation messages close to the relevant input.
-   Provide useful empty states.
-   Prevent accidental double submissions.
-   Preserve user input when validation fails.

### 14.9 Responsive Requirements

Support:

-   Desktop screens.
-   Tablet screens.
-   Mobile phones.

Requirements:

-   No horizontal overflow at supported viewport sizes.
-   Lists and forms remain usable on narrow screens.
-   Navigation adapts to screen size.
-   Timer controls remain accessible on touch devices.
-   Scrollable sections must not trap keyboard or assistive-technology
    users.

### 14.10 Accessibility

-   Support keyboard navigation.
-   Provide visible focus indicators.
-   Use sufficient color contrast.
-   Do not communicate priority or completion using color alone.
-   Respect reduced-motion preferences.
-   Provide accessible names for interactive controls.
-   Ensure checkboxes and timer controls are usable with assistive
    technologies.
-   Support RTL layout for Arabic.

------------------------------------------------------------------------

## 15. Non-Functional Requirements

### 15.1 Performance

-   The application shell and Overview should load promptly.
-   Common interactions should respond immediately.
-   Timer display updates should remain smooth without relying on
    interval accuracy.
-   Large history lists should remain usable.
-   Audio playback should not significantly degrade application
    performance.

### 15.2 Reliability

-   Timer accuracy must be timestamp-based.
-   Refreshing the application must not unintentionally reset an active
    session.
-   Session completion must not create duplicate history records.
-   Habit completion must not create duplicate records for the same
    scheduled date.
-   Derived statistics must update consistently after create, update,
    delete, archive, completion, undo, and import operations.

### 15.3 Maintainability

-   Separate domain/business logic from presentation.
-   Keep timer logic independent of UI rendering.
-   Keep task and habit rules in their respective feature/domain layers.
-   Use a shared source of truth for session eligibility and counting.
-   Keep persistence behind an abstraction.
-   Reuse common validation and date-handling logic.

### 15.4 Compatibility

-   Support modern desktop and mobile browsers.
-   Respect browser restrictions on background execution and audio
    playback.
-   Provide graceful recovery when a browser suspends or throttles the
    application.
-   Do not promise uninterrupted background execution where the platform
    cannot guarantee it.

------------------------------------------------------------------------

## 16. Edge Cases

The implementation must account for:

1.  User refreshes the application while a Timer is running.
2.  User closes the application during an active session.
3.  User returns to an active or paused session after a long
    interruption.
4.  User tries to start a second focus or break session while one is
    active.
5.  User changes the selected task while a session is running.
6.  User deletes a task associated with historical sessions.
7.  User changes the daily goal after already exceeding it.
8.  User changes the system date or timezone.
9.  User crosses local midnight while the application is open.
10. User pauses a Timer or Stopwatch for an extended period.
11. User adds five minutes repeatedly to a running focus Timer.
12. User selects the minimum or maximum custom Timer duration.
13. User completes a focus session while manual break transition is
    selected.
14. User skips a break before it starts.
15. User skips a break while it is running.
16. User skips a long break that remains due in the Pomodoro cycle.
17. User saves a partial Timer session.
18. User discards a Timer or Stopwatch session.
19. User saves a Stopwatch session without a task.
20. User saves a Stopwatch session associated with a task.
21. Browser blocks ambient audio playback.
22. User changes the ambient sound while another sound is playing.
23. User attempts to create a task with an empty title.
24. User enters a zero, negative, or invalid expected session count.
25. A task reaches the end of its due date and becomes overdue.
26. User completes a task after it becomes overdue.
27. User completes a habit more than once on the same scheduled date.
28. User attempts to complete a habit on a date when it is not
    scheduled.
29. User changes a habit schedule after it has historical completion
    records.
30. User archives or deletes a habit with historical records.
31. User misses a scheduled habit day.
32. User selects a Progress date range with no activity.
33. User deletes a focus history record that contributed to task
    progress or daily totals.
34. User deletes a history record after the Pomodoro cycle has advanced.
35. User imports an invalid or unsupported backup file.
36. User imports a valid backup that replaces existing local data.
37. Local browser storage is unavailable, full, or cleared.
38. User completes more eligible focus sessions than the daily goal.
39. User changes language while viewing a page with open dialogs or
    forms.
40. User switches between light, dark, and system themes.

------------------------------------------------------------------------

## 17. MVP Acceptance Criteria

The MVP is ready when the following are satisfied.

### Application Structure

-   [ ] Overview is the default landing page.
-   [ ] The application provides Overview, Tasks, Habits, Focus, and
    Progress destinations.
-   [ ] Desktop uses a collapsible sidebar.
-   [ ] Mobile uses bottom navigation.
-   [ ] Settings are accessible separately from primary navigation.

### Overview

-   [ ] Daily Summary displays Tasks Completed, Habits Completed, and
    Focus Time.
-   [ ] Tasks Completed uses tasks due today as its denominator.
-   [ ] Habits Completed uses active habits scheduled today.
-   [ ] Focus Time includes completed Pomodoro focus sessions and saved
    Stopwatch sessions.
-   [ ] Today's Tasks prioritizes overdue, due-today, and undated
    incomplete tasks in that order.
-   [ ] Users can complete tasks from Overview.
-   [ ] Today's Habits displays every active habit scheduled today.
-   [ ] The habits list can scroll when it exceeds available space.
-   [ ] Users can complete and undo habits from Overview.
-   [ ] Focus Goal counts completed Pomodoro focus sessions and saved
    Stopwatch sessions.
-   [ ] Start Focus navigates to Focus without automatically starting a
    session.
-   [ ] Add Task opens the task creation interface.
-   [ ] Add Habit opens the shared habit creation interface. Habit
    editing, archiving, and deletion are available in Habits.

### Tasks

-   [ ] Users can create, edit, complete, reopen, and delete tasks.
-   [ ] Task title validation works.
-   [ ] Priority supports Low, Medium, and High.
-   [ ] Due date is optional and date-only.
-   [ ] Expected focus sessions are optional and validated.
-   [ ] Task list uses unified filters: All, Pending, Completed,
    Overdue.
-   [ ] Sorting options work and the last-used preference is remembered.
-   [ ] Overdue state is derived and not stored.
-   [ ] A task due today becomes overdue only after the local day ends.
-   [ ] Users can associate focus sessions with tasks.
-   [ ] Task actual session progress is derived from eligible linked
    sessions.
-   [ ] Deleting a task does not delete historical focus sessions.

### Habits

-   [ ] Users can create, edit, archive, restore, and delete habits.
-   [ ] Habit schedules support every day and selected weekdays.
-   [ ] Users can complete and undo a habit from Overview and Habits.
-   [ ] Duplicate completion for the same habit and date is prevented.
-   [ ] Unscheduled days are not counted as missed occurrences.
-   [ ] Historical completion records remain available after archive or
    deletion.
-   [ ] Schedule changes preserve historical schedule information.
-   [ ] Completion rate calculations follow the defined
    schedule rules.
-   [ ] Completion rate and recent habit history are accurate; advanced
    streaks are not required for MVP.

### Focus

-   [ ] Pomodoro Timer and Stopwatch are available.
-   [ ] Timer presets are 25, 45, and 60 minutes.
-   [ ] Custom Timer duration supports 5 minutes to 8 hours in 5-minute
    increments.
-   [ ] The user can add five minutes to a running Timer.
-   [ ] Timer and Stopwatch support pause and resume.
-   [ ] Timer state recovers after refresh.
-   [ ] Short and long breaks work correctly.
-   [ ] Break durations and long-break frequency are configurable.
-   [ ] Automatic and manual break transitions work correctly.
-   [ ] Users can skip a break before it starts or while it runs.
-   [ ] Only naturally completed Pomodoro focus sessions advance the
    Pomodoro cycle.
-   [ ] Skipping a short break does not reset the cycle.
-   [ ] Completing or skipping a long break resets the cycle.
-   [ ] Saved Stopwatch sessions count toward the daily Focus Goal but
    not the Pomodoro cycle.
-   [ ] Partial Timer sessions are saved as Partial and do not count
    toward goals.
-   [ ] Discarded sessions are not saved.
-   [ ] Ambient sounds can be played, paused, changed, and controlled.
-   [ ] Only one ambient sound plays at a time.
-   [ ] Ambient sound playback is independent of timer state.
-   [ ] Focus history is available and filterable by date.
-   [ ] Deleting history updates derived statistics without
    retroactively changing Pomodoro cycle state.

### Progress

-   [ ] Progress supports Today, Last 7 days, Last 30 days, This month,
    and Custom date range.
-   [ ] Focus analytics include completed Timer and saved Stopwatch
    sessions.
-   [ ] Partial and discarded sessions are excluded from completed focus
    statistics.
-   [ ] Task completion analytics use completion dates and preserve
    reporting after soft deletion.
-   [ ] Habit analytics use scheduled occurrences.
-   [ ] Historical task and habit records remain understandable after
    deletion.
-   [ ] Charts have clear labels and accessible summaries.

### Settings and Data

-   [ ] Light, Dark, and System appearance modes work.
-   [ ] Six token-based color themes, including slate, can be selected
    independently of appearance mode.
-   [ ] English and Arabic are supported.
-   [ ] Arabic RTL layout works.
-   [ ] Focus and Pomodoro settings persist.
-   [ ] Daily focus goal is configurable and persists.
-   [ ] Ambient sound preferences persist.
-   [ ] Data can be exported as a versioned JSON backup.
-   [ ] Valid backups can be imported after explicit confirmation.
-   [ ] Invalid backups do not partially overwrite existing data.
-   [ ] Clear All Data requires explicit confirmation.
-   [ ] Local data persists after application restart.

### Quality

-   [ ] Responsive layouts work on desktop, tablet, and mobile.
-   [ ] No critical timer, persistence, task, habit, or history bugs
    remain.
-   [ ] Destructive actions require confirmation.
-   [ ] Keyboard navigation and visible focus states work.
-   [ ] Color contrast and accessible labels are adequate.
-   [ ] Reduced-motion preferences are respected.

------------------------------------------------------------------------

## 18. Recommended Implementation Phases

The implementation should proceed incrementally. The phases describe
delivery order, not a required technology stack.

### Phase 1 --- Foundation and Application Shell

-   Project setup.
-   Design tokens and shared UI foundations.
-   Responsive application shell.
-   Desktop sidebar and mobile bottom navigation.
-   Theme infrastructure.
-   Localization and RTL foundation.
-   Local persistence abstraction.
-   Data schema versioning.

### Phase 2 --- Overview and Task Management

-   Task data model and persistence.
-   Task creation and editing.
-   Unified task list, filters, and sorting.
-   Task completion and deletion.
-   Overdue calculation.
-   Overview layout and Daily Summary.
-   Overview task completion and Add Task action.

### Phase 3 --- Habit Management

-   Habit creation and editing.
-   Recurring weekday schedules.
-   Schedule version history.
-   Habit completion records.
-   Overview habit list and completion.
-   Archive, restore, and delete behavior.
-   Completion-rate calculations and recent history.

### Phase 4 --- Focus Engine

-   Pomodoro Timer.
-   Stopwatch.
-   Timestamp-based timing.
-   Pause, resume, stop, and partial-session handling.
-   Add 5 Minutes.
-   Break timers.
-   Pomodoro cycle state.
-   Automatic/manual transitions.
-   Break skipping.
-   Active session recovery.

### Phase 5 --- Focus History and Daily Goals

-   Focus session persistence.
-   Task association.
-   Session title snapshots.
-   History list and date filtering.
-   Daily Focus Goal.
-   Session eligibility and derived counting.
-   Overview Focus Goal and Focus Time.

### Phase 6 --- Ambient Sounds and Settings

-   Ambient sound player.
-   Sound selection and volume.
-   Sound persistence.
-   Focus and Pomodoro settings.
-   Theme and language settings.
-   Keyboard shortcut documentation and supported interactions.

### Phase 7 --- Progress and Data Management

-   Progress summary metrics.
-   Focus analytics.
-   Task analytics.
-   Habit analytics.
-   Date-range filters.
-   JSON export/import.
-   Clear local data flow.

### Phase 8 --- Quality Assurance and Release Readiness

-   Timer accuracy tests.
-   Pomodoro cycle tests.
-   Local date and timezone tests.
-   Habit schedule and completion-rate tests.
-   Data migration and backup tests.
-   Responsive testing.
-   Accessibility testing.
-   Persistence and recovery testing.
-   Cross-browser testing.

------------------------------------------------------------------------

## 19. Future Considerations

Potential features for later releases:

-   User accounts.
-   Cloud synchronization.
-   Cross-device data sync.
-   Native mobile applications.
-   PWA installation and enhanced offline capabilities.
-   Calendar integration.
-   Notifications and habit reminders.
-   Task categories and tags.
-   Subtasks and task dependencies.
-   Additional ambient sounds.
-   Multiple ambient sound layers.
-   Advanced analytics and forecasting.
-   AI productivity assistance.
-   Collaboration and shared workspaces.
-   Social features, if justified by product direction.

These features should not delay the initial MVP.

------------------------------------------------------------------------

## 20. Final Product Definition

Doop is a personal productivity workspace that combines daily planning,
task management, recurring habit tracking, focus tools, and productivity
analytics.

The application is organized around five primary destinations:

-   **Overview:** Understand and manage today's work.
-   **Tasks:** Organize independent tasks and track their completion.
-   **Habits:** Build consistency through recurring activities.
-   **Focus:** Work through Pomodoro sessions or the Stopwatch in a
    distraction-free environment.
-   **Progress:** Understand productivity patterns over time.

The MVP prioritizes clarity, consistency, reliable timing, useful
historical records, and local-first data ownership.

Doop should make it easy for users to understand what matters today,
take action without unnecessary navigation, focus on meaningful work,
and review their progress without turning productivity into a
competitive or punitive experience.


## 21. Confirmed Decisions and Remaining Design Discretion (v1.3)

**Confirmed by product owner:** The first release is a responsive web
application; native Android/iOS applications are planned for a later phase.
Skipping a long break starts a new Pomodoro cycle. Overview's Add Task
and Add Habit actions open the exact shared forms used by their dedicated
pages, not simplified secondary forms.

**Product defaults adopted in this revision:** Sessions belong to their
local completion date; a saved Stopwatch requires at least one second;
soft deletion preserves historical reporting; task reopening changes
current completed statistics; timer expiration during closure is
reconciled once on reopen; basic habit completion history is MVP while
advanced streaks are postponed; six token-based color themes are
supported independently of light/dark/system mode.

**Design discretion:** Exact dialogs, spacing, icons, theme palettes,
chart rendering libraries, and technical framework remain implementation
choices. No pixel-level sign-off is required to begin design exploration.
