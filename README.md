# mason-observer

**mason-observer** is an open-source Claude Code plugin that observes Claude Code's
execution through official Hooks and reconstructs how a request was handled —
using only observable evidence (prompts, tool calls, file paths, subagent
activity, the final answer). It never extracts Claude's private
chain-of-thought, makes no network calls, and stores everything locally under
your project's `.mason-observer/` directory. Full documentation below is in
Korean; see [docs/](./docs) for architecture, event schema, privacy, and
limitations.

---

## 1. 프로젝트 소개

`mason-observer`는 Claude Code의 실행 과정을 **공식 Hook**을 통해 관찰하고, 그 관찰
증거만으로 "Claude가 이번 요청을 어떻게 처리했는지"를 재구성하는 오픈소스 Claude Code
Plugin이다. 별도 서버나 외부 LLM 호출 없이, 이미 설치된 Claude Code 자신이 로그를 읽고
분석 리포트를 작성한다.

## 2. 해결하려는 문제

Claude Code는 하나의 요청을 처리하면서 여러 Tool을 호출하고, 파일을 읽거나 수정하고,
때로는 Subagent를 실행한다. 이 과정은 대화창에서 지나가듯 스쳐 사라지고, "왜 이런
선택을 했는지", "실제로 어떤 파일들을 건드렸는지", "어떤 지침이 적용됐는지"를 나중에
정확히 재구성하기 어렵다. `mason-observer`는 이 실행 과정의 **관찰 가능한 부분**을 로컬에
기록하고, 나중에 그 기록만으로 사실과 추정을 구분해 설명해주는 도구다.

## 3. 확인할 수 있는 정보

- 사용자가 입력한 프롬프트(마스킹·길이 제한 적용)
- 세션/프롬프트 식별자
- 로드된 `CLAUDE.md` 등 지침 파일의 **경로**
- 호출된 Tool 이름과 최소한의 입력 요약(예: Bash 명령, 파일 경로)
- Tool 실행 결과의 안전한 요약(성공/실패, 마스킹·길이 제한된 텍스트 또는 구조 요약)
- 읽거나 수정한 파일 **경로**
- 실행된 Bash 명령(마스킹 적용)
- Subagent 실행 흔적(유형, 식별자)
- Claude의 최종 답변(마스킹·길이 제한 적용)
- 위 사실들을 바탕으로 재구성한, "observed/inferred/unknown"으로 구분된 판단 근거

## 4. 확인할 수 없는 정보

- Claude의 비공개 chain-of-thought, 모델 내부 후보 비교 과정
- 로그에 기록되지 않은 판단 이유(추정은 가능하나 확정할 수 없음)
- 파일의 전체 내용, 원본 diff, Tool 결과 원문 전체(정책상 저장하지 않음)
- Skill 파일이 컨텍스트에 로드된 것과 실제로 그 Skill의 절차가 적용됐는지의 완전한 구분
  (증거 등급으로만 추정 가능)

자세한 한계는 [docs/limitations.md](./docs/limitations.md) 참고.

## 5. Claude의 비공개 chain-of-thought를 제공하지 않는다는 점

**mason-observer는 Claude의 비공개 내부 추론을 추출하거나 우회 노출하는 도구가 아니다.**
모든 분석은 Hook과 transcript에서 공식적으로 노출되는 관찰 가능한 사실에만 근거하며,
리포트는 "Claude가 이렇게 생각했다"라고 단정하지 않고 "관찰된 행동을 보면 이렇게 판단한
것으로 추정된다"는 식으로만 서술하도록 설계되어 있다(`skills/decision-analysis/SKILL.md`
참고).

## 6. 동작 구조

```text
User Prompt
  → UserPromptSubmit Hook
  → Claude Agent Loop
  → Tool/Subagent Hooks
  → Stop Hook
  → Local JSONL (.mason-observer/events/)
  → inspect Command
  → decision-analysis Skill
  → Mason Observer Report
```

자세한 내용은 [docs/architecture.md](./docs/architecture.md) 참고.

## 7. 수집되는 Hook 이벤트

공식 문서(`code.claude.com/docs/en/hooks.md`)에서 현재 지원을 확인한 아래 10개 이벤트만
사용한다:

`SessionStart`, `UserPromptSubmit`, `InstructionsLoaded`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, `SessionEnd`

