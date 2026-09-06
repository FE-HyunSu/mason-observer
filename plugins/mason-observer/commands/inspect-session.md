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

2. 이벤트를 시간순으로 정렬해 `UserPromptSubmit` 기준으로 턴을 구분한다. 각 턴에서:
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

```markdown
# Mason Observer Session Report

## 세션 개요

- 세션 ID:
- 관찰된 턴 수:
- 관찰 기간(첫 이벤트 ~ 마지막 이벤트):

## 턴 목록

턴별로: 프롬프트 요약 / Tool 호출 수 / 수정 파일 / Subagent 사용 여부

## 반복적으로 사용된 Tool

## 실패한 Tool

## 로드된 지침

## Skill 적용 추정

## 관찰할 수 없는 부분

## 세션 흐름 타임라인

간단한 시간순 요약

## 한계

이 리포트는 실행 증거를 기반으로 재구성한 분석이며
Claude의 비공개 내부 사고과정이 아니다.
```
