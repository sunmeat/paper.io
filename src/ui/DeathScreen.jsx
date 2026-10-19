import { useEffect, useState } from 'react';
import { Home, RotateCcw, Coins, Trophy, Clock, Skull, Crown } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';

const formatPercent = value => Number(value || 0).toFixed(3);

const formatTime = ms => {
  const seconds = Math.floor(Math.max(0, ms || 0) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

function useCountUp(target, decimals = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 850;
    const animate = now => {
      const progress = Math.min(1, (now - start) / duration);
      const current = Math.max(0, Number(target) || 0) * (1 - (1 - progress) ** 3);
      setValue(decimals ? Number(current.toFixed(3)) : Math.round(current));
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
  const territory = useCountUp(stats.territory, true);
  const score = useCountUp(stats.sessionScore || 0);
  const kills = useCountUp(stats.kills || 0);
  const coins = useCountUp(stats.roundCoinsEarned || 0);
  const territoryReward = Math.floor((Number(stats.territory) || 0) * 2);
  const killReward = Math.max(0, Number(stats.kills) || 0) * 35;
  const timeReward = Math.min(50, Math.floor(Math.max(0, Number(stats.roundTimeMs) || 0) / 60000) * 5);
  const victoryReward = stats.outcome === 'victory' ? 75 : 0;
  const secretReward = stats.secretConquered && stats.outcome === 'victory' ? 500 : 0;
  const ranking = [...(stats.playerStats || [])].sort((a, b) => b.territory - a.territory || a.id - b.id);
  const place = Math.max(1, ranking.findIndex(player => player.id === 1) + 1);
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => { setNewRecord(Boolean(stats.isNewRecord)); }, [stats.isNewRecord]);

  return (
    <div className="screen-overlay">
      <section className="dialog-card result-card">
        <span className="eyebrow">{stats.outcome === 'victory' ? (language === 'ru' ? 'РАУНД ВЫИГРАН' : 'ROUND WON') : (language === 'ru' ? 'РАУНД ЗАВЕРШЁН' : 'ROUND OVER')}</span>
        <h1>{stats.outcome === 'victory' ? (language === 'ru' ? 'ПОБЕДА!' : 'VICTORY!') : t('deadTitle')}</h1>
        <p>{stats.outcome === 'victory' ? (language === 'ru' ? 'Арена твоя. Награда за победу начислена.' : 'The arena is yours. Your victory reward has been added.') : t('deadText')}</p>
        {stats.secretConquered && stats.outcome === 'victory' && <div className="new-record secret-conquest">{language === 'ru' ? 'СЕКРЕТ: КАРТА ЗАХВАЧЕНА · +500 МОНЕТ' : 'SECRET: FULL MAP CONQUERED · +500 COINS'}</div>}
        {newRecord && <div className="new-record"><Crown size={16}/>{language === 'ru' ? 'НОВЫЙ РЕКОРД' : 'NEW RECORD'}</div>}
        <div className="result-grid block8-results">
          <div><span>{t('territory')}</span><strong>{formatPercent(territory)}%</strong></div>
          <div><span>{t('score')}</span><strong>{score}</strong></div>
          <div><span><Skull size={12}/>{language === 'ru' ? 'Убийства' : 'Kills'}</span><strong>{kills}</strong></div>
          <div><span><Clock size={12}/>{language === 'ru' ? 'Время' : 'Time'}</span><strong>{formatTime(stats.roundTimeMs)}</strong></div>
          <div><span><Trophy size={12}/>{language === 'ru' ? 'Место' : 'Place'}</span><strong>#{place}</strong></div>
          <div><span><Coins size={12}/>{language === 'ru' ? 'Монеты за раунд' : 'Coins earned'}</span><strong>+{coins}</strong></div>
        </div>
        <div className="reward-breakdown">
          <span>{t('roundReward')}</span>
          <div><small>{language === 'ru' ? 'База' : 'Base'}</small><strong>+10</strong></div>
          <div><small>{t('rewardTerritory')}</small><strong>+{territoryReward}</strong></div>
          <div><small>{t('rewardKills')}</small><strong>+{killReward}</strong></div>
          <div><small>{t('rewardTime')}</small><strong>+{timeReward}</strong></div>
          {victoryReward > 0 && <div><small>{language === 'ru' ? 'Победа' : 'Victory'}</small><strong>+{victoryReward}</strong></div>}
          {secretReward > 0 && <div><small>{language === 'ru' ? 'Вся карта' : 'Full map'}</small><strong>+{secretReward}</strong></div>}
        </div>
        <button className="primary-button" onClick={onAgain}><RotateCcw size={17}/>{t('again')}</button>
        <button className="secondary-button" onClick={onMenu}><Home size={17}/>{t('menu')}</button>
      </section>
    </div>
  );
}
