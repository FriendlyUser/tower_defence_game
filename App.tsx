
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Phaser from 'phaser';
import { MainScene } from './game/MainScene';
import { GameState, GameStats, TowerConfig, TowerInstance, TargetingPriority } from './types';

interface TutorialStepDef {
  title: string;
  content: string;
  targetId?: string;
  condition?: (stats: GameStats, placement: TowerConfig | null, instance: TowerInstance | null) => boolean;
  autoAdvance?: boolean;
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: "Welcome Commander",
    content: "Welcome to Polygon Siege. Let's walk through the basics of defending the core. Click Next to continue.",
  },
  {
    title: "Tactical Arsenal",
    content: "This is your arsenal. Select the 'Striker' tower to prepare for placement.",
    targetId: "tower-btn-basic",
    condition: (stats, placement, instance) => placement?.id === 'basic',
    autoAdvance: true
  },
  {
    title: "Tower Placement",
    content: "Now, click anywhere on the dark grid (away from the path) to place your tower. It costs 100 Gold.",
    targetId: "game-container",
    condition: (stats, placement, instance) => stats.towerCount > 0,
    autoAdvance: true
  },
  {
    title: "Engage the Enemy",
    content: "Excellent. Now click the ENGAGE WAVE button to start the first wave of enemies.",
    targetId: "engage-btn",
    condition: (stats, placement, instance) => stats.waveActive,
    autoAdvance: true
  },
  {
    title: "Select Tower",
    content: "While the tower defends, click on it to view its intel and upgrade options.",
    targetId: "game-container",
    condition: (stats, placement, instance) => instance !== null,
    autoAdvance: true
  },
  {
    title: "Upgrade Tower",
    content: "Upgrading increases damage and fire rate. Click the UPGRADE button.",
    targetId: "upgrade-btn",
    condition: (stats, placement, instance) => instance !== null && instance.level > 1,
    autoAdvance: true
  },
  {
    title: "Targeting Priority",
    content: "You can change who the tower targets first. Try setting it to 'STRONGEST'.",
    targetId: "priority-STRONGEST",
    condition: (stats, placement, instance) => instance !== null && instance.targetingPriority === 'STRONGEST',
    autoAdvance: true
  },
  {
    title: "Tutorial Complete",
    content: "You're ready to command! Defend the core through all 30 waves.",
  }
];

const TOWERS: TowerConfig[] = [
  {
    id: 'basic',
    name: 'Striker',
    cost: 100,
    damage: 10,
    range: 150,
    fireRate: 800,
    color: 0x3b82f6,
    description: 'Reliable all-rounder. No special properties.'
  },
  {
    id: 'sniper',
    name: 'Longshot',
    cost: 250,
    damage: 40,
    range: 300,
    fireRate: 2500,
    color: 0xeab308,
    description: 'Piercing shots: +25% DMG vs Goliaths & Bosses.'
  },
  {
    id: 'rapid',
    name: 'Swarm',
    cost: 200,
    damage: 4,
    range: 120,
    fireRate: 200,
    color: 0xa855f7,
    description: 'High fire rate. -50% DMG vs Goliaths & Bosses.'
  }
];

