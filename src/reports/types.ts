/** Shared types for report generation. */
import type { DateRange } from '@/reports/stats/range';

export type ReportKind = 'pillar' | 'progress';
export type ReportFormat = 'text' | 'pdf';

export interface ReportMeta {
  /** Who the report is about. */
  userName: string;
  companyName?: string;
  /** Display date, e.g. "Monday, 24 August 2026". */
  generatedOn: string;
}

export interface PillarReportOptions {
  kind: 'pillar';
  /** Display number 1-8. */
  pillarNumber: number;
}

export interface ProgressReportOptions {
  kind: 'progress';
  range: DateRange;
  /** Pillar 5 pairs names with performance verdicts; allow leaving it out. */
  excludeBusinessSystems?: boolean;
}

export type ReportOptions = PillarReportOptions | ProgressReportOptions;
