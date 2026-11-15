// Missions: jobs worth coins — three a day and one big one a week.
//
// Everybody gets the same set on the same day: they are picked from the date itself, not at
// random, so they do not change under you when you reload, and you and a friend can compare them.
//
// Build 121: 200 more of them (184 daily, 35 weekly in all), dealt out so they do not come round
// again for a long time: each day gets the jobs that have waited longest (about two months before a
// daily one comes back, the better part of a year for a weekly one). On any
// one day the three are never two of the same kind ("score 5 goals" and "score 8 goals"), and at
// most one of them needs you to play online, so somebody playing offline can always finish two.
// The weekly one is never online-only. Online matches count too (before build 121 only matches
// played on this device did).

// ---------------------------------------------------------------- missions
// kind: what counts. n: how many. coins: what it pays. where: only matches of that sort count
// ('1v1'..'4v4', 'pro', 'club', 'country', 'cup', 'hard', 'online').
const MISSION_POOL = [
  { id: 'play3', kind: 'play', n: 3, coins: 300, text: tl('Play {n} matches') },
  { id: 'win2', kind: 'win', n: 2, coins: 450, text: tl('Win {n} matches') },
  { id: 'win4', kind: 'win', n: 4, coins: 800, text: tl('Win {n} matches') },
  { id: 'goals6', kind: 'goals', n: 6, coins: 420, text: tl('Score {n} goals') },
  { id: 'goals12', kind: 'goals', n: 12, coins: 750, text: tl('Score {n} goals') },
  { id: 'online2', kind: 'onlineWin', n: 2, coins: 700, text: tl('Win {n} online matches') },
  { id: 'skills8', kind: 'skills', n: 8, coins: 380, text: tl('Pull off {n} skills') },
  { id: 'tackles10', kind: 'tackles', n: 10, coins: 360, text: tl('Win {n} tackles') },
  { id: 'assists3', kind: 'assists', n: 3, coins: 480, text: tl('Set up {n} goals') },
  { id: 'power2', kind: 'powerGoal', n: 2, coins: 520, text: tl('Score {n} power-shot goals') },
  { id: 'clean1', kind: 'cleanSheet', n: 1, coins: 500, text: tl('Win without letting one in') },
  { id: 'pens1', kind: 'pensWin', n: 1, coins: 550, text: tl('Win a shootout') },
  { id: 'hat1', kind: 'hattrick', n: 1, coins: 650, text: tl('Score a hat-trick') },
  { id: 'saves6', kind: 'saves', n: 6, coins: 400, text: tl('Keep {n} shots out') },
  // ---- build 121: 170 more
  { id: 'd-play-2', kind: 'play', n: 2, coins: 430, text: tl("Play {n} matches") },
  { id: 'd-play-4', kind: 'play', n: 4, coins: 690, text: tl("Play {n} matches") },
  { id: 'd-play-5', kind: 'play', n: 5, coins: 820, text: tl("Play {n} matches") },
  { id: 'd-win-1', kind: 'win', n: 1, coins: 410, text: tl("Win a match") },
  { id: 'd-win-3', kind: 'win', n: 3, coins: 880, text: tl("Win {n} matches") },
  { id: 'd-goals-3', kind: 'goals', n: 3, coins: 370, text: tl("Score {n} goals") },
  { id: 'd-goals-5', kind: 'goals', n: 5, coins: 500, text: tl("Score {n} goals") },
  { id: 'd-goals-8', kind: 'goals', n: 8, coins: 690, text: tl("Score {n} goals") },
  { id: 'd-goals-10', kind: 'goals', n: 10, coins: 820, text: tl("Score {n} goals") },
  { id: 'd-assists-1', kind: 'assists', n: 1, coins: 330, text: tl("Set up a goal") },
  { id: 'd-assists-2', kind: 'assists', n: 2, coins: 500, text: tl("Set up {n} goals") },
  { id: 'd-assists-4', kind: 'assists', n: 4, coins: 820, text: tl("Set up {n} goals") },
  { id: 'd-assists-5', kind: 'assists', n: 5, coins: 900, text: tl("Set up {n} goals") },
  { id: 'd-skills-3', kind: 'skills', n: 3, coins: 300, text: tl("Pull off {n} skills") },
  { id: 'd-skills-5', kind: 'skills', n: 5, coins: 390, text: tl("Pull off {n} skills") },
  { id: 'd-skills-10', kind: 'skills', n: 10, coins: 600, text: tl("Pull off {n} skills") },
  { id: 'd-skills-15', kind: 'skills', n: 15, coins: 820, text: tl("Pull off {n} skills") },
  { id: 'd-tackles-3', kind: 'tackles', n: 3, coins: 280, text: tl("Win {n} tackles") },
  { id: 'd-tackles-5', kind: 'tackles', n: 5, coins: 360, text: tl("Win {n} tackles") },
  { id: 'd-tackles-8', kind: 'tackles', n: 8, coins: 470, text: tl("Win {n} tackles") },
  { id: 'd-tackles-12', kind: 'tackles', n: 12, coins: 620, text: tl("Win {n} tackles") },
  { id: 'd-saves-3', kind: 'saves', n: 3, coins: 330, text: tl("Keep {n} shots out") },
  { id: 'd-saves-4', kind: 'saves', n: 4, coins: 380, text: tl("Keep {n} shots out") },
  { id: 'd-saves-8', kind: 'saves', n: 8, coins: 590, text: tl("Keep {n} shots out") },
  { id: 'd-saves-10', kind: 'saves', n: 10, coins: 690, text: tl("Keep {n} shots out") },
  { id: 'd-shots-5', kind: 'shots', n: 5, coins: 300, text: tl("Take {n} shots") },
  { id: 'd-shots-10', kind: 'shots', n: 10, coins: 430, text: tl("Take {n} shots") },
  { id: 'd-shots-15', kind: 'shots', n: 15, coins: 560, text: tl("Take {n} shots") },
  { id: 'd-shots-20', kind: 'shots', n: 20, coins: 690, text: tl("Take {n} shots") },
  { id: 'd-passes-10', kind: 'passes', n: 10, coins: 300, text: tl("Make {n} passes") },
  { id: 'd-passes-20', kind: 'passes', n: 20, coins: 430, text: tl("Make {n} passes") },
  { id: 'd-passes-30', kind: 'passes', n: 30, coins: 560, text: tl("Make {n} passes") },
  { id: 'd-passes-40', kind: 'passes', n: 40, coins: 690, text: tl("Make {n} passes") },
  { id: 'd-dodges-1', kind: 'dodges', n: 1, coins: 280, text: tl("Dodge a tackle") },
  { id: 'd-dodges-2', kind: 'dodges', n: 2, coins: 390, text: tl("Dodge {n} tackles") },
  { id: 'd-dodges-3', kind: 'dodges', n: 3, coins: 500, text: tl("Dodge {n} tackles") },
  { id: 'd-dodges-5', kind: 'dodges', n: 5, coins: 710, text: tl("Dodge {n} tackles") },
  { id: 'd-steals-3', kind: 'steals', n: 3, coins: 300, text: tl("Win the ball back {n} times") },
  { id: 'd-steals-5', kind: 'steals', n: 5, coins: 390, text: tl("Win the ball back {n} times") },
  { id: 'd-steals-8', kind: 'steals', n: 8, coins: 520, text: tl("Win the ball back {n} times") },
  { id: 'd-powergoal-1', kind: 'powerGoal', n: 1, coins: 540, text: tl("Score a power-shot goal") },
  { id: 'd-curlgoal-1', kind: 'curlGoal', n: 1, coins: 600, text: tl("Score a curling goal") },
  { id: 'd-curlgoal-2', kind: 'curlGoal', n: 2, coins: 900, text: tl("Score {n} curling goals") },
  { id: 'd-nutmeg-1', kind: 'nutmeg', n: 1, coins: 600, text: tl("Nutmeg someone") },
  { id: 'd-nutmeg-2', kind: 'nutmeg', n: 2, coins: 900, text: tl("Nutmeg {n} players") },
  { id: 'd-brace-1', kind: 'brace', n: 1, coins: 430, text: tl("Score twice in a match") },
  { id: 'd-brace-2', kind: 'brace', n: 2, coins: 690, text: tl("Score twice in {n} matches") },
  { id: 'd-brace-3', kind: 'brace', n: 3, coins: 900, text: tl("Score twice in {n} matches") },
  { id: 'd-bigwin-1', kind: 'bigWin', n: 1, coins: 690, text: tl("Win by 3 goals or more") },
  { id: 'd-goalfest-1', kind: 'goalFest', n: 1, coins: 540, text: tl("Play a match with 6 goals or more in it") },
  { id: 'd-goalfest-2', kind: 'goalFest', n: 2, coins: 900, text: tl("Play {n} matches with 6 goals or more in them") },
  { id: 'd-skillsin-1', kind: 'skillsIn', n: 1, coins: 600, text: tl("Pull off 5 skills in one match") },
  { id: 'd-tacklesin-1', kind: 'tacklesIn', n: 1, coins: 600, text: tl("Win 5 tackles in one match") },
  { id: 'd-assistsin-1', kind: 'assistsIn', n: 1, coins: 820, text: tl("Set up 2 goals in one match") },
  { id: 'd-play-1v1-2', kind: 'play', n: 2, coins: 480, where: '1v1', text: tl("Play {n} 1v1 matches") },
  { id: 'd-play-1v1-3', kind: 'play', n: 3, coins: 610, where: '1v1', text: tl("Play {n} 1v1 matches") },
  { id: 'd-win-1v1-1', kind: 'win', n: 1, coins: 460, where: '1v1', text: tl("Win a 1v1 match") },
  { id: 'd-win-1v1-2', kind: 'win', n: 2, coins: 690, where: '1v1', text: tl("Win {n} 1v1 matches") },
  { id: 'd-win-1v1-3', kind: 'win', n: 3, coins: 900, where: '1v1', text: tl("Win {n} 1v1 matches") },
  { id: 'd-play-2v2-2', kind: 'play', n: 2, coins: 480, where: '2v2', text: tl("Play {n} 2v2 matches") },
  { id: 'd-play-2v2-3', kind: 'play', n: 3, coins: 610, where: '2v2', text: tl("Play {n} 2v2 matches") },
  { id: 'd-win-2v2-1', kind: 'win', n: 1, coins: 460, where: '2v2', text: tl("Win a 2v2 match") },
  { id: 'd-win-2v2-2', kind: 'win', n: 2, coins: 690, where: '2v2', text: tl("Win {n} 2v2 matches") },
  { id: 'd-play-3v3-2', kind: 'play', n: 2, coins: 480, where: '3v3', text: tl("Play {n} 3v3 matches") },
  { id: 'd-play-3v3-3', kind: 'play', n: 3, coins: 610, where: '3v3', text: tl("Play {n} 3v3 matches") },
  { id: 'd-win-3v3-1', kind: 'win', n: 1, coins: 460, where: '3v3', text: tl("Win a 3v3 match") },
  { id: 'd-win-3v3-2', kind: 'win', n: 2, coins: 690, where: '3v3', text: tl("Win {n} 3v3 matches") },
  { id: 'd-play-4v4-2', kind: 'play', n: 2, coins: 480, where: '4v4', text: tl("Play {n} 4v4 matches") },
  { id: 'd-play-4v4-3', kind: 'play', n: 3, coins: 610, where: '4v4', text: tl("Play {n} 4v4 matches") },
  { id: 'd-win-4v4-1', kind: 'win', n: 1, coins: 460, where: '4v4', text: tl("Win a 4v4 match") },
  { id: 'd-win-4v4-2', kind: 'win', n: 2, coins: 690, where: '4v4', text: tl("Win {n} 4v4 matches") },
  { id: 'd-goals-1v1-3', kind: 'goals', n: 3, coins: 420, where: '1v1', text: tl("Score {n} goals in 1v1 matches") },
  { id: 'd-goals-1v1-5', kind: 'goals', n: 5, coins: 550, where: '1v1', text: tl("Score {n} goals in 1v1 matches") },
  { id: 'd-goals-2v2-3', kind: 'goals', n: 3, coins: 420, where: '2v2', text: tl("Score {n} goals in 2v2 matches") },
  { id: 'd-goals-2v2-5', kind: 'goals', n: 5, coins: 550, where: '2v2', text: tl("Score {n} goals in 2v2 matches") },
  { id: 'd-goals-3v3-3', kind: 'goals', n: 3, coins: 420, where: '3v3', text: tl("Score {n} goals in 3v3 matches") },
  { id: 'd-goals-3v3-5', kind: 'goals', n: 5, coins: 550, where: '3v3', text: tl("Score {n} goals in 3v3 matches") },
  { id: 'd-goals-4v4-3', kind: 'goals', n: 3, coins: 420, where: '4v4', text: tl("Score {n} goals in 4v4 matches") },
  { id: 'd-goals-4v4-5', kind: 'goals', n: 5, coins: 550, where: '4v4', text: tl("Score {n} goals in 4v4 matches") },
  { id: 'd-assists-2v2-2', kind: 'assists', n: 2, coins: 550, where: '2v2', text: tl("Set up {n} goals in 2v2 matches") },
  { id: 'd-assists-2v2-3', kind: 'assists', n: 3, coins: 710, where: '2v2', text: tl("Set up {n} goals in 2v2 matches") },
  { id: 'd-assists-4v4-2', kind: 'assists', n: 2, coins: 550, where: '4v4', text: tl("Set up {n} goals in 4v4 matches") },
  { id: 'd-assists-4v4-3', kind: 'assists', n: 3, coins: 710, where: '4v4', text: tl("Set up {n} goals in 4v4 matches") },
  { id: 'd-cleansheet-1v1-1', kind: 'cleanSheet', n: 1, coins: 900, where: '1v1', text: tl("Win a 1v1 match without letting one in") },
  { id: 'd-tackles-3v3-5', kind: 'tackles', n: 5, coins: 410, where: '3v3', text: tl("Win {n} tackles in 3v3 matches") },
  { id: 'd-tackles-3v3-8', kind: 'tackles', n: 8, coins: 520, where: '3v3', text: tl("Win {n} tackles in 3v3 matches") },
  { id: 'd-skills-1v1-5', kind: 'skills', n: 5, coins: 440, where: '1v1', text: tl("Pull off {n} skills in 1v1 matches") },
  { id: 'd-skills-4v4-6', kind: 'skills', n: 6, coins: 480, where: '4v4', text: tl("Pull off {n} skills in 4v4 matches") },
  { id: 'd-shots-2v2-10', kind: 'shots', n: 10, coins: 480, where: '2v2', text: tl("Take {n} shots in 2v2 matches") },
  { id: 'd-passes-3v3-15', kind: 'passes', n: 15, coins: 420, where: '3v3', text: tl("Make {n} passes in 3v3 matches") },
  { id: 'd-passes-4v4-15', kind: 'passes', n: 15, coins: 420, where: '4v4', text: tl("Make {n} passes in 4v4 matches") },
  { id: 'd-saves-4v4-5', kind: 'saves', n: 5, coins: 480, where: '4v4', text: tl("Keep {n} shots out in 4v4 matches") },
  { id: 'd-play-pro-1', kind: 'play', n: 1, coins: 350, where: 'pro', text: tl("Play a PRO MATCH") },
  { id: 'd-play-pro-2', kind: 'play', n: 2, coins: 480, where: 'pro', text: tl("Play {n} PRO MATCH games") },
  { id: 'd-play-pro-3', kind: 'play', n: 3, coins: 610, where: 'pro', text: tl("Play {n} PRO MATCH games") },
  { id: 'd-win-pro-1', kind: 'win', n: 1, coins: 460, where: 'pro', text: tl("Win a PRO MATCH") },
  { id: 'd-win-pro-2', kind: 'win', n: 2, coins: 690, where: 'pro', text: tl("Win {n} PRO MATCH games") },
  { id: 'd-goals-pro-3', kind: 'goals', n: 3, coins: 420, where: 'pro', text: tl("Score {n} goals in PRO MATCH") },
  { id: 'd-goals-pro-5', kind: 'goals', n: 5, coins: 550, where: 'pro', text: tl("Score {n} goals in PRO MATCH") },
  { id: 'd-assists-pro-2', kind: 'assists', n: 2, coins: 550, where: 'pro', text: tl("Set up {n} goals in PRO MATCH") },
  { id: 'd-shots-pro-8', kind: 'shots', n: 8, coins: 430, where: 'pro', text: tl("Take {n} shots in PRO MATCH") },
  { id: 'd-tackles-pro-6', kind: 'tackles', n: 6, coins: 440, where: 'pro', text: tl("Win {n} tackles in PRO MATCH") },
  { id: 'd-play-club-2', kind: 'play', n: 2, coins: 480, where: 'club', text: tl("Play {n} matches for a club") },
  { id: 'd-play-club-3', kind: 'play', n: 3, coins: 610, where: 'club', text: tl("Play {n} matches for a club") },
  { id: 'd-win-club-1', kind: 'win', n: 1, coins: 460, where: 'club', text: tl("Win a match for a club") },
  { id: 'd-win-club-2', kind: 'win', n: 2, coins: 690, where: 'club', text: tl("Win {n} matches for a club") },
  { id: 'd-win-club-3', kind: 'win', n: 3, coins: 900, where: 'club', text: tl("Win {n} matches for a club") },
  { id: 'd-goals-club-3', kind: 'goals', n: 3, coins: 420, where: 'club', text: tl("Score {n} goals for a club") },
  { id: 'd-goals-club-5', kind: 'goals', n: 5, coins: 550, where: 'club', text: tl("Score {n} goals for a club") },
  { id: 'd-goals-club-8', kind: 'goals', n: 8, coins: 740, where: 'club', text: tl("Score {n} goals for a club") },
  { id: 'd-assists-club-2', kind: 'assists', n: 2, coins: 550, where: 'club', text: tl("Set up {n} goals for a club") },
  { id: 'd-skills-club-6', kind: 'skills', n: 6, coins: 480, where: 'club', text: tl("Pull off {n} skills for a club") },
  { id: 'd-win-country-1', kind: 'win', n: 1, coins: 460, where: 'country', text: tl("Win a match for your country") },
  { id: 'd-win-country-2', kind: 'win', n: 2, coins: 690, where: 'country', text: tl("Win {n} matches for your country") },
  { id: 'd-win-country-3', kind: 'win', n: 3, coins: 900, where: 'country', text: tl("Win {n} matches for your country") },
  { id: 'd-goals-country-3', kind: 'goals', n: 3, coins: 420, where: 'country', text: tl("Score {n} goals for your country") },
  { id: 'd-goals-country-5', kind: 'goals', n: 5, coins: 550, where: 'country', text: tl("Score {n} goals for your country") },
  { id: 'd-tackles-country-8', kind: 'tackles', n: 8, coins: 520, where: 'country', text: tl("Win {n} tackles for your country") },
  { id: 'd-cupplay-2', kind: 'cupPlay', n: 2, coins: 430, text: tl("Play {n} cup matches") },
  { id: 'd-cupplay-3', kind: 'cupPlay', n: 3, coins: 560, text: tl("Play {n} cup matches") },
  { id: 'd-cupwin-1', kind: 'cupWin', n: 1, coins: 410, text: tl("Win a cup match") },
  { id: 'd-cupwin-2', kind: 'cupWin', n: 2, coins: 640, text: tl("Win {n} cup matches") },
  { id: 'd-cupwin-3', kind: 'cupWin', n: 3, coins: 880, text: tl("Win {n} cup matches") },
  { id: 'd-goals-cup-3', kind: 'goals', n: 3, coins: 420, where: 'cup', text: tl("Score {n} goals in cup matches") },
  { id: 'd-goals-cup-5', kind: 'goals', n: 5, coins: 550, where: 'cup', text: tl("Score {n} goals in cup matches") },
  { id: 'd-assists-cup-2', kind: 'assists', n: 2, coins: 550, where: 'cup', text: tl("Set up {n} goals in cup matches") },
  { id: 'd-pensplay-1', kind: 'pensPlay', n: 1, coins: 250, text: tl("Play a penalty shootout") },
  { id: 'd-pensplay-2', kind: 'pensPlay', n: 2, coins: 300, text: tl("Play {n} penalty shootouts") },
  { id: 'd-penswin-2', kind: 'pensWin', n: 2, coins: 430, text: tl("Win {n} shootouts") },
  { id: 'd-penswin-3', kind: 'pensWin', n: 3, coins: 560, text: tl("Win {n} shootouts") },
  { id: 'd-pensscored-4', kind: 'pensScored', n: 4, coins: 250, text: tl("Score {n} penalties") },
  { id: 'd-pensscored-6', kind: 'pensScored', n: 6, coins: 280, text: tl("Score {n} penalties") },
  { id: 'd-pensscored-8', kind: 'pensScored', n: 8, coins: 320, text: tl("Score {n} penalties") },
  { id: 'd-pensscored-10', kind: 'pensScored', n: 10, coins: 360, text: tl("Score {n} penalties") },
  { id: 'd-penssaved-1', kind: 'pensSaved', n: 1, coins: 250, text: tl("Save a penalty") },
  { id: 'd-penssaved-2', kind: 'pensSaved', n: 2, coins: 260, text: tl("Save {n} penalties") },
  { id: 'd-penssaved-3', kind: 'pensSaved', n: 3, coins: 300, text: tl("Save {n} penalties") },
  { id: 'd-fkplay-1', kind: 'fkPlay', n: 1, coins: 250, text: tl("Play a free-kick shootout") },
  { id: 'd-fkplay-2', kind: 'fkPlay', n: 2, coins: 300, text: tl("Play {n} free-kick shootouts") },
  { id: 'd-fkwin-1', kind: 'fkWin', n: 1, coins: 300, text: tl("Win a free-kick shootout") },
  { id: 'd-fkwin-2', kind: 'fkWin', n: 2, coins: 430, text: tl("Win {n} free-kick shootouts") },
  { id: 'd-fkscored-2', kind: 'fkScored', n: 2, coins: 250, text: tl("Score {n} free kicks") },
  { id: 'd-fkscored-3', kind: 'fkScored', n: 3, coins: 280, text: tl("Score {n} free kicks") },
  { id: 'd-fkscored-5', kind: 'fkScored', n: 5, coins: 350, text: tl("Score {n} free kicks") },
  { id: 'd-win-hard-1', kind: 'win', n: 1, coins: 460, where: 'hard', text: tl("Win a match on HARD") },
  { id: 'd-win-hard-2', kind: 'win', n: 2, coins: 690, where: 'hard', text: tl("Win {n} matches on HARD") },
  { id: 'd-goals-hard-3', kind: 'goals', n: 3, coins: 420, where: 'hard', text: tl("Score {n} goals on HARD") },
  { id: 'd-onlineplay-1', kind: 'onlinePlay', n: 1, coins: 400, text: tl("Play an online match") },
  { id: 'd-onlineplay-2', kind: 'onlinePlay', n: 2, coins: 530, text: tl("Play {n} online matches") },
  { id: 'd-onlineplay-3', kind: 'onlinePlay', n: 3, coins: 660, text: tl("Play {n} online matches") },
  { id: 'd-onlineplay-4', kind: 'onlinePlay', n: 4, coins: 790, text: tl("Play {n} online matches") },
  { id: 'd-onlinewin-1', kind: 'onlineWin', n: 1, coins: 560, text: tl("Win an online match") },
  { id: 'd-onlinewin-3', kind: 'onlineWin', n: 3, coins: 900, text: tl("Win {n} online matches") },
  { id: 'd-rankedplay-1', kind: 'rankedPlay', n: 1, coins: 400, text: tl("Play a ranked match") },
  { id: 'd-rankedplay-2', kind: 'rankedPlay', n: 2, coins: 530, text: tl("Play {n} ranked matches") },
  { id: 'd-rankedplay-3', kind: 'rankedPlay', n: 3, coins: 660, text: tl("Play {n} ranked matches") },
  { id: 'd-rankedwin-1', kind: 'rankedWin', n: 1, coins: 560, text: tl("Win a ranked match") },
  { id: 'd-rankedwin-2', kind: 'rankedWin', n: 2, coins: 850, text: tl("Win {n} ranked matches") },
  { id: 'd-goals-online-3', kind: 'goals', n: 3, coins: 520, where: 'online', text: tl("Score {n} goals online") },
  { id: 'd-goals-online-5', kind: 'goals', n: 5, coins: 650, where: 'online', text: tl("Score {n} goals online") },
  { id: 'd-crate-1', kind: 'crate', n: 1, coins: 400, text: tl("Open a crate") },
  { id: 'd-upgrade-1', kind: 'upgrade', n: 1, coins: 300, text: tl("Upgrade a stat") },
  { id: 'd-upgrade-2', kind: 'upgrade', n: 2, coins: 450, text: tl("Upgrade your stats {n} times") },
  { id: 'd-emote-2', kind: 'emote', n: 2, coins: 250, text: tl("Use {n} emotes in matches") },
  { id: 'd-emote-3', kind: 'emote', n: 3, coins: 300, text: tl("Use {n} emotes in matches") },
  { id: 'd-emote-5', kind: 'emote', n: 5, coins: 350, text: tl("Use {n} emotes in matches") },
  { id: 'd-challenge-1', kind: 'challenge', n: 1, coins: 250, text: tl("Finish a skill challenge") },
  { id: 'd-challenge-2', kind: 'challenge', n: 2, coins: 350, text: tl("Finish {n} skill challenges") },
  { id: 'd-challenge-3', kind: 'challenge', n: 3, coins: 450, text: tl("Finish {n} skill challenges") },
  { id: 'd-medal-1', kind: 'medal', n: 1, coins: 450, text: tl("Win a medal in a skill challenge") },
];

