# Requirements Document

## Introduction

A Single Page Application (SPA) fitness dashboard that connects to Garmin Connect to collect user fitness and activity data. The dashboard replicates features from both Garmin Connect and Strava, enriches data by combining multiple metrics to derive additional insights, and provides visual animations of training exercises. The application is deployed as a static site on GitHub Pages with multi-user support via Garmin OAuth authentication.

## Glossary

- **Dashboard**: The main SPA interface that displays fitness data, insights, and exercise animations to authenticated users.
- **Garmin_Connect_API**: The Garmin Connect REST API that provides access to user fitness and activity data via OAuth 1.0a authentication.
- **OAuth_Proxy**: A serverless function (e.g., AWS Lambda, Cloudflare Worker) that securely handles OAuth token exchange without exposing secrets in the client-side code.
- **Activity**: A single recorded fitness session (run, bike ride, swim, strength training, etc.) containing metrics such as duration, distance, heart rate, and GPS data.
- **Metric**: A single measurable data point from an activity or daily summary (e.g., heart rate, cadence, pace, elevation, VO2 max).
- **Enriched_Insight**: A derived data point calculated by combining two or more raw metrics to provide additional analytical value (e.g., training load from heart rate + duration + intensity).
- **Exercise_Animation**: A visual animated representation of a specific training exercise rendered in the browser.
- **Auth_Session**: A client-side session storing encrypted OAuth tokens that enables a user to access their personal Garmin data.
- **GitHub_Pages**: A static site hosting service provided by GitHub that serves the SPA from a public repository.
- **CI_CD_Pipeline**: A GitHub Actions workflow that builds, tests, and deploys the SPA to GitHub Pages automatically on code changes.

## Requirements

### Requirement 1: Garmin OAuth Authentication

**User Story:** As a fitness enthusiast, I want to sign in with my Garmin Connect credentials, so that I can view my personal fitness data on the dashboard.

#### Acceptance Criteria

1. WHEN a user initiates sign-in, THE Dashboard SHALL redirect the user to the Garmin Connect OAuth authorization page within 2 seconds.
2. WHEN the Garmin Connect OAuth flow returns an authorization code, THE OAuth_Proxy SHALL exchange the code for access and refresh tokens within 5 seconds.
3. WHEN valid OAuth tokens are received, THE Dashboard SHALL store the tokens in encrypted form in the browser session storage.
4. WHILE a user has a valid Auth_Session, THE Dashboard SHALL display the authenticated user's Garmin profile name.
5. IF the OAuth token exchange fails, THEN THE Dashboard SHALL display an error message indicating authentication failed and offer a retry option.
6. IF the stored access token has expired, THEN THE OAuth_Proxy SHALL attempt to refresh the token using the refresh token with a maximum of 1 retry attempt within 5 seconds.
7. IF the token refresh attempt fails, THEN THE Dashboard SHALL clear the stored tokens, display a message indicating the session has expired, and redirect the user to the sign-in page.
8. WHEN a user clicks the sign-out button, THE Dashboard SHALL clear all stored tokens and redirect to the sign-in page within 1 second.

### Requirement 2: Activity Data Retrieval

**User Story:** As a user, I want to see my recorded activities from Garmin Connect, so that I can review my fitness history in one place.

#### Acceptance Criteria

1. WHEN a user navigates to the activities view, THE Dashboard SHALL retrieve the most recent 50 activities from the Garmin_Connect_API and provide pagination controls to load additional activities in increments of 50.
2. WHEN activity data retrieval is complete, THE Dashboard SHALL display each Activity with its type, date, duration, and distance.
3. WHEN the user selects an individual Activity, THE Dashboard SHALL retrieve and display detailed metrics including heart rate zones, pace/speed, cadence, elevation, and GPS route data where available for that activity type.
4. IF the Garmin_Connect_API returns an error during data retrieval, THEN THE Dashboard SHALL display an error message indicating the nature of the failure and provide a retry button that re-initiates the failed request.
5. WHILE activity data is loading, THE Dashboard SHALL display a loading indicator to the user.
6. THE Dashboard SHALL cache retrieved activity data in local storage for the duration of the browser session and serve subsequent requests for the same data from cache instead of making repeated API calls.
7. IF an activity does not include one or more metric fields (heart rate zones, cadence, elevation, or GPS route data), THEN THE Dashboard SHALL omit the unavailable metric from the detail view and display the remaining available metrics without error.

