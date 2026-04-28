// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js"
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

type SyncAction = "sync_activities" | "sync_completions" | "sync_prune" | "sync_all"

type MinigameRow = {
  id: string
  name: string
  isActive: boolean
}

type ActivityRow = {
  id: string
  code: string
  points: number
}

type ParticipantMinigamePair = {
  participantId: string
  minigameId: string
  userCode: string
}

const CONFIG_KEY = "MINIGAME_ACTIVITY_POINTS"
const OVERRIDE_KEY_PREFIX = "MINIGAME_ACTIVITY_POINTS_OVERRIDE__"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const BATCH_SIZE = parsePositiveInt(Deno.env.get("EDGE_SYNC_BATCH_SIZE"), 10)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  })
}

type DebugEvent = {
  at: string
  step: string
  detail?: unknown
}

function toDebugError(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === "string" ? error : "Unknown edge function failure",
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.trunc(parsed)
}

function normalizeBearerToken(authHeader: string | null): string {
  if (!authHeader) return ""
  const trimmed = authHeader.trim()
  if (!trimmed.toLowerCase().startsWith("bearer ")) return ""
  return trimmed.slice(7).trim()
}

function getFallbackPoints(): number {
  return parsePositiveInt(Deno.env.get("MINIGAME_ACTIVITY_POINTS_FALLBACK"), 5)
}

function chunkArray<T>(input: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < input.length; index += size) {
    chunks.push(input.slice(index, index + size))
  }
  return chunks
}

function buildMinigameActivityCode(minigameId: string): string {
  const compact = minigameId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 24)
  return `MINIGAME_${compact}_PARTICIPATION`
}

