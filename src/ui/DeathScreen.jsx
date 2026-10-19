import { Home, RotateCcw } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';

export default function DeathScreen({ onAgain, onMenu }) {
  const t = useT();
  const stats = useGameStore(state => state.snapshot);
  const language = useGameStore(state => state.language);

  return (
    <div className="screen-overlay">
      <section className="dialog-card">
        <span className="eyebrow">ROUND OVER</span>
        <h1>{t('deadTitle')}</h1>
        <p>{t('deadText')}</p>
        <div className="result-grid">
          <div><span>{t('territory')}</span><strong>{stats.territory}%</strong></div>
          <div><span>{t('score')}</span><strong>{stats.sessionScore || 0}</strong></div>
          <div><span>{language === 'ru' ? 'Убийства' : 'Kills'}</span><strong>{stats.kills || 0}</strong></div>
        </div>
        <button className="primary-button" onClick={onAgain}><RotateCcw size={17}/>{t('again')}</button>
        <button className="secondary-button" onClick={onMenu}><Home size={17}/>{t('menu')}</button>
      </section>
    </div>
  );
}
