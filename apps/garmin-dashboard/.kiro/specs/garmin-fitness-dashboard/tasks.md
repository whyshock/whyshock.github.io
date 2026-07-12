# Implementation Plan: Garmin Fitness Dashboard

## Overview

A comprehensive fitness dashboard SPA built with React 19, TypeScript, and Vite, deployed on GitHub Pages with a Cloudflare Worker OAuth proxy. The implementation proceeds from project scaffolding through authentication, data layer, UI shell, feature views, enriched insights, animations, and CI/CD pipeline.

## Tasks

- [x] 1. Set up project structure and core configuration
  - [x] 1.1 Initialize Vite + React + TypeScript project
    - Run `npm create vite@latest` with React + TypeScript template
    - Configure `tsconfig.json` with strict mode, path aliases (`@/`)
    - Configure `vite.config.ts` with base path for GitHub Pages, code splitting
    - Install and configure Tailwind CSS 4 with light/dark theme tokens
    - Install core dependencies: `react-router-dom`, `@tanstack/react-query`, `zustand`, `recharts`, `leaflet`
    - Install dev dependencies: `eslint`, `prettier`, `vitest`, `@testing-library/react`, `fast-check`
    - _Requirements: 8.1, 8.3, 9.5_

  - [x] 1.2 Define TypeScript interfaces and type definitions
    - Create `src/types/garmin.ts` with all domain model interfaces (Activity, ActivityDetail, DailySummary, PersonalRecord, TrainingStatus, EnrichedInsight, ExerciseAnimationConfig, UserPreferences, AuthSession, UserProfile)
    - Create `src/types/api.ts` with API response types and error types
    - Create `src/types/cache.ts` with CacheService interface
    - _Requirements: 2.2, 2.3, 3.2, 6.1–6.5_

  - [x] 1.3 Set up project directory structure and placeholder modules
    - Create directory structure: `src/components/{layout,charts,maps,animations,ui}`, `src/features/{auth,activities,daily-summary,training,insights,performance}`, `src/services/`, `src/stores/`, `src/utils/`, `src/assets/animations/`
    - Create barrel index files for each module
    - Configure ESLint with accessibility plugin (`eslint-plugin-jsx-a11y`)
    - _Requirements: 8.1, 12.2_

- [x] 2. Implement OAuth Proxy (Cloudflare Worker)
  - [x] 2.1 Create Cloudflare Worker project structure
    - Initialize worker project under `worker/` directory with Wrangler config
    - Define environment bindings for GARMIN_CONSUMER_KEY, GARMIN_CONSUMER_SECRET, ALLOWED_ORIGINS, ENCRYPTION_KEY
    - Implement `/health` endpoint returning 200 with status JSON
    - _Requirements: 11.1, 11.4_

  - [x] 2.2 Implement OAuth 1.0a request token endpoint
    - Implement `GET /auth/request-token` handler
    - Sign request using OAuth 1.0a HMAC-SHA1 with consumer credentials
    - Return `{ redirectUrl, requestToken }` to client
    - Add Origin header validation against ALLOWED_ORIGINS allowlist
    - Return 403 for unauthorized origins
    - _Requirements: 1.1, 1.2, 11.3, 11.5_

  - [x] 2.3 Implement OAuth 1.0a access token exchange endpoint
    - Implement `POST /auth/access-token` handler
    - Accept `requestToken` and `oauthVerifier` in request body
    - Exchange for access token + secret via Garmin API
    - Encrypt tokens with AES-256-GCM before returning to client
    - Ensure token data is discarded from memory within 30 seconds
    - _Requirements: 1.2, 1.3, 10.3, 10.4_

  - [x] 2.4 Implement token refresh endpoint
    - Implement `POST /auth/refresh-token` handler
    - Accept encrypted refresh token, decrypt, exchange for new tokens
    - Return new encrypted token payload
    - Implement max 1 retry on refresh failure within 5 seconds
    - _Requirements: 1.6, 1.7_

  - [x] 2.5 Write unit tests for OAuth proxy
    - Test origin validation (allowed/blocked domains)
    - Test token exchange flow with mocked Garmin API
    - Test 403 response for unauthorized origins
    - Test token memory cleanup timing
    - _Requirements: 11.3, 11.5, 10.3, 10.4_

