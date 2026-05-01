# Plano Tecnico Prioridade 1 - Vet

Data: 2026-05-01

Objetivo:
- transformar a Prioridade 1 do relatorio em plano executavel
- detalhar por tela, endpoint e modelo de dados
- priorizar o fechamento do modulo Vet sem abrir escopo desnecessario de Clinica Vet

## Principio de arquitetura

O plano parte de uma decisao pragmatica:

- `atendimentos` continua como agregado clinico principal da consulta
- `receitas` continua vinculada ao atendimento via `receitas.atendimento_id`
- `consultas` e `video_chamadas` continuam como motor de telemedicina e agenda
- `clinic_case` e `clinical_event` passam a ser a camada de timeline longitudinal e fila clinica, em vez de criar outro modelo novo

Motivo:
- `atendimentos`, `receitas`, `consultas` e `video_chamadas` ja existem
- o backend ja possui migracao e controller parcial para `clinic_case` e `clinical_event`
- isso permite fechar Vet sem depender da Clinica Vet completa

## Base atual confirmada no repositorio

### Frontend Vet atual

Telas existentes:
- `/area-vet`
- `/gerar-receita`
- `/historico-receitas`
- `/historico-receitas/:id`
- `/pacientes`
- `/pacientes/:petId`
- `/panorama-atendimento`

Observacao importante:
- a landing `/area-vet` ainda e o guia de ativos, nao um cockpit clinico

### Backend clinico atual

Rotas existentes:
- `POST /receitas`
- `GET /receitas`
- `GET /receitas/:id`
- `POST /atendimentos`
- `GET /atendimentos`
- `GET /atendimentos/:id`
- `GET /pacientes`
- `GET /pacientes/:petId`

Motor de telemedicina existente:
- `GET /parceiro/telemedicina/consultas`
- `POST /parceiro/telemedicina/consultas`
- `GET /parceiro/telemedicina/agendamentos/:agendamentoId`
- `POST /parceiro/telemedicina/consultas/:id/entrar`
- `GET /clientes/me/telemedicina`
- `POST /clientes/me/telemedicina/consultas/:id/entrar`

Camada longitudinal existente, mas ainda nao integrada ao Vet:
- `GET /parceiro/clinic-cases`
- `POST /parceiro/clinic-cases`
- `GET /parceiro/clinic-cases/:id`
- `POST /parceiro/clinic-cases/:id/events`

### Modelo de dados existente

Ja existem no banco:
- `atendimentos`
- `atendimento_exames`
- `atendimento_fotos`
- `receitas`
- `receita_ativos`
- `consultas`
- `video_chamadas`
- `clinic_case`
- `clinical_event`

Conclusao tecnica:
- a base para fechar o Vet nao e hipotetica; ela ja existe, mas esta fragmentada

---

## Escopo da Prioridade 1

Prioridade 1 sera entregue em quatro frentes:

1. Dashboard clinico do Vet
2. Prontuario longitudinal por paciente
3. Jornada unica agenda -> atendimento -> receita -> telemedicina
4. Fila operacional do Vet

Cada frente abaixo traz:
- objetivo
- telas
- endpoints
- modelo de dados
- sequencia de implementacao

---

## Frente 1. Dashboard clinico do Vet

### Objetivo

Substituir a home atual de `/area-vet` por um cockpit clinico.

### Tela

#### Tela alvo: `/area-vet`

Estado atual:
- guia de ativos e referencias farmacologicas

Estado alvo:
- dashboard com 5 blocos principais
  - agenda de hoje
  - fila clinica
  - pacientes recentes
  - teleatendimento agora/proximos
  - atalhos clinicos

#### Composicao recomendada da tela

Bloco 1. Resumo do dia
- atendimentos de hoje
- consultas em andamento
- retornos pendentes
- teleconsultas na janela ativa

Bloco 2. Fila clinica
- aguardando inicio
- em atendimento
- aguardando retorno
- exames pendentes

Bloco 3. Pacientes recentes
- ultimos pets tocados pelo vet
- ultimo atendimento
- proxima acao sugerida

Bloco 4. Teleatendimento
- consultas com janela ativa
- consultas em menos de 30 minutos
- botao direto para entrar

Bloco 5. Acoes rapidas
- novo atendimento
- nova receita
- ver pacientes
- abrir fila
- abrir agenda

### Endpoints

#### Reaproveitar
- `GET /atendimentos`
- `GET /pacientes`
- `GET /parceiro/telemedicina/consultas`

#### Criar
- `GET /vet/dashboard`

Resposta sugerida:

