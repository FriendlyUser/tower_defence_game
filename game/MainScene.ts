
import Phaser from 'phaser';
import { GameStats, TowerConfig, TargetingPriority, TowerInstance } from "../types";

enum EnemyArchetype {
  SCOUT = 'SCOUT',      // Fast, low health
  SENTINEL = 'SENTINEL',// Balanced
  GOLIATH = 'GOLIATH',  // Slow, high health, armored
  BOSS = 'BOSS'         // Every 10 levels
}

export class MainScene extends Phaser.Scene {
  public add!: Phaser.GameObjects.GameObjectFactory;
  public physics!: Phaser.Physics.Arcade.ArcadePhysics;
  public input!: Phaser.Input.InputPlugin;
  public cameras!: Phaser.Cameras.Scene2D.CameraManager;
  public time!: Phaser.Time.Clock;
  public tweens!: Phaser.Tweens.TweenManager;
  public scale!: Phaser.Scale.ScaleManager;

  private path: Phaser.Curves.Path | null = null;
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private rangeGraphics: Phaser.GameObjects.Graphics | null = null;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;
  private enemies: Phaser.Physics.Arcade.Group | null = null;
  private towers: Phaser.Physics.Arcade.StaticGroup | null = null;
  private projectiles: Phaser.Physics.Arcade.Group | null = null;
  
  private stats: GameStats = { 
    gold: 500, 
    lives: 20, 
    level: 1, 
    score: 0, 
    towerCount: 0, 
    waveActive: false,
    gameSpeed: 1
  };
  
  private onStatsUpdate: (stats: GameStats) => void;
  private onGameOver: () => void;
  private onTowerSelected: (tower: TowerInstance | null) => void;
  
  private currentTowerType: TowerConfig | null = null;
  private selectedTowerObject: any = null;
  
  private nextEnemyTime: number = 0;
  private enemiesRemaining: number = 0;
  private waveInProgress: boolean = false;

  // Temporal Scaling
  private scaledTime: number = 0;
  private timeScale: number = 1;

  constructor(callbacks: { 
    onStatsUpdate: (s: GameStats) => void, 
    onGameOver: () => void,
    onTowerSelected: (t: TowerInstance | null) => void 
  }) {
    super('MainScene');
    this.onStatsUpdate = callbacks.onStatsUpdate;
    this.onGameOver = callbacks.onGameOver;
    this.onTowerSelected = callbacks.onTowerSelected;
  }

  init() {
    this.stats = { 
      gold: 500, 
      lives: 20, 
      level: 1, 
      score: 0, 
      towerCount: 0, 
      waveActive: false,
      gameSpeed: 1
    };
    this.selectedTowerObject = null;
    this.scaledTime = 0;
    this.timeScale = 1;
  }