### Requirement 3: Daily Summary and Health Metrics

**User Story:** As a user, I want to view my daily health summaries (steps, sleep, heart rate, stress), so that I can track my overall wellness trends.

#### Acceptance Criteria

1. WHEN a user navigates to the daily summary view, THE Dashboard SHALL retrieve the user's daily summary data from the Garmin_Connect_API for the most recent 7 days as the default date range.
2. THE Dashboard SHALL display daily steps, resting heart rate, sleep duration, sleep stages, stress level, body battery, and respiration rate.
3. WHEN a user selects a date range of up to 90 days, THE Dashboard SHALL update the displayed data to reflect the selected period within 5 seconds.
4. THE Dashboard SHALL render daily summary metrics as time-series charts with selectable granularity (day, week, month).
5. IF daily summary data is unavailable for a selected date, THEN THE Dashboard SHALL display a placeholder indicating no data is available for that date.
6. IF the Garmin_Connect_API returns an error during daily summary data retrieval, THEN THE Dashboard SHALL display an error message indicating data retrieval failed and offer a retry option.
7. WHILE daily summary data is loading from the Garmin_Connect_API, THE Dashboard SHALL display a loading indicator to the user.

### Requirement 4: Garmin Connect Feature Replication

**User Story:** As a Garmin Connect user, I want familiar features from Garmin Connect available in this dashboard, so that I can use it as an alternative interface.

#### Acceptance Criteria

1. THE Dashboard SHALL display a training calendar view showing activities plotted on a monthly calendar grid, with each activity displaying its type, duration, and a color-coded indicator by activity type.
2. THE Dashboard SHALL display personal records (longest run, fastest pace, highest elevation gain) retrieved from the Garmin_Connect_API as a minimum set.
3. THE Dashboard SHALL display training status indicators including at minimum VO2 max estimate, training load, and recovery time.
4. WHEN a user views an activity with GPS data, THE Dashboard SHALL render the GPS route on a map that supports zoom, pan, and click-on-route to display pace and elevation at the selected point.
5. THE Dashboard SHALL display performance metrics including at minimum race predictor estimates and functional threshold calculations.
6. IF the Garmin_Connect_API returns an error or no data when retrieving training status, personal records, or performance metrics, THEN THE Dashboard SHALL display a message indicating the specific data is unavailable and offer a retry option.
7. IF a user has no recorded personal records or no GPS-enabled activities, THEN THE Dashboard SHALL display a placeholder message indicating no data is available for that section.

### Requirement 5: Strava Feature Replication

**User Story:** As a Strava user, I want features similar to Strava available in this dashboard, so that I can get a Strava-like experience with my Garmin data.

#### Acceptance Criteria

1. THE Dashboard SHALL display a social-feed-style activity list with summary cards showing activity type, date, distance, duration, pace/speed, elevation gain, and a route thumbnail for GPS-enabled activities.
2. THE Dashboard SHALL display up to 20 activities per page in the activity feed, with pagination controls to load additional activities.
3. THE Dashboard SHALL display segment-style analysis for GPS-enabled activities, breaking routes into sections of approximately 1 km (or 1 mile based on user unit preference) and displaying pace and elevation data for each section.
4. THE Dashboard SHALL display weekly and monthly training summaries with totals for distance, time, elevation, and activity count.
5. THE Dashboard SHALL provide a year-over-year comparison view showing cumulative distance and activity count for the current year compared to up to 3 previous years.
6. THE Dashboard SHALL display a fitness and freshness chart derived from training load and recovery data over a rolling 90-day window with the ability to adjust the time range up to 12 months.
7. IF an Activity does not contain GPS data, THEN THE Dashboard SHALL omit the route thumbnail and segment analysis for that activity and display only the available summary metrics.

### Requirement 6: Enriched Data Insights

**User Story:** As a data-driven athlete, I want the dashboard to combine multiple metrics to produce derived insights, so that I can gain deeper understanding of my fitness progress.

#### Acceptance Criteria

