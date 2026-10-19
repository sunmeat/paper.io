import { useEffect, useState } from 'react';
import { Home, RotateCcw, Coins, Trophy, Clock, Skull, Crown } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';

const formatTime = ms => {
  const seconds = Math.floor(Math.max(0, ms || 0) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

function useCountUp(target) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 850;
    const animate = now => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(Math.max(0, Number(target) || 0) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export default function DeathScreen({ onAgain, onMenu }) {
  const t = useT();
  const stats = useGameStore(state => state.snapshot);
  const language = useGameStore(state => state.language);
  const territory = useCountUp(stats.territory);
  const score = useCountUp(stats.sessionScore || 0);
  const kills = useCountUp(stats.kills || 0);
  const coins = useCountUp(stats.roundCoinsEarned || 0);
  const place = Math.max(1, (stats.top5 || []).findIndex(player => player.id === 1) + 1);
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => {
    const key = 'paper-io-block8-best';
    const previous = Number(localStorage.getItem(key)) || 0;
    const current = Number(stats.territory) || 0;
    setNewRecord(current > previous);
    if (current > previous) localStorage.setItem(key, String(current));
  }, [stats.territory]);

  return (
    <div className="screen-overlay">
      <section className="dialog-card result-card">
        <span className="eyebrow">ROUND OVER</span>
        <h1>{t('deadTitle')}</h1>
        <p>{t('deadText')}</p>
        {newRecord && <div className="new-record"><Crown size={16}/>{language === 'ru' ? 'НОВЫЙ РЕКОРД' : 'NEW RECORD'}</div>}
        <div className="result-grid block8-results">
          <div><span>{t('territory')}</span><strong>{territory}%</strong></div>
          <div><span>{t('score')}</span><strong>{score}</strong></div>
          <div><span><Skull size={12}/>{language === 'ru' ? 'Убийства' : 'Kills'}</span><strong>{kills}</strong></div>
          <div><span><Clock size={12}/>{language === 'ru' ? 'Время' : 'Time'}</span><strong>{formatTime(stats.roundTimeMs)}</strong></div>
          <div><span><Trophy size={12}/>{language === 'ru' ? 'Место' : 'Place'}</span><strong>#{place}</strong></div>
          <div><span><Coins size={12}/>{language === 'ru' ? 'Монеты за раунд' : 'Coins earned'}</span><strong>+{coins}</strong></div>
        </div>
        <button className="primary-button" onClick={onAgain}><RotateCcw size={17}/>{t('again')}</button>
        <button className="secondary-button" onClick={onMenu}><Home size={17}/>{t('menu')}</button>
      </section>
    </div>
  );
}
