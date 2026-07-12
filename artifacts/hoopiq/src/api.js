// API service layer.
//
// This module is the single place that knows how to fetch game data.
// UI components never talk to the network (or to mock data) directly —
// they only call the functions exported here. That means swapping the
// mock implementations below for real `fetch(...)` calls against
// API_BASE_URL later will not require any changes in the UI layer.

import { API_BASE_URL } from "./config";

// ---------------------------------------------------------------------
// Mock "live" data. This stands in for what a real backend would return
// from endpoints like `${API_BASE_URL}/games?league=nba`. It is kept
// private to this file so the rest of the app only ever sees it through
// the service functions below.
// ---------------------------------------------------------------------
const MOCK_GAMES = [
  {
    id: "nba-1",
    league: "nba",
    startTime: "7:30 PM ET",
    status: "in_progress",
    period: "Q3",
    clock: "4:12",
    homeTeam: {
      id: "bos",
      name: "Boston",
      abbreviation: "BOS",
      score: 84,
      players: [
        { id: "p-bos-1", name: "J. Tatum", number: "0", position: "SF", stats: { points: 24, rebounds: 8, assists: 4, steals: 1, blocks: 1, turnovers: 2 } },
        { id: "p-bos-2", name: "J. Brown", number: "7", position: "SG", stats: { points: 19, rebounds: 5, assists: 3, steals: 2, blocks: 0, turnovers: 1 } },
        { id: "p-bos-3", name: "K. Porzingis", number: "8", position: "C", stats: { points: 14, rebounds: 10, assists: 1, steals: 0, blocks: 3, turnovers: 1 } },
        { id: "p-bos-4", name: "D. White", number: "9", position: "PG", stats: { points: 11, rebounds: 3, assists: 6, steals: 1, blocks: 2, turnovers: 0 } },
        { id: "p-bos-5", name: "J. Holiday", number: "4", position: "PG", stats: { points: 8, rebounds: 4, assists: 5, steals: 1, blocks: 0, turnovers: 1 } },
        { id: "p-bos-6", name: "A. Horford", number: "42", position: "C", stats: { points: 5, rebounds: 6, assists: 2, steals: 0, blocks: 1, turnovers: 0 } },
        { id: "p-bos-7", name: "S. Hauser", number: "30", position: "SF", stats: { points: 3, rebounds: 1, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-bos-8", name: "P. Pritchard", number: "11", position: "PG", stats: { points: 0, rebounds: 1, assists: 2, steals: 0, blocks: 0, turnovers: 1 } },
      ],
    },
    awayTeam: {
      id: "mia",
      name: "Miami",
      abbreviation: "MIA",
      score: 79,
      players: [
        { id: "p-mia-1", name: "J. Butler", number: "22", position: "SF", stats: { points: 21, rebounds: 6, assists: 5, steals: 2, blocks: 0, turnovers: 2 } },
        { id: "p-mia-2", name: "B. Adebayo", number: "13", position: "C", stats: { points: 16, rebounds: 11, assists: 4, steals: 1, blocks: 1, turnovers: 3 } },
        { id: "p-mia-3", name: "T. Herro", number: "14", position: "SG", stats: { points: 18, rebounds: 3, assists: 2, steals: 0, blocks: 0, turnovers: 1 } },
        { id: "p-mia-4", name: "T. Rozier", number: "2", position: "PG", stats: { points: 12, rebounds: 2, assists: 6, steals: 1, blocks: 0, turnovers: 2 } },
        { id: "p-mia-5", name: "N. Jovic", number: "5", position: "PF", stats: { points: 7, rebounds: 4, assists: 1, steals: 0, blocks: 1, turnovers: 0 } },
        { id: "p-mia-6", name: "C. Martin", number: "16", position: "SF", stats: { points: 5, rebounds: 3, assists: 1, steals: 1, blocks: 0, turnovers: 1 } },
        { id: "p-mia-7", name: "D. Robinson", number: "55", position: "SG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-mia-8", name: "H. Highsmith", number: "24", position: "PF", stats: { points: 0, rebounds: 2, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
  },
  {
    id: "nba-2",
    league: "nba",
    startTime: "8:00 PM ET",
    status: "scheduled",
    homeTeam: {
      id: "nyk",
      name: "New York",
      abbreviation: "NYK",
      score: null,
      players: [
        { id: "p-nyk-1", name: "J. Brunson", number: "11", position: "PG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-2", name: "J. Randle", number: "30", position: "PF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-3", name: "OG Anunoby", number: "8", position: "SF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-4", name: "D. DiVincenzo", number: "0", position: "SG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-5", name: "I. Hartenstein", number: "55", position: "C", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-6", name: "J. Hart", number: "3", position: "SF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-7", name: "M. Robinson", number: "23", position: "C", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-nyk-8", name: "M. McBride", number: "2", position: "PG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
    awayTeam: {
      id: "phi",
      name: "Philadelphia",
      abbreviation: "PHI",
      score: null,
      players: [
        { id: "p-phi-1", name: "J. Embiid", number: "21", position: "C", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-2", name: "T. Maxey", number: "0", position: "PG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-3", name: "T. Harris", number: "12", position: "PF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-4", name: "K. Oubre Jr.", number: "9", position: "SF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-5", name: "N. Batum", number: "40", position: "SF", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-6", name: "B. Hield", number: "17", position: "SG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-7", name: "P. Reed", number: "44", position: "C", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-phi-8", name: "C. Payne", number: "22", position: "PG", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
  },
  {
    id: "nba-3",
    league: "nba",
    startTime: "10:00 PM ET",
    status: "final",
    homeTeam: {
      id: "den",
      name: "Denver",
      abbreviation: "DEN",
      score: 112,
      players: [
        { id: "p-den-1", name: "N. Jokic", number: "15", position: "C", stats: { points: 28, rebounds: 14, assists: 11, steals: 1, blocks: 1, turnovers: 3 } },
        { id: "p-den-2", name: "J. Murray", number: "27", position: "PG", stats: { points: 22, rebounds: 4, assists: 8, steals: 2, blocks: 0, turnovers: 2 } },
        { id: "p-den-3", name: "M. Porter Jr.", number: "1", position: "SF", stats: { points: 19, rebounds: 7, assists: 1, steals: 0, blocks: 1, turnovers: 1 } },
        { id: "p-den-4", name: "A. Gordon", number: "50", position: "PF", stats: { points: 14, rebounds: 8, assists: 4, steals: 1, blocks: 2, turnovers: 1 } },
        { id: "p-den-5", name: "K. Caldwell-Pope", number: "5", position: "SG", stats: { points: 11, rebounds: 2, assists: 3, steals: 2, blocks: 0, turnovers: 0 } },
        { id: "p-den-6", name: "R. Jackson", number: "7", position: "PG", stats: { points: 8, rebounds: 1, assists: 3, steals: 0, blocks: 0, turnovers: 1 } },
        { id: "p-den-7", name: "C. Braun", number: "0", position: "SG", stats: { points: 6, rebounds: 3, assists: 1, steals: 1, blocks: 0, turnovers: 0 } },
        { id: "p-den-8", name: "P. Watson", number: "8", position: "SF", stats: { points: 4, rebounds: 2, assists: 0, steals: 0, blocks: 1, turnovers: 0 } },
      ],
    },
    awayTeam: {
      id: "lal",
      name: "LA Lakers",
      abbreviation: "LAL",
      score: 105,
      players: [
        { id: "p-lal-1", name: "L. James", number: "23", position: "SF", stats: { points: 26, rebounds: 8, assists: 9, steals: 1, blocks: 1, turnovers: 4 } },
        { id: "p-lal-2", name: "A. Davis", number: "3", position: "C", stats: { points: 24, rebounds: 12, assists: 3, steals: 1, blocks: 3, turnovers: 2 } },
        { id: "p-lal-3", name: "D. Russell", number: "1", position: "PG", stats: { points: 16, rebounds: 3, assists: 6, steals: 0, blocks: 0, turnovers: 3 } },
        { id: "p-lal-4", name: "A. Reaves", number: "15", position: "SG", stats: { points: 14, rebounds: 4, assists: 5, steals: 1, blocks: 0, turnovers: 1 } },
        { id: "p-lal-5", name: "R. Hachimura", number: "28", position: "PF", stats: { points: 12, rebounds: 5, assists: 1, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-lal-6", name: "S. Dinwiddie", number: "26", position: "PG", stats: { points: 8, rebounds: 2, assists: 3, steals: 0, blocks: 0, turnovers: 1 } },
        { id: "p-lal-7", name: "T. Prince", number: "12", position: "SF", stats: { points: 5, rebounds: 3, assists: 0, steals: 1, blocks: 0, turnovers: 0 } },
        { id: "p-lal-8", name: "J. Hayes", number: "11", position: "C", stats: { points: 0, rebounds: 2, assists: 0, steals: 0, blocks: 1, turnovers: 0 } },
      ],
    },
  },
  {
    id: "wnba-1",
    league: "wnba",
    startTime: "7:00 PM ET",
    status: "final",
    homeTeam: {
      id: "ny",
      name: "New York",
      abbreviation: "NYL",
      score: 88,
      players: [
        { id: "p-ny-1", name: "B. Stewart", number: "30", position: "PF", stats: { points: 22, rebounds: 10, assists: 4, steals: 2, blocks: 2, turnovers: 2 } },
        { id: "p-ny-2", name: "S. Ionescu", number: "20", position: "G", stats: { points: 18, rebounds: 5, assists: 8, steals: 1, blocks: 0, turnovers: 3 } },
        { id: "p-ny-3", name: "J. Jones", number: "35", position: "C", stats: { points: 14, rebounds: 12, assists: 2, steals: 0, blocks: 1, turnovers: 1 } },
        { id: "p-ny-4", name: "B. Laney-Hamilton", number: "44", position: "G", stats: { points: 12, rebounds: 4, assists: 3, steals: 1, blocks: 0, turnovers: 1 } },
        { id: "p-ny-5", name: "C. Vandersloot", number: "22", position: "G", stats: { points: 8, rebounds: 3, assists: 9, steals: 2, blocks: 0, turnovers: 2 } },
        { id: "p-ny-6", name: "K. Thornton", number: "13", position: "F", stats: { points: 7, rebounds: 4, assists: 1, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-ny-7", name: "N. Sabally", number: "5", position: "F", stats: { points: 4, rebounds: 2, assists: 0, steals: 0, blocks: 1, turnovers: 1 } },
        { id: "p-ny-8", name: "K. Burke", number: "2", position: "G", stats: { points: 3, rebounds: 1, assists: 1, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
    awayTeam: {
      id: "lv",
      name: "Las Vegas",
      abbreviation: "LVA",
      score: 84,
      players: [
        { id: "p-lv-1", name: "A. Wilson", number: "22", position: "C", stats: { points: 26, rebounds: 11, assists: 2, steals: 1, blocks: 3, turnovers: 2 } },
        { id: "p-lv-2", name: "K. Plum", number: "10", position: "G", stats: { points: 19, rebounds: 2, assists: 5, steals: 1, blocks: 0, turnovers: 3 } },
        { id: "p-lv-3", name: "J. Young", number: "0", position: "G", stats: { points: 16, rebounds: 4, assists: 4, steals: 2, blocks: 0, turnovers: 1 } },
        { id: "p-lv-4", name: "C. Gray", number: "12", position: "G", stats: { points: 10, rebounds: 3, assists: 7, steals: 1, blocks: 0, turnovers: 2 } },
        { id: "p-lv-5", name: "A. Clark", number: "20", position: "F", stats: { points: 8, rebounds: 6, assists: 1, steals: 2, blocks: 0, turnovers: 0 } },
        { id: "p-lv-6", name: "K. Stokes", number: "41", position: "C", stats: { points: 2, rebounds: 5, assists: 0, steals: 0, blocks: 1, turnovers: 0 } },
        { id: "p-lv-7", name: "S. George", number: "1", position: "F", stats: { points: 3, rebounds: 1, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-lv-8", name: "A. Hayes", number: "3", position: "C", stats: { points: 0, rebounds: 2, assists: 0, steals: 0, blocks: 0, turnovers: 1 } },
      ],
    },
  },
  {
    id: "wnba-2",
    league: "wnba",
    startTime: "8:00 PM ET",
    status: "in_progress",
    period: "Q2",
    clock: "6:45",
    homeTeam: {
      id: "sea",
      name: "Seattle",
      abbreviation: "SEA",
      score: 34,
      players: [
        { id: "p-sea-1", name: "J. Loyd", number: "24", position: "G", stats: { points: 12, rebounds: 2, assists: 2, steals: 0, blocks: 0, turnovers: 1 } },
        { id: "p-sea-2", name: "N. Ogwumike", number: "30", position: "F", stats: { points: 8, rebounds: 5, assists: 1, steals: 1, blocks: 1, turnovers: 0 } },
        { id: "p-sea-3", name: "S. Diggins-Smith", number: "4", position: "G", stats: { points: 6, rebounds: 1, assists: 4, steals: 0, blocks: 0, turnovers: 1 } },
        { id: "p-sea-4", name: "E. Magbegor", number: "13", position: "C", stats: { points: 4, rebounds: 4, assists: 1, steals: 0, blocks: 2, turnovers: 0 } },
        { id: "p-sea-5", name: "J. Horston", number: "8", position: "G", stats: { points: 4, rebounds: 2, assists: 0, steals: 1, blocks: 0, turnovers: 0 } },
        { id: "p-sea-6", name: "S. Whitcomb", number: "32", position: "G", stats: { points: 0, rebounds: 0, assists: 1, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-sea-7", name: "M. Russell", number: "21", position: "C", stats: { points: 0, rebounds: 1, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-sea-8", name: "V. Vivians", number: "35", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
    awayTeam: {
      id: "ind",
      name: "Indiana",
      abbreviation: "IND",
      score: 32,
      players: [
        { id: "p-ind-1", name: "C. Clark", number: "22", position: "G", stats: { points: 11, rebounds: 3, assists: 4, steals: 0, blocks: 0, turnovers: 2 } },
        { id: "p-ind-2", name: "A. Boston", number: "7", position: "C", stats: { points: 8, rebounds: 6, assists: 1, steals: 0, blocks: 1, turnovers: 0 } },
        { id: "p-ind-3", name: "K. Mitchell", number: "0", position: "G", stats: { points: 7, rebounds: 1, assists: 0, steals: 1, blocks: 0, turnovers: 1 } },
        { id: "p-ind-4", name: "N. Smith", number: "1", position: "F", stats: { points: 4, rebounds: 3, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-ind-5", name: "K. Samuelson", number: "33", position: "F", stats: { points: 2, rebounds: 1, assists: 1, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-ind-6", name: "L. Hull", number: "10", position: "G", stats: { points: 0, rebounds: 0, assists: 1, steals: 1, blocks: 0, turnovers: 0 } },
        { id: "p-ind-7", name: "T. Fagbenle", number: "14", position: "F", stats: { points: 0, rebounds: 2, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-ind-8", name: "K. Wallace", number: "17", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
  },
  {
    id: "wnba-3",
    league: "wnba",
    startTime: "10:00 PM ET",
    status: "scheduled",
    homeTeam: {
      id: "pho",
      name: "Phoenix",
      abbreviation: "PHO",
      score: null,
      players: [
        { id: "p-pho-1", name: "K. Copper", number: "2", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-2", name: "B. Griner", number: "42", position: "C", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-3", name: "D. Taurasi", number: "3", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-4", name: "N. Cloud", number: "0", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-5", name: "R. Allen", number: "9", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-6", name: "S. Cunningham", number: "12", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-7", name: "M. Mack", number: "11", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-pho-8", name: "S. Sutton", number: "1", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
    awayTeam: {
      id: "min",
      name: "Minnesota",
      abbreviation: "MIN",
      score: null,
      players: [
        { id: "p-min-1", name: "N. Collier", number: "24", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-2", name: "K. McBride", number: "21", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-3", name: "C. Williams", number: "10", position: "G", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-4", name: "A. Smith", number: "8", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-5", name: "B. Carleton", number: "6", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-6", name: "N. Hines-Allen", number: "2", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-7", name: "C. Zandalasini", number: "9", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
        { id: "p-min-8", name: "D. Dantas", number: "14", position: "F", stats: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 } },
      ],
    },
  },
];

/**
 * Fetch today's games for a given league.
 * Real implementation would be:
 *   const res = await fetch(`${API_BASE_URL}/games?league=${league}`);
 *   return res.json();
 *
 * @param {"nba" | "wnba"} league
 * @returns {Promise<object[]>}
 */
export async function fetchGamesByLeague(league) {
  void API_BASE_URL; // referenced here so it's clear where the real base URL would be used
  return MOCK_GAMES.filter((game) => game.league === league);
}

/**
 * Fetch a single game (including full box score) by id.
 * Real implementation would be:
 *   const res = await fetch(`${API_BASE_URL}/games/${gameId}`);
 *   return res.json();
 *
 * @param {string} gameId
 * @returns {Promise<object | undefined>}
 */
export async function fetchGameById(gameId) {
  void API_BASE_URL;
  return MOCK_GAMES.find((game) => game.id === gameId);
}
