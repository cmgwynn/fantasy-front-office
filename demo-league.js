(() => {
  function createDemoLeague() {
    const positions = ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "WR", "QB", "TE"];
    const scores = [21, 7, 13, 16, 11, 9, 19, 14, 17, 8];
    return {
      leagueName: "Demo Front Office League",
      season: String(new Date().getFullYear()),
      currentWeek: 6,
      playoffTeams: 4,
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"],
      scoringSettings: { rec: 1 },
      completedMatchups: [
        { week: 1, completed: true, homeId: "1", awayId: "2", homeScore: 132, awayScore: 118 },
        { week: 1, completed: true, homeId: "3", awayId: "4", homeScore: 105, awayScore: 106 },
        { week: 2, completed: true, homeId: "2", awayId: "1", homeScore: 121, awayScore: 121 },
        { week: 2, completed: true, homeId: "4", awayId: "3", homeScore: 95, awayScore: 140 }
      ],
      freeAgents: ["RB", "WR", "TE", "QB"].map((position, index) => ({
        playerId: `demo_free_${index}`, name: `Sample Free Agent ${position}`,
        position, nflTeam: "KC", projectedPoints: 22 - index,
        seasonPpg: 18 - index, injuryStatus: "Healthy", planningByeWeek: 10
      })),
      teams: ["Harbor Hawks", "Summit Wolves", "Metro Owls", "Coastal Foxes"].map((teamName, teamIndex) => ({
        teamName, manager: `Sample Manager ${teamIndex + 1}`,
        wins: 4 - teamIndex, losses: 1 + teamIndex,
        pointsFor: 650 - teamIndex * 30, pointsAgainst: 580 + teamIndex * 20,
        players: positions.map((position, index) => ({
          playerId: `demo_${teamIndex}_${index}`,
          name: `Sample ${position} ${teamIndex + 1}-${index + 1}`,
          position, nflTeam: ["KC", "BUF", "SF", "NE"][teamIndex],
          projectedPoints: scores[index] + teamIndex,
          seasonPpg: scores[index] + teamIndex,
          starter: index < 7,
          injuryStatus: teamIndex === 0 && index === 1 ? "Out" : "Healthy",
          planningByeWeek: index < 3 ? 7 : (index < 6 ? 8 : 9)
        }))
      }))
    };
  }
  function createDemoHistory() {
    const current = createDemoLeague();
    const year = Number(current.season);
    const teams = current.teams.map((team, index) => ({
      rosterId: String(index + 1), ownerId: `demo-manager-${index + 1}`, name: team.teamName
    }));
    return { source: "Fictional demo matchup results", errors: [], complete: true,
      coverage: "Two fictional seasons for illustration; not real league history.",
      seasons: [
        { season: String(year - 1), leagueId: "demo-prior", teams,
          games: [
            { week: 1, completed: true, homeId: "1", awayId: "3", homeScore: 110, awayScore: 104 },
            { week: 1, completed: true, homeId: "2", awayId: "4", homeScore: 120, awayScore: 120 },
            { week: 2, completed: true, homeId: "3", awayId: "1", homeScore: 115, awayScore: 90 },
            { week: 2, completed: true, homeId: "4", awayId: "2", homeScore: 98, awayScore: 125 }
          ], errors: [], coverage: "Two supplied fictional regular-season weeks." },
        { season: current.season, leagueId: "demo-current", teams,
          games: current.completedMatchups, errors: [], coverage: "Two supplied fictional regular-season weeks." }
      ] };
  }
  window.FFODemo = Object.freeze({ createDemoLeague, createDemoHistory });
})();
