import { useState } from 'react';
import { Coins, Gift, Settings2, ShoppingBag, Zap, Globe2, BarChart3, Lock, Check, Star } from 'lucide-react';
import { MAPS, getMapPreview } from '../engine/maps.js';
import { GAME_MODES } from '../engine/modes.js';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';
import { WORLD_COUNTRIES, isCountryUnlocked } from '../engine/world.js';

export default function Menu({
  onPlay,
  onShop,
  onDaily,
  coins = 0,
  dailyClaimed = false,
  rewardNotice = ''
}) {
  const t = useT();
  const toggle = useGameStore(state => state.toggleSettings);
  const language = useGameStore(state => state.language);
  const selectedMap = useGameStore(state => state.selectedMap);
  const setSelectedMap = useGameStore(state => state.setSelectedMap);
  const selectedMode = useGameStore(state => state.selectedMode);
  const setSelectedMode = useGameStore(state => state.setSelectedMode);
  const modeRecords = useGameStore(state => state.modeRecords);
  const [worldView, setWorldView] = useState('world');
  const selectedCountryId = useGameStore(state => state.selectedCountryId || 'ukraine');
  const setSelectedCountry = useGameStore(state => state.setSelectedCountry);
  const completedCountries = useGameStore(state => state.completedCountries || ['ukraine']);
  const countryRecords = useGameStore(state => state.countryRecords || {});
  const prestige = useGameStore(state => state.prestige || 0);
  const level = useGameStore(state => state.level || 1);
  const experience = useGameStore(state => state.experience || 0);
  const gamesPlayed = useGameStore(state => state.gamesPlayed || 0);
  const totalTerritory = useGameStore(state => state.totalTerritory || 0);
  const bestTerritory = useGameStore(state => state.bestTerritory || 0);
  const rank = useGameStore(state => state.rank || 'recruit');
  const levelFloor = Array.from({ length: Math.max(0, level - 1) }, (_, index) => (index + 1) * 100).reduce((sum, value) => sum + value, 0);
  const xpInLevel = Math.max(0, experience - levelFloor);
  const xpNeeded = level * 100;

  return (
    <main className="screen-shell menu-screen">
      <div className="menu-grid" />
      <div className="menu-content">
        <div className="menu-brand">
          <span className="brand-mark"><Zap size={22} fill="currentColor" /></span>
          <span>PAPER<span className="brand-dot">.IO</span></span>
        </div>
        <span className="eyebrow">CLAIM YOUR SPACE</span>
        <h1>{t('title')}</h1>
        <p>{t('subtitle')}</p>
        <div className="meta-wallet"><Coins size={17} /><strong key={coins} className="coin-count-pop">{coins}</strong><span>{language === 'ru' ? 'монет' : 'coins'}</span></div>
        <button className="primary-button menu-play" onClick={onPlay}><Zap size={18} />{t('play')}</button>
        <button className="secondary-button" onClick={onDaily} disabled={dailyClaimed}><Gift size={17} />{dailyClaimed ? t('dailyClaimed') : t('dailyReward')}</button>
        {rewardNotice && <p className="reward-notice" role="status">{rewardNotice}</p>}
        <button className="secondary-button" onClick={onShop}><ShoppingBag size={17} />{t('shop')}</button>
        <button className="secondary-button" onClick={toggle}><Settings2 size={17} />{t('settings')}</button>


        <div className="world-view-tabs" role="tablist" aria-label={language === 'ru' ? 'Прогресс игрока' : 'Player progression'}>
          <button className={worldView === 'world' ? 'selected' : ''} onClick={() => setWorldView('world')}><Globe2 size={15}/>{language === 'ru' ? 'МИР' : 'WORLD'}</button>
          <button className={worldView === 'stats' ? 'selected' : ''} onClick={() => setWorldView('stats')}><BarChart3 size={15}/>{language === 'ru' ? 'СТАТИСТИКА' : 'STATS'}</button>
          <button className={worldView === 'arena' ? 'selected' : ''} onClick={() => setWorldView('arena')}><Star size={15}/>{language === 'ru' ? 'АРЕНЫ' : 'ARENAS'}</button>
        </div>
        {worldView === 'world' && <section className="world-panel">
          <div className="world-heading"><div><span className="eyebrow">{language === 'ru' ? 'КАРТА МИРА' : 'WORLD MAP'}</span><h2>{language === 'ru' ? 'Экспедиция' : 'Expedition'}{prestige > 0 ? ' · ' + (language === 'ru' ? 'Престиж' : 'Prestige') + ' ' + prestige : ''}</h2></div><span className="world-level">{language === 'ru' ? 'УР.' : 'LVL'} {level}</span></div>
          <div className="xp-track"><i style={{ width: Math.min(100, xpInLevel / xpNeeded * 100) + '%' }}/></div>
          <div className="xp-caption"><span>{experience} XP</span><span>{xpInLevel}/{xpNeeded} XP</span></div>
          <div className="country-list">{WORLD_COUNTRIES.map(country => {
            const unlocked = isCountryUnlocked(country.id, completedCountries);
            const completed = completedCountries.includes(country.id);
            const record = Number(countryRecords[country.id]) || 0;
            const active = selectedCountryId === country.id;
            return <button type="button" key={country.id} className={'country-card' + (active ? ' country-active' : '') + (completed ? ' country-complete' : '') + (!unlocked ? ' country-locked' : '')} disabled={!unlocked} onClick={() => setSelectedCountry(country.id)}>
              <span className="country-flag">{country.flag}</span>
              <span className="country-info"><strong>{country.name[language] || country.name.en}</strong><small>{completed ? (language === 'ru' ? '90% достигнуто · страна открыта' : '90% reached · country cleared') : unlocked ? (language === 'ru' ? 'Цель: захватить 90%' : 'Goal: capture 90%') : (language === 'ru' ? 'Сначала пройди предыдущую страну' : 'Clear the previous country first')}</small><i className="country-progress"><b style={{ width: Math.min(100, record / 90 * 100) + '%' }}/></i></span>
              <span className="country-status">{completed ? <Check size={17}/> : unlocked ? <span>{record.toFixed(1)}%</span> : <Lock size={16}/>}</span>
            </button>;
          })}</div>
          <p className="world-hint">{language === 'ru' ? 'Захвати 90% страны за один раунд, чтобы открыть следующую. После финала мир начинается заново, но соперники становятся сильнее.' : 'Capture 90% of a country in one round to unlock the next. After the finale, the world resets and rivals get tougher.'}</p>
        </section>}
        {worldView === 'stats' && <section className="player-stats-panel">
          <div className="stats-rank"><Star size={22}/><div><span className="eyebrow">{language === 'ru' ? 'ЗВАНИЕ' : 'RANK'}</span><strong>{({recruit:language==='ru'?'Новобранец':'Recruit',explorer:language==='ru'?'Исследователь':'Explorer',captain:language==='ru'?'Капитан':'Captain',veteran:language==='ru'?'Ветеран':'Veteran',champion:language==='ru'?'Чемпион':'Champion',legend:language==='ru'?'Легенда':'Legend'})[rank] || rank}</strong></div><span>×{prestige + 1}</span></div>
          <div className="player-stats-grid">
            <div><small>{language === 'ru' ? 'Сыграно игр' : 'Games played'}</small><strong>{gamesPlayed}</strong></div>
            <div><small>{language === 'ru' ? 'Средняя территория' : 'Average territory'}</small><strong>{gamesPlayed ? (totalTerritory / gamesPlayed).toFixed(2) : '0.00'}%</strong></div>
            <div><small>{language === 'ru' ? 'Лучший результат' : 'Best result'}</small><strong>{bestTerritory.toFixed(3)}%</strong></div>
            <div><small>{language === 'ru' ? 'Стран пройдено' : 'Countries cleared'}</small><strong>{completedCountries.length}/{WORLD_COUNTRIES.length}</strong></div>
          </div>
          <div className="stats-record-list"><span className="eyebrow">{language === 'ru' ? 'РЕКОРДЫ СТРАН' : 'COUNTRY RECORDS'}</span>{WORLD_COUNTRIES.map(country => <div key={country.id}><span>{country.flag} {country.name[language] || country.name.en}</span><strong>{(Number(countryRecords[country.id]) || 0).toFixed(3)}%</strong></div>)}</div>
        </section>}
        <section className="mode-picker" aria-label={language === 'ru' ? 'Режим игры' : 'Game mode'} style={{ width: '100%', maxWidth: 380, margin: '10px auto', textAlign: 'left' }}>
          <span className="eyebrow">{language === 'ru' ? 'РЕЖИМ ИГРЫ' : 'GAME MODE'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
            {Object.values(GAME_MODES).map(mode => (
              <button key={mode.id} type="button" aria-pressed={selectedMode === mode.id} onClick={() => setSelectedMode(mode.id)} style={{ padding: 12, borderRadius: 12, textAlign: 'left', border: selectedMode === mode.id ? '1px solid #9b7bff' : '1px solid #34394a', background: selectedMode === mode.id ? '#25243b' : '#151823', color: '#f5f5fb' }}>
                <strong style={{ display: 'block', fontSize: 12 }}>{mode.title[language] || mode.title.en}</strong>
                <span style={{ display: 'block', marginTop: 6, color: '#a4abc0', fontSize: 10, lineHeight: 1.45 }}>{mode.description[language] || mode.description.en}</span>
                <span style={{ display: 'block', marginTop: 8, color: '#b9a8ff', font: '10px "DM Mono", monospace' }}>{language === 'ru' ? 'Рекорд' : 'Record'}: {(Number(modeRecords?.[mode.id]) || 0).toFixed(3)}%</span>
              </button>
            ))}
          </div>
        </section>
        {worldView === 'arena' && <section className="map-picker" aria-label={language === 'ru' ? 'Выбор карты' : 'Choose a map'} style={{ width: '100%', maxWidth: 380, margin: '10px auto', textAlign: 'left' }}>
          <span className="eyebrow">{language === 'ru' ? 'ФОРМА АРЕНЫ' : 'ARENA SHAPE'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
            {MAPS.map(map => (
              <button
                key={map.id}
                type="button"
                aria-pressed={selectedMap === map.id}
                onClick={() => setSelectedMap(map.id)}
                title={map.name[language] || map.name.en}
                style={{
                  minWidth: 0,
                  padding: '7px 2px',
                  borderRadius: 9,
                  border: selectedMap === map.id ? '1px solid #9b7bff' : '1px solid #34394a',
                  background: selectedMap === map.id ? '#25243b' : '#151823',
                  color: '#f5f5fb',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 4px)', gridTemplateRows: 'repeat(9, 4px)', gap: 1 }}>
                  {getMapPreview(map.id, 9).map((cell, index) => (
                    <i key={index} style={{ width: 4, height: 4, background: cell ? (selectedMap === map.id ? '#c1b0ff' : '#777f9d') : 'transparent', borderRadius: 1 }} />
                  ))}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{map.name[language] || map.name.en}</span>
              </button>
            ))}
          </div>
        </section>}
        {worldView === 'arena' && <div className="menu-meta">10 RIVALS <span>•</span> ONE ARENA</div>}
      </div>
    </main>
  );
}
