---
description: 가장 최근에 완료된 사용자 턴을 mason-observer가 수집한 관찰 증거(observed)만으로 재구성하여 Mason Observer Report를 생성합니다.
allowed-tools: Bash, Read
---

# 목표

가장 최근에 완료된 사용자 턴(마지막 `UserPromptSubmit`부터 그에 대응하는 `Stop`까지)에 대해,
`.mason-observer/events/`에 기록된 로그만을 근거로 실행 과정을 재구성한다.

**이 명령은 Claude의 비공개 chain-of-thought를 조회하거나 요구하지 않는다.** 오직 Hook과
transcript에서 관찰 가능한 사실(호출된 Tool, 읽거나 수정한 파일, 실행한 명령, Subagent 활동,
최종 답변)만을 사용한다.

# 절차

1. 아래 명령으로 가장 최근 턴의 원본 이벤트를 가져온다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" last-turn
   ```

   반환된 JSON은 `prompt`(가장 최근 `UserPromptSubmit` 이벤트), `promptIdCorrelated`(같은
   `promptId`로 명시적으로 연결된 이벤트 — observed 근거로 취급 가능), `timeWindowCorrelated`
   (`promptId`가 없어 시간 구간으로만 연결된 이벤트 — 반드시 inferred/약한 근거로 취급)로
   구성된다.

   결과가 비어 있거나 `prompt`가 `null`이면, 아직 수집된 로그가 없다는 사실을 그대로 보고하고
   중단한다. 로그가 없다는 것을 추측으로 채우지 않는다.

2. `plugins/mason-observer/skills/decision-analysis/SKILL.md`에 정의된 분석 절차와 Skill 활성화
   증거 등급(confirmed / strongly-inferred / weakly-inferred / not-observed)을 그대로 적용한다.
   이 Skill의 절차를 skip하지 말고 각 단계를 실제로 수행한다.

3. 아래 출력 형식을 그대로 사용하여 보고서를 작성한다. 프롬프트 원문을 먼저 인용하고,
   그 프롬프트에 대한 설명을 바로 이어서 하나의 흐름으로 서술한다 — 요청/분류/실행흐름/
   컨텍스트/판단근거를 각각 별도 h2 섹션으로 쪼개지 말고, 자연스러운 문단·불릿으로
   압축한다. 다만 각 문장·불릿에는 반드시 `(observed)` / `(inferred)` / `(unknown)`
   태그를 붙여 근거 수준을 명확히 한다. "Claude가 이렇게 생각했다"처럼 단정하지 말고,
   "관찰된 행동을 보면 이렇게 판단한 것으로 추정된다"는 식으로만 서술한다.

# 출력 형식

```markdown
# Mason Observer Report

> "<사용자 프롬프트 원문 또는 핵심 요약>"

<이 턴에서 실제로 일어난 일을 시간순으로, 자연스러운 문장이나 짧은 불릿으로 서술한다.
호출된 Tool, 수정/조회한 파일 경로, Subagent 활동, 최종 답변과의 일치 여부까지 이 안에서
전부 다룬다. 각 문장 끝에 (observed) / (inferred) / (unknown) 중 하나를 붙인다.>

**Skill 적용**: <Skill 이름 또는 "해당 없음"> · <confirmed/strongly-inferred/weakly-inferred/not-observed> — <한 줄 근거>

**지침 적용**: <지침 파일명 또는 "해당 없음"> · <판정 등급> — <한 줄 근거>

## 한계

이 리포트는 실행 증거를 기반으로 재구성한 분석이며
Claude의 비공개 내부 사고과정이 아니다.
```
