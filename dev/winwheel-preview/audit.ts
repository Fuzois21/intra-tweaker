import { getExtraGameMarkup, runExtraGame, extraGameStyles, physicalGameStyles, type ExtraGameId, type FxHelpers } from '../../src/entrypoints/module_winwheel.unlisted/extraGames';
import {casinoStyles} from '../../src/entrypoints/module_winwheel.unlisted/styles';
const shadow=document.querySelector('#host')!.attachShadow({mode:'open'});
shadow.innerHTML=`<style>${casinoStyles+extraGameStyles+physicalGameStyles+".casino-overlay{z-index:1}"}</style><div class="casino-overlay is-open"><div class="casino-dialog"><section class="game-panel"><div class="game-stage"></div></section></div></div>`;
const stage=shadow.querySelector<HTMLElement>('.game-stage')!;
const panel=shadow.querySelector<HTMLElement>('.game-panel')!;
const results=document.querySelector('#results')!;
const state=document.querySelector('#state')!;
const reduced=new URLSearchParams(location.search).has('reduced');
const fx:FxHelpers={reduced:()=>reduced,wait:(ms,signal)=>new Promise(resolve=>{const id=setTimeout(()=>resolve(!signal.aborted),reduced?20:ms);signal.addEventListener('abort',()=>{clearTimeout(id);resolve(false)},{once:true})}),animate:async(el,frames,options,signal)=>{const a=el.animate(frames,options);signal.addEventListener('abort',()=>a.cancel(),{once:true});try{await a.finished;return true}catch{return false}}};
const games:ExtraGameId[]=['marbles','pachinko','derby','crash','pinball','lotto','cups'];
document.querySelector('#rerun')!.addEventListener('click',()=>location.reload());
let failures=0;
for(const [index,game] of games.entries()){
  const score=[92,0,100,7,42,100,0][index];
  state.textContent=`${game} · ${score}% · animation en cours`;
  panel.dataset.game=game;delete stage.dataset.phase;
  stage.innerHTML=getExtraGameMarkup(game,score);
  let changes=0;
  const observer=new MutationObserver(records=>{changes+=records.filter(r=>r.type==='attributes'&&['transform','cx','cy','style'].includes(r.attributeName??'')).length;});
  observer.observe(stage,{subtree:true,attributes:true});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  const row=document.createElement('li');results.append(row);
  try{
    if(game!=='crash'&&/[1-9]\d*%/.test(stage.textContent??''))throw Error('Pourcentage visible au départ');
    const completed=await runExtraGame(game,stage,score,controller.signal,fx);
    if(!completed)throw Error('Animation interrompue');
    if(changes<5)throw Error('Aucun mouvement');
    const result=stage.querySelector('[data-result]');
    if(result?.getAttribute('data-result')!==String(score)||result?.textContent!==score+'%')throw Error('Résultat incorrect');
    for(const el of stage.querySelectorAll('*'))for(const attr of el.attributes)if(/NaN|Infinity/.test(attr.value))throw Error('Coordonnées invalides');
    row.className='pass';row.textContent=`${game} : ${score}% · ${changes} positions · OK`;
  }catch(error){failures++;row.className='fail';row.textContent=`${game} : ${String(error)}`;}
  clearTimeout(timeout);observer.disconnect();
  await new Promise(resolve=>setTimeout(resolve,reduced?50:1050));
}
state.textContent=failures?`${failures} échec(s)`:'7/7 jeux terminés · résultats exacts';
document.body.dataset.audit=failures?'failed':'passed';
