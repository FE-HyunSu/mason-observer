#!/usr/bin/env node
'use strict'

/**
 * Read-only query helper over the .mason-recap/events JSONL logs. Invoked
 * directly (not as a hook) by the plugin's slash commands via Bash, e.g.:
 *
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" status
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" sessions
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" session <sessionId>
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/read-events.js" last-turn
 *
 * Unlike capture-event.js, this script is allowed to print to stdout (it is
 * not a hook, so there is no risk of its output being silently injected
 * into Claude's context) and prints results as JSON for the calling command
 * to read and reason over.
 */

const fs = require('fs')
const path = require('path')

const { debugLog, safeJSONParse, logPaths } = require('./utils')

const SUPPORTED_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'InstructionsLoaded',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'SessionEnd',
]

function resolveProjectRootForQuery() {
  const candidate = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  try {
    const resolved = path.resolve(candidate)
    if (fs.statSync(resolved).isDirectory()) return resolved
  } catch {
    // fall through
  }
  return null
}

/** Read and parse every *.jsonl file in the events directory, skipping any corrupted lines. */
function readAllEvents(eventsDir) {
  let entries
  try {
    entries = fs.readdirSync(eventsDir)
  } catch {
    return []
  }

  const events = []
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue
    const full = path.join(eventsDir, name)
    let content
    try {
      content = fs.readFileSync(full, 'utf8')
    } catch (err) {
      debugLog(`could not read ${name}: ${err && err.message}`)
      continue
    }
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) continue
      const parsed = safeJSONParse(line)
      if (!parsed.ok) {
        debugLog(`skipping corrupted JSONL line in ${name}`)
        continue
      }
      events.push(parsed.value)
    }
  }
  return events
}

function byTimestampAsc(a, b) {
  const ta = typeof a.timestamp === 'string' ? a.timestamp : ''
  const tb = typeof b.timestamp === 'string' ? b.timestamp : ''
  return ta < tb ? -1 : ta > tb ? 1 : 0
}

function listSessions(events) {
  const bySession = new Map()
  for (const ev of events) {
    const id = ev.sessionId || 'unknown-session'
    if (!bySession.has(id)) {
      bySession.set(id, { sessionId: id, count: 0, firstTimestamp: null, lastTimestamp: null, eventTypes: {} })
    }
    const entry = bySession.get(id)
    entry.count += 1
    entry.eventTypes[ev.event] = (entry.eventTypes[ev.event] || 0) + 1
    if (typeof ev.timestamp === 'string') {
      if (!entry.firstTimestamp || ev.timestamp < entry.firstTimestamp) entry.firstTimestamp = ev.timestamp
      if (!entry.lastTimestamp || ev.timestamp > entry.lastTimestamp) entry.lastTimestamp = ev.timestamp
    }
  }
  return Array.from(bySession.values()).sort((a, b) => (a.lastTimestamp < b.lastTimestamp ? 1 : -1))
}

function eventsForSession(events, sessionId) {
  return events.filter((ev) => (ev.sessionId || 'unknown-session') === sessionId).sort(byTimestampAsc)
}

/** Most recently observed UserPromptSubmit event across all sessions. */
function findLastPrompt(events) {
  const prompts = events.filter((ev) => ev.event === 'UserPromptSubmit').sort(byTimestampAsc)
  return prompts.length ? prompts[prompts.length - 1] : null
}

/**
 * Build the bundle of events belonging to the same turn as `promptEvent`.
 *
 * Primary correlation is by matching `promptId` (an observed fact when
 * present). When an event lacks a promptId (older Claude Code versions may
 * omit it on some events), it is included only if its timestamp falls
 * between this prompt and the next UserPromptSubmit/Stop in the same
 * session — a weaker, inferred correlation, and callers should treat that
 * distinction as part of the observed-vs-inferred boundary.
 */
