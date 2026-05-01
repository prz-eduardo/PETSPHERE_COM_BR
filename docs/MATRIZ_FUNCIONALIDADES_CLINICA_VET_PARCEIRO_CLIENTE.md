# Matriz de Funcionalidades por Area

Data: 2026-05-01

Objetivo:
- consolidar o que existe hoje por area
- explicitar o gap entre Clinica Vet e Vet
- priorizar a finalizacao do Vet
- detalhar o gap de descoberta de teleatendimento no ecossistema PetSphere

## Leitura executiva

Hoje o projeto tem duas realidades diferentes:

1. Vet ja existe como fluxo funcional.
   - ha rotas, telas, guards e backend real para receitas, pacientes, atendimentos e parte do prontuario
   - ha aprovacao de veterinario, historico de receitas, busca de tutor por CPF e telemedicina acoplada a agenda/parceiro

2. Clinica Vet ainda nao existe como modulo de gestao implementado.
   - existe como segmento comercial, categoria da vitrine e rota no shell parceiro
   - a rota de gestao da clinica ainda aponta para um componente generico de "em breve"
   - nao existem telas nem dominio proprio para unidade, filiais, convenios, alvaras, responsavel tecnico e operacao administrativa da clinica

Conclusao pratica:
- o caminho mais eficiente nao e "construir Clinica Vet do zero"
- o caminho mais eficiente e terminar o modulo Vet, desacoplar o que hoje esta espalhado e depois encapsular Clinica Vet como composicao de agenda + vet + configuracao clinica + financeiro

---

## Matriz por area

Legenda:
- Implementado: existe tela e/ou endpoint funcional em uso direto
- Parcial: existe parte da experiencia, mas com lacunas relevantes
- Nao implementado: ausente ou placeholder

| Capacidade | Clinica | Vet | Parceiro | Cliente |
|---|---|---|---|---|
| Autenticacao e sessao | Parcial | Implementado | Implementado | Implementado |
| Home/landing propria da area | Nao implementado | Parcial | Implementado | Implementado |
| Cadastro/gestao de perfil | Nao implementado | Parcial | Implementado | Implementado |
| Gestao de unidade/empresa | Nao implementado | Nao aplicavel | Implementado | Nao aplicavel |
| Equipe/colaboradores | Nao implementado | Parcial | Implementado | Nao aplicavel |
| Agenda/agenda operacional | Parcial | Parcial | Implementado | Parcial |
| Prontuario clinico | Nao implementado | Parcial forte | Nao implementado como modulo proprio | Nao implementado |
| Receitas veterinarias | Nao implementado | Implementado | Parcial via area-vet no shell | Nao implementado |
| Pacientes/carteira clinica | Nao implementado | Implementado | Parcial via area-vet no shell | Parcial via pets do tutor |
| Atendimento/panorama de caso | Nao implementado | Parcial | Parcial | Nao implementado |
| Telemedicina/teleatendimento | Nao implementado | Parcial | Implementado operacionalmente | Implementado para entrar em consulta |
| Descoberta de vets/teleatendimento | Parcial comercial | Parcial | Parcial | Parcial |
| Chat/mensageria | Nao implementado | Nao implementado como area propria | Implementado | Implementado |
| Consentimento LGPD de dados | Nao implementado | Parcial via parceiro shell | Implementado | Implementado |
| Financeiro/repasse | Nao implementado | Nao implementado | Parcial | Nao aplicavel |
| Loja/vitrine/comercial | Nao implementado | Nao aplicavel | Implementado | Implementado |
| Mapa/visibilidade | Parcial comercial | Parcial | Implementado | Implementado |
| Admin e auditoria | Nao implementado | Implementado no backoffice | Implementado no backoffice | Implementado no backoffice |

---

## Evidencia por area

### 1. Clinica

Status geral: comercialmente modelada, operacionalmente ausente.

Existe hoje:
- tipo de parceiro "Clinica Veterinaria" em schema e seeds
- categoria comercial `clinica-vet` na vitrine demo
- rota `/parceiros/gestao-clinica` no shell parceiro
- descricoes comerciais de cadastro da unidade, responsavel tecnico, convenios, documentacao, integracao com agenda e prontuario

