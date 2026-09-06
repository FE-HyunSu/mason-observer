# mason-observer (한국어)

English version: [README.md](./README.md)

`mason-observer`는 Claude Code의 실행 과정을 **공식 Hook**을 통해 관찰하고, 그 관찰
증거만으로 "Claude가 이번 요청을 어떻게 처리했는지"를 재구성하는 오픈소스 Claude Code
Plugin입니다. 별도 서버나 외부 LLM 호출 없이, 이미 설치된 Claude Code 자신이 로그를 읽고
분석 리포트를 작성합니다.

---

## 1. 프로젝트 소개

`mason-observer`는 Claude Code의 실행 과정을 **공식 Hook**을 통해 관찰하고, 그 관찰
증거만으로 "Claude가 이번 요청을 어떻게 처리했는지"를 재구성하는 오픈소스 Claude Code
Plugin입니다. 별도 서버나 외부 LLM 호출 없이, 이미 설치된 Claude Code 자신이 로그를 읽고
분석 리포트를 작성합니다.

## 2. 해결하려는 문제

Claude Code는 하나의 요청을 처리하면서 여러 Tool을 호출하고, 파일을 읽거나 수정하고,
때로는 Subagent를 실행합니다. 이 과정은 대화창에서 지나가듯 스쳐 사라지고, "왜 이런
선택을 했는지", "실제로 어떤 파일들을 건드렸는지", "어떤 지침이 적용됐는지"를 나중에
정확히 재구성하기 어렵습니다. `mason-observer`는 이 실행 과정의 **관찰 가능한 부분**을
로컬에 기록하고, 나중에 그 기록만으로 사실과 추정을 구분해 설명해주는 도구입니다.

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

자세한 한계는 [docs/limitations.md](./docs/limitations.md)를 참고해 주세요.

## 5. Claude의 비공개 chain-of-thought를 제공하지 않는다는 점

**mason-observer는 Claude의 비공개 내부 추론을 추출하거나 우회 노출하는 도구가 아닙니다.**
모든 분석은 Hook과 transcript에서 공식적으로 노출되는 관찰 가능한 사실에만 근거하며,
리포트는 "Claude가 이렇게 생각했다"라고 단정하지 않고 "관찰된 행동을 보면 이렇게 판단한
것으로 추정된다"는 식으로만 서술하도록 설계되어 있습니다(`skills/decision-analysis/SKILL.md`
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

자세한 내용은 [docs/architecture.md](./docs/architecture.md)를 참고해 주세요.

## 7. 수집되는 Hook 이벤트

공식 문서(`code.claude.com/docs/en/hooks.md`)에서 현재 지원을 확인한 아래 10개 이벤트만
사용합니다:

`SessionStart`, `UserPromptSubmit`, `InstructionsLoaded`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, `SessionEnd`

이벤트별로 저장되는 정확한 필드는 [docs/event-schema.md](./docs/event-schema.md)에
정의되어 있습니다. **Hook은 어떤 경우에도 Tool 호출을 차단하거나, Claude/Tool의 입력을
수정하거나, stdout으로 무언가를 출력하지 않습니다** — 순수 관찰자로만 동작합니다.

## 8. 요구 사항