- [x] 3. Implement Authentication Flow (Client-Side)
  - [x] 3.1 Create auth store and session management
    - Implement `src/stores/auth-store.ts` with Zustand
    - Manage AuthSession state: login, logout, token refresh, session expiry check
    - Store encrypted tokens in sessionStorage prefixed with userId
    - Implement automatic session cleanup on sign-out (clear all user-prefixed storage)
    - _Requirements: 1.3, 1.8, 10.1, 10.2_

  - [x] 3.2 Implement crypto utilities for token encryption
    - Create `src/utils/crypto.ts` with AES-256-GCM encrypt/decrypt using Web Crypto API
    - Implement key derivation from user-specific salt
    - Ensure tokens are never stored in plaintext
    - _Requirements: 1.3, 11.2, 11.4_

  - [x] 3.3 Implement OAuth proxy client service
    - Create `src/services/oauth-proxy.ts` implementing OAuthProxyAPI interface
    - Implement `getRequestToken()`, `exchangeAccessToken()`, `refreshToken()` methods
    - Handle error responses and timeout (5 second max for token exchange)
    - Load proxy URL from build-time environment variable
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 11.4_

  - [x] 3.4 Implement AuthProvider context and sign-in page
    - Create `src/features/auth/AuthProvider.tsx` wrapping app with auth context
    - Create `src/features/auth/SignInPage.tsx` with Garmin sign-in button
    - Implement OAuth redirect flow (redirect to Garmin, handle callback)
    - Display user profile name on successful auth
    - Handle auth errors with retry option
    - _Requirements: 1.1, 1.4, 1.5, 1.7_

  - [x] 3.5 Write property tests for authentication
    - **Property 1: Token encryption round-trip** — encrypt then decrypt always returns original token
    - **Validates: Requirements 1.3, 11.2**
    - **Property 2: User namespace isolation** — storage keys for different userIds never collide
    - **Validates: Requirements 10.1, 10.2**

- [~] 4. Checkpoint - Authentication complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Garmin API Client and Caching Layer
  - [x] 5.1 Create Garmin API client with OAuth signing
    - Implement `src/services/garmin-api.ts` implementing GarminAPIClient interface
    - Sign all requests with OAuth 1.0a HMAC-SHA1 using stored access token
    - Implement methods: `getActivities`, `getActivityDetail`, `getDailySummary`, `getPersonalRecords`, `getTrainingStatus`, `getUserProfile`
    - Handle API errors with typed error responses
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 4.2, 4.3_

  - [x] 5.2 Implement user-namespaced caching layer
    - Create `src/services/cache.ts` implementing CacheService interface
    - Prefix all keys with `{userId}:` for multi-user isolation
    - Implement TTL-based cache expiration
    - Implement `get`, `set`, `clear(userId)`, `clearAll()` methods
    - Store activity data in localStorage, auth in sessionStorage
    - _Requirements: 2.6, 10.1, 10.2_

  - [x] 5.3 Integrate TanStack Query with Garmin API client
    - Create custom hooks: `useActivities`, `useActivityDetail`, `useDailySummary`, `usePersonalRecords`, `useTrainingStatus`
    - Configure staleTime, cacheTime, and retry logic per query
    - Implement background refresh on window focus
    - Provide loading/error states via query status
    - _Requirements: 2.5, 2.6, 3.7, 8.7_

  - [x] 5.4 Write property tests for caching layer
    - **Property 3: Cache namespace isolation** — data written under userId A is never retrievable under userId B
    - **Validates: Requirements 10.1, 10.2**
    - **Property 4: Cache TTL expiration** — expired entries return null
    - **Validates: Requirements 2.6**