const SPEED_LEVELS = [1, 2, 4, 8, 16];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({ 
    gold: 500, 
    lives: 20, 
    level: 1, 
    score: 0, 
    towerCount: 0, 
    waveActive: false,
    gameSpeed: 1
  });
  const [selectedPlacementTower, setSelectedPlacementTower] = useState<TowerConfig | null>(null);
  const [selectedTowerInstance, setSelectedTowerInstance] = useState<TowerInstance | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number>(-1);
  
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);

  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats(prev => ({ ...prev, ...newStats }));
  }, []);

  const handleGameOver = useCallback(() => {
    setGameState(GameState.GAMEOVER);
  }, []);

  const handleTowerSelected = useCallback((tower: TowerInstance | null) => {
    setSelectedTowerInstance(tower);
    if (tower) setSelectedPlacementTower(null);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const sceneInstance = new MainScene({ 
      onStatsUpdate: handleStatsUpdate,
      onGameOver: handleGameOver,
      onTowerSelected: handleTowerSelected
    });
    
    sceneRef.current = sceneInstance;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: 800,
      height: 600,
      backgroundColor: '#0f172a',
      physics: {
        default: 'arcade',
        arcade: { debug: false }
      },
      scene: sceneInstance
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      sceneRef.current = null;
    };
  }, [handleStatsUpdate, handleGameOver, handleTowerSelected]);

  useEffect(() => {
    if (stats.level > 30) {
      setGameState(GameState.WIN);
    }
  }, [stats.level]);

  useEffect(() => {
    if (tutorialStep >= 0 && tutorialStep < TUTORIAL_STEPS.length) {
      const step = TUTORIAL_STEPS[tutorialStep];
      if (step.autoAdvance && step.condition && step.condition(stats, selectedPlacementTower, selectedTowerInstance)) {
        setTutorialStep(s => s + 1);
      }
    }
  }, [stats, selectedPlacementTower, selectedTowerInstance, tutorialStep]);

  const togglePlacementTower = (tower: TowerConfig) => {
    const newSelected = selectedPlacementTower?.id === tower.id ? null : tower;
    setSelectedPlacementTower(newSelected);
    if (newSelected) setSelectedTowerInstance(null);
    
    if (sceneRef.current) {
        sceneRef.current.setTowerType(newSelected);
    }
  };

  const cycleGameSpeed = () => {
    const currentIndex = SPEED_LEVELS.indexOf(stats.gameSpeed);
    const nextIndex = (currentIndex + 1) % SPEED_LEVELS.length;
    const nextSpeed = SPEED_LEVELS[nextIndex];
    
    if (sceneRef.current) {
      sceneRef.current.setGameSpeed(nextSpeed);
      setStats(prev => ({ ...prev, gameSpeed: nextSpeed }));
    }
  };

  const changeTargetingPriority = (priority: TargetingPriority) => {
    if (selectedTowerInstance && sceneRef.current) {
      sceneRef.current.updateTowerPriority(selectedTowerInstance.id, priority);
    }
  };

  const upgradeCost = useMemo(() => {
    if (!selectedTowerInstance) return 0;
    return Math.floor(selectedTowerInstance.config.cost * 0.8 * selectedTowerInstance.level);
  }, [selectedTowerInstance]);

  const handleUpgrade = () => {
    if (!selectedTowerInstance || stats.gold < upgradeCost) return;
    
    if (sceneRef.current) {
      setStats(prev => ({ ...prev, gold: prev.gold - upgradeCost }));
      sceneRef.current.upgradeTower(selectedTowerInstance.id);
    }
  };

  const startNextWave = () => {
    if (sceneRef.current) {
        sceneRef.current.startWave();
    }
  };

  const calculateRank = () => {
    const maxScorePossible = 2000000; 
    const percentage = (stats.score / maxScorePossible) * 100;
    if (percentage > 80) return 'S';
    if (percentage > 60) return 'A';
    if (percentage > 40) return 'B';
    if (percentage > 20) return 'C';
    return 'D';
  };

  const isEngageDisabled = stats.waveActive || (stats.level === 1 && stats.towerCount === 0);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-950 text-slate-100 font-sans p-4 gap-4 overflow-hidden relative">
      {/* Tutorial Overlay */}
      {tutorialStep >= 0 && tutorialStep < TUTORIAL_STEPS.length && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-blue-500 rounded-xl p-6 shadow-[0_0_40px_rgba(59,130,246,0.3)] max-w-md w-full animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-black shrink-0">
              {tutorialStep + 1}
            </div>
            <h3 className="text-xl font-black text-white">{TUTORIAL_STEPS[tutorialStep].title}</h3>
          </div>
          <p className="text-slate-300 mb-6">{TUTORIAL_STEPS[tutorialStep].content}</p>
          
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setTutorialStep(-1)}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              SKIP TUTORIAL
            </button>
            {!TUTORIAL_STEPS[tutorialStep].autoAdvance && (
              <button 
                onClick={() => {
                  if (tutorialStep === TUTORIAL_STEPS.length - 1) {
                    setTutorialStep(-1);
                  } else {
                    setTutorialStep(s => s + 1);
                  }
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg"
              >
                {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'FINISH' : 'NEXT'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tutorial Highlight Styles */}
      {tutorialStep >= 0 && TUTORIAL_STEPS[tutorialStep].targetId && (
        <style>{`
          #${TUTORIAL_STEPS[tutorialStep].targetId} {
            position: relative;
            z-index: 40;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.8) !important;
            border-color: #3b82f6 !important;
            animation: tutorial-pulse 2s infinite;
          }
          @keyframes tutorial-pulse {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
          }
        `}</style>
      )}

      {/* Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 no-print shrink-0">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
          <h1 className="text-2xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            POLYGON SIEGE
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Strategic Defense Array</p>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <StatCard label="GOLD" value={stats.gold.toLocaleString()} color="text-yellow-400" />
            <StatCard label="LIVES" value={stats.lives.toString()} color="text-red-400" />
            <StatCard label="LEVEL" value={`${stats.level}/30`} color="text-blue-400" />
            <StatCard label="SCORE" value={stats.score.toLocaleString()} color="text-slate-400" />
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Temporal Control</h3>
          <button 
            onClick={cycleGameSpeed}
            className={`w-full p-3 rounded-lg border transition-all flex items-center justify-between group overflow-hidden relative ${
              stats.gameSpeed > 1 
                ? 'bg-blue-600/20 border-blue-400 text-blue-100' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3 z-10">
              <div className={`transition-transform duration-300 ${stats.gameSpeed > 1 ? 'animate-spin' : ''}`} style={{ animationDuration: `${2000 / stats.gameSpeed}ms` }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-bold text-sm">Chronos Scale</span>
            </div>
            <span className={`text-xl font-black z-10 ${stats.gameSpeed >= 8 ? 'text-purple-400' : 'text-blue-400'}`}>
              {stats.gameSpeed}x
            </span>
            <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${(SPEED_LEVELS.indexOf(stats.gameSpeed) + 1) / SPEED_LEVELS.length * 100}%` }} />
          </button>
        </div>

        <div className="flex-1 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-y-auto">
          {selectedTowerInstance ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Tower Intel</h3>
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-black">LVL {selectedTowerInstance.level}</span>
                </div>
                <button onClick={() => handleTowerSelected(null)} className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded border flex items-center justify-center" style={{ borderColor: `#${selectedTowerInstance.config.color.toString(16).padStart(6, '0')}` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `#${selectedTowerInstance.config.color.toString(16).padStart(6, '0')}` }} />
                  </div>
                  <span className="font-bold text-lg">{selectedTowerInstance.config.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2">
                  <div className="bg-slate-950/30 p-2 rounded flex flex-col">
                    <span>DAMAGE:</span>
                    <span className="text-slate-100 font-bold">{selectedTowerInstance.config.damage}</span>
                  </div>
                  <div className="bg-slate-950/30 p-2 rounded flex flex-col">
                    <span>COOLDOWN:</span>
                    <span className="text-slate-100 font-bold">{selectedTowerInstance.config.fireRate}ms</span>
                  </div>
                </div>

                <button
                  id="upgrade-btn"
                  onClick={handleUpgrade}
                  disabled={stats.gold < upgradeCost}
                  className={`mt-4 w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    stats.gold >= upgradeCost
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  UPGRADE (¤{upgradeCost})
                </button>
              </div>

              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Targeting Matrix</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(TargetingPriority).map(priority => (
                  <button
                    id={`priority-${priority}`}
                    key={priority}
                    onClick={() => changeTargetingPriority(priority)}
                    className={`p-3 text-[10px] font-bold rounded-md border transition-all ${
                      selectedTowerInstance.targetingPriority === priority
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Tactical Arsenal</h3>
              <div className="space-y-3">
                {TOWERS.map(tower => (
                  <button
                    id={`tower-btn-${tower.id}`}
                    key={tower.id}
                    onClick={() => togglePlacementTower(tower)}
                    disabled={stats.gold < tower.cost}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${
                      selectedPlacementTower?.id === tower.id 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                    } ${stats.gold < tower.cost ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded border-2 flex items-center justify-center`} style={{ borderColor: `#${tower.color.toString(16).padStart(6, '0')}` }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${tower.color.toString(16).padStart(6, '0')}` }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{tower.name}</span>
                        <span className="text-yellow-500 text-sm font-bold">¤{tower.cost}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{tower.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          id="engage-btn"
          onClick={startNextWave}
          disabled={isEngageDisabled}
          className={`w-full py-4 rounded-xl font-black text-lg transition-all shadow-lg active:scale-95 ${
            isEngageDisabled 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {stats.waveActive 
            ? 'WAVE IN PROGRESS' 
            : (stats.level === 1 && stats.towerCount === 0) 
              ? 'PLACE 1 TOWER' 
              : `ENGAGE WAVE ${stats.level}`}
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col gap-4 relative min-w-0">
        <div id="game-container" className="flex-1 bg-slate-900 rounded-xl shadow-inner relative overflow-x-auto overflow-y-hidden border border-slate-800">
          
          {/* HUD Overlay - Chronos badge */}
          {stats.gameSpeed > 1 && (
            <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-[10px] font-black text-purple-400 animate-pulse backdrop-blur-md no-print">
              TIME COMPRESSION ({stats.gameSpeed}X)
            </div>
          )}

          {/* Screens Overlay */}
          <div className="absolute inset-0 z-20 pointer-events-none sticky left-0">
            {gameState === GameState.START && (
              <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-700">
                <div className="p-12 text-center max-w-md">
                  <div className="mb-6 inline-block p-4 rounded-full bg-blue-500/10 border border-blue-500/30">
                    <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.955 11.955 0 01-8.618 3.04 11.955 11.955 0 01-8.618-3.04m17.236 0A11.955 11.955 0 0112 21.056a11.955 11.955 0 01-8.618-3.04" />
                    </svg>
                  </div>
                  <h2 className="text-5xl font-black mb-4 tracking-tighter">COMMAND READY</h2>
                  <p className="text-slate-400 mb-8 font-light leading-relaxed">Defend the core through 30 waves of escalating geometric evolution. Optimize your arsenal and master temporal flow.</p>
                  <div className="flex flex-col gap-4 w-full">
                    <button 
                      onClick={() => {
                        if (sceneRef.current) sceneRef.current.scene.restart();
                        setGameState(GameState.PLAYING);
                      }} 
                      className="w-full px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-xl transition-all shadow-[0_0_40px_rgba(37,99,235,0.4)] active:scale-95"
                    >
                      INITIALIZE DEFENSES
                    </button>
                    <button 
                      onClick={() => {
                        if (sceneRef.current) sceneRef.current.scene.restart();
                        setGameState(GameState.PLAYING);
                        setTutorialStep(0);
                      }} 
                      className="w-full px-10 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full font-bold text-xl transition-all active:scale-95 text-slate-300"
                    >
                      TRAINING SIMULATION
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gameState === GameState.GAMEOVER && (
              <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md animate-in fade-in duration-1000">
                <div className="text-center p-8 bg-red-900/20 border border-red-500/30 rounded-3xl shadow-2xl max-w-lg w-full">
                  <h2 className="text-6xl font-black text-white mb-2 tracking-tighter animate-pulse">SYSTEM CRITICAL</h2>
                  <div className="w-24 h-1 bg-red-500 mx-auto mb-6"></div>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-red-200 border-b border-red-500/20 pb-2">
                      <span className="uppercase text-xs font-bold tracking-widest">WAVES SURVIVED</span>
                      <span className="text-2xl font-black">{stats.level - 1}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-200 border-b border-red-500/20 pb-2">
                      <span className="uppercase text-xs font-bold tracking-widest">FINAL SCORE</span>
                      <span className="text-2xl font-black">{stats.score.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-200">
                      <span className="uppercase text-xs font-bold tracking-widest">RANK</span>
                      <span className="text-4xl font-black text-white">{calculateRank()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => window.location.reload()} 
                      className="px-6 py-5 bg-white text-red-950 rounded-full font-black text-xl transition-all hover:bg-red-50 hover:scale-[1.02] active:scale-95 shadow-xl"
                    >
                      REBOOT
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="px-6 py-5 bg-red-600 text-white rounded-full font-black text-xl transition-all hover:bg-red-500 hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      PRINT
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gameState === GameState.WIN && (
              <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-teal-950/90 backdrop-blur-md animate-in zoom-in-95 duration-700">
                <div className="text-center p-10 bg-teal-900/20 border border-teal-500/30 rounded-3xl shadow-2xl max-w-lg w-full relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                  
                  <div className="mb-4 inline-block px-4 py-1 rounded-full bg-teal-500/20 text-teal-400 text-xs font-black tracking-[0.2em] uppercase">
                    Mission Accomplished
                  </div>
                  <h2 className="text-6xl font-black text-white mb-2 tracking-tighter">ASCENSION COMPLETE</h2>
                  <div className="w-24 h-1 bg-teal-500 mx-auto mb-8"></div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-teal-500/20">
                      <div className="text-xs font-bold text-teal-500 uppercase tracking-widest mb-1">Final Score</div>
                      <div className="text-2xl font-black text-white">{stats.score.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-teal-500/20">
                      <div className="text-xs font-bold text-teal-500 uppercase tracking-widest mb-1">Combat Rank</div>
                      <div className="text-4xl font-black text-teal-400">{calculateRank()}</div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-teal-500/20 col-span-2">
                      <div className="text-xs font-bold text-teal-500 uppercase tracking-widest mb-1">Lives Maintained</div>
                      <div className="text-xl font-black text-white">{stats.lives} / 20</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => window.location.reload()} 
                      className="px-6 py-5 bg-white text-teal-950 rounded-full font-black text-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                    >
                      NEW RUN
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="px-6 py-5 bg-gradient-to-r from-teal-400 to-blue-500 text-white rounded-full font-black text-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      ARCHIVE
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
      <div className="text-[10px] font-bold text-slate-500 tracking-tighter mb-1 uppercase">{label}</div>
      <div className={`text-lg font-black truncate ${color}`}>{value}</div>
    </div>
  );
}
