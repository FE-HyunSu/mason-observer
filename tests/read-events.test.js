'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  readAllEvents,
  listSessions,
  eventsForSession,
  findLastPrompt,
  eventsForTurn,
  buildStatus,
} = require('../plugins/mason-recap/scripts/read-events')

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mason-recap-read-test-'))
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}

function writeEventsFile(dir, name, lines) {
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  fs.writeFileSync(path.join(dir, name), content, 'utf8')
}

test('readAllEvents returns [] when the events directory does not exist', () => {
  const events = readAllEvents('/nonexistent/path/that/should/not/exist')
  assert.deepEqual(events, [])
})

test('readAllEvents skips corrupted JSONL lines and keeps valid ones', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'corrupted-events.jsonl')
  const dir = makeTempDir()
  try {
    fs.copyFileSync(fixturePath, path.join(dir, 'sess-corrupt.jsonl'))
    const events = readAllEvents(dir)
    assert.equal(events.length, 2)
    assert.equal(events[0].event, 'UserPromptSubmit')
    assert.equal(events[1].event, 'Stop')
  } finally {
    cleanup(dir)
  }
})

test('listSessions groups events by sessionId and tracks first/last timestamps', () => {
  const events = [
    { sessionId: 'a', event: 'SessionStart', timestamp: '2026-01-01T00:00:00.000Z' },
    { sessionId: 'a', event: 'Stop', timestamp: '2026-01-01T00:05:00.000Z' },
    { sessionId: 'b', event: 'SessionStart', timestamp: '2026-01-02T00:00:00.000Z' },
  ]
  const sessions = listSessions(events)
  const a = sessions.find((s) => s.sessionId === 'a')
  assert.equal(a.count, 2)
  assert.equal(a.firstTimestamp, '2026-01-01T00:00:00.000Z')
  assert.equal(a.lastTimestamp, '2026-01-01T00:05:00.000Z')
  assert.equal(a.eventTypes.SessionStart, 1)
  assert.equal(a.eventTypes.Stop, 1)
})

test('eventsForSession filters and sorts by timestamp ascending', () => {
  const events = [
    { sessionId: 'a', event: 'Stop', timestamp: '2026-01-01T00:05:00.000Z' },
    { sessionId: 'a', event: 'SessionStart', timestamp: '2026-01-01T00:00:00.000Z' },
    { sessionId: 'b', event: 'SessionStart', timestamp: '2026-01-01T00:00:00.000Z' },
  ]
  const result = eventsForSession(events, 'a')
  assert.equal(result.length, 2)
  assert.equal(result[0].event, 'SessionStart')
  assert.equal(result[1].event, 'Stop')
})

test('findLastPrompt returns the most recent UserPromptSubmit event', () => {
  const events = [
    { sessionId: 'a', event: 'UserPromptSubmit', timestamp: '2026-01-01T00:00:00.000Z', data: { prompt: 'first' } },
    { sessionId: 'a', event: 'UserPromptSubmit', timestamp: '2026-01-01T00:10:00.000Z', data: { prompt: 'second' } },
  ]
  const last = findLastPrompt(events)
  assert.equal(last.data.prompt, 'second')
})

test('findLastPrompt returns null when there is no UserPromptSubmit event', () => {
  assert.equal(findLastPrompt([{ event: 'SessionStart', timestamp: '2026-01-01T00:00:00.000Z' }]), null)
})

test('eventsForTurn correlates by promptId when present, and falls back to time window otherwise', () => {
  const prompt = { sessionId: 'a', promptId: 'p1', event: 'UserPromptSubmit', timestamp: '2026-01-01T00:00:00.000Z' }
  const withPromptId = { sessionId: 'a', promptId: 'p1', event: 'PreToolUse', timestamp: '2026-01-01T00:00:01.000Z' }
  const withoutPromptId = { sessionId: 'a', event: 'PostToolUse', timestamp: '2026-01-01T00:00:02.000Z' }
  const stop = { sessionId: 'a', promptId: 'p1', event: 'Stop', timestamp: '2026-01-01T00:00:03.000Z' }
  const nextTurnPrompt = { sessionId: 'a', promptId: 'p2', event: 'UserPromptSubmit', timestamp: '2026-01-01T00:01:00.000Z' }
  const laterUnrelated = { sessionId: 'a', event: 'PostToolUse', timestamp: '2026-01-01T00:02:00.000Z' }

  const events = [prompt, withPromptId, withoutPromptId, stop, nextTurnPrompt, laterUnrelated]
  const { promptIdCorrelated, timeWindowCorrelated } = eventsForTurn(events, prompt)

  assert.equal(promptIdCorrelated.length, 2) // withPromptId + stop
  assert.ok(promptIdCorrelated.includes(withPromptId))
  assert.ok(promptIdCorrelated.includes(stop))

  assert.equal(timeWindowCorrelated.length, 1)
  assert.ok(timeWindowCorrelated.includes(withoutPromptId))
})

test('buildStatus reports a clear warning when no events have been captured yet', () => {
  const dir = makeTempDir()
  try {
    const status = buildStatus(dir)
    assert.equal(status.eventsDirExists, false)
    assert.equal(status.sessionCount, 0)
    assert.ok(status.warnings.length >= 1)
  } finally {
    cleanup(dir)
  }
})

test('buildStatus aggregates session count, last event, and masking stats', () => {
  const dir = makeTempDir()
  try {
    fs.mkdirSync(path.join(dir, '.mason-recap', 'events'), { recursive: true })
    writeEventsFile(dir, path.join('.mason-recap', 'events', 'sess-a.jsonl'), [
      {
        schemaVersion: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        event: 'SessionStart',
        sessionId: 'sess-a',
        data: {},
        redaction: { applied: true, count: 0 },
      },
      {
        schemaVersion: 1,
        timestamp: '2026-01-01T00:05:00.000Z',
        event: 'Stop',
        sessionId: 'sess-a',
        data: {},
        redaction: { applied: true, count: 2 },
      },
    ])

    const status = buildStatus(dir)
    assert.equal(status.eventsDirExists, true)
    assert.equal(status.sessionCount, 1)
    assert.equal(status.totalEvents, 2)
    assert.equal(status.lastEventType, 'Stop')
    assert.equal(status.maskingAppliedToEventCount, 2)
    assert.equal(status.maskingTotalSubstitutions, 2)
    assert.ok(status.supportedHookEvents.includes('PreToolUse'))
  } finally {
    cleanup(dir)
  }
})