이벤트별로 저장되는 정확한 필드는 [docs/event-schema.md](./docs/event-schema.md)에
정의되어 있다. **Hook은 어떤 경우에도 Tool 호출을 차단하거나, Claude/Tool의 입력을
수정하거나, stdout으로 무언가를 출력하지 않는다** — 순수 관찰자로만 동작한다.

## 8. 설치 방법

### 8.1. 요구 사항

- Claude Code (Plugin/Marketplace/Hooks 기능을 지원하는 버전 — [§17](#17-지원-claude-code-버전) 참고)
- Node.js 18 이상 (Hook/조회 스크립트가 Node.js로 작성되어 있으며, 별도 설치 없이
  실행됨)
- macOS, Linux, 또는 Windows

### 8.2. 로컬에서 바로 테스트하기 (마켓플레이스 등록 없이)

저장소를 clone한 뒤, Claude Code에서 로컬 경로를 마켓플레이스로 추가할 수 있다:

```text
/plugin marketplace add /path/to/mason-observer
/plugin install mason-observer@mason-observer
```

## 9. GitHub Marketplace 등록 방법

1. 이 저장소를 GitHub에 공개 저장소로 push한다(`.claude-plugin/marketplace.json`이
   저장소 루트에 있어야 한다).
2. `.claude-plugin/marketplace.json`의 `name`, `owner.name`, 각 플러그인 항목의
   `author`, `homepage`, `repository` 등에 있는 `fe-hyunsu`,
   `mason-observer` placeholder를 실제 값으로 교체한다.
3. 태그를 눌러 버전을 명시적으로 관리한다([§ 릴리스 체크리스트](#릴리스-체크리스트-태그-기반-버전-관리) 참고).

## 10. 플러그인 설치 방법

마켓플레이스가 GitHub에 등록된 이후에는 다른 사용자가 아래처럼 설치한다:

```text
/plugin marketplace add fe-hyunsu/mason-observer
/plugin install mason-observer@mason-observer
```

설치 후 `/mason-observer:status`로 정상 동작 여부를 확인한다.

## 11. `/mason-observer:inspect-last` 사용 방법

가장 최근에 완료된 사용자 턴을 관찰 증거만으로 재구성한 리포트를 생성한다.

```text
/mason-observer:inspect-last
```

출력 형식과 예시는 [examples/sample-report.md](./examples/sample-report.md) 참고.

## 12. `/mason-observer:inspect-session` 사용 방법

현재 세션 전체(턴 목록, Tool 사용 패턴, 실패, 로드된 지침, Skill 적용 추정 등)를 요약한다.

```text
/mason-observer:inspect-session
```

## 13. `/mason-observer:status` 사용 방법

로그 수집 상태(위치, 최근 이벤트, 세션 수, 마스킹 적용 여부, 로그 크기, 지원 Hook 목록,
진단 경고)를 표시한다.

```text
/mason-observer:status
```

## 14. 로그 저장 위치

```text
<project-root>/.mason-observer/
├── events/    # Hook 이벤트 JSONL
├── reports/   # (예약됨 — 향후 리포트 저장용)
├── state/     # 내부 상태(예: .gitignore 보강 여부 마커)
└── config.json  # (예약됨 — 향후 설정용)
```

플러그인 설치 디렉터리나 플러그인 캐시에는 어떤 로그도 저장하지 않는다. 프로젝트
루트를 안전하게 확인할 수 없는 경우(`CLAUDE_PROJECT_DIR`도 없고 Hook의 `cwd`도 유효한
디렉터리가 아닌 경우) 아무 곳에도 기록하지 않는다.

## 15. 로그 삭제 방법

```bash
rm -rf .mason-observer/
```

위 명령은 사용자가 자신의 프로젝트에서 직접 실행하는 일반적인 파일 삭제이며,
`mason-observer`는 자체적으로 원격 삭제나 별도 삭제 API를 제공하지 않는다.

## 16. 개인정보 및 보안 정책

- 기본적으로 **네트워크를 사용하지 않는다.**
- 파일 내용은 저장하지 않고 경로와 작업 유형만 저장한다(`.env` 포함).
- API Key, Access/Bearer Token, Authorization/Cookie 헤더, 비밀번호, PEM/Private Key,
  AWS/GitHub/Anthropic/OpenAI 토큰 등은 저장 전에 마스킹된다.
- Tool 결과는 원문 전체가 아닌 안전한 요약만, 크기 제한을 두어 저장한다.
- 로그 크기와 보관 개수를 제한한다(파일당 약 5MB, 프로젝트당 파일 개수 제한).
- `.mason-observer/`가 프로젝트 외부를 가리키는 심볼릭 링크이면 쓰기를 거부한다.
- `.gitignore`에 `.mason-observer/`가 없으면 기존 내용을 보존한 채로만 안전하게 추가한다.
- Hook 실패나 분석 실패가 Claude Code의 정상 작업을 절대 막지 않는다.

자세한 내용은 [docs/privacy.md](./docs/privacy.md) 참고.

## 17. 지원 Claude Code 버전

이 플러그인은 공식 문서(`code.claude.com/docs/en/`)에서 현재 확인 가능한 Plugin /
Marketplace / Hooks / Skill 규격을 기준으로 작성했다. 개발 환경에는 실제로 동작하는
Claude Code CLI 바이너리가 설치되어 있지 않아(npm wrapper 패키지만 존재, 네이티브
바이너리는 미설치 상태), **실제 Claude Code 프로세스를 통한 end-to-end 검증은 하지
못했다.** 아래 버전 의존성은 문서 기반으로 확인한 것이다:

- Plugin/Marketplace/Hooks/Skill 기본 구조: 문서상 안정적으로 지원됨.
- `prompt_id`(턴 연결에 사용) — **Claude Code v2.1.196 이상 필요.** 그보다 낮은
  버전에서는 시간 구간 기반의 약한 추정으로 대체된다.
- `UserPromptSubmit`의 프롬프트 텍스트 필드명은 문서 원문을 완전히 재확인하지 못해
  방어적으로 여러 후보 필드명을 시도하도록 구현했다(자세한 내용은
  [docs/event-schema.md](./docs/event-schema.md)).

설치 후 `/mason-observer:status`를 실행해 실제 환경에서 이벤트가 정상적으로 수집되는지
직접 확인할 것을 권장한다.

## 18. 알려진 한계

[docs/limitations.md](./docs/limitations.md)에 전체 목록이 있다. 핵심 요약:

- chain-of-thought/모델 내부 후보 비교 과정은 원천적으로 접근 불가.
- 파일 접근/지침 로드가 "실제 적용"을 의미하지는 않음.
- Observer(리포트 생성 과정)도 Claude의 해석이므로 오류 가능.
- 마스킹은 알려진 패턴 기반이라 완전하지 않음.
- 실제 Claude Code 프로세스를 통한 end-to-end 검증 미실시(위 §17 참고).

## 19. 개발 및 테스트 방법

```bash
git clone https://github.com/fe-hyunsu/mason-observer.git
cd mason-observer

npm test        # Node.js 내장 테스트 러너로 단위/통합 테스트 실행
npm run validate # 매니페스트/hooks.json/Command·Skill frontmatter/스크립트 문법 검사 + 테스트 실행
```

외부 의존성 없이 Node.js 표준 라이브러리와 `node:test`만 사용한다.

## 20. 기여 방법

1. 이슈를 먼저 열어 논의한다(특히 Hook 이벤트 추가나 마스킹 규칙 변경처럼 개인정보에
   영향을 주는 변경).
2. 이 저장소를 fork하고 브랜치를 만든다.
3. `npm run validate`가 통과하는지 확인한 뒤 PR을 연다.
4. 마스킹 규칙을 추가/변경하는 PR은 반드시 대응하는 테스트(`tests/redact.test.js`)를
   포함해야 한다.
5. 보안 취약점은 공개 이슈 대신 저장소 owner에게 비공개로 먼저 알려줄 것을 권장한다
   (연락 방법은 `fe-hyunsu`의 GitHub 프로필 참고— 저장소 공개 시 구체적인
   보안 연락처를 이 절에 채워 넣을 것).

### 릴리스 체크리스트 (태그 기반 버전 관리)

- [ ] `npm test`, `npm run validate` 통과
- [ ] `CHANGELOG.md`에 변경 사항 기록
- [ ] `.claude-plugin/marketplace.json`과 `plugins/mason-observer/.claude-plugin/plugin.json`의
      `version` 필드를 함께 올림
- [ ] `git tag vX.Y.Z` 후 push (Marketplace의 `github` source 타입은 `ref`로 특정
      태그/브랜치를 고정할 수 있음)

## 21. 라이선스

[MIT License](./LICENSE)
