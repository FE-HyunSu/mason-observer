# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르려 하며,
버전은 태그 기반([릴리스 체크리스트](./README.md#릴리스-체크리스트-태그-기반-버전-관리) 참고)으로 관리한다.

## [0.1.1] - 2026-09-06

### Changed

- `/mason-observer:inspect-last`, `/mason-observer:inspect-session`의 출력 포맷을
  고정된 8개 h2 섹션 방식에서, "사용자 프롬프트 한 줄 인용 → 그 턴에 대한 설명 → 다음
  프롬프트" 순서로 이어지는 내러티브 스타일로 변경했다(가독성 개선 피드백 반영).
  `observed`/`inferred`/`unknown` 태그와 Skill/Rule 적용 등급 구분은 그대로 유지된다.
- `examples/sample-report.md`를 새 포맷에 맞춰 갱신했다.

### Considered and rejected

- 리포트에 이번 요청의 토큰 사용량을 표시하는 기능을 검토했으나, Hook 이벤트 JSON에는
  토큰 필드가 전혀 없고, Claude Code의 공식 토큰/비용 데이터(`statusline`)는 세션
  누적치이거나 "가장 최근 API 호출 1건"의 스냅샷이라 "이번 턴에 정확히 사용된 토큰"을
  나타낼 수 없어 구현하지 않기로 했다. 또한 현재 우선순위(리포트 가독성)와도 무관해
  범위에서 제외했다.

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

- 2026-09-06에 실제 Claude Code(v2.1.178, VS Code 확장)에 설치해 end-to-end 검증을
  완료했다(Hook 발화, 이벤트 기록, 마스킹, `sessionId`/`promptId` 상관관계, `/mason-observer:status`
  실행까지 확인). 다만 `/reload-plugins`가 보고한 "1 error during load"의 정확한 원인은
  아직 확인하지 못했다. 또한 이 실측 과정에서 `promptId`의 최소 지원 버전에 대한 공식
  문서 기재(v2.1.196 이상)가 실제와 다르다는 것을 발견해 문서를 정정했다. 자세한 내용은
  `docs/limitations.md` 참고.
