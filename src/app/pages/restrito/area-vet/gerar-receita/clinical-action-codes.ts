/** Labels PT — manter sincronizado com `services/ai/clinical/actionCodes.js`. */

export const CLINICAL_ACTION_LABELS_PT: Record<string, string> = {
  abdominal_ultrasound: 'Ultrassom abdominal',
  thoracic_radiography: 'Radiografia torácica',
  abdominal_radiography: 'Radiografia abdominal',
  blood_test_cbc: 'Hemograma completo',
  blood_test_biochemistry: 'Perfil bioquímico (renal/hepático/eletrolítos)',
  urinalysis: 'Urinálise',
  fluid_therapy: 'Fluidoterapia / suporte hídrico',
  pain_management_protocol: 'Protocolo de analgesia',
  oxygen_support: 'Suporte de oxigénio',
  hospitalization_consideration: 'Avaliar internação / observação prolongada',
  detailed_neurological_exam: 'Exame neurológico detalhado',
  orthopedic_evaluation: 'Avaliação ortopédica focada',
  antiemetic_support: 'Suporte antiemético (avaliação clínica)',
  recheck_24h: 'Reavaliação em 24h',
  dietary_history_review: 'Revisão histórico alimentar',
  temperature_recheck: 'Aferir temperatura (retal)',
  abdominal_palpation_focused: 'Palpação abdominal focada',
  cardiac_auscultation_detailed: 'Ausculta cardíaca detalhada',
  pulmonary_auscultation_basal: 'Ausculta pulmonar (campos basais)',
};

export function labelClinicalAction(code: string): string {
  const c = (code || '').trim();
  return CLINICAL_ACTION_LABELS_PT[c] || c || 'Ação';
}