const WEEKLY_POOL = [
  { id: 'w-win10', kind: 'win', n: 10, coins: 12000, text: tl('Win {n} matches this week') },
  { id: 'w-goals40', kind: 'goals', n: 40, coins: 13000, text: tl('Score {n} goals this week') },
  { id: 'w-online6', kind: 'onlineWin', n: 6, coins: 15000, retired: true, text: tl('Win {n} online matches this week') },
  { id: 'w-play20', kind: 'play', n: 20, coins: 10000, text: tl('Play {n} matches this week') },
  { id: 'w-skills40', kind: 'skills', n: 40, coins: 11000, text: tl('Pull off {n} skills this week') },
  // ---- build 121: 30 more (none of them online-only: a whole week of one a guest cannot do is no good)
  { id: 'w-win-7', kind: 'win', n: 7, coins: 12000, text: tl("Win {n} matches this week") },
  { id: 'w-win-15', kind: 'win', n: 15, coins: 15000, text: tl("Win {n} matches this week") },
  { id: 'w-goals-25', kind: 'goals', n: 25, coins: 12000, text: tl("Score {n} goals this week") },
  { id: 'w-goals-60', kind: 'goals', n: 60, coins: 15000, text: tl("Score {n} goals this week") },
  { id: 'w-play-15', kind: 'play', n: 15, coins: 12500, text: tl("Play {n} matches this week") },
  { id: 'w-play-30', kind: 'play', n: 30, coins: 15000, text: tl("Play {n} matches this week") },
  { id: 'w-skills-25', kind: 'skills', n: 25, coins: 11000, text: tl("Pull off {n} skills this week") },
  { id: 'w-skills-60', kind: 'skills', n: 60, coins: 14000, text: tl("Pull off {n} skills this week") },
  { id: 'w-assists-10', kind: 'assists', n: 10, coins: 12000, text: tl("Set up {n} goals this week") },
  { id: 'w-assists-20', kind: 'assists', n: 20, coins: 15000, text: tl("Set up {n} goals this week") },
  { id: 'w-tackles-30', kind: 'tackles', n: 30, coins: 11000, text: tl("Win {n} tackles this week") },
  { id: 'w-saves-20', kind: 'saves', n: 20, coins: 11000, text: tl("Keep {n} shots out this week") },
  { id: 'w-saves-30', kind: 'saves', n: 30, coins: 12000, text: tl("Keep {n} shots out this week") },
  { id: 'w-shots-60', kind: 'shots', n: 60, coins: 12000, text: tl("Take {n} shots this week") },
  { id: 'w-passes-100', kind: 'passes', n: 100, coins: 11500, text: tl("Make {n} passes this week") },
  { id: 'w-dodges-15', kind: 'dodges', n: 15, coins: 12000, text: tl("Dodge {n} tackles this week") },
  { id: 'w-powergoal-5', kind: 'powerGoal', n: 5, coins: 12500, text: tl("Score {n} power-shot goals this week") },
  { id: 'w-powergoal-10', kind: 'powerGoal', n: 10, coins: 15000, text: tl("Score {n} power-shot goals this week") },
  { id: 'w-brace-6', kind: 'brace', n: 6, coins: 12000, text: tl("Score twice in {n} matches this week") },
  { id: 'w-hattrick-2', kind: 'hattrick', n: 2, coins: 12500, text: tl("Score {n} hat-tricks this week") },
  { id: 'w-cleansheet-3', kind: 'cleanSheet', n: 3, coins: 14000, text: tl("Win {n} matches without letting one in this week") },
  { id: 'w-cupwin-6', kind: 'cupWin', n: 6, coins: 11500, text: tl("Win {n} cup matches this week") },
  { id: 'w-cupchampion-1', kind: 'cupChampion', n: 1, coins: 13000, text: tl("Win a cup this week") },
  { id: 'w-penswin-4', kind: 'pensWin', n: 4, coins: 10000, text: tl("Win {n} shootouts this week") },
  { id: 'w-win-pro-4', kind: 'win', n: 4, coins: 10500, where: 'pro', text: tl("Win {n} PRO MATCH games this week") },
  { id: 'w-win-club-6', kind: 'win', n: 6, coins: 11500, where: 'club', text: tl("Win {n} matches for a club this week") },
  { id: 'w-win-country-6', kind: 'win', n: 6, coins: 11500, where: 'country', text: tl("Win {n} matches for your country this week") },
  { id: 'w-goals-club-15', kind: 'goals', n: 15, coins: 11000, where: 'club', text: tl("Score {n} goals for a club this week") },
  { id: 'w-challenge-5', kind: 'challenge', n: 5, coins: 10000, text: tl("Finish {n} skill challenges this week") },
  { id: 'w-fkwin-3', kind: 'fkWin', n: 3, coins: 9500, text: tl("Win {n} free-kick shootouts this week") },
];

