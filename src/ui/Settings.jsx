import { useState } from 'react';
import { X, Volume2, Music2, Vibrate } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';
import { isSoundEnabled, isMusicEnabled, setSoundEnabled, setMusicEnabled } from '../engine/audio.js';
export default function Settings(){
 const t=useT(),lang=useGameStore(s=>s.language),setLang=useGameStore(s=>s.setLanguage),toggle=useGameStore(s=>s.toggleSettings);
 const [sound,setSound]=useState(isSoundEnabled),[music,setMusic]=useState(isMusicEnabled),[vibration,setVibration]=useState(localStorage.getItem('paper-io-vibration')!=='false');
 return <div className="screen-overlay" role="dialog" aria-modal="true"><section className="dialog-card settings-card">
 <button className="close-button" onClick={toggle} aria-label={t('close')}><X/></button><span className="eyebrow">PREFERENCES</span><h1>{t('settings')}</h1>
 <label className="setting-label">{t('language')}</label><div className="language-options">
 <button className={lang==='ru'?'language-button selected':'language-button'} onClick={()=>setLang('ru')}>{t('russian')}</button>
 <button className={lang==='en'?'language-button selected':'language-button'} onClick={()=>setLang('en')}>{t('english')}</button></div>
 <div className="audio-settings">
 <label><Volume2 size={17}/><span>{t('sound')}</span><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);setSoundEnabled(e.target.checked);}}/></label>
 <label><Music2 size={17}/><span>{t('music')}</span><input type="checkbox" checked={music} onChange={e=>{setMusic(e.target.checked);setMusicEnabled(e.target.checked);}}/></label>
 <label><Vibrate size={17}/><span>{t('vibration')}</span><input type="checkbox" checked={vibration} onChange={e=>{setVibration(e.target.checked);localStorage.setItem('paper-io-vibration',String(e.target.checked));}}/></label>
 </div><button className="primary-button settings-close" onClick={toggle}>{t('back')}</button>
 </section></div>;
}