1. THE Dashboard SHALL calculate a training intensity score as a normalized value from 0 to 100 by combining heart rate zone distribution with activity duration and type.
2. THE Dashboard SHALL calculate an aerobic efficiency metric as a normalized value from 0 to 100 by combining pace with average heart rate for running activities.
3. THE Dashboard SHALL calculate a recovery readiness score as a normalized value from 0 to 100 by combining resting heart rate trend over the previous 7 days, sleep quality score, and body battery level.
4. THE Dashboard SHALL calculate a weekly training balance metric as a normalized value from 0 to 100 by combining activity types, durations, and intensity distributions across the week.
5. THE Dashboard SHALL classify overtraining risk as low, moderate, or high by combining training load trend, recovery time, sleep quality, and resting heart rate variability over a 7-day rolling window.
6. WHEN the Dashboard calculates an Enriched_Insight, THE Dashboard SHALL display the contributing metrics with their individual values alongside the derived value and a plain-language description of which inputs were used and how they influence the result.
7. THE Dashboard SHALL render all Enriched_Insight values as trend charts showing change over a user-selectable time period with options of 7 days, 30 days, 90 days, and 1 year.
8. IF one or more contributing metrics required for an Enriched_Insight calculation are unavailable, THEN THE Dashboard SHALL indicate which specific metrics are missing and not display a calculated value for that insight.
9. IF fewer than 3 days of historical data are available for a trend-based Enriched_Insight, THEN THE Dashboard SHALL display a message indicating that insufficient data exists to calculate the insight.

### Requirement 7: Exercise Animation Visualizations

**User Story:** As a user reviewing my workouts, I want to see animated visualizations of exercises, so that I can better understand the movements in my training plan.

#### Acceptance Criteria

1. THE Dashboard SHALL provide animated visual representations for a minimum of 20 common training exercises (e.g., squats, lunges, push-ups, planks, deadlifts), where each animation depicts one full repetition cycle lasting between 2 and 6 seconds.
2. WHEN a user views a strength training activity, THE Dashboard SHALL display the corresponding Exercise_Animation for each exercise in the workout that has a matching animation available.
3. IF an exercise in a strength training activity does not have a corresponding Exercise_Animation, THEN THE Dashboard SHALL display a static placeholder image with the exercise name indicating that no animation is available for that exercise.
4. THE Dashboard SHALL render Exercise_Animation using browser-native technologies (CSS animations, SVG, or Canvas).
5. WHEN a user hovers over or selects an Exercise_Animation, THE Dashboard SHALL display the exercise name, target muscle groups, and rep/set count from the activity data within 300 milliseconds of the interaction.
6. THE Dashboard SHALL provide visible play, pause, and replay controls for each Exercise_Animation, allowing the user to start, stop, and restart the animation loop.

### Requirement 8: SPA Architecture and Client-Side Rendering

**User Story:** As a user, I want the dashboard to load quickly and navigate smoothly without full page reloads, so that I have a responsive experience.

#### Acceptance Criteria

1. THE Dashboard SHALL render all views client-side using a JavaScript framework with client-side routing.
2. WHEN a user navigates between views, THE Dashboard SHALL update the URL and render the new view without a full page reload within 300 milliseconds of the navigation action.
3. THE Dashboard SHALL implement code splitting such that each view's code is loaded on demand and the initial JavaScript bundle does not exceed 200 KB (gzip-compressed).
4. THE Dashboard SHALL achieve a Lighthouse Performance score of 80 or above on initial load when tested using Lighthouse default throttling (simulated slow 4G, 4x CPU slowdown).
5. IF the browser does not support required JavaScript features (browsers older than the latest 2 major versions of Chrome, Firefox, Safari, or Edge), THEN THE Dashboard SHALL display a message indicating minimum browser requirements and prevent rendering of the application views.
6. WHEN a user presses the browser back or forward button, THE Dashboard SHALL navigate to the previous or next view in history and update the rendered content without a full page reload.
7. WHEN a user navigates between views, THE Dashboard SHALL preserve shared application state such as authentication status and global filters across the navigation.

### Requirement 9: GitHub Pages Deployment

**User Story:** As a developer, I want the dashboard deployed to GitHub Pages via GitHub Actions, so that it is publicly accessible and automatically updated on code changes.

#### Acceptance Criteria

