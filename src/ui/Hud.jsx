import {useEffect,useState} from 'react';
import {Pause,Play,RotateCcw,Trophy,Zap,Settings2,ShoppingBag,Coins,Clock,Skull,Crown} from 'lucide-react';
import {getPlayerColor} from '../engine/playerPalette.js';
import {useGameStore} from '../store/gameStore.js';
import {useT} from '../i18n.js';
import { GAME_MODES } from '../engine/modes.js';
import './block8.css';

const formatPercent = value => Number(value || 0).toFixed(3);
const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;

export default function Hud({onPause,onRestart,onShop}){
  const t=useT(),stats=useGameStore(s=>s.snapshot),paused=useGameStore(s=>s.paused),toggle=useGameStore(s=>s.toggleSettings),coins=useGameStore(s=>s.coins),language=useGameStore(s=>s.language);
  const [feed,setFeed]=useState([]),[bonus,setBonus]=useState(null),[leaderToast,setLeaderToast]=useState(''),[powerupToast,setPowerupToast]=useState(null);
  const timerMs = GAME_MODES[stats.modeId]?.timeLimitMs ? Math.max(0, GAME_MODES[stats.modeId].timeLimitMs - (stats.elapsedMs || 0)) : (stats.elapsedMs || 0);
  useEffect(()=>{
    let leaderTimer;
    const onLeader=e=>{
      const event=e.detail||{};
      const message=event.leaderId===1?'leader':event.previousLeaderId===1?'lost':'';
      if(!message)return;
      setLeaderToast(message);
      window.clearTimeout(leaderTimer);
      leaderTimer=window.setTimeout(()=>setLeaderToast(''),2200);
    };
    const onKill=e=>{const event=e.detail||{};setFeed(items=>[{id:Date.now()+Math.random(),text:`${event.killerName||'Игрок'} убил ${event.victimName||'соперника'}`},...items].slice(0,4));};
    const onPowerup=e=>{const event=e.detail||{};if(!event.human)return;const labels={speed:'⚡ Ускорение',shield:'🛡 Щит',bigCapture:'💥 Взрыв-захват',freeze:'❄ Заморозка'};setPowerupToast({id:Date.now(),text:labels[event.powerup]||event.powerup});window.setTimeout(()=>setPowerupToast(null),1800);};
    const onCapture=e=>{const amount=Math.max(0,Number(e.detail?.percent)||0);if(!amount)return;setBonus({id:Date.now(),amount,x:e.detail?.screenX??window.innerWidth/2,y:e.detail?.screenY??window.innerHeight/2});window.setTimeout(()=>setBonus(null),1600);};
    window.addEventListener('paperio:kill',onKill);window.addEventListener('paperio:capture',onCapture);window.addEventListener('paperio:leader-change',onLeader);window.addEventListener('paperio:powerup',onPowerup);
    return()=>{window.removeEventListener('paperio:kill',onKill);window.removeEventListener('paperio:capture',onCapture);window.removeEventListener('paperio:leader-change',onLeader);window.removeEventListener('paperio:powerup',onPowerup);window.clearTimeout(leaderTimer)};
  },[]);
  return <><header className="top-hud"><div className="brand"><span className="brand-mark"><Zap size={18}/></span><span>PAPER<span className="brand-dot">.IO</span></span></div><div className="stat-pill"><span>{t('territory')}</span><strong>{formatPercent(stats.territory)}%</strong></div><div className="round-timer"><Clock size={13}/><strong>{formatTime(timerMs/1000)}</strong></div><div className="kill-count" title="Kills"><Skull size={13}/><strong>{stats.kills||0}</strong></div><div className="coin-pill"><Coins size={14}/>{coins}</div>{(stats.effects||[]).map(effect=><div className={`powerup-chip powerup-${effect.id}`} key={effect.id} title={effect.id}><span>{({speed:'⚡',shield:'🛡️',bigCapture:'💥',freeze:'❄️'})[effect.id]}</span><i style={{'--effect-progress':`${Math.max(0,Math.min(1,effect.ticksLeft/effect.durationTicks))*100}%`}}/><small>{Math.ceil(effect.ticksLeft/15)}s</small></div>)}<button className="hud-button" onClick={onPause} aria-label={t('pause')}>{paused?<Play/>:<Pause/>}</button><button className="hud-button" onClick={onRestart} aria-label={t('newGame')}><RotateCcw/></button><button className="hud-button" onClick={onShop} aria-label={t('shop')}><ShoppingBag/></button><button className="hud-button settings-hud-button" onClick={toggle} aria-label={t('settings')}><Settings2/></button></header><aside className="side-hud"><div className="legend"><i className="legend-player"/>{t('you')}</div><div className="legend"><i className="legend-pink"/>{t('rivals')} <strong>{stats.bots}</strong></div><div className="legend"><Trophy size={13}/>{t('score')} <strong>{stats.sessionScore||0}</strong></div><div className="kill-feed" aria-live="polite">{feed.map(event=><div className="kill-feed-item" key={event.id}><Skull size={12}/>{event.text}</div>)}</div><div className="leaderboard"><span>{t('top')}</span>{(stats.top5||[]).map((p,i)=><div className={`leader-row${p.id===stats.leaderId?' leader-row-current':''}`} key={p.id}><i style={{background:getPlayerColor(p.id)}}/>{p.id===1?t('you'):(p.name||`Бот ${p.id-1}`)}{i===0&&<Crown className="leader-crown" size={13}/>}<strong>{p.score}</strong></div>)}</div></aside>{powerupToast&&<div className="powerup-toast" role="status" key={powerupToast.id}>{powerupToast.text}</div>}{leaderToast&&<div className="leader-toast" role="status"><Crown size={17}/>{leaderToast==='leader'?(language==='ru'?'Вы лидер!':'You are the leader!'):(language==='ru'?'Корона потеряна':'Crown lost')}</div>}{bonus&&<div className="capture-bonus" key={bonus.id} style={{left:bonus.x,top:bonus.y}}>+{Number(bonus.amount).toFixed(3)}%</div>}<div className="bottom-hud"><div className="tip-icon"><Trophy/></div><div><strong>{t('subtitle')}</strong><span>{t('firstText').split('. ')[0]}</span></div><div className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div>{paused&&<div className="screen-overlay pause-overlay"><section className="dialog-card"><span className="eyebrow">{t('pause')}</span><h1>{t('pausedTitle')}</h1><p>{t('pausedText')}</p><button className="primary-button" onClick={onPause}><Play/>{t('resume')}</button></section></div>}</>
}