Nao existe hoje:
- modulo clinico real em frontend
- controller ou rotas backend especificas de gestao clinica
- cadastro de unidade/filiais
- cadastro de responsavel tecnico
- gestao de alvaras, convenios, tabelas de preco
- prontuario clinico da clinica como agregado institucional
- financeiro proprio da clinica

Estado atual da rota:
- a rota carrega `ParceiroModuloEmBreveComponent`

### 2. Vet

Status geral: modulo mais avancado do eixo clinico.

Existe hoje:
- area vet com rotas dedicadas e guard
- gerar receita
- historico de receitas
- detalhe de receita
- pacientes
- detalhe do paciente
- panorama de atendimento
- endpoints backend de receitas, pacientes e atendimentos protegidos por vet aprovado
- aprovacao de vet no admin com trilha de auditoria
- busca de tutor por CPF no fluxo de gerar receita
- prontuario dentro do fluxo de consulta/receita

Lacunas atuais:
- landing `/area-vet` ainda e centrada em guia de ativos, nao em operacao clinica
- telemedicina nao aparece como modulo vet dedicado; ela esta acoplada a agenda/parceiro
- panorama de atendimento ainda tem carater de apoio operacional e checklist local, nao de prontuario longitudinal consolidado
- nao ha timeline clinica unica por paciente agregando atendimentos, exames, receitas e teleconsultas
- nao ha inbox clinica/vet nativo para triagem de teleatendimento

### 3. Parceiro

Status geral: area mais completa em breadth, com forte cobertura operacional e comercial.

Existe hoje:
- autenticacao de parceiro e shell autenticado
- painel do parceiro
- agenda
- colaboradores
- servicos
- meus clientes
- mensagens/chat
- hospedagem/reservas hotel
- transporte pet
- configuracoes/minha loja
- petshop online
- cadastro de produto
- inventario/POS
- caixa
- creditos e saldo
- vitrine/loja publica
- telemedicina pelo contexto da agenda
- area-vet embutida no shell parceiro via `parceiroVetGuard`

Lacunas relevantes:
- gestao-clinica e financeiro-parceiro ainda estao em placeholder
- nao existe lente institucional "clinica" acima dos modulos ja existentes
- faltam modelos de capacidade real por servico para descoberta publica, especialmente telemedicina

### 4. Cliente

Status geral: area madura para relacionamento, consumo e acesso a servicos.

Existe hoje:
- area do cliente
- meus pedidos
- meus pets
- novo pet
- perfil
- enderecos
- cartoes
- telemedicina do cliente
- suporte/chat
- galeria/minha galeria
- consentimento LGPD com parceiros
- transporte pet
- acesso a mapa e descoberta

Lacunas relevantes:
- telemedicina no cliente depende de consulta previamente criada; descoberta do atendimento online ainda nao e clara
- nao ha jornada explicita "encontrar vet online agora" com elegibilidade, janela e entrada unica
- historico clinico do cliente continua fragmentado entre pedidos, pets, consultas e atendimento

---

## Gap exato para transformar Clinica Vet de "em breve" em modulo real implementado

Para sair de placeholder e virar modulo real, Clinica Vet precisa de quatro camadas que hoje nao existem como produto unificado.

### Camada 1. Identidade institucional da clinica

Falta implementar:
- entidade de clinica/unidade no dominio de parceiro
- cadastro de unidade principal e filiais
- responsavel tecnico vinculado a vet
- documentos da unidade: alvara, licencas, CRMV da unidade quando aplicavel
- convenios e tabelas de preco
- horarios, especialidades e recursos clinicos da unidade

Dependencias:
- modelagem backend propria
- telas de configuracao especificas de clinica
- permissao por colaborador e por unidade

### Camada 2. Operacao clinica unificada

Falta implementar:
- dashboard clinico da unidade
- fila de atendimentos do dia
- prontuario longitudinal por paciente
- vinculo entre agendamento, atendimento, consulta, receita, exames e teleconsulta
- status clinico padronizado do caso

Dependencias:
- consolidar `atendimentos`, `receitas`, `pacientes` e `consultas` sob uma visao unica
- timeline de caso/paciente
- consultas agregadas por clinica e nao apenas por vet/agenda