// What each kind counts in a finished match (S, from Missions.fromMatch / fromOnline). A shootout is
// its own thing: it counts as a match played (and won), and for the shootout kinds, but its kicks
// are not goals, shots or skills.
const MISSION_KINDS = {
  play: (S) => 1,
  win: (S) => (S.won ? 1 : 0),
  goals: (S) => (S.pens ? 0 : S.goals),
  assists: (S) => (S.pens ? 0 : S.assists),
  skills: (S) => (S.pens ? 0 : S.skills),
  tackles: (S) => (S.pens ? 0 : S.tackles),
  saves: (S) => (S.pens ? 0 : S.saves),
  shots: (S) => (S.pens ? 0 : S.shots),
  passes: (S) => (S.pens ? 0 : S.passes),
  dodges: (S) => (S.pens ? 0 : S.dodges),
  steals: (S) => (S.pens ? 0 : S.steals),
  powerGoal: (S) => (S.pens ? 0 : S.powerGoals),
  curlGoal: (S) => (S.pens ? 0 : S.curlGoals),
  nutmeg: (S) => (S.pens ? 0 : S.nutmegs),
  hattrick: (S) => (!S.pens && S.goals >= 3 ? 1 : 0),
  brace: (S) => (!S.pens && S.goals >= 2 ? 1 : 0),
  cleanSheet: (S) => (S.won && !S.pens && S.theirs === 0 ? 1 : 0),
  bigWin: (S) => (S.won && !S.pens && S.mine - S.theirs >= 3 ? 1 : 0),
  goalFest: (S) => (!S.pens && S.mine + S.theirs >= 6 ? 1 : 0),
  skillsIn: (S) => (!S.pens && S.skills >= 5 ? 1 : 0),
  tacklesIn: (S) => (!S.pens && S.tackles >= 5 ? 1 : 0),
  assistsIn: (S) => (!S.pens && S.assists >= 2 ? 1 : 0),
  cupPlay: (S) => (S.cup && !S.pens ? 1 : 0),
  cupWin: (S) => (S.cup && !S.pens && S.won ? 1 : 0),
  cupChampion: (S) => (S.cupChampion ? 1 : 0),
  pensPlay: (S) => (S.pens && !S.fk ? 1 : 0),
  pensWin: (S) => (S.pens && !S.fk && S.won ? 1 : 0),
  pensScored: (S) => (S.pens && !S.fk ? S.kicksScored : 0),
  pensSaved: (S) => (S.pens && !S.fk ? S.kicksSaved : 0),
  fkPlay: (S) => (S.pens && S.fk ? 1 : 0),
  fkWin: (S) => (S.pens && S.fk && S.won ? 1 : 0),
  fkScored: (S) => (S.pens && S.fk ? S.kicksScored : 0),
  onlinePlay: (S) => (S.online && !S.coop ? 1 : 0),
  onlineWin: (S) => (S.online && !S.coop && S.won ? 1 : 0), // beating fill-ins with a friend is not an online win
  rankedPlay: (S) => (S.ranked ? 1 : 0),
  rankedWin: (S) => (S.ranked && S.won ? 1 : 0),
};
// kinds counted away from a match, through Missions.bump(kind)
const MISSION_BUMPS = new Set(['crate', 'upgrade', 'emote', 'challenge', 'medal']);
// the kinds only an online player can do: at most one of these on a day, and never the weekly one
const MISSION_ONLINE = new Set(['onlinePlay', 'onlineWin', 'rankedPlay', 'rankedWin']);
// kinds close enough to be "the same kind" for the no-two-alike-on-one-day rule
const MISSION_GROUP = {
  hattrick: 'brace', pensPlay: 'pens', pensWin: 'pens', pensScored: 'pens', pensSaved: 'pens',
  fkPlay: 'fk', fkWin: 'fk', fkScored: 'fk', cupPlay: 'cup', cupWin: 'cup', cupChampion: 'cup',
  onlinePlay: 'online', onlineWin: 'online', rankedPlay: 'online', rankedWin: 'online',
  challenge: 'challenge', medal: 'challenge', skillsIn: 'skills', tacklesIn: 'tackles', assistsIn: 'assists',
};
// what a "where" lets through
const MISSION_WHERE = {
  '1v1': (S) => !S.pens && S.format === '1v1', '2v2': (S) => !S.pens && S.format === '2v2',
  '3v3': (S) => !S.pens && S.format === '3v3', '4v4': (S) => !S.pens && S.format === '4v4',
  pro: (S) => !S.pens && S.pro, club: (S) => !S.pens && !!S.club, country: (S) => !S.pens && !S.club,
  cup: (S) => !S.pens && S.cup, hard: (S) => !S.pens && !!S.hard, online: (S) => S.online && !S.coop,
};
const MISSION_EPOCH = Date.UTC(2026, 9, 5); // a Monday: day 0 and week 0 of the deal