async function requireActorStaffProfileId(): Promise<string> {
  const fromEnv = (Deno.env.get("SYSTEM_STAFF_PROFILE_ID") || "").trim()
  if (fromEnv) return fromEnv

  const { data, error } = await supabase
    .from("StaffProfile")
    .select("id")
    .eq("isApproved", true)
    .order("updatedAt", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Could not resolve actor staff profile: ${error.message}`)
  }

  const row = data?.[0]
  if (!row?.id) {
    throw new Error("No approved staff profile found. Set SYSTEM_STAFF_PROFILE_ID.")
  }

  return row.id
}

async function requireManualActivityTypeId(): Promise<string> {
  const byCode = await supabase
    .from("ActivityType")
    .select("id")
    .eq("code", "MANUAL")
    .limit(1)

  if (byCode.error) {
    throw new Error(`Could not resolve MANUAL activity type: ${byCode.error.message}`)
  }

  if (byCode.data?.[0]?.id) {
    return byCode.data[0].id
  }

  const fallback = await supabase
    .from("ActivityType")
    .select("id")
    .eq("isActive", true)
    .order("createdAt", { ascending: true })
    .limit(1)

  if (fallback.error) {
    throw new Error(`Could not resolve active activity type: ${fallback.error.message}`)
  }

  const row = fallback.data?.[0]
  if (!row?.id) {
    throw new Error("No active ActivityType found.")
  }

  return row.id
}

async function loadConfigPoints(): Promise<{ globalDefault: number | null; overrides: Map<string, number> }> {
  const globalResult = await supabase
    .from("MasterConfig")
    .select("valueText")
    .eq("key", CONFIG_KEY)
    .maybeSingle()

  if (globalResult.error) {
    throw new Error(`Could not load master config: ${globalResult.error.message}`)
  }

  const overrideResult = await supabase
    .from("MasterConfig")
    .select("key, valueText")
    .like("key", `${OVERRIDE_KEY_PREFIX}%`)

  if (overrideResult.error) {
    throw new Error(`Could not load minigame config overrides: ${overrideResult.error.message}`)
  }

  const globalRaw = globalResult.data?.valueText ?? null
  const globalDefault = globalRaw !== null && globalRaw !== "" ? Number(globalRaw) : null

  const overrides = new Map<string, number>()
  for (const row of overrideResult.data || []) {
    const key = String(row.key || "")
    const minigameId = key.slice(OVERRIDE_KEY_PREFIX.length)
    if (!minigameId || row.valueText === null || row.valueText === "") continue
    const parsed = Number(row.valueText)
    if (Number.isFinite(parsed)) {
      overrides.set(minigameId, parsed)
    }
  }

  return {
    globalDefault: Number.isFinite(globalDefault as number) ? (globalDefault as number) : null,
    overrides,
  }
}

async function loadMinigames(): Promise<MinigameRow[]> {
  const result = await supabase
    .from("Minigame")
    .select("id, name, isActive")
    .order("name", { ascending: true })

  if (result.error) {
    throw new Error(`Could not load minigames: ${result.error.message}`)
  }

  return result.data || []
}

async function syncActivities(
  actorStaffProfileId: string,
  manualActivityTypeId: string,
): Promise<{
  created: number
  updated: number
  unchanged: number
  pointsFallbackUsed: boolean
  activitiesByMinigameId: Map<string, ActivityRow>
}> {
  const nowIso = new Date().toISOString()
  const minigames = await loadMinigames()
  const { globalDefault, overrides } = await loadConfigPoints()
  const fallbackPoints = getFallbackPoints()

  const activitiesByMinigameId = new Map<string, ActivityRow>()
  let created = 0
  let updated = 0
  let unchanged = 0
  let pointsFallbackUsed = false

  for (const minigame of minigames) {
    const resolvedPoints = overrides.get(minigame.id) ?? globalDefault ?? fallbackPoints
    if (!overrides.has(minigame.id) && globalDefault === null) {
      pointsFallbackUsed = true
    }

    const code = buildMinigameActivityCode(minigame.id)
    const name = `${minigame.name} Participation`
    const description = `Auto-managed activity for minigame participation (${minigame.name}).`

    const existingResult = await supabase
      .from("Activity")
      .select("id, code, points")
      .eq("code", code)
      .maybeSingle()

    if (existingResult.error) {
      throw new Error(`Could not query existing activity (${code}): ${existingResult.error.message}`)
    }

    if (!existingResult.data) {
      const createdResult = await supabase
        .from("Activity")
        .insert({
          id: crypto.randomUUID(),
          code,
          name,
          description,
          points: resolvedPoints,
          activityTypeId: manualActivityTypeId,
          isActive: minigame.isActive,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdByStaffProfileId: actorStaffProfileId,
          updatedByStaffProfileId: actorStaffProfileId,
        })
        .select("id, code, points")
        .single()

      if (createdResult.error || !createdResult.data) {
        throw new Error(`Could not create activity (${code}): ${createdResult.error?.message || "Unknown insert failure"}`)
      }

      activitiesByMinigameId.set(minigame.id, createdResult.data)
      created += 1
      continue
    }

    const existing = existingResult.data
    const updatedResult = await supabase
      .from("Activity")
      .update({
        name,
        description,
        points: resolvedPoints,
        isActive: minigame.isActive,
        activityTypeId: manualActivityTypeId,
        updatedAt: nowIso,
        updatedByStaffProfileId: actorStaffProfileId,
      })
      .eq("id", existing.id)
      .select("id, code, points")
      .single()

    if (updatedResult.error || !updatedResult.data) {
      throw new Error(`Could not update activity (${code}): ${updatedResult.error?.message || "Unknown update failure"}`)
    }

    if (existing.points !== resolvedPoints) {
      updated += 1
    } else {
      unchanged += 1
    }

    activitiesByMinigameId.set(minigame.id, updatedResult.data)
  }

  return {
    created,
    updated,
    unchanged,
    pointsFallbackUsed,
    activitiesByMinigameId,
  }
}

async function loadEligibleParticipantMinigamePairs(): Promise<ParticipantMinigamePair[]> {
  const scoresResult = await supabase
    .from("Score")
    .select("userCode, gameId")

  if (scoresResult.error) {
    throw new Error(`Could not load scores: ${scoresResult.error.message}`)
  }

  const uniqueScores = new Map<string, { userCode: string; gameId: string }>()
  for (const row of scoresResult.data || []) {
    if (!row.userCode || !row.gameId) continue
    const key = `${row.userCode}:${row.gameId}`
    if (!uniqueScores.has(key)) {
      uniqueScores.set(key, { userCode: row.userCode, gameId: row.gameId })
    }
  }

  const distinctCodes = Array.from(new Set(Array.from(uniqueScores.values()).map((item) => item.userCode))).filter(Boolean)
  if (!distinctCodes.length) return []

  const participantsByCode = new Map<string, string>()
  for (const codeChunk of chunkArray(distinctCodes, 200)) {
    const participantsResult = await supabase
      .from("Participant")
      .select("id, minigameCode")
      .in("minigameCode", codeChunk)

    if (participantsResult.error) {
      throw new Error(`Could not load participants by minigame code: ${participantsResult.error.message}`)
    }

    for (const row of participantsResult.data || []) {
      if (row.minigameCode && row.id && !participantsByCode.has(row.minigameCode)) {
        participantsByCode.set(row.minigameCode, row.id)
      }
    }
  }

  const pairs: ParticipantMinigamePair[] = []
  const pairKeys = new Set<string>()
  for (const item of uniqueScores.values()) {
    const participantId = participantsByCode.get(item.userCode)
    if (!participantId) continue
    const key = `${participantId}:${item.gameId}`
    if (pairKeys.has(key)) continue
    pairKeys.add(key)
    pairs.push({
      participantId,
      minigameId: item.gameId,
      userCode: item.userCode,
    })
  }

  return pairs
}

async function syncCompletions(
  actorStaffProfileId: string,
  activitiesByMinigameId: Map<string, ActivityRow>,
  participantPairs: ParticipantMinigamePair[],
): Promise<{ created: number; skippedExisting: number; skippedNoActivity: number }> {
  let created = 0
  let skippedExisting = 0
  let skippedNoActivity = 0

  const chunks = chunkArray(participantPairs, BATCH_SIZE)
  for (const batch of chunks) {
    for (const row of batch) {
      const activity = activitiesByMinigameId.get(row.minigameId)
      if (!activity) {
        skippedNoActivity += 1
        continue
      }

      const completionExists = await supabase
        .from("ParticipantActivityCompletion")
        .select("id")
        .eq("participantId", row.participantId)
        .eq("activityId", activity.id)
        .maybeSingle()

      if (completionExists.error) {
        throw new Error(`Could not query completion for participant ${row.participantId}: ${completionExists.error.message}`)
      }

      if (completionExists.data?.id) {
        skippedExisting += 1
        continue
      }

      const completionId = crypto.randomUUID()
      const { data: outcome, error: rpcError } = await supabase.rpc(
        "grant_minigame_activity_completion",
        {
          p_participant_id: row.participantId,
          p_minigame_id: row.minigameId,
          p_user_code: row.userCode,
          p_activity_id: activity.id,
          p_points: activity.points,
          p_actor_staff_profile_id: actorStaffProfileId,
          p_completion_id: completionId,
          p_ledger_id: crypto.randomUUID(),
          p_audit_id: crypto.randomUUID(),
        },
      )

      if (rpcError) {
        throw new Error(`Could not complete sync via RPC for participant ${row.participantId}: ${rpcError.message}`)
      }

      if (outcome === "created") {
        created += 1
      } else {
        skippedExisting += 1
      }
    }
  }

  return { created, skippedExisting, skippedNoActivity }
}

async function syncPruneCompletions(
  actorStaffProfileId: string,
  activitiesByMinigameId: Map<string, ActivityRow>,
  participantPairs: ParticipantMinigamePair[],
): Promise<{ revoked: number; skippedNotFound: number; skippedNonSynced: number }> {
  const managedEntries = Array.from(activitiesByMinigameId.entries())
  const managedActivityIds = managedEntries.map(([, activity]) => activity.id)

  if (!managedActivityIds.length) {
    return { revoked: 0, skippedNotFound: 0, skippedNonSynced: 0 }
  }

  const completionRowsResult = await supabase
    .from("ParticipantActivityCompletion")
    .select("participantId, activityId")
    .in("activityId", managedActivityIds)

  if (completionRowsResult.error) {
    throw new Error(`Could not load managed completions for prune: ${completionRowsResult.error.message}`)
  }

  const activityToMinigameId = new Map<string, string>()
  for (const [minigameId, activity] of managedEntries) {
    activityToMinigameId.set(activity.id, minigameId)
  }

  const expectedSet = new Set<string>()
  for (const pair of participantPairs) {
    expectedSet.add(`${pair.participantId}:${pair.minigameId}`)
  }

  let revoked = 0
  let skippedNotFound = 0
  let skippedNonSynced = 0

  const completionRows = completionRowsResult.data || []
  const chunks = chunkArray(completionRows, BATCH_SIZE)
  for (const batch of chunks) {
    for (const completionRow of batch) {
      const minigameId = activityToMinigameId.get(completionRow.activityId)
      if (!minigameId) {
        skippedNotFound += 1
        continue
      }

      const expectedKey = `${completionRow.participantId}:${minigameId}`
      if (expectedSet.has(expectedKey)) {
        continue
      }

      const { data: outcome, error: rpcError } = await supabase.rpc(
        "revoke_minigame_activity_completion",
        {
          p_participant_id: completionRow.participantId,
          p_minigame_id: minigameId,
          p_activity_id: completionRow.activityId,
          p_actor_staff_profile_id: actorStaffProfileId,
          p_audit_id: crypto.randomUUID(),
        },
      )

      if (rpcError) {
        throw new Error(`Could not prune completion for participant ${completionRow.participantId}: ${rpcError.message}`)
      }

      if (outcome === "revoked") {
        revoked += 1
      } else if (outcome === "skipped_non_synced") {
        skippedNonSynced += 1
      } else {
        skippedNotFound += 1
      }
    }
  }

  return { revoked, skippedNotFound, skippedNonSynced }
}

Deno.serve(async (req) => {
  const debugEvents: DebugEvent[] = []
  const addDebug = (step: string, detail?: unknown) => {
    debugEvents.push({
      at: new Date().toISOString(),
      step,
      detail,
    })
  }

  addDebug("request.received", { method: req.method })

  if (req.method !== "POST") {
    addDebug("request.invalid_method", { expected: "POST", actual: req.method })
    return json(405, { error: "Method not allowed", debug: { events: debugEvents } })
  }

  const expectedToken = (Deno.env.get("EDGE_FUNCTION_TOKEN") || "").trim()
  if (expectedToken) {
    addDebug("auth.token_required")
    const suppliedToken = normalizeBearerToken(req.headers.get("authorization"))
    if (!suppliedToken || suppliedToken !== expectedToken) {
      addDebug("auth.failed", { hasSuppliedToken: Boolean(suppliedToken) })
      return json(401, { error: "Unauthorized", debug: { events: debugEvents } })
    }
    addDebug("auth.passed")
  }

  let body: { action?: SyncAction; debug?: boolean } = {}
  try {
    addDebug("request.parse_body.start")
    body = await req.json()
    addDebug("request.parse_body.success", { hasAction: Boolean(body.action), debugRequested: Boolean(body.debug) })
  } catch {
    addDebug("request.parse_body.failed")
    return json(400, { error: "Invalid JSON body", debug: { events: debugEvents } })
  }

  const action = body.action || "sync_all"
  const includeDebugInSuccess = Boolean(body.debug)
  addDebug("request.action_resolved", { action })

  if (!["sync_activities", "sync_completions", "sync_prune", "sync_all"].includes(action)) {
    addDebug("request.action_invalid", { action })
    return json(400, {
      error: "Invalid action. Use sync_activities, sync_completions, sync_prune, or sync_all.",
      debug: { events: debugEvents },
    })
  }

  try {
    addDebug("resolve.actor_staff_profile.start")
    const actorStaffProfileId = await requireActorStaffProfileId()
    addDebug("resolve.actor_staff_profile.success", { actorStaffProfileId })

    addDebug("resolve.manual_activity_type.start")
    const manualActivityTypeId = await requireManualActivityTypeId()
    addDebug("resolve.manual_activity_type.success", { manualActivityTypeId })

    addDebug("sync.activities.start")
    const activitySync = await syncActivities(actorStaffProfileId, manualActivityTypeId)
    addDebug("sync.activities.success", {
      created: activitySync.created,
      updated: activitySync.updated,
      unchanged: activitySync.unchanged,
      pointsFallbackUsed: activitySync.pointsFallbackUsed,
    })

    addDebug("load.participant_pairs.start")
    const participantPairs = await loadEligibleParticipantMinigamePairs()
    addDebug("load.participant_pairs.success", { count: participantPairs.length })

    if (action === "sync_activities") {
      const responsePayload = {
        ok: true,
        action,
        actorStaffProfileId,
        configKey: CONFIG_KEY,
        fallbackDefaultPoints: getFallbackPoints(),
        activities: {
          created: activitySync.created,
          updated: activitySync.updated,
          unchanged: activitySync.unchanged,
          pointsFallbackUsed: activitySync.pointsFallbackUsed,
        },
      }

      if (includeDebugInSuccess) {
        return json(200, {
          ...responsePayload,
          debug: { events: debugEvents },
        })
      }

      return json(200, responsePayload)
    }

    if (action === "sync_completions") {
      addDebug("sync.completions.start")
      const completionSync = await syncCompletions(actorStaffProfileId, activitySync.activitiesByMinigameId, participantPairs)
      addDebug("sync.completions.success", completionSync)

      const responsePayload = {
        ok: true,
        action,
        actorStaffProfileId,
        configKey: CONFIG_KEY,
        fallbackDefaultPoints: getFallbackPoints(),
        activities: {
          created: activitySync.created,
          updated: activitySync.updated,
          unchanged: activitySync.unchanged,
          pointsFallbackUsed: activitySync.pointsFallbackUsed,
        },
        completions: completionSync,
      }

      if (includeDebugInSuccess) {
        return json(200, {
          ...responsePayload,
          debug: { events: debugEvents },
        })
      }

      return json(200, responsePayload)
    }

    if (action === "sync_prune") {
      addDebug("sync.prune.start")
      const pruneSync = await syncPruneCompletions(actorStaffProfileId, activitySync.activitiesByMinigameId, participantPairs)
      addDebug("sync.prune.success", pruneSync)

      const responsePayload = {
        ok: true,
        action,
        actorStaffProfileId,
        configKey: CONFIG_KEY,
        fallbackDefaultPoints: getFallbackPoints(),
        activities: {
          created: activitySync.created,
          updated: activitySync.updated,
          unchanged: activitySync.unchanged,
          pointsFallbackUsed: activitySync.pointsFallbackUsed,
        },
        prune: pruneSync,
      }

      if (includeDebugInSuccess) {
        return json(200, {
          ...responsePayload,
          debug: { events: debugEvents },
        })
      }

      return json(200, responsePayload)
    }

    addDebug("sync.completions.start")
    const completionSync = await syncCompletions(actorStaffProfileId, activitySync.activitiesByMinigameId, participantPairs)
    addDebug("sync.completions.success", completionSync)

    addDebug("sync.prune.start")
    const pruneSync = await syncPruneCompletions(actorStaffProfileId, activitySync.activitiesByMinigameId, participantPairs)
    addDebug("sync.prune.success", pruneSync)

    const responsePayload = {
      ok: true,
      action,
      actorStaffProfileId,
      configKey: CONFIG_KEY,
      fallbackDefaultPoints: getFallbackPoints(),
      activities: {
        created: activitySync.created,
        updated: activitySync.updated,
        unchanged: activitySync.unchanged,
        pointsFallbackUsed: activitySync.pointsFallbackUsed,
      },
      completions: completionSync,
      prune: pruneSync,
    }

    if (includeDebugInSuccess) {
      return json(200, {
        ...responsePayload,
        debug: { events: debugEvents },
      })
    }

    return json(200, responsePayload)
  } catch (error) {
    const details = toDebugError(error)
    addDebug("execution.failed", details)
    return json(500, {
      ok: false,
      error: details.message,
      debug: {
        action,
        events: debugEvents,
        error: details,
      },
    })
  }
})
