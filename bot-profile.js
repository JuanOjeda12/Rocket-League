import {botRankFromSkill} from './bot-difficulty.js?v=gold-nexto-20261101';
export function botProfile(difficulty='competitive',skill=.65){
 const hard=difficulty==='competitive',s=hard?Math.max(0,Math.min(1,Number.isFinite(skill)?skill:.65)):.25;
 return{skill:s,think:hard?.045-s*.028:.085,topSpeed:hard?22+s:19,prediction:hard?2.4+s:2,accuracy:hard?3.5+s*1.5:3.2,air:hard&&s>=.55,carry:hard&&s>=.82,speedFlip:hard&&s>=.7,jumpHeight:hard?3+s*9:2.8,boostAngle:hard?.3+s*.15:.22};
}

export function rankedScriptedProfile(skill){const rank=botRankFromSkill(skill),q=Math.max(0,Math.min(1,(rank-.8)/2.2));return{skill,think:.15-q*.075,topSpeed:13+q*7,prediction:.8+q*.9,accuracy:3.2+q,air:false,carry:false,speedFlip:false,jumpHeight:2.8,boostAngle:.16+q*.08}}