- [x] 6. Implement SPA Shell (Routing, Layout, Navigation, Theme)
  - [x] 6.1 Configure client-side routing with code splitting
    - Create `src/router.tsx` with React Router v7 and lazy-loaded route components
    - Define routes: `/`, `/activities`, `/activities/:id`, `/daily-summary`, `/training`, `/insights`, `/performance`, `/exercises`
    - Implement route guards (redirect unauthenticated users to sign-in)
    - Verify initial bundle stays under 200KB gzip
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 6.2 Implement responsive layout shell
    - Create `src/components/layout/Layout.tsx` with header, main content, footer
    - Create `src/components/layout/NavigationBar.tsx` for desktop (≥1024px)
    - Create `src/components/layout/HamburgerMenu.tsx` for mobile (<768px) with 44x44px touch target
    - Implement responsive breakpoints at 768px and 1024px
    - _Requirements: 12.1, 12.4, 12.6_

  - [x] 6.3 Implement theme toggle and preferences store
    - Create `src/stores/preferences-store.ts` with Zustand
    - Manage theme ('light' | 'dark' | 'system'), unitSystem, defaultDateRange
    - Create `src/components/ui/ThemeToggle.tsx` with light/dark/system options
    - Apply theme via Tailwind dark mode class on `<html>`
    - Default to system preference, persist choice per user
    - _Requirements: 12.5, 8.7_

  - [x] 6.4 Write property tests for routing and navigation
    - **Property 5: Route navigation preserves auth state** — navigating between any routes never clears auth session
    - **Validates: Requirements 8.7, 8.2**
    - **Property 6: Browser history consistency** — back/forward navigation renders matching route
    - **Validates: Requirements 8.6**

- [ ] 7. Implement Activities View
  - [x] 7.1 Implement activity list with pagination
    - Create `src/features/activities/ActivityList.tsx`
    - Display activity type, date, duration, distance for each activity
    - Implement pagination controls (50 activities per page)
    - Show loading indicator while fetching
    - Handle API errors with retry button
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [x] 7.2 Implement activity detail view
    - Create `src/features/activities/ActivityDetail.tsx`
    - Display heart rate zones, pace/speed splits, cadence, elevation profile
    - Gracefully omit unavailable metrics without error
    - Show exercise sets for strength training activities
    - _Requirements: 2.3, 2.7_

  - [x] 7.3 Implement GPS route map component
    - Create `src/components/maps/ActivityMap.tsx` using Leaflet
    - Render GPS route polyline on interactive map
    - Support zoom, pan, and click-on-route to show pace/elevation at point
    - Only render when activity has GPS data
    - _Requirements: 4.4, 4.7_

  - [~] 7.4 Write unit tests for activities view
    - Test pagination state management
    - Test graceful handling of missing metrics
    - Test error states and retry behavior
    - _Requirements: 2.1, 2.4, 2.7_

- [ ] 8. Implement Daily Summary View
  - [x] 8.1 Implement daily summary data display
    - Create `src/features/daily-summary/DailySummaryView.tsx`
    - Display steps, resting HR, sleep duration/stages, stress, body battery, respiration rate
    - Default to 7-day date range on load
    - Show placeholder for dates with no data
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 8.2 Implement date range picker and time-series charts
    - Create `src/features/daily-summary/DateRangePicker.tsx` (up to 90 days selectable)
    - Create `src/components/charts/MetricsChart.tsx` using Recharts
    - Render metrics as time-series with selectable granularity (day, week, month)
    - Update data within 5 seconds of range change
    - Handle loading and error states
    - _Requirements: 3.3, 3.4, 3.6, 3.7_

  - [~] 8.3 Write unit tests for daily summary
    - Test date range validation (max 90 days)
    - Test placeholder rendering for missing dates
    - Test chart data transformation
    - _Requirements: 3.3, 3.5_

- [~] 9. Checkpoint - Core views complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Training Features (Garmin Connect Replication)
  - [x] 10.1 Implement training calendar view
    - Create `src/features/training/TrainingCalendarView.tsx`
    - Display monthly calendar grid with activities plotted on their dates
    - Show activity type, duration, and color-coded indicator per type
    - Support month navigation
    - _Requirements: 4.1_

  - [x] 10.2 Implement personal records display
    - Create `src/features/training/PersonalRecords.tsx`
    - Display longest run, fastest pace, highest elevation gain (minimum set)
    - Handle empty state with placeholder message
    - Handle API errors with retry
    - _Requirements: 4.2, 4.6, 4.7_

  - [x] 10.3 Implement training status and performance metrics
    - Create `src/features/training/TrainingStatus.tsx` showing VO2 max, training load, recovery time
    - Create `src/features/performance/PerformanceView.tsx` with race predictor and functional threshold
    - Handle unavailable data with informative messages
    - _Requirements: 4.3, 4.5, 4.6_

  - [~] 10.4 Write unit tests for training features
    - Test calendar grid rendering with various activity configurations
    - Test empty state rendering for personal records
    - Test error/retry behavior for training status
    - _Requirements: 4.1, 4.6, 4.7_

