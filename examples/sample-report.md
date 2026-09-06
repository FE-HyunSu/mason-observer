# Sample Mason Observer Report (worked example)

이 문서는 실제 사용자 세션이 아니라, `plugins/mason-observer/scripts/capture-event.js`와
`read-events.js`에 실제 샘플 Hook 이벤트를 흘려보내 얻은 결과를 근거로 손으로 작성한
예시다. `/mason-observer:inspect-last`가 실행되면 Claude가 이와 유사한 형태의 리포트를
생성한다.

입력으로 사용된 이벤트 시퀀스(요약): `SessionStart` → `UserPromptSubmit`
("utils.js에 있는 off-by-one 버그를 고쳐줘") → `InstructionsLoaded` (`CLAUDE.md`) →
`PreToolUse`/`PostToolUse` (`Read src/utils.js`) → `PreToolUse`/`PostToolUse`
(`Edit src/utils.js`) → `PreToolUse`/`PostToolUse` (`Bash: npm test`) → `Stop`.

---

# Mason Observer Report

## 요청

utils.js에 있는 off-by-one 버그를 수정해 달라는 요청 (observed: `UserPromptSubmit` 이벤트의
`data.prompt`).

## 분류

- 요청 유형: 버그 수정 (observed: 프롬프트 텍스트에 "버그를 고쳐줘"라는 표현이 있음)
- 예상한 결과: `src/utils.js`의 로직 수정 및 검증 (inferred: 프롬프트 문구를 근거로 한 해석)
- 실제 완료 상태: 완료로 보고됨 (observed: `Stop` 이벤트의 `last_assistant_message`에
  "수정했고 테스트 5개가 모두 통과합니다"라는 문장이 있음)

## 실행 흐름

시간순으로 관찰된 주요 이벤트 (모두 observed, `.mason-observer/events/*.jsonl`에서 확인됨):

1. `InstructionsLoaded` — `CLAUDE.md` 로드 (loadReason: `session_start`)
2. `PreToolUse`/`PostToolUse` — `Read` 도구로 `src/utils.js` 조회 (내용은 저장되지 않음,
   경로만 기록됨)
3. `PreToolUse`/`PostToolUse` — `Edit` 도구로 `src/utils.js` 수정 (내용은 저장되지 않음,
   경로와 작업 유형만 기록됨)
4. `PreToolUse`/`PostToolUse` — `Bash` 도구로 `npm test` 실행, 결과 요약 `"5 passing"`
5. `Stop` — 최종 응답 생성

## 사용된 컨텍스트

- 로드된 지침: `CLAUDE.md` (observed)
- 읽은 주요 파일: `src/utils.js` (observed, 경로만 — 내용은 수집 정책상 저장하지 않음)
- 호출된 Tool: `Read`, `Edit`, `Bash` (observed)
- 실행된 Subagent: 없음 (not-observed — 이 예시 시퀀스에는 `SubagentStart`/`SubagentStop`
  이벤트가 없음)

## 판단 근거 재구성

- "off-by-one 버그가 실제로 `src/utils.js`에 있었다": inferred — Edit가 그 파일에 대해
  일어났다는 사실은 observed지만, 원래 코드에 어떤 버그가 있었는지는 diff 내용을 저장하지
  않으므로 확인 불가.
- "수정 후 관련 테스트가 통과했다": observed — `Bash` 도구의 결과 요약이 `"5 passing"`.
- "이 5개 테스트가 실제로 이 버그를 검증하는 테스트다": unknown — 어떤 테스트 파일이 어떤
  코드를 검증하는지는 로그만으로 확인할 수 없음.

## Skill 적용 분석

- Skill: (이 예시에는 별도 Skill 호출과 연관된 이벤트가 없음)
- 판정: not-observed
- 증거: 해당 세션 이벤트에 Skill 파일 접근이나 MCP Tool 호출 흔적이 없음
- 확신도: 없음 (판단할 근거 자체가 없음)

## Rule 및 지침 적용 분석

- 지침: `CLAUDE.md`
- 판정: weakly-inferred — `CLAUDE.md`가 로드된 사실은 observed이나, 그 내용 중 어떤 규칙이
  이번 Edit 결정에 실제로 영향을 미쳤는지는 로그에 나타나지 않음 (파일 내용 자체를 저장하지
  않기 때문)
- 증거: `InstructionsLoaded` 이벤트 1건
- 확신도: 낮음

## 최종 답변 검토

- 실행 내용과 답변의 일치 여부: 대체로 일치 (observed: Edit 발생 + 테스트 통과가 답변
  내용과 부합)
- 누락된 내용: 어떤 구체적인 변경(예: 비교 연산자 변경)이 이루어졌는지는 답변에 명시되지
  않음 — 다만 이는 로그 정책상 diff 자체를 저장하지 않기 때문에 이 리포트에서도 확인 불가
  (unknown)
- 과도하게 단정한 내용: 특별히 발견되지 않음 (다만 "고쳤다"는 표현이 실제 버그 원인을
  정확히 짚었는지는 이 로그만으로는 검증 불가 — unknown)

## 한계

이 리포트는 실행 증거를 기반으로 재구성한 분석이며
Claude의 비공개 내부 사고과정이 아니다.