1. WHEN a push is made to the main branch, THE CI_CD_Pipeline SHALL build and deploy the Dashboard to GitHub_Pages.
2. WHEN a deployment is triggered, THE CI_CD_Pipeline SHALL run linting and all unit tests before executing the deployment step.
3. IF linting or any unit test fails, THEN THE CI_CD_Pipeline SHALL halt the deployment and report the failure in the GitHub Actions workflow summary.
4. IF the deployment step fails after tests pass, THEN THE CI_CD_Pipeline SHALL report the failure in the GitHub Actions workflow summary including the failed step name.
5. THE Dashboard SHALL be served as a static site with all data retrieval happening client-side via the OAuth_Proxy or direct authenticated API calls, with no server-side rendering or backend processes required at runtime.
6. THE CI_CD_Pipeline SHALL store sensitive configuration (OAuth client secrets, proxy URLs) as GitHub repository secrets, not in source code.
7. WHEN a deployment completes successfully, THE CI_CD_Pipeline SHALL produce a deployment summary in the GitHub Actions workflow summary indicating the deployed commit hash and deployment timestamp in UTC.

### Requirement 10: Multi-User Support

**User Story:** As any Garmin user, I want to sign in with my own credentials and see my personal data, so that multiple people can use this dashboard independently.

#### Acceptance Criteria

1. THE Dashboard SHALL isolate each authenticated user's data by prefixing all local storage and session storage entries with the user's unique Garmin user identifier.
2. WHEN a different user signs in on the same browser, THE Dashboard SHALL clear all local storage entries, session storage entries, and in-memory state associated with the previous user's Garmin identifier before displaying the new user's data.
3. THE OAuth_Proxy SHALL handle concurrent token exchanges from a minimum of 10 simultaneous users without data leakage between sessions.
4. THE OAuth_Proxy SHALL discard all OAuth tokens and user data from memory within 30 seconds of completing the token exchange transaction, retaining no user-specific data on the server side.
5. IF a user's Garmin account does not authorize the required data scopes, THEN THE Dashboard SHALL display a notification listing the unauthorized scopes and render placeholder indicators in affected data sections while continuing to display all data for which authorization was granted.

### Requirement 11: Secrets Management for Public Repository

**User Story:** As a developer maintaining a public repository, I want secrets handled securely, so that OAuth credentials and API keys are never exposed in source code.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL inject environment-specific configuration at build time using GitHub Secrets.
2. THE Dashboard source code SHALL not contain any hardcoded API keys, client secrets, or OAuth credentials.
3. THE OAuth_Proxy SHALL validate the Origin header of incoming requests against a configured allowlist of authorized domains to prevent unauthorized usage of the proxy endpoint.
4. THE Dashboard SHALL load runtime configuration (proxy URLs, client IDs) from environment variables injected at build time, and SHALL NOT include OAuth client secrets or token-signing keys in the client-side bundle.
5. IF a request to the OAuth_Proxy originates from an unauthorized domain, THEN THE OAuth_Proxy SHALL reject the request with a 403 status code.
6. IF a required secret or environment variable is not available during the CI_CD_Pipeline build step, THEN THE CI_CD_Pipeline SHALL fail the build and produce an error message indicating which variable is missing.
7. THE CI_CD_Pipeline SHALL run an automated secret-scanning step that fails the build if patterns matching API keys, client secrets, or OAuth credentials are detected in source files.

### Requirement 12: Responsive Design and Accessibility

**User Story:** As a user accessing the dashboard from various devices, I want the interface to be responsive and accessible, so that I can use it on mobile, tablet, and desktop.

#### Acceptance Criteria

1. THE Dashboard SHALL adapt its layout for viewport widths from 320px to 2560px using responsive breakpoints at 768px (tablet) and 1024px (desktop).
2. THE Dashboard SHALL meet WCAG 2.1 Level AA compliance for color contrast, keyboard navigation, and screen reader support.
3. THE Dashboard SHALL provide meaningful alt text or ARIA labels for all Exercise_Animation elements and chart visualizations.
4. WHEN the viewport width is below 768px, THE Dashboard SHALL collapse navigation into a hamburger menu accessible via a minimum 44x44px touch target.
5. THE Dashboard SHALL support both light and dark color themes, defaulting to the user's system preference and allowing manual override via a theme toggle control.
6. THE Dashboard SHALL ensure all interactive elements (buttons, links, controls) have a minimum touch target size of 44x44px on viewports below 768px.