- [ ] 11. Implement Strava-Like Features
  - [~] 11.1 Implement activity feed with social-style cards
    - Create `src/features/performance/ActivityFeed.tsx`
    - Display summary cards: type, date, distance, duration, pace/speed, elevation, route thumbnail
    - 20 activities per page with pagination
    - Omit route thumbnail for non-GPS activities
    - _Requirements: 5.1, 5.2, 5.7_

  - [~] 11.2 Implement segment analysis and training summaries
    - Create `src/features/performance/SegmentAnalysis.tsx`
    - Break GPS routes into ~1km/1mi segments with pace and elevation per segment
    - Respect user unit preference (metric/imperial)
    - Create weekly/monthly training summaries (distance, time, elevation, count)
    - _Requirements: 5.3, 5.4_

  - [~] 11.3 Implement year-over-year comparison and fitness/freshness chart
    - Create `src/features/performance/YearOverYear.tsx` showing cumulative distance/count vs up to 3 prior years
    - Create `src/features/performance/FitnessAndFreshness.tsx` with rolling 90-day chart, adjustable up to 12 months
    - Derive fitness/freshness from training load and recovery data
    - _Requirements: 5.5, 5.6_

  - [~] 11.4 Write property tests for segment analysis
    - **Property 7: Segment distance consistency** — sum of segment distances equals total route distance (within tolerance)
    - **Validates: Requirements 5.3**
    - **Property 8: Unit conversion correctness** — metric segments ≈ 1km, imperial segments ≈ 1 mile
    - **Validates: Requirements 5.3**

- [ ] 12. Implement Enriched Data Insights
  - [~] 12.1 Implement insight calculator algorithms
    - Create `src/utils/calculations.ts` implementing InsightCalculator interface
    - Implement `calculateTrainingIntensity` (HR zones + duration + type → 0-100)
    - Implement `calculateAerobicEfficiency` (pace / avgHR → 0-100, running only)
    - Implement `calculateRecoveryReadiness` (HR trend + sleep + body battery → 0-100)
    - Implement `calculateWeeklyBalance` (activity types + durations → 0-100)
    - Implement `classifyOvertrainingRisk` (load trend + recovery + sleep + HRV → low/moderate/high)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [~] 12.2 Implement insights view with contributing metrics display
    - Create `src/features/insights/InsightsView.tsx`
    - Create `src/features/insights/InsightCard.tsx` showing derived value + contributing metrics + description
    - Handle missing metrics: indicate which are unavailable, don't show calculated value
    - Handle insufficient data (<3 days): show appropriate message
    - _Requirements: 6.6, 6.8, 6.9_

  - [~] 12.3 Implement insight trend charts
    - Create `src/features/insights/InsightTrendChart.tsx` using Recharts
    - Show change over selectable period: 7d, 30d, 90d, 1 year
    - Render all 5 insight types as time-series
    - _Requirements: 6.7_

  - [~] 12.4 Write property tests for insight calculations
    - **Property 9: Training intensity output range** — always produces value in [0, 100]
    - **Validates: Requirements 6.1**
    - **Property 10: Aerobic efficiency output range** — always produces value in [0, 100]
    - **Validates: Requirements 6.2**
    - **Property 11: Recovery readiness output range** — always produces value in [0, 100]
    - **Validates: Requirements 6.3**
    - **Property 12: Weekly balance output range** — always produces value in [0, 100]
    - **Validates: Requirements 6.4**
    - **Property 13: Overtraining risk classification** — always returns 'low', 'moderate', or 'high'
    - **Validates: Requirements 6.5**
    - **Property 14: Missing metric handling** — if any contributing metric is undefined, result is marked insufficientData
    - **Validates: Requirements 6.8**
    - **Property 15: Insufficient history guard** — fewer than 3 days of data yields no calculated value
    - **Validates: Requirements 6.9**

