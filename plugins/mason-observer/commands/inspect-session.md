---
description: 현재 세션 전체를 mason-observer가 수집한 관찰 증거만으로 요약합니다 (턴 목록, Tool 사용, 실패, Skill 적용 추정 등).
allowed-tools: Bash, Read
---

# 목표

현재 세션(`${CLAUDE_SESSION_ID}`)에서 관찰된 전체 흐름을 요약한다. 개별 턴의 상세 재구성이
아니라 세션 단위의 패턴(반복된 Tool, 실패한 Tool, Subagent 사용 여부, 로드된 지침 등)에
초점을 맞춘다.

**비공개 chain-of-thought는 다루지 않는다.** 오직 로그에 기록된 관찰 사실만 사용한다.

# 절차

1. 현재 세션의 전체 이벤트를 가져온다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" session "${CLAUDE_SESSION_ID}"
   ```

   결과가 빈 배열이면, 이 세션에서 아직 수집된 이벤트가 없다는 사실을 그대로 보고한다
   (예: 세션이 막 시작됐거나, hooks가 아직 한 번도 트리거되지 않았을 수 있다).

2. 이벤트를 시간순으로 정렬해 `UserPromptSubmit` 기준으로 턴을 구분한다. **턴은 반드시
   프롬프트가 입력된 순서대로 하나씩 나열한다** — 먼저 그 턴의 사용자 프롬프트를 인용하고,
   바로 그 아래에 그 턴에 대한 설명을 붙인 다음, 다음 턴으로 넘어간다(아래 출력 형식 참고).
   각 턴에서:
   - 해당 턴에 속한 `PreToolUse`/`PostToolUse`/`PostToolUseFailure` 이벤트 수
   - 수정된 파일 경로(`PreToolUse`의 `Write`/`Edit`/`NotebookEdit` 이벤트에서 추출)
   - `SubagentStart`/`SubagentStop` 존재 여부
   를 집계한다.

3. 세션 전체에서:
   - 가장 많이 호출된 Tool
   - 실패(`PostToolUseFailure`)가 발생한 Tool과 횟수
   - 로드된 지침(`InstructionsLoaded` 이벤트의 경로 목록)
   을 집계한다.

4. `plugins/mason-observer/skills/decision-analysis/SKILL.md`의 Skill 활성화 증거 등급
   (confirmed / strongly-inferred / weakly-inferred / not-observed)을 참고하여, 세션 전체에서
   관찰된 Skill 적용 여부를 턴 단위로 추정한다.

5. 로그만으로 확인할 수 없는 부분(예: `promptId`가 없어 시간 구간으로만 연결된 이벤트, 아직
   transcript에 반영되지 않았을 수 있는 항목)은 반드시 `unknown` 또는 명시적 한계로 표시한다.

# 출력 형식

턴 목록은 **프롬프트 한 줄 → 그 턴에 대한 설명 → 다음 프롬프트** 순서로, 턴 개수만큼
반복한다. 별도의 "턴 목록" 표나 타임라인 섹션으로 다시 요약하지 않는다 — 아래 턴별
블록 자체가 타임라인이다.

```markdown
# Mason Observer Session Report

- 세션 ID: <sessionId>
- 관찰된 턴 수: <N>
- 관찰 기간: <첫 이벤트 시각> ~ <마지막 이벤트 시각>

## 턴 1
> "<프롬프트 1 원문 또는 핵심 요약>"

<이 턴에서 관찰된 것을 간결하게 서술한다 — 호출된 Tool, 수정한 파일, Subagent 사용,
실패 여부, Skill 적용 판정 등. 각 문장에 (observed)/(inferred)/(unknown) 태그를 붙인다.>

## 턴 2
> "<프롬프트 2>"

<설명>

<!-- 관찰된 턴 수만큼 "## 턴 N" 블록을 반복한다 -->

## 세션 요약

- 반복적으로 사용된 Tool:
- 실패한 Tool:
- 로드된 지침:
- Skill 적용 추정:
- 관찰할 수 없는 부분:

## 한계

이 리포트는 실행 증거를 기반으로 재구성한 분석이며
Claude의 비공개 내부 사고과정이 아니다.
```