### Camada 3. Descoberta publica e conversao

Falta implementar:
- perfil publico de clinica vet coerente no mapa e vitrine
- flags publicas de capacidades reais: aceita telemedicina, atende agora, especialidades, especies, urgencia, retorno, domicilio
- pagina de descoberta para teleatendimento
- filtro real de telemedicina no mapa

Dependencias:
- enriquecer dados do mapa
- indexar capacidade de servico e disponibilidade
- conectar descoberta publica com agenda/consulta/telemedicina

### Camada 4. Gestao administrativa e financeira da clinica

Falta implementar:
- faturamento por atendimento e por teleconsulta
- convenio e repasse
- extrato e conciliacao
- relatorios clinicos e operacionais por unidade/vet

Dependencias:
- rotas e telas hoje placeholder
- metricas por unidade
- modelo de repasse/receita da clinica

---

## Foco recomendado: finalizar Vet antes de abrir Clinica Vet completa

Essa priorizacao e a mais segura porque o modulo Vet ja tem base funcional. O ganho vem de fechar o ciclo clinico e tornar Clinica Vet uma composicao desse nucleo.

### O que significa "finalizar Vet"

#### Vet-1. Trocar a landing da area vet

Problema atual:
- `/area-vet` abre um guia de ativos, nao um hub clinico

Objetivo:
- transformar a home vet em cockpit clinico com acesso claro a:
  - atendimentos de hoje
  - nova consulta/receita
  - pacientes recentes
  - teleatendimento em andamento/proximos
  - pendencias clinicas

Gap tecnico:
- frontend existe, mas a tela raiz precisa deixar de ser "guia de ativos"
- manter o guia como ferramenta secundaria, nao como home principal

#### Vet-2. Consolidar prontuario real

Problema atual:
- o prontuario existe dentro de gerar receita e partes do atendimento, mas nao como timeline consolidada

Objetivo:
- unificar por paciente:
  - anamnese
  - exame fisico
  - diagnostico
  - plano terapeutico
  - receitas emitidas
  - exames/anexos
  - retornos
  - teleconsultas

Gap tecnico:
- pagina de paciente precisa virar hub longitudinal
- endpoints precisam expor agregados por `pet_id` e por `vet_id`

#### Vet-3. Fechar o loop agenda -> atendimento -> consulta -> receita -> telemedicina

Problema atual:
- esses fluxos coexistem, mas ainda nao se apresentam como jornada unica do vet

Objetivo:
- a partir de um agendamento, o vet deve conseguir:
  - abrir atendimento
  - registrar prontuario
  - gerar receita
  - marcar retorno
  - iniciar teleconsulta quando aplicavel

Gap tecnico:
- falta navegacao cruzada e estado compartilhado
- falta timeline do caso

#### Vet-4. Inbox operacional do vet

Problema atual:
- nao ha uma fila unica de trabalho clinico

Objetivo:
- fila de:
  - pacientes aguardando
  - retornos sugeridos
  - exames pendentes
  - consultas com janela de telemedicina aberta

Gap tecnico:
- hoje o vet precisa navegar entre telas isoladas

---

## Foco recomendado: descoberta de teleatendimento pelo sistema PetSphere

Este e o maior gap de produto entre o que o sistema promete e o que de fato descobre/publica.

### O que existe hoje

No frontend:
- atalhos para `Telemedicina`, `Buscar vet` e `Agendar` no dock e na navegacao
- mapa le `?service=telemedicina`
- parceiro pode iniciar/entrar em telemedicina via agenda
- cliente pode ver e entrar em consultas de telemedicina ja criadas

No backend:
- parceiro tem endpoints de telemedicina
- cliente tem endpoints para listar/entrar nas suas consultas
- ha estrutura de `consultas` e `video_chamadas`

### O problema central

Hoje o sistema permite executar teleatendimento, mas nao descobrir teleatendimento de forma confiavel.

Em outras palavras:
- existe motor de telemedicina
- nao existe descoberta publica baseada em capacidade real

### Onde o gap aparece tecnicamente

#### Gap T-1. Mapa nao filtra por capacidade real de telemedicina