```json
{
  "today": {
    "atendimentos": 8,
    "em_andamento": 2,
    "retornos_pendentes": 5,
    "teleconsultas_ativas": 1
  },
  "queue": [
    {
      "atendimento_id": 123,
      "clinic_case_id": 88,
      "pet_id": 44,
      "pet_nome": "Luna",
      "cliente_nome": "Marina",
      "status": "EM_ATENDIMENTO",
      "canal": "presencial",
      "scheduled_at": "<PRIVATE_DATE>",
      "next_action": "emitir_receita"
    }
  ],
  "recent_patients": [],
  "telemedicine": {
    "active": [],
    "upcoming": []
  }
}
```

### Modelo de dados

#### Reaproveitar
- `atendimentos`
- `consultas`
- `clinic_case`
- `clinical_event`

#### Adicionar em `atendimentos`
- `status ENUM('RASCUNHO','AGUARDANDO','EM_ATENDIMENTO','AGUARDANDO_RETORNO','CONCLUIDO','CANCELADO')`
- `canal ENUM('presencial','telemedicina','domicilio')`
- `agendamento_id INT NULL`
- `consulta_id INT NULL`
- `retorno_previsto_em DATETIME NULL`
- `prioridade ENUM('baixa','normal','alta','urgente') DEFAULT 'normal'`

Essas colunas permitem fila clinica sem depender de parsing de `dados_raw`.

### Sequencia de implementacao

1. Adicionar colunas em `atendimentos`.
2. Criar `GET /vet/dashboard` agregando atendimento, paciente e teleconsulta.
3. Substituir o componente raiz de `/area-vet` por dashboard.
4. Rebaixar o guia de ativos para ferramenta secundaria, acessivel por atalho.

---

## Frente 2. Prontuario longitudinal por paciente

### Objetivo

Transformar a tela de paciente em timeline clinica real, e nao apenas resumo com ultimas receitas.

### Telas

#### Tela alvo: `/pacientes`

Estado alvo:
- lista de pacientes com filtros por status clinico, ultimo atendimento e retorno pendente
- chips de alerta: alergia, teleconsulta pendente, exame pendente, retorno vencido

#### Tela alvo: `/pacientes/:petId`

Estado atual:
- resumo do pet, top ativos e ultimas receitas

Estado alvo:
- hub longitudinal do paciente
  - cabecalho do pet
  - resumo clinico
  - timeline de casos
  - timeline de eventos
  - receitas
  - exames e anexos
  - teleconsultas
  - retornos

### Endpoints

#### Reaproveitar
- `GET /pacientes`
- `GET /pacientes/:petId`
- `GET /receitas?pet_id=...`
- `GET /atendimentos?pet_id=...`
- `GET /parceiro/clinic-cases?pet_id=...`
- `GET /parceiro/clinic-cases/:id`

#### Criar
- `GET /vet/pacientes/:petId/timeline`

Resposta sugerida:

```json
{
  "pet": {},
  "summary": {
    "total_atendimentos": 12,
    "ultimo_atendimento": "<PRIVATE_DATE>",
    "retorno_pendente": true,
    "teleconsultas_total": 3,
    "exames_pendentes": 2
  },
  "cases": [
    {
      "clinic_case_id": 88,
      "status": "AGUARDANDO_RETORNO",
      "opened_at": "<PRIVATE_DATE>",
      "last_event_at": "<PRIVATE_DATE>",
      "latest_prescription_id": 991
    }
  ],
  "timeline": [
    {
      "type": "atendimento",
      "id": 123,
      "created_at": "<PRIVATE_DATE>",
      "label": "Consulta presencial"
    },
    {
      "type": "receita",
      "id": 991,
      "created_at": "<PRIVATE_DATE>",
      "label": "Receita emitida"
    }
  ]
}
```

### Modelo de dados

#### Reaproveitar fortemente
- `clinic_case`
- `clinical_event`

#### Integrar
- `clinic_case.pet_id`
- `atendimentos.pet_id`
- `receitas.atendimento_id`
- `consultas.cliente_id` e `consultas.veterinario_id`

#### Adicoes recomendadas em `clinical_event.payload`
- `atendimento_id`
- `receita_id`
- `consulta_id`
- `exam_ids`
- `retorno_previsto_em`

### Eventos minimos a usar

Ampliar o enum existente para suportar o que a timeline precisa.

Eventos atuais:
- `consultation_created`
- `anamnesis_recorded`
- `diagnosis_set`
- `prescription_issued`
- `exam_requested`
- `telemedicine_started`
- `telemedicine_finished`

Eventos a adicionar:
- `attendance_started`
- `attendance_finished`
- `return_scheduled`
- `attachment_uploaded`
- `status_changed`

### Sequencia de implementacao

1. Criar `GET /vet/pacientes/:petId/timeline`.
2. Integrar `clinic_case` e `clinical_event` com atendimento e receita.
3. Reescrever `/pacientes/:petId` como hub longitudinal.
4. Evoluir `/pacientes` para lista com filtros clinicos.

