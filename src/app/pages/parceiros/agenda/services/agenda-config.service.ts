import { Injectable } from '@angular/core';
import { AgendaConfig, PartnerType, ViewMode } from '../../../../types/agenda.types';

@Injectable({ providedIn: 'root' })
export class AgendaConfigService {
  getConfig(tipo: PartnerType): AgendaConfig {
    switch (tipo) {
      case 'PETSHOP':
        return {
          multiProfessional: true,
          allowOverlap: false,
          defaultDuration: 60,
          servicesEnabled: true,
          viewModes: ['DAY', 'WEEK', 'TIMELINE', 'LIST'],
          workStart: 8,
          workEnd: 19,
        };
      case 'CLINIC':
        return {
          multiProfessional: true,
          allowOverlap: false,
          defaultDuration: 30,
          servicesEnabled: true,
          viewModes: ['DAY', 'WEEK', 'TIMELINE', 'LIST'],
          workStart: 8,
          workEnd: 18,
        };
      case 'SITTER':
        return {
          multiProfessional: false,
          allowOverlap: false,
          defaultDuration: 60,
          servicesEnabled: true,
          viewModes: ['DAY', 'WEEK', 'LIST'],
          workStart: 7,
          workEnd: 22,
        };
      case 'HOTEL':
        return {
          multiProfessional: false,
          allowOverlap: true,
          defaultDuration: 1440,
          servicesEnabled: false,
          viewModes: ['WEEK', 'LIST'],
          workStart: 0,
          workEnd: 24,
        };
      case 'DAYCARE':
        return {
          multiProfessional: false,
          allowOverlap: true,
          defaultDuration: 60,
          servicesEnabled: false,
          viewModes: ['DAY', 'WEEK', 'LIST'],
          workStart: 7,
          workEnd: 20,
        };
    }
  }

  getLabelModes(): Record<ViewMode, string> {
    return {
      DAY: 'Dia',
      WEEK: 'Semana',
      TIMELINE: 'Timeline',
      LIST: 'Lista',
    };
  }
}
