.pragma library

function marketplaceUrl(pluginId) {
  return "https://plugins.omarchy.org/plugin.html?id=" + encodeURIComponent(String(pluginId))
}

function listingChecksUrl(pluginId) {
  return marketplaceUrl(pluginId) + "#verification"
}

function shortSha(sha) {
  var value = String(sha || "")
  return value.length > 7 ? value.substring(0, 7) : value
}

function normalizedGitHubUrl(repoUrl) {
  var url = String(repoUrl || "").trim()
  var match = url.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*?)(?:\.git)?\/?$/)
  if (!match || match[1].indexOf("..") !== -1 || match[2].indexOf("..") !== -1) return ""
  return "https://github.com/" + match[1] + "/" + match[2]
}

function commitUrl(repoUrl, sha) {
  var url = normalizedGitHubUrl(repoUrl)
  var commit = String(sha || "")
  return url !== "" && commit !== "" ? url + "/commit/" + commit : ""
}

function authorUrl(repoUrl) {
  var match = normalizedGitHubUrl(repoUrl).match(/^https:\/\/github\.com\/([^\/]+)/)
  return match ? "https://github.com/" + match[1] : ""
}

function compareUrl(repoUrl, fromSha, toSha) {
  var url = normalizedGitHubUrl(repoUrl)
  var from = String(fromSha || "")
  var to = String(toSha || "")
  if (url === "" || from === "" || to === "" || from === to) return ""
  return url + "/compare/" + from + "..." + to
}

function kindLabel(kinds, knownKinds) {
  if (!kinds) return ""
  var parts = String(kinds).split(",")
  var labels = []
  for (var i = 0; i < parts.length; i++) {
    var kind = parts[i].trim()
    if (kind === "") continue
    var label = kind
    for (var j = 0; j < knownKinds.length; j++) {
      if (knownKinds[j].value === kind) {
        label = knownKinds[j].label
        break
      }
    }
    labels.push(label)
  }
  return labels.join(", ").toUpperCase()
}

function iconColor(name) {
  var value = String(name || "")
  var hash = 0
  for (var i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  var palette = [
    "#c0392b", "#2980b9", "#27ae60", "#d35400", "#8e44ad",
    "#16a085", "#e67e22", "#2c3e50", "#c0272f", "#21618c",
    "#1e8449", "#b9770e", "#7d3c98", "#117a65", "#ca6f1e"
  ]
  return palette[Math.abs(hash) % palette.length]
}

function commitVerification(entry, commit) {
  if (!entry) return "Not listed"
  if (!entry.verified && entry.snapshotStatus !== "update-unverified") return "Unverified"
  if (!/^[0-9a-f]{40}$/.test(String(commit || ""))
      || !/^[0-9a-f]{40}$/.test(String(entry.snapshotCommit || ""))) return "Verification unavailable"
  return entry.verified && commit === entry.snapshotCommit ? "Verified" : "Update Unverified"
}

function bulkUpdateKeys(rows, states, marketplace, scope, incomingCommits) {
  var sources = Object.create(null)
  var keys = []
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var key = String(row.sourceKey || "")
    if (!key || states[key] !== "UPDATE") continue
    var entry = marketplace[String(row.id)]
    var status = commitVerification(entry, (incomingCommits || {})[key])
    var allowed = scope === "all" || status === "Verified"
      || (scope === "pending" && status === "Update Unverified")
    if (sources[key] === undefined) {
      keys.push(key)
      sources[key] = true
    }
    // A repository updates as a unit: every plugin it contains must qualify.
    sources[key] = sources[key] && allowed
  }
  return keys.filter(function(key) { return sources[key] })
}

// Every repository the last check proved updateable, once each, in row order.
function updatableKeys(rows, states) {
  var seen = Object.create(null)
  var keys = []
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i].sourceKey || "")
    if (!key || seen[key] || states[key] !== "UPDATE") continue
    seen[key] = true
    keys.push(key)
  }
  return keys
}

// Picks on the updates page behave like the per-row UPDATE button, so the bulk
// update scope does not apply. Selections left over from an earlier check are
// dropped once their repository is no longer in the UPDATE state.
function selectedUpdateKeys(rows, states, selection) {
  return updatableKeys(rows, states).filter(function(key) {
    return (selection || {})[key] === true
  })
}

// The selection map without repositories that left the UPDATE state, so a
// pick does not come back checked when a later check finds a new update.
function prunedSelection(rows, states, selection) {
  var next = {}
  var keys = selectedUpdateKeys(rows, states, selection)
  for (var i = 0; i < keys.length; i++) next[keys[i]] = true
  return next
}

var UPDATES_FILTER = 5

// Scope filter choices for the main list. "Updates" is only offered while
// updates are pending, but stays while it is the active filter so the
// dropdown value always has a matching option.
function scopeFilterOptions(pendingCount, currentMode) {
  var options = [
    { value: "0", label: "All plugins" },
    { value: "1", label: "Omarchy" },
    { value: "2", label: "Third-party" }
  ]
  if (pendingCount > 0 || currentMode === UPDATES_FILTER)
    options.push({ value: String(UPDATES_FILTER), label: "Updates (" + pendingCount + ")" })
  return options
}

// A check or an update rewrites states in place (CHECK, then the result), so
// an emptied "Updates" filter is only left once nothing is in flight.
function leaveUpdateFilter(mode, updatableCount, busy) {
  return mode === UPDATES_FILTER && updatableCount === 0 && !busy
}
