---
name: decision-analysis
description: mason-recap가 수집한 Hook/transcript 로그를 분석하여, 관찰된 사실(observed)과 추정(inferred)과 확인 불가(unknown)를 분리한 Mason Recap Report를 만드는 절차. Claude Code 실행 과정을 재구성하거나, "왜 이렇게 했는지" 설명하거나, Skill/Rule 적용 여부를 검증할 때 사용한다.
license: MIT
---

# decision-analysis

이 Skill은 `.mason-recap/events/`에 기록된 JSONL 로그(observed evidence)만을 근거로, Claude
Code가 하나의 사용자 요청을 어떻게 처리했는지를 재구성하는 절차를 정의한다.

## 핵심 원칙

- **이 Skill은 Claude의 비공개 chain-of-thought를 조회하지 않는다.** 로그에 없는 내용은
  아무리 그럴듯해도 "확인됨"으로 서술하지 않는다.
- 모든 서술은 다음 세 등급 중 하나로 명시한다.
  - `observed`: Hook 이벤트 또는 transcript에서 직접 확인된 사실
  - `inferred`: 관찰된 행동을 근거로 재구성한 설명
  - `unknown`: 현재 로그만으로 확인할 수 없는 내용
- "Claude가 이렇게 판단했다"라고 단정하지 말고, "관찰된 행동을 보면 이렇게 판단한 것으로
  추정된다"처럼 서술한다.
- transcript 파일은 비동기로 기록되어 현재 턴의 최신 메시지가 아직 반영되지 않았을 수
  있다. `Stop`/`SubagentStop` 이벤트의 `last_assistant_message`가 있으면 그것을 우선
  신뢰하고, transcript 재조회로 같은 `Stop` 처리를 반복 트리거하지 않는다.

## 분석 절차

1. **분석 대상 식별**: 분석할 `sessionId`와 (있다면) `promptId`를 확정한다. 단일 턴
   분석이면 가장 최근 `UserPromptSubmit`, 세션 분석이면 현재 `sessionId`의 전체 이벤트를
   기준으로 삼는다.
2. **최초 프롬프트 확인**: 해당 턴의 `UserPromptSubmit.data.prompt`를 확인한다. 이 값은
   저장 시 마스킹·길이 제한이 적용된 값이므로, 원문 그대로가 아닐 수 있다는 점을 인지한다.
3. **로드된 지침 확인**: 같은 턴(또는 세션 시작 시점)의 `InstructionsLoaded` 이벤트를
   모아 어떤 파일(`CLAUDE.md`, `.claude/rules/*.md` 등)이 로드됐는지 확인한다. 파일이
   "로드됨"과 그 내용이 "실제로 적용됨"은 별개다 — 이 구분은 8단계에서 다시 판단한다.
4. **시간순 정렬**: `PreToolUse`/`PostToolUse`/`PostToolUseFailure`/`SubagentStart`/
   `SubagentStop` 이벤트를 `timestamp` 기준으로 정렬한다. `promptId`로 명시적으로 연결된
   이벤트는 observed 근거로, `promptId`가 없어 시간 구간으로만 연결된 이벤트는 그 자체로
   inferred(약한 연결)로 표시한다.
5. **실제 수행된 행동 요약**: 정렬된 이벤트로부터 "무엇을 했는가"만 사실 그대로 요약한다
   (예: "Bash로 `npm test` 실행", "`src/foo.ts`를 Edit로 수정", "Explore 타입 Subagent를
   1회 실행"). 이 단계에서는 의도나 이유를 추측하지 않는다.
6. **관찰과 추정 분리**: 5단계 요약에 "왜 그렇게 했는가"에 대한 설명이 필요하면, 그 설명은
   반드시 `inferred`로 표시하고 근거가 된 관찰 사실을 함께 적는다.
7. **Skill 적용 여부 판단**: 아래 "Skill 활성화 등급"을 사용해 각 후보 Skill에 대해
   판정한다.
8. **Rule/지침 적용 여부 판단**: 3단계에서 확인한 지침 각각에 대해, 이후 관찰된 행동이
   그 지침의 내용과 일치하는지를 같은 4단계 등급 체계로 판단한다. 지침이 로드됐다는 사실만
   으로 "적용됨"이라 단정하지 않는다.
9. **최종 답변과 실제 행동 비교**: `Stop.data.lastAssistantMessage`(마스킹·길이 제한 적용됨)
   와 5단계 행동 요약을 비교해, 답변이 실제 수행 내용과 일치하는지, 누락되거나 과도하게
   단정된 부분이 있는지 확인한다.
10. **확인 불가 항목 표기**: 로그가 없거나, 파일이 회전(rotate)되어 유실됐거나, 이벤트
    스키마가 예상과 달라 판단할 수 없는 항목은 전부 `unknown`으로 남긴다. 빈 자리를
    그럴듯한 서술로 채우지 않는다.

## Skill/MCP Tool 활성화 등급

```text
confirmed
- 명시적인 Skill 또는 MCP Tool 호출이 기록됨
  (예: PreToolUse의 tool_name이 해당 MCP tool과 일치, 또는 프롬프트/답변 텍스트에
  "/plugin-name:skill-name" 같은 명시적 호출 문자열이 관찰됨)

strongly-inferred
- 해당 SKILL.md 접근(예: PreToolUse Read, path가 skills/<name>/SKILL.md와 일치)이
  확인되고, 이후 행동이 그 SKILL.md에 정의된 절차와 일치함

weakly-inferred
- 행동은 절차와 유사하지만 Skill 파일 접근이나 명시적 호출이 관찰되지 않음
  (우연히 비슷한 순서로 행동했을 가능성을 배제할 수 없음)

not-observed
- 관련 이벤트가 전혀 관찰되지 않음
```

**중요**: mason-recap가 수집하는 Hook 이벤트에는 "Skill이 호출됐다"를 직접 알려주는 전용
이벤트가 없다. 따라서 기본값은 `weakly-inferred` 이하이며, `confirmed`로 판정하려면 위
정의에 맞는 명시적 증거가 실제로 있어야 한다. 증거가 애매하면 등급을 낮춰 잡는다
(과대 확신 금지).

## 산출물

이 절차의 결과는 호출한 커맨드(`/mason-recap:inspect-last`, `/mason-recap:inspect-session`)가
정의한 출력 형식에 맞춰 작성한다. 이 Skill 자체는 형식을 강제하지 않고 분석 절차와 등급
기준만 제공한다.