---

## Frente 3. Jornada unica agenda -> atendimento -> receita -> telemedicina

### Objetivo

Eliminar a navegacao solta entre agenda, gerar receita e telemedicina.

### Telas

#### Tela alvo: `agenda`

Estado alvo:
- cada agendamento veterinario oferece CTA unico:
  - iniciar atendimento
  - entrar em teleconsulta
  - abrir caso clinico existente

#### Tela alvo: `/gerar-receita`

Estado atual:
- mistura consulta, prontuario e receita, mas sem amarracao forte com agenda e teleconsulta

Estado alvo:
- tela de edicao do atendimento corrente
- receber `agendamento_id`, `consulta_id`, `clinic_case_id`, `pet_id`, `cliente_id`
- salvar atendimento e emitir receita no mesmo fluxo

### Endpoints

#### Reaproveitar
- `POST /atendimentos`
- `POST /receitas`
- `POST /parceiro/telemedicina/consultas`
- `GET /parceiro/telemedicina/agendamentos/:agendamentoId`
- `POST /parceiro/clinic-cases`
- `POST /parceiro/clinic-cases/:id/events`

#### Criar
- `POST /vet/encounters/start-from-agendamento`
- `POST /vet/encounters/:id/finish`
- `POST /vet/encounters/:id/prescription`

#### Contrato sugerido: start-from-agendamento

Entrada:

```json
{
  "agendamento_id": 501,
  "modo": "presencial"
}
```

Saida:

```json
{
  "clinic_case_id": 88,
  "atendimento_id": 123,
  "consulta_id": 901,
  "redirect": {
    "path": "/gerar-receita",
    "query": {
      "clinic_case_id": 88,
      "atendimento_id": 123,
      "agendamento_id": 501
    }
  }
}
```

### Modelo de dados

#### Regras novas

1. Todo atendimento iniciado a partir da agenda deve criar ou reusar `clinic_case`.
2. Todo atendimento telemedico deve apontar para `consulta_id`.
3. Toda receita emitida no fluxo deve apontar para `atendimento_id`.
4. Toda transicao relevante deve gerar `clinical_event`.

#### Vinculos minimos
- `atendimentos.agendamento_id -> agendamentos.id`
- `atendimentos.consulta_id -> consultas.id`
- `atendimentos.clinic_case_id -> clinic_case.id`
- `receitas.atendimento_id -> atendimentos.id`

#### Coluna nova recomendada em `atendimentos`
- `clinic_case_id INT NULL`

Essa e a chave que fecha o loop tecnico sem precisar reconstituir relacionamento por heuristica.

### Sequencia de implementacao

1. Adicionar `clinic_case_id` em `atendimentos`.
2. Criar endpoint de inicio de encontro clinico a partir do agendamento.
3. Fazer agenda navegar sempre para o encontro clinico, e nao para telas soltas.
4. Adaptar `gerar-receita` para trabalhar com `atendimento_id` e `clinic_case_id`.
5. Ao finalizar, publicar eventos no grafo clinico.

---

## Frente 4. Fila operacional do Vet

### Objetivo

Criar uma fila unica de trabalho para o vet, incluindo teleatendimento.

### Telas

#### Tela alvo: nova aba ou substituicao de `/panorama-atendimento`

Nome recomendado:
- `/fila-clinica`
ou
- manter `/panorama-atendimento` com funcao redefinida

Estado alvo:
- board/lista com agrupamento por status
  - aguardando
  - em atendimento
  - aguardando retorno
  - exames pendentes
  - teleconsultas em janela ativa

Cada card deve mostrar:
- pet
- tutor
- canal
- horario
- origem
- ultimo evento
- proxima acao sugerida

### Endpoints

#### Criar
- `GET /vet/work-queue`
- `PATCH /vet/work-queue/:atendimentoId/status`

Resposta sugerida:

```json
{
  "columns": {
    "AGUARDANDO": [],
    "EM_ATENDIMENTO": [],
    "AGUARDANDO_RETORNO": [],
    "EXAMES_PENDENTES": [],
    "TELEMEDICINA_ATIVA": []
  },
  "summary": {
    "total": 14,
    "telemedicina_ativa": 2,
    "retornos_vencidos": 3
  }
}
```

#### Fontes de agregacao
- `atendimentos.status`
- `consultas.status`
- `atendimento_exames.status`
- `clinic_case.status`
- `clinical_event`

### Modelo de dados

#### Nao criar tabela nova no primeiro ciclo

A fila pode ser query derivada sobre:
- `atendimentos`
- `consultas`
- `atendimento_exames`
- `clinic_case`

#### Regras de classificacao