- [~] 13. Checkpoint - Features complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Exercise Animation System
  - [~] 14.1 Create SVG exercise animation assets
    - Create minimum 20 exercise SVG animations in `src/assets/animations/`
    - Exercises: squats, lunges, push-ups, planks, deadlifts, bench press, rows, shoulder press, bicep curls, tricep dips, burpees, mountain climbers, jumping jacks, leg press, calf raises, lat pulldown, chest fly, Russian twist, leg raises, hip thrust
    - Each animation: one full rep cycle, 2-6 seconds duration
    - Use CSS keyframe animations with browser-native SVG
    - _Requirements: 7.1, 7.4_

  - [~] 14.2 Implement exercise animation component and matching logic
    - Create `src/components/animations/ExerciseAnimation.tsx`
    - Implement exercise name → animation matching from activity data
    - Display animation for matched exercises, static placeholder for unmatched
    - Show exercise name, target muscle groups, rep/set count on hover/select within 300ms
    - Provide play, pause, replay controls for each animation
    - _Requirements: 7.2, 7.3, 7.5, 7.6_

  - [~] 14.3 Implement exercise library page
    - Create `src/features/exercises/ExerciseLibrary.tsx` listing all available animations
    - Allow users to browse and preview exercise animations
    - Ensure ARIA labels for all animation elements
    - _Requirements: 7.1, 12.3_

  - [~] 14.4 Write property tests for exercise animation system
    - **Property 16: Animation duration bounds** — all animations have duration in [2, 6] seconds
    - **Validates: Requirements 7.1**
    - **Property 17: Exercise matching determinism** — same exercise name always maps to same animation config
    - **Validates: Requirements 7.2**
    - **Property 18: Unmatched exercise fallback** — exercises without matching animation always show placeholder
    - **Validates: Requirements 7.3**

- [ ] 15. Implement Accessibility and Responsive Design Compliance
  - [~] 15.1 Implement accessibility features across all views
    - Add meaningful alt text and ARIA labels for all charts and animations
    - Ensure full keyboard navigation support (tab order, focus management, escape to close)
    - Verify WCAG 2.1 AA color contrast in both light and dark themes
    - Ensure minimum 44x44px touch targets on mobile for all interactive elements
    - _Requirements: 12.2, 12.3, 12.6_

  - [~] 15.2 Implement responsive breakpoint adaptations
    - Verify layout adapts correctly at 320px, 768px, 1024px, and 2560px viewports
    - Ensure hamburger menu appears below 768px with proper touch target
    - Ensure charts and maps resize appropriately at all breakpoints
    - Test content reflow without horizontal scrolling at 320px
    - _Requirements: 12.1, 12.4_

  - [~] 15.3 Write property tests for responsive and accessibility
    - **Property 19: Touch target minimum size** — all interactive elements on mobile viewport have dimensions ≥ 44x44px
    - **Validates: Requirements 12.6**
    - **Property 20: Theme toggle persistence** — theme preference survives navigation and page reload
    - **Validates: Requirements 12.5**

- [ ] 16. Implement CI/CD Pipeline
  - [~] 16.1 Create GitHub Actions workflow for build and deploy
    - Create `.github/workflows/deploy.yml`
    - Steps: checkout → install → lint → test → secret scan → build → deploy to GitHub Pages
    - Trigger on push to main branch
    - Use GitHub Secrets for VITE_OAUTH_PROXY_URL, VITE_GARMIN_CLIENT_ID
    - Fail build if any secret/env variable is missing
    - _Requirements: 9.1, 9.2, 9.6, 11.1, 11.6_

  - [~] 16.2 Implement secret scanning and build validation
    - Add secret scanning step using `trufflehog` or `gitleaks` action
    - Fail pipeline if API keys, secrets, or credentials detected in source
    - Add deployment summary output with commit hash and UTC timestamp
    - Halt deployment on lint or test failure with clear failure report
    - _Requirements: 9.3, 9.4, 9.7, 11.7_

  - [~] 16.3 Write integration tests for CI/CD pipeline
    - Verify build produces correct output structure for GitHub Pages
    - Verify environment variable injection at build time
    - Verify bundle size stays under 200KB gzip
    - _Requirements: 9.1, 8.3, 11.4_

