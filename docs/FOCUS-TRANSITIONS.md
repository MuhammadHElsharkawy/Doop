# M6 Focus transitions

Only one active focus, break, or stopwatch snapshot can exist at a time. Timer settings apply to the next relevant session. A break's kind is decided at focus completion from the committed cycle count and current frequency.

| Current state                           | Event                          | Result                                           | History and cycle                                        |
| --------------------------------------- | ------------------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| Idle                                    | Start Pomodoro                 | Running selected duration                        | No history write                                         |
| Idle                                    | Start Stopwatch                | Running elapsed display                          | No history write                                         |
| Running focus                           | Add 5 minutes before deadline  | Running with a deadline five minutes later       | Elapsed time stays intact                                |
| Running focus, break, or Stopwatch      | Pause                          | Paused                                           | Active time freezes                                      |
| Paused focus, break, or Stopwatch       | Resume                         | Running                                          | New anchor keeps accumulated active time                 |
| Focus or Stopwatch                      | Open Stop                      | Paused with local decision dialog                | Refresh leaves the saved paused state                    |
| Stop decision                           | Continue, Escape, or close     | Restore running or paused state from before Stop | No history write                                         |
| Paused focus                            | Save as partial                | Idle                                             | Partial history, cycle stays intact                      |
| Paused Stopwatch                        | Save at one second or above    | Idle                                             | Completed Stopwatch history, cycle stays intact          |
| Paused Stopwatch                        | Save under one second          | Paused                                           | Save unavailable                                         |
| Stop decision                           | Discard                        | Idle                                             | No history write                                         |
| Observed focus expiry                   | Automatic                      | Start short or long break                        | Save focus at original deadline and increment cycle once |
| Focus expiry                            | Manual, suspended, or reopened | Break pending                                    | Save focus at original deadline and increment cycle once |
| Break pending                           | Start break                    | Running selected break                           | Pending decision clears                                  |
| Short break pending, running, or paused | Skip                           | Idle                                             | Cycle count stays intact                                 |
| Long break pending, running, or paused  | Skip                           | Idle                                             | Cycle resets to zero                                     |
| Short break expires                     | Tick or recover                | Idle                                             | Cycle count stays intact                                 |
| Long break expires                      | Tick or recover                | Idle                                             | Cycle resets to zero                                     |

Natural expiration takes precedence over an action received at or after the deadline. Breaks never create history. An expired break waits in Idle for user action, including after reopening. Automatic transition starts the break only when the current document observes focus expiry with live monotonic evidence. Unobserved expiry presents a break decision, following the [architecture recovery rule](01-TECHNICAL-ARCHITECTURE.md#6-time-and-focus-engine).

An observed automatic break starts at the focus deadline. Its recovery anchor includes the observed delay, so refresh preserves the remaining time. If observation is delayed beyond the entire break, the same transaction records focus completion and finishes the break. A completed long break resets the cycle.

The active snapshot and cycle revision guard each transition in one IndexedDB transaction. Settings are read in that transaction. An automatic break begins in the same transaction that saves focus history and updates the cycle. History uses the effective Timer target, including extensions. Stopwatch records actual elapsed time and omits a target. A completion attributable to a prior local day retains its original UTC deadline and the observed or persisted time-zone context under the [persistence contract](PERSISTENCE.md).
