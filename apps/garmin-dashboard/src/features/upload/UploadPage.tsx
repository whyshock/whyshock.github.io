/**
 * Upload page for Garmin data export files.
 * Supports drag-and-drop of ZIP exports, individual FIT/JSON files,
 * and credential-based Garmin Connect sync.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/data-store';
import {
  parseGarminZip,
  parseFitFiles,
  parseJsonFiles,
  type ParseProgress,
  type ParseResult,
} from '@/services/garmin-parser';
import { DataSummary } from './DataSummary';
import { GarminLoginForm } from './GarminLoginForm';

type UploadState = 'idle' | 'dragging' | 'parsing' | 'complete' | 'error';
type TabOption = 'upload' | 'connect';

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabOption>('upload');
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const setActivities = useDataStore((s) => s.setActivities);
  const setDailySummaries = useDataStore((s) => s.setDailySummaries);
  const setDailyDetails = useDataStore((s) => s.setDailyDetails);
  const setProfile = useDataStore((s) => s.setProfile);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setState('parsing');
      setErrorMessage('');
      setProgress({ phase: 'extracting', current: 0, total: 1 });

      try {
        const fileArray = Array.from(files);
        let parseResult: ParseResult;

        // Determine file types
        const zipFiles = fileArray.filter(
          (f) => f.name.endsWith('.zip') || f.type === 'application/zip'
        );
        const fitFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith('.fit'));
        const jsonFiles = fileArray.filter((f) => f.name.endsWith('.json'));

        if (zipFiles.length > 0) {
          // Parse ZIP export
          parseResult = await parseGarminZip(zipFiles[0]!, setProgress);
        } else if (fitFiles.length > 0 && jsonFiles.length === 0) {
          // Parse FIT files only
          parseResult = await parseFitFiles(fitFiles, setProgress);
        } else if (jsonFiles.length > 0) {
          // Parse JSON files (and any FIT files)
          const allJsonResult = await parseJsonFiles(jsonFiles, setProgress);
          if (fitFiles.length > 0) {
            const fitResult = await parseFitFiles(fitFiles, setProgress);
            allJsonResult.activities.push(...fitResult.activities);
            allJsonResult.errors.push(...fitResult.errors);
          }
          parseResult = allJsonResult;
        } else {
          setState('error');
          setErrorMessage(
            'No supported files found. Please upload a Garmin export ZIP, FIT files, or JSON files.'
          );
          return;
        }

        // Check if we got any data
        if (
          parseResult.activities.length === 0 &&
          parseResult.dailySummaries.length === 0
        ) {
          setState('error');
          setErrorMessage(
            'No activity or wellness data found in the uploaded files. Make sure you\'re uploading a Garmin Connect data export.'
          );
          return;
        }

        // Store the parsed data
        if (parseResult.activities.length > 0) {
          setActivities(parseResult.activities);
        }
        if (parseResult.dailySummaries.length > 0) {
          setDailySummaries(parseResult.dailySummaries);
        }
        if (parseResult.dailyDetails && Object.keys(parseResult.dailyDetails).length > 0) {
          setDailyDetails(parseResult.dailyDetails);
        }
        if (parseResult.userProfile) {
          setProfile(parseResult.userProfile);
        }

        setResult(parseResult);
        setState('complete');
      } catch (error) {
        setState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'An unexpected error occurred while parsing files.'
        );
      }
    },
    [setActivities, setDailySummaries, setDailyDetails, setProfile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('idle');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { files } = e.dataTransfer;
      if (files.length > 0) {
        handleFiles(files);
      } else {
        setState('idle');
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResult(null);
    setErrorMessage('');
  }, []);

  const handleProceed = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Show summary after parsing
  if (state === 'complete' && result) {
    return (
      <DataSummary
        result={result}
        onProceed={handleProceed}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Upload Your Garmin Data
          </h1>
          <p className="text-text-secondary">
            Import your fitness data from a Garmin Connect export to view your dashboard.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-bg-secondary border border-border p-1 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'upload'
                ? 'bg-bg-primary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload File
            </span>
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'connect'
                ? 'bg-bg-primary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.07-9.07l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
              </svg>
              Connect Account
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' ? (
          <>
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => state === 'idle' && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Drop zone for Garmin data files"
              className={`
                relative rounded-xl border-2 border-dashed p-12 text-center cursor-pointer
                transition-all duration-200 ease-in-out
                ${state === 'dragging'
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : state === 'parsing'
                    ? 'border-accent bg-accent/5 cursor-wait'
                    : state === 'error'
                      ? 'border-error bg-error/5'
                      : 'border-border hover:border-primary/50 hover:bg-bg-secondary'
                }
              `}
            >
              {state === 'idle' || state === 'dragging' ? (
                <>
                  {/* Upload Icon */}
                  <div className="mb-4">
                    <svg
                      className={`w-16 h-16 mx-auto transition-transform duration-200 ${
                        state === 'dragging' ? 'scale-110 text-primary' : 'text-text-muted'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  </div>

                  <p className="text-lg font-medium text-text-primary mb-2">
                    {state === 'dragging' ? 'Drop files here' : 'Drag & drop your Garmin export'}
                  </p>
                  <p className="text-sm text-text-secondary mb-4">
                    or click to browse files
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center text-xs text-text-muted">
                    <span className="px-2 py-1 rounded-md bg-bg-tertiary">.zip</span>
                    <span className="px-2 py-1 rounded-md bg-bg-tertiary">.fit</span>
                    <span className="px-2 py-1 rounded-md bg-bg-tertiary">.json</span>
                  </div>
                </>
              ) : state === 'parsing' ? (
                <>
                  {/* Parsing Progress */}
                  <div className="mb-4">
                    <div className="w-12 h-12 mx-auto border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
                  </div>
                  <p className="text-lg font-medium text-text-primary mb-2">
                    {progress?.phase === 'extracting' ? 'Extracting ZIP...' : 'Parsing files...'}
                  </p>
                  {progress && progress.total > 0 && (
                    <>
                      <div className="w-full max-w-xs mx-auto bg-bg-tertiary rounded-full h-2 mb-2">
                        <div
                          className="bg-accent h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round((progress.current / progress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-text-muted truncate max-w-md mx-auto">
                        {progress.currentFile ?? `${progress.current}/${progress.total} files`}
                      </p>
                    </>
                  )}
                </>
              ) : state === 'error' ? (
                <>
                  {/* Error State */}
                  <div className="mb-4">
                    <svg
                      className="w-16 h-16 mx-auto text-error"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-error mb-2">Upload Failed</p>
                  <p className="text-sm text-text-secondary mb-4">{errorMessage}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
                  >
                    Try Again
                  </button>
                </>
              ) : null}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".zip,.fit,.json"
              multiple
              onChange={handleFileSelect}
            />

            {/* Instructions */}
            <div className="mt-8 p-4 rounded-lg bg-bg-secondary border border-border">
              <h3 className="font-medium text-text-primary mb-2">How to export your Garmin data:</h3>
              <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://connect.garmin.com/modern/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Garmin Connect Settings
                  </a>
                </li>
                <li>Click &ldquo;Export Your Data&rdquo; under Account Information</li>
                <li>Garmin will email you a ZIP file — upload it here</li>
              </ol>
              <p className="text-xs text-text-muted mt-3">
                You can also drag individual .fit files exported from activity pages.
                All data is processed locally in your browser — nothing is sent to any server.
              </p>
            </div>
          </>
        ) : (
          /* Connect Account Tab */
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Connect your Garmin account
              </h2>
              <p className="text-sm text-text-secondary">
                Enter your Garmin Connect credentials to automatically fetch your recent data.
              </p>
            </div>

            <GarminLoginForm />

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-text-muted text-center">
                If login fails, try{' '}
                <button
                  onClick={() => setActiveTab('upload')}
                  className="text-primary hover:underline"
                >
                  uploading your data export
                </button>{' '}
                instead.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
