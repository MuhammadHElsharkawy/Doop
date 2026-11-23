# M5 mobile feasibility

## Evidence

The isolated `spike/m5-capacitor` worktree lives at `.angular/m5-capacitor`. Its separate `native` npm project uses Capacitor 8.6.2 and the M5 Angular production bundle. Android platform generation and asset sync succeeded. The browser application keeps its existing dependencies.

| Check                                         | Result                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android package build                         | Blocked. The Gradle wrapper rejected the configured `JAVA_HOME`, which points at a bin directory. The installed JDK is Java 8 and no Android SDK or ADB was found.  |
| Android device launch                         | Unverified. No Android or ADB device appeared in Windows Plug and Play.                                                                                             |
| iOS device launch                             | Unverified. This Windows host has no macOS or Xcode environment.                                                                                                    |
| OS suspension and process termination         | Native behavior unverified. Automated Chromium checks cover page lifecycle freeze, missed callbacks, and expiry recovery after reload.                              |
| Active-state durability                       | Native WebView durability unverified. Chromium recovered both running and paused IndexedDB snapshots across refresh.                                                |
| Audio interruption and notification delivery  | Native behavior unverified. The M5 timer uses visual completion feedback. Native audio focus, lock-screen playback, and notification delivery need device probes.   |
| Safe areas, software keyboard, and navigation | Native behavior unverified. The Focus page uses the existing responsive shell. Test system bars, keyboard insets, Android Back, and gesture navigation on a device. |

[Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) and [Android platform documentation](https://capacitorjs.com/docs/android) describe the platform toolchains.

## Reproduce the spike

1. Build Doop and copy the contents of `dist/doop/browser` into `native/www` in the spike worktree.
2. Configure the isolated Capacitor project with app ID `com.doop.spike`, name `Doop M5 Spike`, and web directory `www`. Install matching 8.6.2 versions of core, CLI, and the target platform.
3. Run `npx cap add android` for a fresh project, then `npx cap sync android`. Open the project with Android Studio, select its supported JDK and installed SDK, and deploy to a connected Android device. On macOS, use `npx cap add ios` and `npx cap sync ios`, then build and deploy from Xcode.
4. Start the timer and record the deadline. Lock the device, background the app, and return before and after the deadline. Repeat after force-stopping and reopening the app. Check paused recovery separately. Verify that each completed session produces one history record.
5. In the spike, use a test tone and notification to check interruption and delivery during lock, background, and resume. Record OS, device, and permissions. Inspect edge-to-edge insets and touch targets in portrait and landscape, open an existing form to test the software keyboard, and exercise system Back and app navigation.

The live timer uses a monotonic clock and checkpoints detected wall-clock jumps. Verify monotonic behavior across OS sleep on each target WebView because the clock can stop advancing on some platforms. After a full browser closure, recovery depends on the last saved wall-clock anchor. An adjustment during closure, or before a detected jump's checkpoint commits, may affect recovery time. Unobserved deadlines use the persisted start or resume timezone. Check this policy on real devices after changing zones. Exact background alarms and native lifecycle behavior remain unverified.