const Missions = {
  // the same three for everybody on the same day: the date picks them
  dayKey(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  weekKey(d = new Date()) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // back to Monday
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  },
  seed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  // days since the epoch, by the calendar on this device (so midnight is your own midnight)
  dayIndex(d = new Date()) { return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - MISSION_EPOCH) / 86400000); },
  group(p) { return MISSION_GROUP[p.kind] || p.kind; },
  online(p) { return MISSION_ONLINE.has(p.kind) || p.where === 'online'; },
  // the jobs that can still be dealt (a retired one stays readable for a save that holds it)
  dealt(pool) { return pool.filter((p) => !p.retired); },
  shuffle(list, rng) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; },
  // The deal. Day by day from the epoch, each day takes the three jobs that have waited longest
  // (give or take a few days, so the same three do not keep turning up together) and that fit the
  // day. Everybody works it out the same way, so everybody gets the same jobs on the same day.
  // Worked out once and kept (a year of days takes a few milliseconds).
  JITTER: 12, WEEK_JITTER: 4,
  _deal: null,
  deal(pool, key, upTo, jitter, perDay, fits) {
    const cache = (this._deal = this._deal || {});
    let c = cache[key];
    if (!c || c.size !== pool.length) c = cache[key] = { size: pool.length, days: [], last: Object.fromEntries(pool.map((p, i) => [p.id, -1000 - i])) };
    while (c.days.length <= upTo) {
      const i = c.days.length, rng = mulberry32(this.seed(key + '-' + i));
      const order = pool.map((p) => ({ p, k: c.last[p.id] + rng() * jitter })).sort((x, y) => x.k - y.k);
      const pick = [];
      for (const { p } of order) { if (pick.length >= perDay) break; if (fits(pick, p)) pick.push(p); }
      for (const p of pick) c.last[p.id] = i;
      c.days.push(pick.map((p) => p.id));
    }
    return c.days[upTo];
  },
  fitsDay(pick, p) { return !pick.some((q) => this.group(q) === this.group(p)) && !(this.online(p) && pick.some((q) => this.online(q))); },
  dailyIds(d = new Date()) {
    return this.deal(this.dealt(MISSION_POOL), 'daily', Math.max(0, this.dayIndex(d)), this.JITTER, 3, (pick, p) => this.fitsDay(pick, p));
  },
  weeklyId(d = new Date()) {
    const pool = this.dealt(WEEKLY_POOL).filter((p) => !this.online(p));
    return this.deal(pool, 'weekly', Math.max(0, Math.floor(this.dayIndex(d) / 7)), this.WEEK_JITTER, 1, () => true)[0];
  },

  // make sure the save is holding today's jobs and this week's
  state() {
    const d = Save.data;
    // anything but the right shape starts again: a bad save must not stop the board working
    const m0 = d.missions;
    if (!m0 || typeof m0 !== 'object' || Array.isArray(m0) || !Array.isArray(m0.daily)) {
      d.missions = { day: null, week: null, daily: [], weekly: null };
    }
    const m = d.missions;
    const day = this.dayKey(), week = this.weekKey();
    if (m.day !== day) {
      m.day = day;
      m.daily = this.dailyIds().map((id) => ({ id, n: 0, done: false }));
      Save.write();
    }
    if (m.week !== week || !m.weekly || typeof m.weekly !== 'object') {
      m.week = week;
      m.weekly = { id: this.weeklyId(), n: 0, done: false };
      Save.write();
    }
    return m;
  },
  def(id) { return MISSION_POOL.find((p) => p.id === id) || WEEKLY_POOL.find((p) => p.id === id) || null; },
  label(id) { const p = this.def(id); return p ? p.text.replace('{n}', p.n) : id; },
  all() { const m = this.state(); return [...m.daily, ...(m.weekly ? [m.weekly] : [])]; },
  // how many are sitting there finished and unclaimed
  ready() { return this.all().filter((j) => { const p = this.def(j.id); return p && !j.done && j.n >= p.n; }).length; },

  // a match played on this device, in the shape the kinds read (null: it does not count)
  fromMatch(m, outcome, extra = {}) {
    if (!m || m.autopilot || m.training || m.demo) return null;
    const hs = (m.human && m.human.stats) || {}, pens = !!m.pens, fl = m.flags || {};
    return Object.assign({
      won: outcome === 'win', outcome, online: !!m.net, coop: !!m.coop, ranked: !!m.ranked,
      pens, fk: !!(pens && m.pens.fk), format: pens ? null : m.format, pro: !!m.rules, cup: m.mode === 'cup',
      club: typeof Clubs !== 'undefined' && Clubs.clubMode(), hard: !m.net && !!Save.data.settings && Save.data.settings.difficulty === 'hard',
      mine: m.score.blue, theirs: m.score.red,
      goals: hs.goals || 0, assists: hs.assists || 0, tackles: hs.tackles || 0, skills: hs.skills || 0, shots: hs.shots || 0,
      passes: hs.passes || 0, dodges: hs.dodges || 0, steals: hs.steals || 0,
      saves: (m.stats && m.stats.blue ? m.stats.blue.saves : 0) || 0, // your end of the pitch, not just your own hands
      powerGoals: fl.powerGoals || 0, curlGoals: fl.curlGoals || (fl.curlGoal ? 1 : 0), nutmegs: fl.nutmegs || (fl.nutmeg ? 1 : 0),
      kicksScored: pens ? hs.goals || 0 : 0, kicksSaved: pens ? m.pens.saves || 0 : 0,
      cupChampion: false,
    }, extra);
  },
  // an online match, from the server's end message (st: your own line of it)
  fromOnline(m, msg, st) {
    if (!m || !msg || !msg.score) return null;
    const side = msg.side, other = side === 'blue' ? 'red' : 'blue', S = msg.stats || {};
    st = st || {};
    return {
      won: msg.outcome === 'win', outcome: msg.outcome, online: true, coop: !!msg.coop, ranked: !!msg.ranked,
      pens: false, fk: false, format: msg.format, pro: !!m.rules, cup: !!(msg.wc || msg.fcup),
      club: typeof isEuro === 'function' && !!msg.clubs && !!isEuro(msg.clubs[side]), hard: false,
      mine: msg.score[side] || 0, theirs: msg.score[other] || 0,
      goals: st.goals || 0, assists: st.assists || 0, tackles: st.tackles || 0, skills: st.skills || 0, shots: st.shots || 0,
      passes: st.passes || 0, dodges: st.dodges || 0, steals: st.steals || 0,
      saves: (S[side] && S[side].saves) || 0,
      powerGoals: (m.flags && m.flags.powerGoals) || 0, curlGoals: 0, nutmegs: 0, kicksScored: 0, kicksSaved: 0,
      cupChampion: !!((msg.wc && msg.wc.champion) || (msg.fcup && msg.fcup.champion)),
    };
  },
  // how far one finished match takes one job
  count(p, S) {
    if (p.where && !(MISSION_WHERE[p.where] && MISSION_WHERE[p.where](S))) return 0;
    const f = MISSION_KINDS[p.kind];
    const n = f ? Number(f(S)) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  },
  // what a finished match was worth to every job on the board
  record(S) {
    if (!S || (typeof Game !== 'undefined' && Game.headless)) return;
    for (const job of this.all()) {
      const p = this.def(job.id);
      if (!p || job.done) continue;
      job.n = Math.min(p.n, job.n + this.count(p, S));
    }
    Save.write();
  },
  // something counted away from a match: a crate opened, a stat upgraded, an emote used in a
  // match, a skill challenge finished, a medal won in one
  bump(kind, n = 1) {
    if (!MISSION_BUMPS.has(kind) || (typeof Game !== 'undefined' && Game.headless) || !Save.data) return;
    let moved = false;
    for (const job of this.all()) {
      const p = this.def(job.id);
      if (!p || job.done || p.kind !== kind) continue;
      job.n = Math.min(p.n, job.n + n); moved = true;
    }
    if (moved) Save.write();
  },

  // take the coins for one that is finished
  claim(id) {
    const job = this.all().find((j) => j.id === id);
    const p = this.def(id);
    if (!job || !p || job.done || job.n < p.n) return 0;
    job.done = true;
    Save.data.coins += p.coins;
    Save.write();
    return p.coins;
  },
};

if (typeof module !== 'undefined') module.exports = { MISSION_POOL, WEEKLY_POOL, MISSION_KINDS, MISSION_WHERE, Missions };