- [ ] 17. Implement Multi-User Support and Browser Compatibility
  - [~] 17.1 Implement user switching and data isolation
    - Ensure all localStorage/sessionStorage reads/writes use userId prefix
    - On new user sign-in: clear all previous user's prefixed entries and in-memory state
    - Handle scope authorization failures: display unauthorized scopes, show placeholders for affected sections
    - _Requirements: 10.1, 10.2, 10.5_

  - [~] 17.2 Implement browser compatibility check
    - Create `src/components/ui/BrowserCheck.tsx`
    - Detect browser version (last 2 major versions of Chrome, Firefox, Safari, Edge)
    - Show unsupported browser message and prevent app rendering for older browsers
    - _Requirements: 8.5_

  - [~] 17.3 Write property tests for multi-user isolation
    - **Property 21: Storage key uniqueness** — no two users can read each other's cached data
    - **Validates: Requirements 10.1, 10.2**
    - **Property 22: Session cleanup completeness** — after sign-out, no user-prefixed keys remain in storage
    - **Validates: Requirements 1.8, 10.2**
    - **Property 23: Concurrent user separation** — OAuth proxy handles 10+ simultaneous exchanges without data leakage
    - **Validates: Requirements 10.3**

- [ ] 18. Final Integration and Wiring
  - [~] 18.1 Wire all feature modules into application shell
    - Connect all route components to router with lazy loading
    - Wire AuthProvider → TanStack QueryProvider → ThemeProvider → Layout → Routes
    - Verify state preservation across navigation (auth, filters, preferences)
    - Verify code splitting results in initial bundle < 200KB gzip
    - _Requirements: 8.1, 8.2, 8.3, 8.7_

  - [~] 18.2 Implement error boundaries and global error handling
    - Create error boundary components for each feature section
    - Implement global error handler for uncaught promises
    - Ensure errors in one view don't crash the entire app
    - Add retry mechanisms for transient API failures
    - _Requirements: 2.4, 3.6, 4.6_

  - [~] 18.3 Write end-to-end property tests
    - **Property 24: Navigation never triggers full page reload** — all route changes update URL without page reload
    - **Validates: Requirements 8.2, 8.6**

- [~] 19. Final Checkpoint - All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- Property tests use `fast-check` library for generative testing
- All 12 requirements are covered across the task list
- 24 correctness properties are distributed across relevant implementation tasks
- The Cloudflare Worker (Task 2) can be developed and deployed independently of the SPA
- TanStack Query handles loading states, error states, and caching automatically
- Tailwind CSS dark mode uses class strategy for theme toggle support

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.2", "6.3"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "5.2"] },
    { "id": 4, "tasks": ["2.4", "3.3", "6.1"] },
    { "id": 5, "tasks": ["2.5", "3.4", "3.5", "6.2"] },
    { "id": 6, "tasks": ["5.1", "6.4"] },
    { "id": 7, "tasks": ["5.3", "5.4"] },
    { "id": 8, "tasks": ["7.1", "8.1", "10.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "8.2", "10.2", "10.3"] },
    { "id": 10, "tasks": ["7.4", "8.3", "10.4", "11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 12, "tasks": ["11.4", "12.2", "12.3"] },
    { "id": 13, "tasks": ["12.4", "14.1"] },
    { "id": 14, "tasks": ["14.2", "14.3"] },
    { "id": 15, "tasks": ["14.4", "15.1", "15.2"] },
    { "id": 16, "tasks": ["15.3", "16.1", "17.1", "17.2"] },
    { "id": 17, "tasks": ["16.2", "16.3", "17.3"] },
    { "id": 18, "tasks": ["18.1"] },
    { "id": 19, "tasks": ["18.2"] },
    { "id": 20, "tasks": ["18.3"] }
  ]
}
```
