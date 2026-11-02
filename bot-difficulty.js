// One progressive curve for competitive MMR and local/LAN/online private ranks.
const LEVELS=[.06,.10,.18,.28,.43,.62,.82,1];
export function rankBotSkill(rank){const t=Math.max(0,Math.min(7,Number(rank)||0)),i=Math.floor(t);return i===7?1:LEVELS[i]+(LEVELS[i+1]-LEVELS[i])*(t-i)}
export const mmrBotSkill=mmr=>rankBotSkill(Math.max(0,Number(mmr)||0)/240);
export const nextoDecisionTicks=skill=>8+Math.round(18*Math.pow(1-Math.max(0,Math.min(1,skill)),1.4));

// Convert the existing continuous rank curve back to a tier; no hard controller jump.
export function botRankFromSkill(skill){const s=Math.max(0,Math.min(1,Number(skill)||0));if(s<=LEVELS[0])return 0;for(let i=0;i<7;i++)if(s<LEVELS[i+1])return i+(s-LEVELS[i])/(LEVELS[i+1]-LEVELS[i]);return 7}
// Each car has one coherent driver. Never average opposing controller commands.
export const rankedDriver=skill=>botRankFromSkill(skill)<.8?'basic':botRankFromSkill(skill)<2?'scripted':'nexto';
export function neuralRankSkill(skill){const rank=botRankFromSkill(skill),levels=[.1,.2,.35,.55,.72,.85,.95,1],i=Math.floor(rank);return i===7?1:levels[i]+(levels[i+1]-levels[i])*(rank-i)}
