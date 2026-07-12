/**
 * Training page — protected route.
 * Displays training status metrics, training calendar with activities,
 * and personal records section.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7
 */

import { TrainingCalendarView } from './TrainingCalendarView';
import { PersonalRecords } from './PersonalRecords';
import { TrainingStatus } from './TrainingStatus';

export default function TrainingPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-primary">Training</h1>
      <p className="mt-1 text-text-secondary">
        Your training status, calendar, and activity history.
      </p>

      {/* Training Status — VO2 max, training load, recovery */}
      <section className="mt-6" aria-labelledby="training-status-heading">
        <h2 id="training-status-heading" className="mb-3 text-lg font-semibold text-text-primary">
          Training Status
        </h2>
        <TrainingStatus />
      </section>

      {/* Training Calendar */}
      <section className="mt-8" aria-labelledby="training-calendar-heading">
        <h2 id="training-calendar-heading" className="mb-3 text-lg font-semibold text-text-primary">
          Calendar
        </h2>
        <TrainingCalendarView />
      </section>

      {/* Personal Records */}
      <section className="mt-8" aria-labelledby="personal-records-heading">
        <h2 id="personal-records-heading" className="mb-4 text-xl font-semibold text-text-primary">
          Personal Records
        </h2>
        <PersonalRecords />
      </section>
    </div>
  );
}
