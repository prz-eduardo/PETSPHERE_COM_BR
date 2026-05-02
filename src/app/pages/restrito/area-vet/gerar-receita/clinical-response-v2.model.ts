/** Contrato alinhado ao backend `clinicalDecisionV2` / motor de decisão assistida. */

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type DataQualitySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DataQualityFlagV2 {
  type: string;
  severity: DataQualitySeverity;
  message?: string;
}

export interface ClinicalHypothesisV2 {
  id: string;
  label: string;
  confidence: number;
  supportingFindings: string[];
  contradictions: string[];
  suggestedConfirmatoryTests: string[];
  treatmentDirectionHint: string;
}

export interface DiagnosisRankedV2 {
  name: string;
  probability: number;
}

export interface StructuredPriorityV2 {
  immediate: string[];
  high: string[];
  medium: string[];
  low: string[];
}

export interface ClinicalResponseV2 {
  clinicalRiskScore: number;
  urgencyLevel: UrgencyLevel;
  structuredPriority: StructuredPriorityV2;
  recommendedActions: string[];
  possibleDiagnosesRanked: DiagnosisRankedV2[];
  hypotheses: ClinicalHypothesisV2[];
  missingCriticalData: string[];
  physicalExamChecklist: string[];
  dataQualityFlags: DataQualityFlagV2[];
  clinicalWarnings: string[];
}

export function hasCriticalDataQuality(flags: DataQualityFlagV2[] | undefined | null): boolean {
  return !!(flags && flags.some((f) => f && String(f.severity).toLowerCase() === 'critical'));
}
