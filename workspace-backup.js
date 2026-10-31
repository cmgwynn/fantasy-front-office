(() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const fixedKeys = new Set([
    "fantasy-front-office:newsletter:v1", "fantasy-front-office:gm-feedback:v1",
    "fantasy-front-office:gm-advice-snapshots:v1", "fantasy-front-office:player-alerts",
    "fantasy-front-office:portfolio-rosters"
  ]);
  const isStorageKey = key => fixedKeys.has(key) || /^fantasy-(?:faab|draft|pickem)-v1:[a-z0-9:_-]+$/i.test(key);
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
  const number = value => typeof value === "number" && Number.isFinite(value);
  const id = value => typeof value === "string" && value.length > 0;
  const playerId = value => typeof value === "string" && /^[a-z0-9_:-]+$/i.test(value);
  const ids = value => Array.isArray(value) && value.every(item => typeof item === "string" || Number.isInteger(item));
  const week = value => Number.isInteger(value) && value >= 1 && value <= 18;

  function validateTree(value, depth = 0) {
    requireValue(depth <= 40, "Backup nesting is too deep.");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      requireValue(Number.isFinite(value), "Backup contains a nonfinite number.");
      return;
    }
    if (typeof value === "string") {
      requireValue(!value.includes("<"), "Backup contains markup. Only plain-text workspace data is supported.");
      return;
    }
    requireValue(typeof value === "object", "Backup contains unsupported data.");
    for (const [key, entry] of Object.entries(value)) {
      requireValue(!["__proto__", "prototype", "constructor"].includes(key), "Backup contains an unsafe object key.");
      validateTree(entry, depth + 1);
    }
  }

  function validateSavedEntry(key, text) {
    requireValue(isStorageKey(key) && typeof text === "string", `Unsupported saved-plan key: ${key}`);
    let value;
    try { value = JSON.parse(text); } catch { throw new Error(`Saved plan is not valid JSON: ${key}`); }
    validateTree(value);
    requireValue(object(value) || Array.isArray(value), `Saved plan must be an object or array: ${key}`);
    if (key.startsWith("fantasy-faab-v1:")) {
      requireValue(object(value) && number(value.budget) && value.budget >= 0 &&
        Number.isInteger(value.weeksRemaining) && value.weeksRemaining >= 1 && value.weeksRemaining <= 18 &&
        ["conservative", "balanced", "aggressive"].includes(value.strategy) && Array.isArray(value.claims),
      `Invalid FAAB settings: ${key}`);
      requireValue(value.claims.every(claim => object(claim) && id(claim.playerId) && number(claim.bid) && claim.bid >= 0),
        `Invalid FAAB claims: ${key}`);
    } else if (key.startsWith("fantasy-draft-v1:")) {
      const settings = value.settings;
      requireValue(object(settings) && ["redraft", "keeper", "dynasty"].includes(settings.type) &&
        Number.isInteger(settings.teams) && settings.teams >= 4 && settings.teams <= 32 &&
        Number.isInteger(settings.slot) && settings.slot >= 1 && settings.slot <= settings.teams &&
        Number.isInteger(settings.rounds) && settings.rounds >= 1 && settings.rounds <= 30 &&
        ["standard", "half", "ppr", "tep"].includes(settings.scoring) &&
        ["standard", "superflex", "league"].includes(settings.rosterFormat) &&
        (settings.rosterFormat !== "league" || (Array.isArray(settings.starterSlots) && settings.starterSlots.length > 0 &&
          settings.starterSlots.length <= 40 && settings.starterSlots.every(slot => typeof slot === "string" && slot.length > 0 && slot.length <= 30))) &&
        Array.isArray(value.userPicks) && value.userPicks.every(id) &&
        object(value.adpByName) && Object.values(value.adpByName).every(number) && Array.isArray(value.keepers),
      `Invalid draft session: ${key}`);
    } else if (key === "fantasy-front-office:newsletter:v1") {
      requireValue(object(value) && Object.values(value).every(archive => object(archive) && Object.values(archive).every(issue =>
        object(issue) && id(issue.title) && id(issue.leagueName) && Array.isArray(issue.summary) &&
        issue.summary.every(line => typeof line === "string") && Array.isArray(issue.games) &&
        issue.games.every(game => object(game) && id(game.homeName) && id(game.awayName) && number(game.homeScore) && number(game.awayScore)) &&
        Array.isArray(issue.standings) && issue.standings.every(team => object(team) && id(team.teamName) && id(team.record) && number(team.pointsFor) && number(team.pointsAgainst)) &&
        Array.isArray(issue.actions) && issue.actions.every(action => object(action) && id(action.title) && typeof action.detail === "string") &&
        (issue.nextWeekWatch === undefined || (Array.isArray(issue.nextWeekWatch) && issue.nextWeekWatch.every(line => typeof line === "string"))))),
      "Invalid newsletter archive.");
    } else if (key === "fantasy-front-office:player-alerts") {
      requireValue(object(value) && Array.isArray(value.watchlist) && value.watchlist.every(id) &&
        Array.isArray(value.events) && value.events.every(object) && object(value.snapshots), "Invalid player alerts.");
    } else if (key.startsWith("fantasy-pickem-v1:")) {
      requireValue(key.endsWith(":history") ? Array.isArray(value) && value.every(object) : object(value),
        `Invalid pick'em saves: ${key}`);
    } else {
      requireValue(object(value), `Invalid saved-plan object: ${key}`);
      if (key.includes("gm-feedback") || key.includes("gm-advice-snapshots")) {
        requireValue(Object.values(value).every(object), `Invalid Inbox records: ${key}`);
      }
    }
    return value;
  }

  function validateBackup(backup) {
    requireValue(object(backup) && backup.format === "fantasy-front-office-workspace" && backup.version === 1,
      "Unsupported backup format or version. Choose a version 1 Fantasy Front Office workspace backup.");
    validateTree(backup);
    requireValue(id(backup.savedAt) && Number.isFinite(Date.parse(backup.savedAt)), "Backup date is invalid.");
    const snapshot = backup.snapshot;
    requireValue(object(snapshot) && /^\d{4}$/.test(snapshot.season) && week(snapshot.week) &&
      ["sleeper", "espn", "yahoo"].includes(snapshot.provider), "Invalid workspace season, week, or provider.");
    const league = snapshot.activeLeague;
    requireValue(object(league) && league.provider === snapshot.provider && id(String(league.leagueId || "")) &&
      id(league.name) && /^\d{4}$/.test(league.season) && Array.isArray(league.rosterPositions) &&
      league.rosterPositions.length > 0 && league.rosterPositions.length <= 100 &&
      league.rosterPositions.every(id) && object(league.scoringSettings), "Invalid league snapshot or roster settings.");
    requireValue(Object.values(league.scoringSettings).every(number) &&
      ["totalTeams", "leagueType", "draftRounds", "playoffTeams", "playoffWeekStart", "playoffSeedType", "playoffRoundType"]
        .every(field => league[field] === undefined || number(league[field])),
    "Invalid league scoring or season settings.");
    requireValue(object(snapshot.players) && Object.keys(snapshot.players).length > 0, "Backup has no player data.");
    for (const [key, player] of Object.entries(snapshot.players)) {
      requireValue(object(player) && player.id === key && playerId(key) && id(player.name) && typeof player.position === "string" &&
        typeof player.team === "string" && ["projectedPoints", "seasonPpg", "baseValue", "posRank", "ovrRank"].every(field => number(player[field])) &&
        (player.isPick === true || number(player.vorpScore)) &&
        (player.injuryStatus === undefined || typeof player.injuryStatus === "string"), `Invalid player snapshot: ${key}`);
      requireValue(["age", "exp", "byeWeek", "searchRank", "adp", "snapSharePct", "targetsPerGame", "receptionsPerGame",
        "rushAttPerGame", "touchesPerGame", "passYdsPerGame", "passTdPerGame", "sacksPerGame", "takeawaysPerGame",
        "fgMadePerGame", "tprrPct", "yprrVal", "yptoeVal", "goldTouchesPerGame", "ryoePerGame", "cpoeVal",
        "epaPerPlay", "defPlaysPerGame"].every(field => player[field] === undefined || player[field] === null || number(player[field])),
      `Invalid player metric: ${key}`);
      requireValue(player.importedPlanningBye === undefined || player.importedPlanningBye === null || week(player.importedPlanningBye),
        `Invalid player bye snapshot: ${key}`);
    }
    const managers = snapshot.managers;
    requireValue(Array.isArray(managers) && managers.length > 0 && managers.length <= 64 && managers.every(object) &&
      new Set(managers.map(manager => String(manager.rosterId))).size === managers.length, "Invalid or duplicate league rosters.");
    for (const manager of managers) {
      requireValue(object(manager) && /^[1-9]\d*$/.test(String(manager.rosterId)) && id(manager.teamName) &&
        ["players", "starters", "reserve", "taxi"].every(field => ids(manager[field])) &&
        ["wins", "losses", "pf", "pa", "maxPf", "eff", "rosPpg", "allPlayW", "allPlayL", "luck", "power", "week1Rank", "currentRank", "projW", "projL", "playoffPct"].every(field => number(manager[field])) &&
        Array.isArray(manager.ownedPicks) && manager.ownedPicks.every(object) && Array.isArray(manager.history) && manager.history.every(number),
      "Invalid manager data.");
      requireValue([...manager.players, ...manager.reserve, ...manager.taxi].every(playerId => snapshot.players[String(playerId)]),
        `Roster references missing players: ${manager.teamName}`);
      requireValue(manager.starters.every(playerId => String(playerId) === "0" || snapshot.players[String(playerId)]),
        `Starter references missing players: ${manager.teamName}`);
      requireValue(manager.ownedPicks.every(pick => playerId(pick.id) && snapshot.players[pick.id]?.isPick === true && number(pick.baseValue)),
        `Invalid owned draft picks: ${manager.teamName}`);
    }
    requireValue(object(snapshot.rawProj) && object(snapshot.rawStats) && Array.isArray(snapshot.currentMatchups) &&
      object(snapshot.livePlayerPoints) && Object.values(snapshot.livePlayerPoints).every(number) &&
      object(snapshot.portfolioRosterSelections) && object(snapshot.dataFreshness) && object(snapshot.dataErrors),
    "Invalid workspace source data.");
    requireValue(Object.values(snapshot.dataFreshness).every(number) && Object.values(snapshot.dataErrors).every(message => typeof message === "string"),
      "Invalid source freshness data.");
    const ui = backup.ui;
    requireValue(object(ui) && Number.isInteger(ui.teamIndex) && ui.teamIndex >= 0 && ui.teamIndex < managers.length &&
      typeof ui.tab === "string" && /^tab-[a-z-]+$/.test(ui.tab) && object(ui.planner) &&
      [2, 4, 6].includes(ui.planner.weeks) && typeof ui.planner.holdInjuries === "boolean" &&
      ["search", "addId", "dropId"].every(key => typeof ui.planner[key] === "string"),
    "Invalid saved workspace view or planner settings.");
    requireValue(object(backup.storage), "Saved plans are missing.");
    Object.entries(backup.storage).forEach(([key, text]) => validateSavedEntry(key, text));
    requireValue(object(backup.records) && Array.isArray(backup.records.games) && typeof backup.records.source === "string" &&
      typeof backup.records.coverage === "string" && Array.isArray(backup.records.errors) && backup.records.errors.every(message => typeof message === "string"),
    "Invalid completed-result cache.");
    window.FFORecords.validateGames(backup.records.games);
    if (backup.careerHistory !== undefined && backup.careerHistory !== null) {
      const history = backup.careerHistory;
      requireValue(object(history) && Array.isArray(history.seasons) && history.seasons.length <= 10 &&
        Array.isArray(history.errors) && history.errors.every(error => typeof error === "string") &&
        typeof history.coverage === "string" && typeof history.complete === "boolean" &&
        (history.source === undefined || typeof history.source === "string") &&
        history.seasons.every(season => object(season) && typeof season.coverage === "string" &&
          id(season.leagueId) && Array.isArray(season.errors) && season.errors.every(error => typeof error === "string")),
      "Invalid career-history snapshot.");
      window.FFORecords.summarizeHistory(history.seasons);
    }
    const rosterIds = new Set(managers.map(manager => String(manager.rosterId)));
    requireValue(backup.records.games.every(game => rosterIds.has(String(game.homeId)) && rosterIds.has(String(game.awayId))),
      "Completed results reference a roster not in this backup.");
    return backup;
  }

  function parseBackup(text) {
    requireValue(typeof text === "string" && new TextEncoder().encode(text).length <= MAX_BYTES, "Backup exceeds the 25 MB limit.");
    let value;
    try { value = JSON.parse(text); } catch { throw new Error("Backup is not valid JSON."); }
    return validateBackup(value);
  }

  function captureStorage(storage, validate = true) {
    const entries = {};
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (isStorageKey(key)) {
        const text = storage.getItem(key);
        if (validate) validateSavedEntry(key, text);
        entries[key] = text;
      }
    }
    return entries;
  }

  async function restoreBackup(backup, storage, persist) {
    validateBackup(backup);
    const previous = captureStorage(storage, false);
    const replace = entries => {
      const keys = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (isStorageKey(key)) keys.push(key);
      }
      keys.forEach(key => storage.removeItem(key));
      Object.entries(entries).forEach(([key, value]) => storage.setItem(key, value));
    };
    try {
      replace(backup.storage);
      await persist(backup);
    } catch (error) {
      try { replace(previous); } catch (rollbackError) {
        throw new Error(`Restore failed and local-plan rollback failed. Keep your downloaded backup. ${error.message}; ${rollbackError.message}`);
      }
      throw new Error(`Restore failed; previous local plans were restored. ${error.message}`);
    }
  }

  window.FFOWorkspace = Object.freeze({ MAX_BYTES, isStorageKey, validateBackup, parseBackup, captureStorage, restoreBackup });
})();