Situacao atual:
- o mapa recebe parceiros e tipos
- o backend de mapa filtra por `parceiro_tipos`
- nao ha filtro backend por `telemedicina_habilitada`, disponibilidade, janela ou capacidade do parceiro/vet

Impacto:
- `?service=telemedicina` muda a experiencia, mas nao garante uma lista de clinicas/vets realmente aptos para teleatendimento naquele momento

#### Gap T-2. Nao existe indice publico de oferta de teleatendimento

Falta modelar e publicar:
- parceiro atende telemedicina: sim/nao
- vet atende telemedicina: sim/nao
- especies atendidas
- especialidades
- horario online
- atende agora
- primeira consulta ou retorno
- valor/base de cobranca

#### Gap T-3. Nao existe jornada publica "encontre um vet online agora"

Hoje:
- ha atalhos para mapa e telemedicina

Nao ha:
- lista/resultado de teleatendimento online disponivel agora
- ordenacao por disponibilidade, distancia, especialidade, preco ou elegibilidade
- CTA unico para solicitar teleconsulta

#### Gap T-4. Cliente entra em consulta ja criada, mas nao a origina a partir da descoberta

Hoje:
- cliente lista suas consultas e entra nelas

Nao ha claramente:
- descoberta publica -> selecao de vet/clinica -> criacao assistida da consulta -> entrada do cliente

#### Gap T-5. Vet nao tem fila propria de teleatendimento

Hoje:
- telemedicina mora na agenda/parceiro

Nao ha:
- painel vet de consultas online
- fila de chamadas ativas/proximas/pedidos pendentes

---

## Backlog priorizado

### Prioridade 1. Fechar Vet como modulo clinico central

Documento tecnico detalhado:
- ver `docs/PLANO_TECNICO_PRIORIDADE_1_VET.md`

1. Substituir a home `/area-vet` por dashboard clinico.
2. Consolidar prontuario longitudinal por paciente.
3. Integrar agenda, atendimento, receita e teleconsulta numa jornada unica.
4. Criar fila operacional do vet.

Resultado esperado:
- o modulo Vet passa a ser o nucleo real da Clinica Vet.

### Prioridade 2. Tornar teleatendimento descobrivel de verdade

1. Adicionar capacidade publica de telemedicina no modelo de parceiro/vet.
2. Expor isso no backend do mapa e na busca publica.
3. Criar filtro real `telemedicina disponivel` e `atende agora`.
4. Criar jornada publica de descoberta -> agendamento/consulta -> entrada.
5. Criar fila vet/parceiro para teleconsultas.

Resultado esperado:
- o sistema deixa de apenas executar telemedicina e passa a gerar demanda descoberta dentro do proprio ecossistema PetSphere.

### Prioridade 3. Encapsular Clinica Vet

1. Criar modulo de gestao da clinica.
2. Adicionar unidade, filiais, convenios e responsavel tecnico.
3. Integrar financeiro e relatorios.
4. Publicar perfil institucional de clinica com capacidades reais.

Resultado esperado:
- Clinica Vet deixa de ser um placeholder comercial e vira produto.

---

## Definicao objetiva de pronto

### Vet finalizado

Considerar Vet finalizado quando:
- a home vet for um cockpit clinico, nao um guia de ativos
- cada paciente tiver timeline clinica unica
- agendamento, atendimento, receita e teleconsulta estiverem conectados
- houver fila de trabalho do vet
- teleconsulta puder ser iniciada e acompanhada pelo vet a partir do proprio modulo clinico

### Descoberta de teleatendimento finalizada

Considerar descoberta de teleatendimento finalizada quando:
- o mapa e a busca publicarem apenas oferta elegivel para teleatendimento
- houver filtro real por capacidade e disponibilidade
- o cliente puder descobrir, escolher e entrar no fluxo de teleconsulta sem depender de consulta previamente invisivel
- o parceiro/vet puder administrar a fila dessas teleconsultas

### Clinica Vet implementada de verdade

Considerar Clinica Vet implementada quando:
- `/parceiros/gestao-clinica` deixar de ser placeholder
- existir modelo e telas de unidade/filial/responsavel tecnico/convenios
- existir visao operacional consolidada da clinica
- existir perfil publico e descoberta coerente de servicos da clinica
