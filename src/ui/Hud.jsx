import {useEffect,useState} from 'react';
import {Pause,Play,RotateCcw,Trophy,Zap,Settings2,ShoppingBag,Coins,Clock,Skull} from 'lucide-react';
import {getPlayerColor} from '../engine/playerPalette.js';
import {useGameStore} from '../store/gameStore.js';
import {useT} from '../i18n.js';
import './block8.css';

const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;

export default function Hud({onPause,onRestart,onShop}){
  const t=useT(),stats=useGameStore(s=>s.snapshot),paused=useGameStore(s=>s.paused),toggle=useGameStore(s=>s.toggleSettings),coins=useGameStore(s=>s.coins);
  const [elapsed,setElapsed]=useState(0),[feed,setFeed]=useState([]),[bonus,setBonus]=useState(null);
  useEffect(()=>{const started=Date.now();const id=window.setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),250);return()=>window.clearInterval(id)},[]);
  useEffect(()=>{
    const onKill=e=>{const event=e.detail||{};setFeed(items=>[{id:Date.now()+Math.random(),text:`${event.killerName||'Игрок'} убил ${event.victimName||'соперника'}`},...items].slice(0,4));};
    const onCapture=e=>{const amount=Math.max(0,Number(e.detail?.percent)||0);if(!amount)return;setBonus({id:Date.now(),amount,x:e.detail?.screenX??window.innerWidth/2,y:e.detail?.screenY??window.innerHeight/2});window.setTimeout(()=>setBonus(null),1600);};
    window.addEventListener('paperio:kill',onKill);window.addEventListener('paperio:capture',onCapture);
    return()=>{window.removeEventListener('paperio:kill',onKill);window.removeEventListener('paperio:capture',onCapture)};
  },[]);
  return <><header className="top-hud"><div className="brand"><span className="brand-mark"><Zap size={18}/></span><span>PAPER<span className="brand-dot">.IO</span></span></div><div className="stat-pill"><span>{t('territory')}</span><strong>{stats.territory}%</strong></div><div className="round-timer"><Clock size={13}/><strong>{formatTime(elapsed)}</strong></div><div className="kill-count" title="Kills"><Skull size={13}/><strong>{stats.kills||0}</strong></div><div className="coin-pill"><Coins size={14}/>{coins}</div><button className="hud-button" onClick={onPause} aria-label={t('pause')}>{paused?<Play/>:<Pause/>}</button><button className="hud-button" onClick={onRestart} aria-label={t('newGame')}><RotateCcw/></button><button className="hud-button" onClick={onShop} aria-label={t('shop')}><ShoppingBag/></button><button className="hud-button settings-hud-button" onClick={toggle} aria-label={t('settings')}><Settings2/></button></header><aside className="side-hud"><div className="legend"><i className="legend-player"/>{t('you')}</div><div className="legend"><i className="legend-pink"/>{t('rivals')} <strong>{stats.bots}</strong></div><div className="legend"><Trophy size={13}/>{t('score')} <strong>{stats.sessionScore||0}</strong></div><div className="kill-feed" aria-live="polite">{feed.map(event=><div className="kill-feed-item" key={event.id}><Skull size={12}/>{event.text}</div>)}</div><div className="leaderboard"><span>{t('top')}</span>{(stats.top5||[]).map((p,i)=><div className="leader-row" key={p.id}><i style={{background:getPlayerColor(p.id)}}/>{p.id===1?t('you'):(p.name||`Бот ${p.id-1}`)}<strong>{p.score}</strong></div>)}</div></aside>{bonus&&<div className="capture-bonus" key={bonus.id} style={{left:bonus.x,top:bonus.y}}>+{bonus.amount}%</div>}<div className="bottom-hud"><div className="tip-icon"><Trophy/></div><div><strong>{t('subtitle')}</strong><span>{t('firstText').split('. ')[0]}</span></div><div className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div>{paused&&<div className="screen-overlay pause-overlay"><section className="dialog-card"><span className="eyebrow">{t('pause')}</span><h1>{t('pausedTitle')}</h1><p>{t('pausedText')}</p><button className="primary-button" onClick={onPause}><Play/>{t('resume')}</button></section></div>}</>
}