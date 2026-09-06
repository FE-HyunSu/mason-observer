# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르려 하며,
버전은 태그 기반([릴리스 체크리스트](./README.md#릴리스-체크리스트-태그-기반-버전-관리) 참고)으로 관리한다.

## [0.1.0] - Unreleased

### Added

- 첫 MVP 릴리스.
- `mason-observer` Claude Code Plugin (`plugins/mason-observer/`)과 이를 배포하기 위한
  Plugin Marketplace 구조(`.claude-plugin/marketplace.json`).
- 10개 공식 Hook 이벤트(`SessionStart`, `UserPromptSubmit`, `InstructionsLoaded`,
  `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`,
  `Stop`, `SessionEnd`)를 프로젝트 로컬 `.mason-observer/events/*.jsonl`로 수집하는 Hook
  수집기(`scripts/capture-event.js`).
- 정규식/키 이름 기반 민감정보 마스킹(`scripts/redact.js`): API Key, Access/Bearer
  Token, Authorization/Cookie 헤더, 비밀번호, `.env` 관련 경로, PEM/Private Key,
  AWS/GitHub/Anthropic/OpenAI 토큰 패턴 등.
- 로그 조회 CLI(`scripts/read-events.js`)와 로그 회전(`scripts/rotate-logs.js`).
- `/mason-observer:inspect-last`, `/mason-observer:inspect-session`, `/mason-observer:status`
  Slash Command.
- `decision-analysis` Skill: observed/inferred/unknown 구분과 Skill/Rule 적용 여부
  4단계 증거 등급(confirmed/strongly-inferred/weakly-inferred/not-observed)을 정의.
- Node.js 내장 테스트 러너 기반 테스트(`tests/*.test.js`)와 매니페스트/스크립트
  검증 스크립트(`tests/validate.js`, `npm run validate`).
- 문서: `docs/architecture.md`, `docs/event-schema.md`, `docs/privacy.md`,
  `docs/limitations.md`, `examples/sample-report.md`.

### Known limitations

- 실제 Claude Code CLI 프로세스를 통한 end-to-end 검증은 수행하지 못했다(개발 환경에
  동작하는 CLI 바이너리가 설치되어 있지 않았음). 스크립트 단위 테스트와 수동 스크립트
  실행으로만 검증됨. 자세한 내용은 `docs/limitations.md` 참고.