function eventsForTurn(events, promptEvent) {
  if (!promptEvent) return { promptIdCorrelated: [], timeWindowCorrelated: [] }

  const sessionEvents = eventsForSession(events, promptEvent.sessionId || 'unknown-session')
  const startTs = promptEvent.timestamp
  const startIdx = sessionEvents.findIndex((ev) => ev === promptEvent || (ev.timestamp === startTs && ev.event === 'UserPromptSubmit'))

  let endTs = null
  for (let i = (startIdx === -1 ? 0 : startIdx + 1); i < sessionEvents.length; i++) {
    const ev = sessionEvents[i]
    if (ev.event === 'Stop') {
      endTs = ev.timestamp
      break
    }
    if (ev.event === 'UserPromptSubmit') {
      endTs = ev.timestamp
      break
    }
  }

  const promptIdCorrelated = []
  const timeWindowCorrelated = []

  for (const ev of sessionEvents) {
    if (ev === promptEvent) continue
    const hasPromptId = typeof ev.promptId === 'string' && ev.promptId.length > 0
    if (hasPromptId && promptEvent.promptId && ev.promptId === promptEvent.promptId) {
      promptIdCorrelated.push(ev)
      continue
    }
    if (!hasPromptId) {
      const ts = ev.timestamp
      if (typeof ts === 'string' && ts >= startTs && (endTs === null || ts <= endTs)) {
        timeWindowCorrelated.push(ev)
      }
    }
  }

  return { promptIdCorrelated, timeWindowCorrelated }
}

function dirSizeBytes(dir) {
  let total = 0
  let entries
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return 0
  }
  for (const name of entries) {
    try {
      total += fs.statSync(path.join(dir, name)).size
    } catch {
      // ignore
    }
  }
  return total
}

function buildStatus(projectRoot) {
  const paths = logPaths(projectRoot)
  const eventsDirExists = fs.existsSync(paths.events)
  const events = eventsDirExists ? readAllEvents(paths.events) : []
  const sessions = listSessions(events)
  const sorted = [...events].sort(byTimestampAsc)
  const last = sorted.length ? sorted[sorted.length - 1] : null

  let redactionEventsCount = 0
  let redactionTotalMasks = 0
  for (const ev of events) {
    if (ev.redaction && ev.redaction.applied) {
      redactionEventsCount += 1
      redactionTotalMasks += typeof ev.redaction.count === 'number' ? ev.redaction.count : 0
    }
  }

  return {
    logRoot: paths.root,
    eventsDirExists,
    supportedHookEvents: SUPPORTED_HOOK_EVENTS,
    sessionCount: sessions.length,
    totalEvents: events.length,
    lastEventTimestamp: last ? last.timestamp : null,
    lastEventType: last ? last.event : null,
    maskingAppliedToEventCount: redactionEventsCount,
    maskingTotalSubstitutions: redactionTotalMasks,
    eventsDirSizeBytes: dirSizeBytes(paths.events),
    warnings: eventsDirExists ? [] : ['no events captured yet in this project (hooks may not have fired, or this is a new project)'],
  }
}

function printJSON(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
}

function main() {
  const [, , subcommand, arg] = process.argv
  const projectRoot = resolveProjectRootForQuery()

  if (!projectRoot) {
    printJSON({ error: 'could not resolve project root' })
    process.exitCode = 1
    return
  }

  const paths = logPaths(projectRoot)

  switch (subcommand) {
    case 'status':
      printJSON(buildStatus(projectRoot))
      return
    case 'sessions': {
      const events = readAllEvents(paths.events)
      printJSON(listSessions(events))
      return
    }
    case 'session': {
      if (!arg) {
        printJSON({ error: 'usage: read-events.js session <sessionId>' })
        process.exitCode = 1
        return
      }
      const events = readAllEvents(paths.events)
      printJSON(eventsForSession(events, arg))
      return
    }
    case 'last-turn': {
      const events = readAllEvents(paths.events)
      const promptEvent = findLastPrompt(events)
      if (!promptEvent) {
        printJSON({ prompt: null, promptIdCorrelated: [], timeWindowCorrelated: [] })
        return
      }
      const { promptIdCorrelated, timeWindowCorrelated } = eventsForTurn(events, promptEvent)
      printJSON({ prompt: promptEvent, promptIdCorrelated, timeWindowCorrelated })
      return
    }
    default:
      printJSON({
        error: `unknown subcommand: ${subcommand || '(none)'}`,
        usage: ['status', 'sessions', 'session <sessionId>', 'last-turn'],
      })
      process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  readAllEvents,
  listSessions,
  eventsForSession,
  findLastPrompt,
  eventsForTurn,
  buildStatus,
  SUPPORTED_HOOK_EVENTS,
}
