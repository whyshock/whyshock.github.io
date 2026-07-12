/**
 * Performance page — protected route.
 * Displays race predictor and functional threshold metrics.
 *
 * Validates: Requirements 4.5, 4.6
 */

import { PerformanceView } from './PerformanceView';

export default function PerformancePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
      <p className="mt-1 text-text-secondary">
        Race predictions and threshold estimates based on your training data.
      </p>

      <div className="mt-6">
        <PerformanceView />
      </div>
    </div>
  );
}
