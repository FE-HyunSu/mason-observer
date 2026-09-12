# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르려 하며,
버전은 태그 기반([릴리스 체크리스트](./README.md#릴리스-체크리스트-태그-기반-버전-관리) 참고)으로 관리한다.

## [0.1.4] - 2026-09-12

### Changed

- **Command 이름을 더 짧게 바꿨다**: `/mason-recap:inspect-last` → `/mason-recap:1`,
  `/mason-recap:inspect-session` → `/mason-recap:all` (`/mason-recap:status`는 그대로
  유지). 기존 이름이 타이핑하기엔 너무 길다는 피드백을 반영했다. 순수 숫자(`1`)로만
  이루어진 command 파일명이 실제로 유효한 slash command로 동작하는지는 문서로 확신할
  수 없어, 설치 후 실제 세션에서 직접 호출해 확인했다.

### Fixed

- **`npm test`/`npm run validate`가 Node v24.11.1에서 실패하던 문제를 고쳤다.**
  `node --test tests/`(바로 뒤에 디렉터리 경로를 붙이는 형태)가 이 환경에서는
  `--test` 플래그 자체가 인식되지 않은 것처럼 `Cannot find module '.../tests'`
  에러를 내며 완전히 실패했다 — 이전에 개발할 때 쓰던 Node 버전에서는 문제없이
  동작했던 것과 대조적이다. 임의의 디렉터리 하나만 비교해본 결과 같은 증상이
  재현되어 이 리포지토리 코드 문제가 아니라 Node 버전 차이임을 확인했다. 경로 인자
  없이 `node --test`만 실행하면(현재 디렉터리에서 재귀적으로 테스트 파일을 찾는
  기본 동작) 두 버전 모두에서 안정적으로 동작해, `package.json`과
  `tests/validate.js`를 이 형태로 변경했다.

## [0.1.3] - 2026-09-10

### Changed

- **프로젝트 이름을 `mason-observer`에서 `mason-recap`으로 변경했다** (컨셉에 더 맞는
  이름을 찾는 과정에서, 중간에 `mason-why`도 검토했으나 최종적으로 "실행 내용을
  요약·복기해준다"는 뜻이 더 명확한 `mason-recap`으로 결정). 플러그인 디렉터리
  (`plugins/mason-observer/` → `plugins/mason-recap/`), 마켓플레이스/플러그인 `name`,
  슬래시 커맨드 네임스페이스(`/mason-observer:*` → `/mason-recap:*`), 로컬 저장 디렉터리
  (`.mason-observer/` → `.mason-recap/`), 문서 전체를 일괄 변경했다.
- **GitHub 저장소 자체도 `mason-observer`에서 `mason-recap`으로 rename했다** — 저장소
  URL이 `github.com/fe-hyunsu/mason-recap`로 바뀌었다(GitHub이 옛 URL을 당분간
  리다이렉트한다). 이미 `mason-observer@mason-observer`로 설치돼 있던 경우, 옛 이름으로
  uninstall한 뒤 새 이름으로 다시 설치해야 한다.

## [0.1.2] - 2026-09-06

### Fixed

- **`plugin.json`이 자체 로드 실패를 유발하던 버그를 수정했다.** `"hooks": "./hooks/hooks.json"`을
  명시적으로 선언해뒀는데, 이 경로는 Claude Code가 기본적으로 자동 로드하는 표준 위치라서
  또 명시하면 중복으로 인식되어 플러그인 로드 자체가 실패했다
  (`Duplicate hooks file detected: ./hooks/hooks.json resolves to already-loaded file .../hooks/hooks.json`).
  실제 사용자가 v0.1.0 → v0.1.1로 업데이트를 시도하다가 이 에러로 완전히 막히는 것을
  터미널 로그로 확인하고 나서 발견했다. `plugin.json`에서 불필요한 `hooks` 필드를
  제거해 해결했다.
- 이 버그는 사실 v0.1.0/v0.1.1에서 `/reload-plugins`가 원인 불명으로 보고했던
  "1 error during load"의 실체였을 가능성이 높다(정확히 같은 증상). README/README_ko의
  §17, §18과 `docs/limitations.md`에 이 내용을 반영했다.
- `tests/validate.js`에 이 실수를 다시 잡아낼 수 있는 회귀 검사를 추가했다: `plugin.json`의
  `hooks` 필드가 자동 로드되는 기본 `hooks/hooks.json` 경로와 같은 파일을 가리키면
  검증에 실패한다.

## [0.1.1] - 2026-09-06

### Changed

- `/mason-recap:1`, `/mason-recap:all`의 출력 포맷을
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
- `mason-recap` Claude Code Plugin (`plugins/mason-recap/`)과 이를 배포하기 위한
  Plugin Marketplace 구조(`.claude-plugin/marketplace.json`).
- 10개 공식 Hook 이벤트(`SessionStart`, `UserPromptSubmit`, `InstructionsLoaded`,
  `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`,
  `Stop`, `SessionEnd`)를 프로젝트 로컬 `.mason-recap/events/*.jsonl`로 수집하는 Hook
  수집기(`scripts/capture-event.js`).
- 정규식/키 이름 기반 민감정보 마스킹(`scripts/redact.js`): API Key, Access/Bearer
  Token, Authorization/Cookie 헤더, 비밀번호, `.env` 관련 경로, PEM/Private Key,
  AWS/GitHub/Anthropic/OpenAI 토큰 패턴 등.
- 로그 조회 CLI(`scripts/read-events.js`)와 로그 회전(`scripts/rotate-logs.js`).
- `/mason-recap:1`, `/mason-recap:all`, `/mason-recap:status`
  Slash Command.
- `decision-analysis` Skill: observed/inferred/unknown 구분과 Skill/Rule 적용 여부
  4단계 증거 등급(confirmed/strongly-inferred/weakly-inferred/not-observed)을 정의.
- Node.js 내장 테스트 러너 기반 테스트(`tests/*.test.js`)와 매니페스트/스크립트
  검증 스크립트(`tests/validate.js`, `npm run validate`).
- 문서: `docs/architecture.md`, `docs/event-schema.md`, `docs/privacy.md`,
  `docs/limitations.md`, `examples/sample-report.md`.

### Known limitations

- 2026-09-06에 실제 Claude Code(v2.1.178, VS Code 확장)에 설치해 end-to-end 검증을
  완료했다(Hook 발화, 이벤트 기록, 마스킹, `sessionId`/`promptId` 상관관계, `/mason-recap:status`
  실행까지 확인). 다만 `/reload-plugins`가 보고한 "1 error during load"의 정확한 원인은
  아직 확인하지 못했다. 또한 이 실측 과정에서 `promptId`의 최소 지원 버전에 대한 공식
  문서 기재(v2.1.196 이상)가 실제와 다르다는 것을 발견해 문서를 정정했다. 자세한 내용은
  `docs/limitations.md` 참고.