- Claude Code (Plugin/Marketplace/Hooks 기능을 지원하는 버전 — [§17](#17-지원-claude-code-버전) 참고)
- Node.js 18 이상 (Hook/조회 스크립트가 Node.js로 작성되어 있으며, 별도 설치 없이
  실행됩니다)
- macOS, Linux, 또는 Windows

다른 것을 시도하기 전에 먼저 `claude`가 실제로 실행되는지부터 확인해 주세요.

```bash
claude --version
```

`2.1.178 (Claude Code)`처럼 실제 버전 문자열이 출력되어야 합니다. `nvm`으로 여러 Node
버전을 쓰시는 경우, 버전마다 `@anthropic-ai/claude-code`의 전역 npm 설치가 따로
존재합니다 — 설치가 불완전하면(네이티브 바이너리 postinstall이 실행되지 않아 "claude
native binary not installed" 에러를 내는 placeholder 스크립트만 남는 경우가 흔합니다)
정상 설치된 다른 Node 버전으로 바꾸거나, 아래처럼 깨끗하게 재설치해 주세요.

```bash
npm install -g @anthropic-ai/claude-code
```

## 9. GitHub에 자신의 마켓플레이스 배포하기

이 플러그인을 fork하거나 직접 유지보수하시는 경우:

1. 이 저장소를 GitHub에 **public** 저장소로 push합니다(`.claude-plugin/marketplace.json`이
   저장소 루트에 있어야 합니다).
2. `.claude-plugin/marketplace.json`의 `name`, `owner.name`, 각 플러그인 항목의
   `author`/`homepage`/`repository`, 그리고 `plugins/mason-observer/.claude-plugin/plugin.json`의
   해당 필드들을 자신의 값으로 교체합니다.
3. 태그를 눌러 버전을 명시적으로 관리합니다([릴리스 체크리스트](#릴리스-체크리스트-태그-기반-버전-관리) 참고).

## 10. 플러그인 설치 방법

마켓플레이스 저장소가 public이 된 이후엔 누구나 설치할 수 있습니다 — 다만 **어디서
Claude Code를 실행 중이냐에 따라 입력하는 명령이 달라집니다.** 여기서 가장 많이
헷갈리므로 아래 표를 먼저 읽어봐 주세요.

| Claude Code를 실행 중인 곳 | 입력할 명령 | 입력하는 위치 |
|---|---|---|
| 일반 터미널 셸, Claude Code가 아직 인터랙티브로 실행 중이 아님 | `claude plugin marketplace add fe-hyunsu/mason-observer` 실행 후 `claude plugin install mason-observer@mason-observer` | 셸 프롬프트에 그대로 — **앞에 `/`를 붙이지 않습니다.** `claude` 바이너리의 일반 CLI 서브커맨드이지 슬래시 명령이 아니라서, 평범한 셸이 그대로 이해합니다. |
| 인터랙티브 터미널 REPL(이미 `claude`를 실행해서 그 자체 프롬프트 안에 들어가 있는 상태) | `/plugin marketplace add fe-hyunsu/mason-observer` 실행 후 `/plugin install mason-observer@mason-observer` | 그 세션 자체의 입력창 안에서 입력합니다. |
| VS Code 확장 | `/plugins` (**복수형** — 단수형 `/plugin`은 이 환경에서 지원되지 않습니다) | 채팅 입력창에 — GUI 다이얼로그가 열리고 거기서 마켓플레이스 추가/설치를 진행합니다. |
| 인터랙티브 UI 자체가 없는 환경(클라우드 세션, headless/CI) | `.claude/settings.json`에 선언 (아래 참고) | 명령을 타이핑하는 게 아니라 설정 파일에 적어둡니다. |

### 단계별 안내 (셸 명령 — 거의 모든 곳에서 동작, 권장)

1. Claude Code가 정상 동작하는지 먼저 확인해 주세요([§8](#8-요구-사항) 참고): `claude --version`

2. 마켓플레이스를 추가하고 플러그인을 설치합니다.
   ```bash
   claude plugin marketplace add fe-hyunsu/mason-observer
   claude plugin install mason-observer@mason-observer
   ```
   `@` 앞은 **플러그인 이름**, `@` 뒤는 **마켓플레이스 이름**입니다. 이 저장소는 우연히
   둘 다 `mason-observer`라는 같은 문자열이라 헷갈릴 수 있는데, 이는 이름을 그렇게
   지어서 생긴 우연이지 규칙은 아닙니다.

3. **이미 열려 있는 세션에 반영합니다.** 셸 레벨 설치는 이미 실행 중이던 Claude Code
   세션(예: 명령 실행 전부터 열려 있던 VS Code 채팅창)에 자동으로 반영되지 않습니다.
   그 세션 안에서 아래를 실행해 주세요.
   ```
   /reload-plugins
   ```
   설치 **이후에** 새로 시작한 세션은 별도 조치 없이 자동으로 플러그인을 불러옵니다.

4. **실제로 활성화됐는지 확인합니다.**
   ```
   /mason-observer:status
   ```
   "unknown command"가 아니라 실제 상태 리포트가 나오면 활성화된 것입니다. 평범한
   프롬프트/Tool 호출을 몇 번 실행한 뒤 `/mason-observer:status`를 다시 실행하면
   `totalEvents`가 0보다 커져 있어야 합니다.

### 대안: `.claude/settings.json`에 직접 선언 (인터랙티브 단계 불필요)

팀 단위 설정이나, 인터랙티브 UI가 전혀 없는 환경에 유용합니다.

```json
{
  "extraKnownMarketplaces": {
    "mason-observer": {
      "source": { "source": "github", "repo": "fe-hyunsu/mason-observer" }
    }
  },
  "enabledPlugins": {
    "mason-observer@mason-observer": true
  }
}
```

### 아무 곳에도 배포하지 않고 로컬에서만 테스트하기

```bash
claude plugin marketplace add ./path/to/mason-observer
claude plugin install mason-observer@mason-observer
```
(위 표의 셸 vs REPL vs VS Code 구분은 이 경우에도 동일하게 적용됩니다)

## 11. `/mason-observer:inspect-last` 사용 방법

가장 최근에 완료된 사용자 턴을 관찰 증거만으로 재구성한 리포트를 생성합니다.

```text
/mason-observer:inspect-last
```

출력 형식과 예시는 [examples/sample-report.md](./examples/sample-report.md)를 참고해 주세요.

## 12. `/mason-observer:inspect-session` 사용 방법

현재 세션 전체(턴 목록, Tool 사용 패턴, 실패, 로드된 지침, Skill 적용 추정 등)를 요약합니다.

```text
/mason-observer:inspect-session
```

## 13. `/mason-observer:status` 사용 방법

로그 수집 상태(위치, 최근 이벤트, 세션 수, 마스킹 적용 여부, 로그 크기, 지원 Hook 목록,
진단 경고)를 표시합니다.

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

플러그인 설치 디렉터리나 플러그인 캐시에는 어떤 로그도 저장하지 않습니다. 프로젝트
루트를 안전하게 확인할 수 없는 경우(`CLAUDE_PROJECT_DIR`도 없고 Hook의 `cwd`도 유효한
디렉터리가 아닌 경우) 아무 곳에도 기록하지 않습니다.

## 15. 로그 삭제 방법

```bash
rm -rf .mason-observer/
```

위 명령은 사용자가 자신의 프로젝트에서 직접 실행하는 일반적인 파일 삭제이며,
`mason-observer`는 자체적으로 원격 삭제나 별도 삭제 API를 제공하지 않습니다.

## 16. 개인정보 및 보안 정책

- 기본적으로 **네트워크를 사용하지 않습니다.**
- 파일 내용은 저장하지 않고 경로와 작업 유형만 저장합니다(`.env` 포함).
- API Key, Access/Bearer Token, Authorization/Cookie 헤더, 비밀번호, PEM/Private Key,
  AWS/GitHub/Anthropic/OpenAI 토큰 등은 저장 전에 마스킹됩니다.
- Tool 결과는 원문 전체가 아닌 안전한 요약만, 크기 제한을 두어 저장합니다.
- 로그 크기와 보관 개수를 제한합니다(파일당 약 5MB, 프로젝트당 파일 개수 제한).
- `.mason-observer/`가 프로젝트 외부를 가리키는 심볼릭 링크이면 쓰기를 거부합니다.
- `.gitignore`에 `.mason-observer/`가 없으면 기존 내용을 보존한 채로만 안전하게 추가합니다.
- Hook 실패나 분석 실패가 Claude Code의 정상 작업을 절대 막지 않습니다.

자세한 내용은 [docs/privacy.md](./docs/privacy.md)를 참고해 주세요.

## 17. 지원 Claude Code 버전

이 플러그인은 공식 문서(`code.claude.com/docs/en/`)에서 현재 확인 가능한 Plugin /
Marketplace / Hooks / Skill 규격을 기준으로 작성했습니다.

**2026-09-06에 실제 Claude Code(v2.1.178, VS Code 확장 + Agent SDK 백엔드)에 이 플러그인을
`claude plugin marketplace add` / `claude plugin install`로 설치하고, `/reload-plugins`
후 `/mason-observer:status`를 실행해 end-to-end로 검증했습니다.** `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse` 이벤트가 실제로 `.mason-observer/events/`에
정상 기록됐고, `sessionId`/`promptId` 상관관계, 마스킹 파이프라인, 프로젝트 상대경로 변환이
모두 실제 로그에서 확인됐습니다.

- Plugin/Marketplace/Hooks/Skill 기본 구조: 문서상으로도, 실제 설치·로드로도 확인됐습니다.
- `prompt_id`(턴 연결에 사용) — 공식 문서는 "v2.1.196 이상 필요"라고 적고 있으나, **실제
  v2.1.178에서 정상적으로 채워지는 것을 확인했습니다.** 즉 이 최소 버전 요구사항은 문서와
  실측이 어긋납니다 — 정확한 최소 버전은 unknown으로 남겨둡니다. `promptId`가 비어 있는
  경우를 대비한 시간 구간 기반 폴백은 계속 유지됩니다.
- `UserPromptSubmit`의 프롬프트 텍스트 필드명(`prompt`)은 실제 로그에서 정상적으로
  채워지는 것을 확인했습니다(자세한 내용은 [docs/event-schema.md](./docs/event-schema.md)).
- `/reload-plugins` 실행 시 "1 error during load"가 보고됐으나, 로드된 컴포넌트
  개수(1 plugin · 4 skills · 10 hooks)가 이 플러그인이 선언한 개수와 정확히 일치해
  mason-observer 자체의 로드 오류는 아닌 것으로 보입니다 — 다만 원인을 확정하지는
  못했습니다(unknown). VS Code 확장에서는 `/plugin` Errors 탭이 열리지 않으므로, 원인을
  보려면 터미널 인터랙티브 `claude` 세션에서 `/plugin` → Errors 탭 또는
  `claude plugin details mason-observer`로 확인해야 합니다.

`/mason-observer:status`로 실제 환경에서 이벤트가 정상적으로 수집되는지 직접 확인해
보시길 권장합니다.

## 18. 알려진 한계

[docs/limitations.md](./docs/limitations.md)에 전체 목록이 있습니다. 핵심 요약은
다음과 같습니다.

- chain-of-thought/모델 내부 후보 비교 과정은 원천적으로 접근할 수 없습니다.
- 파일 접근/지침 로드가 "실제 적용"을 의미하지는 않습니다.
- Observer(리포트 생성 과정)도 Claude의 해석이므로 오류가 있을 수 있습니다.
- 마스킹은 알려진 패턴 기반이라 완전하지 않습니다.
- 실제 Claude Code 프로세스를 통한 end-to-end 검증은 완료했으나(위 §17 참고), `/reload-plugins`가
  보고한 "1 error during load"의 정확한 원인은 아직 확인하지 못했습니다(unknown).

## 19. 개발 및 테스트 방법

```bash
git clone https://github.com/fe-hyunsu/mason-observer.git
cd mason-observer

npm test        # Node.js 내장 테스트 러너로 단위/통합 테스트 실행
npm run validate # 매니페스트/hooks.json/Command·Skill frontmatter/스크립트 문법 검사 + 테스트 실행
```

외부 의존성 없이 Node.js 표준 라이브러리와 `node:test`만 사용합니다.

## 20. 기여 방법

1. 이슈를 먼저 열어 논의해 주세요(특히 Hook 이벤트 추가나 마스킹 규칙 변경처럼 개인정보에
   영향을 주는 변경).
2. 이 저장소를 fork하고 브랜치를 만들어 주세요.
3. `npm run validate`가 통과하는지 확인한 뒤 PR을 열어 주세요.
4. 마스킹 규칙을 추가/변경하는 PR은 반드시 대응하는 테스트(`tests/redact.test.js`)를
   포함해야 합니다.
5. 보안 취약점은 공개 이슈 대신 저장소 owner에게 비공개로 먼저 알려주시길 권장합니다
   (연락 방법은 `fe-hyunsu`의 GitHub 프로필을 참고해 주세요 — 저장소 공개 시 구체적인
   보안 연락처를 이 절에 채워 넣을 예정입니다).

### 릴리스 체크리스트 (태그 기반 버전 관리)

- [ ] `npm test`, `npm run validate` 통과
- [ ] `CHANGELOG.md`에 변경 사항 기록
- [ ] `.claude-plugin/marketplace.json`과 `plugins/mason-observer/.claude-plugin/plugin.json`의
      `version` 필드를 함께 올림
- [ ] `git tag vX.Y.Z` 후 push (Marketplace의 `github` source 타입은 `ref`로 특정
      태그/브랜치를 고정할 수 있습니다)

## 21. 라이선스

[MIT License](./LICENSE)