  create() {
    this.graphics = this.add.graphics();
    this.rangeGraphics = this.add.graphics();
    this.selectionGraphics = this.add.graphics();
    
    this.enemies = this.physics.add.group();
    this.towers = this.physics.add.staticGroup();
    this.projectiles = this.physics.add.group();

    this.createPath();
    this.drawPath();

    this.physics.add.overlap(this.projectiles, this.enemies, (p, e) => this.handleHit(p, e), undefined, this);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, targets: any[]) => {
      if (targets.length === 0 && !this.currentTowerType) {
        this.deselectTower();
      }
      
      if (this.currentTowerType) {
        this.placeTower(pointer.x, pointer.y);
      }
    });

    this.onStatsUpdate(this.stats);
  }

  private createPath() {
    const { width, height } = this.scale;
    this.path = new Phaser.Curves.Path(-50, height / 2);
    // Path becomes more complex faster: max 15 segments reached by level 30
    const segments = Math.min(3 + Math.floor(this.stats.level / 2.5), 15);
    for (let i = 1; i <= segments; i++) {
      const x = (width / segments) * i;
      const y = i === segments ? height / 2 : Phaser.Math.Between(80, height - 80);
      this.path.lineTo(x, y);
    }
  }

  private drawPath() {
    if (!this.graphics || !this.path) return;
    this.graphics.clear();
    this.graphics.lineStyle(40, 0x1e293b, 1);
    this.path.draw(this.graphics);
    this.graphics.lineStyle(2, 0x334155, 1);
    this.path.draw(this.graphics);
  }

  public setGameSpeed(multiplier: number) {
    this.timeScale = multiplier;
    this.stats.gameSpeed = multiplier;
    this.physics.world.timeScale = 1 / multiplier;
    this.time.timeScale = multiplier;
  }

  update(time: number, delta: number) {
    const scaledDelta = delta * this.timeScale;
    this.scaledTime += scaledDelta;

    if (this.rangeGraphics) {
      this.rangeGraphics.clear();
      if (this.currentTowerType) {
        const pointer = this.input.activePointer;
        const isInvalid = this.checkPathProximity(pointer.x, pointer.y);
        this.rangeGraphics.lineStyle(2, isInvalid ? 0xff0000 : 0x3b82f6, 0.5);
        this.rangeGraphics.fillStyle(isInvalid ? 0xff0000 : 0x3b82f6, 0.1);
        this.rangeGraphics.strokeCircle(pointer.x, pointer.y, this.currentTowerType.range);
        this.rangeGraphics.fillCircle(pointer.x, pointer.y, this.currentTowerType.range);
      } else if (this.selectedTowerObject) {
        this.rangeGraphics.lineStyle(2, this.selectedTowerObject.config.color, 0.3);
        this.rangeGraphics.fillStyle(this.selectedTowerObject.config.color, 0.05);
        this.rangeGraphics.strokeCircle(this.selectedTowerObject.x, this.selectedTowerObject.y, this.selectedTowerObject.config.range);
        this.rangeGraphics.fillCircle(this.selectedTowerObject.x, this.selectedTowerObject.y, this.selectedTowerObject.config.range);
      }
    }

    if (this.selectionGraphics) {
      this.selectionGraphics.clear();
      if (this.selectedTowerObject) {
        this.selectionGraphics.lineStyle(2, 0xffffff, 0.8);
        this.selectionGraphics.strokeRect(
          this.selectedTowerObject.x - (22 * this.selectedTowerObject.scale), 
          this.selectedTowerObject.y - (22 * this.selectedTowerObject.scale), 
          44 * this.selectedTowerObject.scale, 
          44 * this.selectedTowerObject.scale
        );
      }
    }

    if (this.waveInProgress && this.enemiesRemaining > 0 && this.scaledTime > this.nextEnemyTime) {
      this.spawnEnemy();
      this.enemiesRemaining--;
      // Spawn speed ramps up faster per level
      this.nextEnemyTime = this.scaledTime + (1200 / (1 + this.stats.level * 0.4));
    }

    if (this.waveInProgress && this.enemiesRemaining === 0 && this.enemies?.countActive() === 0) {
      this.completeLevel();
    }

    this.towers?.getChildren().forEach((towerObj: any) => {
      if (this.scaledTime > towerObj.nextFire) {
        const target = this.getPriorityTarget(towerObj);
        if (target) {
          this.shoot(towerObj, target);
          towerObj.nextFire = this.scaledTime + towerObj.config.fireRate;
        }
      }
    });

    this.enemies?.getChildren().forEach((enemyObj: any) => {
      const enemy = enemyObj as any;
      if (!enemy.active) return;
      enemy.t += (enemy.speed * scaledDelta) / 100000;
      const pos = this.path?.getPoint(enemy.t);
      if (pos) {
        enemy.setPosition(pos.x, pos.y);
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        if (body) body.reset(enemy.x, enemy.y);
        this.updateHealthBar(enemy);
      }
      if (enemy.t >= 1) {
        this.stats.lives--;
        this.onStatsUpdate({ ...this.stats });
        if (enemy.healthBar) enemy.healthBar.destroy();
        enemy.destroy();
        if (this.stats.lives <= 0) this.onGameOver();
      }
    });

    this.projectiles?.getChildren().forEach((p: any) => {
      if (!p.target || !p.target.active) {
        p.destroy();
        return;
      }
      this.physics.moveToObject(p, p.target, 850);
      const angle = Phaser.Math.Angle.Between(p.x, p.y, p.target.x, p.target.y);
      p.setRotation(angle + Math.PI/2);
    });
  }

  private checkPathProximity(x: number, y: number): boolean {
    if (!this.path) return false;
    for (let t = 0; t <= 1; t += 0.005) {
      const p = this.path.getPoint(t);
      if (p && Phaser.Math.Distance.Between(x, y, p.x, p.y) < 35) return true;
    }
    return false;
  }

  private spawnEnemy() {
    if (!this.enemies || !this.path) return;
    const level = this.stats.level;
    const isBossLevel = level % 10 === 0;
    
    let archetype = EnemyArchetype.SENTINEL;
    
    if (isBossLevel) {
      archetype = EnemyArchetype.BOSS;
    } else {
      const roll = Math.random();
      if (level >= 4 && roll < 0.25) archetype = EnemyArchetype.GOLIATH;
      else if (level >= 2 && roll < 0.45) archetype = EnemyArchetype.SCOUT;
    }

    let hpMultiplier = 1;
    let speedMultiplier = 1;
    let size = { w: 22, h: 22 };
    let color = 0x60a5fa;
    let stroke = 0xffffff;

    switch (archetype) {
      case EnemyArchetype.SCOUT:
        hpMultiplier = 0.5;
        speedMultiplier = 1.7;
        size = { w: 14, h: 24 };
        color = 0xfacc15; // Yellow
        break;
      case EnemyArchetype.GOLIATH:
        hpMultiplier = 4.0;
        speedMultiplier = 0.6;
        size = { w: 34, h: 34 };
        color = 0xa855f7; // Purple
        stroke = 0xdedede;
        break;
      case EnemyArchetype.BOSS:
        hpMultiplier = 15 + (level / 2);
        speedMultiplier = 0.5;
        size = { w: 42, h: 42 };
        color = 0xef4444; // Red
        stroke = 0xffffff;
        break;
    }

    // Health and Speed scale faster for 30 levels
    // Lowered early game health (1-5) via power curve
    const baseHp = 15 + Math.pow(level, 1.6) * 8 + (level * 15);
    const baseSpeed = 3.2 + (level * 0.45);
    
    const startPoint = this.path.getPoint(0);
    const rect = this.add.rectangle(startPoint.x, startPoint.y, size.w, size.h, color);
    rect.setStrokeStyle(archetype === EnemyArchetype.GOLIATH || archetype === EnemyArchetype.BOSS ? 4 : 2, stroke, 0.8);
    this.physics.add.existing(rect);
    
    const enemy = rect as any;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) body.setSize(size.w, size.h);
    
    enemy.archetype = archetype;
    enemy.hp = baseHp * hpMultiplier;
    enemy.maxHp = enemy.hp;
    enemy.speed = baseSpeed * speedMultiplier;
    enemy.t = 0;
    enemy.setDepth(5);
    
    this.enemies.add(enemy);
    const hb = this.add.graphics();
    hb.setDepth(10);
    enemy.healthBar = hb;
    this.updateHealthBar(enemy);
  }

  private updateHealthBar(enemy: any) {
    if (!enemy || !enemy.active || !enemy.healthBar) return;
    enemy.healthBar.clear();
    const barWidth = Math.max(30, enemy.width + 10);
    enemy.healthBar.fillStyle(0x000000, 0.6);
    enemy.healthBar.fillRect(enemy.x - barWidth/2, enemy.y - (enemy.height/2 + 15), barWidth, 6);
    
    const healthPercent = Math.max(0, enemy.hp / enemy.maxHp);
    const color = healthPercent > 0.5 ? 0x22c55e : (healthPercent > 0.25 ? 0xeab308 : 0xef4444);
    enemy.healthBar.fillStyle(color, 1);
    enemy.healthBar.fillRect(enemy.x - barWidth/2, enemy.y - (enemy.height/2 + 15), barWidth * healthPercent, 6);
  }

  private getPriorityTarget(tower: any) {
    const activeEnemies = (this.enemies?.getChildren() as any[]).filter(e => e.active);
    const inRange = activeEnemies.filter(e => 
      Phaser.Math.Distance.Between(tower.x, tower.y, e.x, e.y) <= tower.config.range
    );

    if (inRange.length === 0) return null;

    switch (tower.targetingPriority) {
      case TargetingPriority.FIRST:
        return inRange.reduce((prev, curr) => (prev.t > curr.t) ? prev : curr);
      case TargetingPriority.STRONGEST:
        return inRange.reduce((prev, curr) => (prev.hp > curr.hp) ? prev : curr);
      case TargetingPriority.WEAKEST:
        return inRange.reduce((prev, curr) => (prev.hp < curr.hp) ? prev : curr);
      case TargetingPriority.CLOSEST:
      default:
        return inRange.reduce((prev, curr) => {
          const distPrev = Phaser.Math.Distance.Between(tower.x, tower.y, prev.x, prev.y);
          const distCurr = Phaser.Math.Distance.Between(tower.x, tower.y, curr.x, curr.y);
          return (distPrev < distCurr) ? prev : curr;
        });
    }
  }

  private shoot(tower: any, target: any) {
    const arrow = this.add.triangle(tower.x, tower.y, 0, 16, 8, 0, 16, 16, tower.config.color);
    arrow.setStrokeStyle(2, 0xffffff, 1.0);
    arrow.setDepth(8);
    // Visual indicator of level on projectile size
    arrow.setScale(1 + (tower.level - 1) * 0.15);
    
    this.physics.add.existing(arrow);
    const projectile = arrow as any;
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    if (body) body.setSize(12, 12);
    
    projectile.damage = tower.config.damage;
    projectile.towerId = tower.config.id; 
    projectile.target = target;
    
    const angle = Phaser.Math.Angle.Between(tower.x, tower.y, target.x, target.y);
    projectile.setRotation(angle + Math.PI/2);
    this.physics.moveToObject(projectile, target, 850);
    this.projectiles?.add(projectile);
    
    this.time.delayedCall(8000 / this.timeScale, () => { if (projectile && projectile.active) projectile.destroy(); });
  }

  private handleHit(projectileObj: any, enemyObj: any) {
    const projectile = projectileObj as any;
    const enemy = enemyObj as any;
    if (!projectile.active || !enemy.active) return;

    let finalDamage = projectile.damage;

    // Tactical Resistances / Vulnerabilities for Heavy Units
    if (enemy.archetype === EnemyArchetype.GOLIATH || enemy.archetype === EnemyArchetype.BOSS) {
      if (projectile.towerId === 'rapid') {
        finalDamage *= 0.5; // Rapid towers are resisted by armor
      }
      if (projectile.towerId === 'sniper') {
        finalDamage *= 1.25; // Sniper towers pierce armor
      }
    }

    enemy.hp -= finalDamage;
    projectile.destroy();
    
    const isCritical = finalDamage > projectile.damage;
    const isResisted = finalDamage < projectile.damage;
    
    const damageText = this.add.text(enemy.x, enemy.y - 35, isResisted ? '.' : (isCritical ? '!' : '-'), { 
      fontSize: isCritical ? '36px' : (isResisted ? '18px' : '28px'), 
      color: isResisted ? '#94a3b8' : (isCritical ? '#fbbf24' : '#ff4444'), 
      fontStyle: 'bold' 
    });
    damageText.setOrigin(0.5);
    damageText.setDepth(15);
    this.tweens.add({ targets: damageText, y: damageText.y - 60, alpha: 0, duration: 600 / this.timeScale, onComplete: () => damageText.destroy() });
    
    this.tweens.add({ 
      targets: enemy, 
      alpha: 0.5, 
      scale: enemy.scale * 1.2, 
      duration: 60 / this.timeScale, 
      yoyo: true, 
      onComplete: () => { if (enemy && enemy.active) { enemy.alpha = 1; enemy.scale = 1; } } 
    });

    if (enemy.hp <= 0) {
      // Rewards scale faster for 30 levels
      let goldReward = 40 + Math.floor(this.stats.level * 8);
      let scoreReward = 800 * this.stats.level;
      
      if (enemy.archetype === EnemyArchetype.GOLIATH) { goldReward *= 2.5; scoreReward *= 2; }
      else if (enemy.archetype === EnemyArchetype.BOSS) { goldReward *= 10; scoreReward *= 10; }

      this.stats.gold += goldReward;
      this.stats.score += scoreReward;
      this.onStatsUpdate({ ...this.stats });
      
      if (enemy.healthBar) enemy.healthBar.destroy();
      enemy.destroy();
      const burst = this.add.circle(enemy.x, enemy.y, 20, 0xffffff, 0.8);
      this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 300 / this.timeScale, onComplete: () => burst.destroy() });
    } else {
      this.updateHealthBar(enemy);
    }
  }

  private placeTower(x: number, y: number) {
    if (!this.currentTowerType) return;
    if (this.stats.gold < this.currentTowerType.cost) {
        this.cameras.main.shake(100, 0.005);
        return;
    }
    if (this.checkPathProximity(x, y)) {
      const flash = this.add.circle(x, y, 20, 0xff0000, 0.4);
      this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 250 / this.timeScale, onComplete: () => flash.destroy() });
      return;
    }

    const towerColor = this.currentTowerType.color;
    this.stats.gold -= this.currentTowerType.cost;
    this.stats.towerCount++;
    
    const id = `tower-${Date.now()}`;
    const towerRect = this.add.rectangle(x, y, 38, 38, 0x1e293b);
    towerRect.setStrokeStyle(3, towerColor);
    towerRect.setInteractive();
    towerRect.setDepth(6);

    const towerInner = this.add.triangle(x, y, 0, 14, 7, 0, 14, 14, towerColor);
    towerInner.setDepth(7);

    // Level indicator text
    const levelText = this.add.text(x, y + 25, "L1", { fontSize: '10px', color: '#ffffff', fontStyle: 'bold' });
    levelText.setOrigin(0.5);
    levelText.setDepth(10);

    const tower = towerRect as any;
    tower.id = id;
    tower.level = 1;
    tower.config = { ...this.currentTowerType };
    tower.targetingPriority = TargetingPriority.FIRST;
    tower.nextFire = 0;
    tower.inner = towerInner;
    tower.lvlLabel = levelText;
    this.towers?.add(tower);

    towerRect.on('pointerdown', (pointer: any, localX: any, localY: any, event: any) => {
      if (event && event.stopPropagation) event.stopPropagation();
      this.selectTower(tower);
    });

    this.onStatsUpdate({ ...this.stats });

    const ring = this.add.circle(x, y, 20);
    ring.setStrokeStyle(4, towerColor, 0.8);
    ring.setDepth(4);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 400 / this.timeScale,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.DegToRad(i * 45);
      const px = x + Math.cos(angle) * 10;
      const py = y + Math.sin(angle) * 10;
      const particleSize = Phaser.Math.Between(4, 8);
      const particle = this.add.rectangle(px, py, particleSize, particleSize, towerColor);
      particle.setDepth(8);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 60,
        y: y + Math.sin(angle) * 60,
        rotation: Phaser.Math.FloatBetween(0, Math.PI * 2),
        alpha: 0,
        scale: 0,
        duration: (500 + Phaser.Math.Between(0, 200)) / this.timeScale,
        ease: 'Power2.out',
        onComplete: () => particle.destroy()
      });
    }

    this.tweens.add({ 
      targets: [towerRect, towerInner], 
      scale: { from: 1.8, to: 1 }, 
      duration: 350 / this.timeScale, 
      ease: 'Back.out' 
    });
    
    this.cameras.main.shake(150, 0.002);
  }

  public upgradeTower(towerId: string) {
    const towersArr = this.towers?.getChildren() as any[];
    const tower = towersArr.find(t => t.id === towerId);
    if (tower) {
      tower.level++;
      // Apply stat boosts
      tower.config.damage = Math.floor(tower.config.damage * 1.5);
      tower.config.fireRate = Math.floor(tower.config.fireRate * 0.85);
      
      // Update UI label
      if (tower.lvlLabel) tower.lvlLabel.setText(`L${tower.level}`);
      
      // Visual feedback
      const towerColor = tower.config.color;
      
      // 1. Scale bump
      this.tweens.add({
        targets: [tower, tower.inner],
        scale: 1 + (tower.level - 1) * 0.1,
        duration: 300,
        ease: 'Back.out'
      });

      // 2. Upgrade effect (sparkle burst)
      for (let i = 0; i < 12; i++) {
        const angle = Phaser.Math.DegToRad(i * 30);
        const particle = this.add.star(tower.x, tower.y, 5, 2, 6, 0xffffff);
        particle.setDepth(15);
        this.tweens.add({
          targets: particle,
          x: tower.x + Math.cos(angle) * 50,
          y: tower.y + Math.sin(angle) * 50,
          alpha: 0,
          scale: 2,
          rotation: Math.PI,
          duration: 600,
          onComplete: () => particle.destroy()
        });
      }

      // Re-select to update UI in React
      this.selectTower(tower);
    }
  }

  private selectTower(tower: any) {
    this.selectedTowerObject = tower;
    this.onTowerSelected({
      id: tower.id,
      x: tower.x,
      y: tower.y,
      config: tower.config,
      targetingPriority: tower.targetingPriority,
      level: tower.level
    });
  }

  private deselectTower() {
    this.selectedTowerObject = null;
    this.onTowerSelected(null);
  }

  public updateTowerPriority(towerId: string, priority: TargetingPriority) {
    const towersArr = this.towers?.getChildren() as any[];
    const tower = towersArr.find(t => t.id === towerId);
    if (tower) {
      tower.targetingPriority = priority;
      if (this.selectedTowerObject && this.selectedTowerObject.id === towerId) {
        this.selectTower(tower);
      }
    }
  }

  public setTowerType(type: TowerConfig | null) {
    this.currentTowerType = type;
    if (type) this.deselectTower();
    if (!type && this.rangeGraphics) this.rangeGraphics.clear();
  }

  public startWave() {
    if (this.waveInProgress) return;
    this.waveInProgress = true;
    this.stats.waveActive = true;
    const isBossLevel = this.stats.level % 10 === 0;
    // Enemies remaining grows much faster for 30 levels
    this.enemiesRemaining = isBossLevel ? Math.max(1, Math.floor(this.stats.level / 5)) : 20 + Math.floor(this.stats.level * 8);
    this.onStatsUpdate({ ...this.stats });
  }

  private completeLevel() {
    this.waveInProgress = false;
    this.stats.waveActive = false;
    this.stats.level++;
    // Gold rewards scale up to match higher upgrade needs
    this.stats.gold += 350 + (this.stats.level * 60);
    this.onStatsUpdate({ ...this.stats });
    if (this.stats.level > 30) { this.onGameOver(); return; }
    this.createPath();
    this.drawPath();
  }
}
