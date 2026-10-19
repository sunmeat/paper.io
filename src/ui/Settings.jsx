import { useState } from 'react';
import { X, Volume2, Music2, Vibrate, MoveHorizontal } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';
import { isSoundEnabled, isMusicEnabled, setSoundEnabled, setMusicEnabled } from '../engine/audio.js';

const DEFAULT_SWIPE_THRESHOLD = 24;

function readSwipeThreshold() {
  const saved = Number(localStorage.getItem('paper-io-swipe-threshold'));
  return Number.isFinite(saved) && saved >= 8 && saved <= 48 ? saved : DEFAULT_SWIPE_THRESHOLD;
}

export default function Settings() {
  const t = useT();
  const lang = useGameStore(state => state.language);
  const setLang = useGameStore(state => state.setLanguage);
  const toggle = useGameStore(state => state.toggleSettings);
  const [sound, setSound] = useState(isSoundEnabled);
  const [music, setMusic] = useState(isMusicEnabled);
  const [vibration, setVibration] = useState(localStorage.getItem('paper-io-vibration') !== 'false');
  const [swipeThreshold, setSwipeThreshold] = useState(readSwipeThreshold);

  const updateSwipeThreshold = value => {
    const next = Number(value);
    setSwipeThreshold(next);
    localStorage.setItem('paper-io-swipe-threshold', String(next));
  };

  return (
    <div className="screen-overlay" role="dialog" aria-modal="true">
      <section className="dialog-card settings-card">
        <button className="close-button" onClick={toggle} aria-label={t('close')}><X /></button>
        <span className="eyebrow">PREFERENCES</span>
        <h1>{t('settings')}</h1>
        <label className="setting-label">{t('language')}</label>
        <div className="language-options">
          <button className={lang === 'ru' ? 'language-button selected' : 'language-button'} onClick={() => setLang('ru')}>{t('russian')}</button>
          <button className={lang === 'en' ? 'language-button selected' : 'language-button'} onClick={() => setLang('en')}>{t('english')}</button>
        </div>
        <div className="audio-settings">
          <label><Volume2 size={17} /><span>{t('sound')}</span><input type="checkbox" checked={sound} onChange={event => { setSound(event.target.checked); setSoundEnabled(event.target.checked); }} /></label>
          <label><Music2 size={17} /><span>{t('music')}</span><input type="checkbox" checked={music} onChange={event => { setMusic(event.target.checked); setMusicEnabled(event.target.checked); }} /></label>
          <label><Vibrate size={17} /><span>{t('vibration')}</span><input type="checkbox" checked={vibration} onChange={event => { setVibration(event.target.checked); localStorage.setItem('paper-io-vibration', String(event.target.checked)); }} /></label>
        </div>
        <label className="swipe-setting">
          <span><MoveHorizontal size={17} />{lang === 'ru' ? 'Чувствительность свайпа' : 'Swipe sensitivity'}</span>
          <strong>{swipeThreshold}px</strong>
          <input type="range" min="8" max="48" step="2" value={swipeThreshold} onChange={event => updateSwipeThreshold(event.target.value)} />
          <small>{lang === 'ru' ? 'Меньше значение = быстрее реакция на короткий жест' : 'Lower value reacts to shorter swipes'}</small>
        </label>
        <button className="primary-button settings-close" onClick={toggle}>{t('back')}</button>
      </section>
    </div>
  );
}