- `TELEMEDICINA_ATIVA`: existe `consulta` com `status = EM_ANDAMENTO` e `telemedicina_habilitada = 1`
- `EXAMES_PENDENTES`: existe `atendimento_exames.status` fora do estado final
- `AGUARDANDO_RETORNO`: `atendimentos.retorno_previsto_em` vencido ou proximo
- `EM_ATENDIMENTO`: `atendimentos.status = EM_ATENDIMENTO`
- `AGUARDANDO`: `atendimentos.status = AGUARDANDO`

### Sequencia de implementacao

1. Criar `GET /vet/work-queue`.
2. Reescrever `/panorama-atendimento` como fila clinica real.
3. Adicionar transicoes de status simples.
4. Exibir teleconsultas no mesmo board.

---

## Ordem de entrega recomendada

### Fase 1. Costura de dados

Objetivo:
- fechar relacionamentos faltantes sem trocar a UX toda de uma vez

Entrega:
- `atendimentos.status`
- `atendimentos.canal`
- `atendimentos.agendamento_id`
- `atendimentos.consulta_id`
- `atendimentos.clinic_case_id`
- `atendimentos.retorno_previsto_em`
- eventos adicionais em `clinical_event`

### Fase 2. Dashboard e fila

Entrega:
- `GET /vet/dashboard`
- `GET /vet/work-queue`
- nova home `/area-vet`
- reuso de `/panorama-atendimento` como fila

### Fase 3. Timeline e jornada unica

Entrega:
- `GET /vet/pacientes/:petId/timeline`
- `POST /vet/encounters/start-from-agendamento`
- `gerar-receita` orientado por encontro clinico

### Fase 4. Teleatendimento integrado ao Vet

Entrega:
- cards de teleconsulta na home e na fila
- CTA unico de entrada
- evento `telemedicine_started` e `telemedicine_finished` refletidos na timeline

---

## Contratos de backend a criar ou ajustar

### Criar
- `GET /vet/dashboard`
- `GET /vet/work-queue`
- `GET /vet/pacientes/:petId/timeline`
- `POST /vet/encounters/start-from-agendamento`
- `POST /vet/encounters/:id/finish`
- `PATCH /vet/work-queue/:atendimentoId/status`

### Ajustar
- `POST /atendimentos`
  - aceitar `agendamento_id`, `consulta_id`, `clinic_case_id`, `status`, `canal`, `retorno_previsto_em`
- `GET /atendimentos`
  - permitir filtro por `status`, `consulta_id`, `clinic_case_id`, `from`, `to`
- `GET /pacientes/:petId`
  - opcionalmente incluir `clinic_cases` resumidos
- `POST /parceiro/telemedicina/consultas`
  - ao criar consulta, publicar ou vincular `clinic_case`

---

## Migrações recomendadas

### Migration A. Evolucao de `atendimentos`

Adicionar:
- `status`
- `canal`
- `agendamento_id`
- `consulta_id`
- `clinic_case_id`
- `retorno_previsto_em`
- `prioridade`

Indices:
- `(vet_id, status, created_at)`
- `(clinic_case_id, created_at)`
- `(consulta_id)`
- `(agendamento_id)`
- `(retorno_previsto_em)`

### Migration B. Evolucao de `clinical_event`

Adicionar novos `event_type`:
- `attendance_started`
- `attendance_finished`
- `return_scheduled`
- `attachment_uploaded`
- `status_changed`

### Migration C. Constraints de integracao

Adicionar FKs:
- `atendimentos.agendamento_id -> agendamentos.id`
- `atendimentos.consulta_id -> consultas.id`
- `atendimentos.clinic_case_id -> clinic_case.id`

---

## Decisoes explicitas de escopo

### Fica fora da Prioridade 1

- unidade/filial clinica
- convenios
- responsavel tecnico institucional
- financeiro da clinica
- pagina publica completa de clinica vet

Esses itens pertencem a Clinica Vet, nao ao fechamento do Vet.

### Entra na Prioridade 1

- home clinica do vet
- fila de trabalho
- timeline do paciente
- jornada unificada do encontro clinico
- teleatendimento acoplado ao fluxo vet

---

## Definicao de pronto tecnico

Prioridade 1 pode ser considerada pronta quando:

1. `/area-vet` deixar de ser guia de ativos e virar dashboard clinico.
2. Todo atendimento iniciado a partir de agenda ou telemedicina gerar ou reutilizar `clinic_case`.
3. Todo atendimento poder resultar em prontuario + receita com vinculo forte em `atendimento_id`.
4. `/pacientes/:petId` expor timeline clinica real.
5. O vet conseguir ver numa unica fila:
   - aguardando
   - em atendimento
   - retorno pendente
   - exame pendente
   - teleconsulta ativa
6. O teleatendimento entrar no fluxo Vet sem depender de navegacao lateral pelo modulo parceiro.
