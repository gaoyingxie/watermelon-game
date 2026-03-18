/**
 * 合成大西瓜 - 性能优化版
 * 可爱画风 + 可靠碰撞 + 高性能
 */

// ==================== 配置 ====================
const CONFIG = {
    // 水果配置
    FRUITS: [
        { name: '蓝莓', emoji: '🫐', radius: 20, color: '#5c6bc0', score: 2 },
        { name: '柠檬', emoji: '🍋', radius: 26, color: '#ffeb3b', score: 4 },
        { name: '猕猴桃', emoji: '🥝', radius: 33, color: '#8bc34a', score: 8 },
        { name: '番茄', emoji: '🍅', radius: 40, color: '#e53935', score: 16 },
        { name: '橙子', emoji: '🍊', radius: 47, color: '#fb8c00', score: 32 },
        { name: '苹果', emoji: '🍎', radius: 55, color: '#c62828', score: 64 },
        { name: '梨', emoji: '🍐', radius: 65, color: '#cddc39', score: 128 },
        { name: '桃子', emoji: '🍑', radius: 75, color: '#f48fb1', score: 256 },
        { name: '菠萝', emoji: '🍍', radius: 88, color: '#ffc107', score: 512 },
        { name: '椰子', emoji: '🥥', radius: 104, color: '#795548', score: 1024 },
        { name: '西瓜', emoji: '🍉', radius: 123, color: '#2e7d32', score: 2048 }
    ],
    
    // 物理常量
    PHYSICS: {
        GRAVITY: 0.4,
        FRICTION: 0.98,
        BOUNCE: 0.3,
        WALL_BOUNCE: 0.4,
        MAX_SPEED: 15,
        MERGE_COOLDOWN: 10
    },
    
    // 性能设置
    PERF: {
        MAX_PARTICLES: 100,
        COLLISION_ITERATIONS: 3,
        GRID_SIZE: 100  // 空间网格大小
    }
};

// ==================== 工具函数 ====================
const Utils = {
    // 颜色处理
    lighten(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    },
    
    darken(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    },
    
    // 缓存的水果配置计算
    fruitCache: new Map(),
    
    getFruitConfig(type) {
        if (!this.fruitCache.has(type)) {
            const f = CONFIG.FRUITS[type];
            this.fruitCache.set(type, {
                ...f,
                mass: f.radius * f.radius,
                lightColor: this.lighten(f.color, 30),
                darkColor: this.darken(f.color, 20),
                strokeColor: this.darken(f.color, 40)
            });
        }
        return this.fruitCache.get(type);
    }
};

// ==================== 对象池 ====================
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.available = [];
        this.inUse = new Set();
        
        // 预创建对象
        for (let i = 0; i < initialSize; i++) {
            this.available.push(this.createFn());
        }
    }
    
    acquire(...args) {
        let obj = this.available.pop() || this.createFn();
        this.resetFn(obj, ...args);
        this.inUse.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.available.push(obj);
        }
    }
    
    releaseAll() {
        this.available.push(...this.inUse);
        this.inUse.clear();
    }
}

// ==================== 水果类 ====================
class Fruit {
    constructor() {
        this.reset();
    }
    
    reset(type, x, y, isPreview = false) {
        const config = Utils.getFruitConfig(type);
        
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.targetRadius = config.radius;
        this.radius = isPreview ? config.radius : 0;
        this.scaleProgress = isPreview ? 1 : 0;
        this.mass = config.mass;
        this.emoji = config.emoji;
        this.color = config.color;
        this.name = config.name;
        this.score = config.score;
        this.config = config;
        
        this.isPreview = isPreview;
        this.merged = false;
        this.mergeCooldown = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.spawnAnimation = !isPreview;
        
        // 网格坐标（用于空间分割）
        this.gridX = 0;
        this.gridY = 0;
        
        return this;
    }
    
    update() {
        if (this.isPreview) return;
        if (this.mergeCooldown > 0) this.mergeCooldown--;
        
        // 入场动画
        if (this.spawnAnimation) {
            this.scaleProgress += 0.08;
            if (this.scaleProgress >= 1) {
                this.scaleProgress = 1;
                this.spawnAnimation = false;
            }
            const t = this.scaleProgress - 1;
            const ease = 1 + 2.70158 * t * t * t + 1.70158 * t * t;
            this.radius = this.targetRadius * ease;
        }
        
        // 物理更新
        this.vy += CONFIG.PHYSICS.GRAVITY;
        
        const maxSpeed = CONFIG.PHYSICS.MAX_SPEED;
        if (this.vx > maxSpeed) this.vx = maxSpeed;
        if (this.vx < -maxSpeed) this.vx = -maxSpeed;
        if (this.vy > maxSpeed) this.vy = maxSpeed;
        if (this.vy < -maxSpeed) this.vy = -maxSpeed;
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.vx *= CONFIG.PHYSICS.FRICTION;
        this.vy *= CONFIG.PHYSICS.FRICTION;
        
        this.rotation += this.rotationSpeed;
        this.rotationSpeed *= 0.75;
        
        if (Math.abs(this.rotationSpeed) < 0.02) {
            this.rotationSpeed = 0;
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (!this.isPreview) {
            ctx.beginPath();
            ctx.arc(3, 3, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();
        }
        
        // 发光效果
        if (this.spawnAnimation) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
        }
        
        // 渐变填充
        const g = ctx.createRadialGradient(
            -this.radius * 0.3, -this.radius * 0.3, 0,
            0, 0, this.radius
        );
        g.addColorStop(0, this.config.lightColor);
        g.addColorStop(0.5, this.color);
        g.addColorStop(1, this.config.darkColor);
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // 纹理和边框
        this.drawPattern(ctx);
        
        ctx.strokeStyle = this.config.strokeColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // 高光
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.3, -this.radius * 0.3, 
                    this.radius * 0.25, this.radius * 0.15, 
                    -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
        
        // Emoji
        ctx.font = `${this.radius * 1.1}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, this.radius * 0.05);
        
        ctx.restore();
    }
    
    drawPattern(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = this.config.darkColor;
        ctx.lineWidth = 1.5;
        
        switch(this.type) {
            case 0: // 蓝莓
                ctx.fillStyle = this.config.darkColor;
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const r = this.radius * 0.6;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 1: // 柠檬
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * this.radius * 0.8, Math.sin(a) * this.radius * 0.8);
                }
                ctx.stroke();
                break;
                
            case 2: // 猕猴桃
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * this.radius * 0.7, Math.sin(a) * this.radius * 0.7);
                }
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = this.config.darkColor;
                ctx.fill();
                break;
                
            case 4: // 橙子
                ctx.fillStyle = this.config.darkColor;
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2;
                    const r = this.radius * (0.4 + (Math.sin(i * 1.5) + 1) * 0.2);
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 5: // 苹果
                ctx.strokeStyle = '#5d4037';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -this.radius * 0.6);
                ctx.quadraticCurveTo(3, -this.radius * 0.8, 5, -this.radius * 0.9);
                ctx.stroke();
                break;
                
            case 6: // 梨
                ctx.beginPath();
                ctx.ellipse(0, this.radius * 0.2, this.radius * 0.3, this.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.strokeStyle = Utils.lighten(this.color, 20);
                ctx.stroke();
                break;
                
            case 7: // 桃子
                ctx.beginPath();
                ctx.moveTo(0, -this.radius * 0.8);
                ctx.quadraticCurveTo(-this.radius * 0.3, 0, 0, this.radius * 0.8);
                ctx.moveTo(0, -this.radius * 0.8);
                ctx.quadraticCurveTo(this.radius * 0.3, 0, 0, this.radius * 0.8);
                ctx.strokeStyle = Utils.darken(this.color, 25);
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 8: // 菠萝
                for (let r = -1; r <= 1; r++) {
                    for (let c = -1; c <= 1; c++) {
                        const x = c * this.radius * 0.4;
                        const y = r * this.radius * 0.4;
                        ctx.beginPath();
                        ctx.moveTo(x, y - 5);
                        ctx.lineTo(x + 5, y);
                        ctx.lineTo(x, y + 5);
                        ctx.lineTo(x - 5, y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                break;
                
            case 9: // 椰子
                for (let i = 0; i < 15; i++) {
                    const a = (i / 15) * Math.PI * 2 + Math.sin(i * 2);
                    const r = this.radius * (0.3 + (i % 5) * 0.1);
                    const x = Math.cos(a) * r;
                    const y = Math.sin(a) * r;
                    ctx.beginPath();
                    ctx.moveTo(x - 2, y - 2);
                    ctx.lineTo(x + 2, y + 2);
                    ctx.stroke();
                }
                break;
                
            case 10: // 西瓜
                ctx.strokeStyle = '#1b5e20';
                ctx.lineWidth = 3;
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius * (0.5 + i * 0.1), a, a + Math.PI);
                    ctx.stroke();
                }
                break;
        }
        
        ctx.restore();
    }
}

// ==================== 粒子类 ====================
class Particle {
    constructor() {
        this.reset();
    }
    
    reset(x, y, color, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1;
        this.color = color;
        this.rotation = 0;
        this.rotationSpeed = 0;
        
        if (type === 'sparkle') {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 12 + 4;
            this.vx = Math.cos(a) * s;
            this.vy = Math.sin(a) * s;
            this.size = Math.random() * 4 + 2;
            this.decay = 0.025;
            this.gravity = 0.15;
        } else if (type === 'star') {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 6 + 2;
            this.vx = Math.cos(a) * s;
            this.vy = Math.sin(a) * s;
            this.size = Math.random() * 8 + 4;
            this.decay = 0.02;
            this.gravity = 0.1;
            this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        } else {
            this.vx = (Math.random() - 0.5) * 8;
            this.vy = (Math.random() - 0.5) * 8;
            this.size = Math.random() * 6 + 3;
            this.decay = 0.02;
            this.gravity = 0.2;
        }
        
        return this;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        
        if (this.type === 'star') {
            this.rotation += this.rotationSpeed;
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        
        if (this.type === 'star') {
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            this.drawStar(ctx, 0, 0, 5, this.size, this.size * 0.5);
        } else if (this.type === 'sparkle') {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawStar(ctx, cx, cy, spikes, outer, inner) {
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - outer);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();
    }
}

// ==================== 空间网格（优化碰撞检测）====================
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }
    
    clear() {
        this.cells.clear();
    }
    
    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }
    
    insert(fruit) {
        const key = this.getKey(fruit.x, fruit.y);
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }
        this.cells.get(key).push(fruit);
    }
    
    getNeighbors(fruit) {
        const cx = Math.floor(fruit.x / this.cellSize);
        const cy = Math.floor(fruit.y / this.cellSize);
        const neighbors = [];
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cell = this.cells.get(key);
                if (cell) {
                    neighbors.push(...cell);
                }
            }
        }
        
        return neighbors;
    }
}

// ==================== 游戏主类 ====================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 状态
        this.fruits = [];
        this.particles = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('watermelonHighScore')) || 0;
        this.currentFruitType = 0;
        this.nextFruitType = Math.floor(Math.random() * 3);
        this.gameOver = false;
        this.dropLine = 100;
        this.mouseX = 0;
        this.width = 0;
        this.height = 0;
        
        // 对象池
        this.fruitPool = new ObjectPool(
            () => new Fruit(),
            (f, ...args) => f.reset(...args),
            20
        );
        this.particlePool = new ObjectPool(
            () => new Particle(),
            (p, ...args) => p.reset(...args),
            50
        );
        
        // 空间网格
        this.grid = new SpatialGrid(CONFIG.PERF.GRID_SIZE);
        
        // 合并相关
        this.mergeQueue = [];
        this.shakeProtectionTime = 0;
        
        // 初始化
        this.init();
    }
    
    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // 控制
        this.canvas.addEventListener('mousemove', e => this.handleMove(e));
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.handleMove(e);
        });
        this.canvas.addEventListener('click', () => this.dropFruit());
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.handleMove(e);
            this.dropFruit();
        });
        
        // 陀螺仪
        this.initShake();
        
        // 预览
        this.previewFruit = this.fruitPool.acquire(0, 0, 0, true);
        this.updatePreview();
        
        // 启动循环
        this.loop();
    }
    
    resize() {
        const gameArea = document.querySelector('.game-area');
        const rect = gameArea.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = rect.width;
        this.height = rect.height;
    }
    
    handleMove(e) {
        if (this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const r = CONFIG.FRUITS[this.currentFruitType].radius;
        this.mouseX = Math.max(r, Math.min(this.width - r, clientX - rect.left));
    }
    
    dropFruit() {
        if (this.gameOver) return;
        
        const fruit = this.fruitPool.acquire(
            this.currentFruitType,
            this.mouseX,
            CONFIG.FRUITS[this.currentFruitType].radius + 10
        );
        fruit.vy = 2;
        this.fruits.push(fruit);
        
        this.currentFruitType = this.nextFruitType;
        this.nextFruitType = Math.floor(Math.random() * Math.min(3, Math.floor(this.score / 100) + 3));
        this.updatePreview();
    }
    
    updatePreview() {
        document.getElementById('preview').textContent = CONFIG.FRUITS[this.nextFruitType].emoji;
        document.getElementById('preview').style.background = CONFIG.FRUITS[this.nextFruitType].color + '40';
        
        this.previewFruit.type = this.currentFruitType;
        this.previewFruit.radius = CONFIG.FRUITS[this.currentFruitType].radius;
        this.previewFruit.emoji = CONFIG.FRUITS[this.currentFruitType].emoji;
        this.previewFruit.color = CONFIG.FRUITS[this.currentFruitType].color;
    }
    
    // ==================== 物理和碰撞 ====================
    updatePhysics() {
        // 更新水果
        for (const fruit of this.fruits) {
            fruit.update();
            
            // 边界
            if (fruit.x - fruit.radius < 0) {
                fruit.x = fruit.radius;
                fruit.vx = Math.abs(fruit.vx) * CONFIG.PHYSICS.WALL_BOUNCE;
            } else if (fruit.x + fruit.radius > this.width) {
                fruit.x = this.width - fruit.radius;
                fruit.vx = -Math.abs(fruit.vx) * CONFIG.PHYSICS.WALL_BOUNCE;
            }
            
            // 底部
            if (fruit.y + fruit.radius > this.height) {
                fruit.y = this.height - fruit.radius;
                fruit.vy = -Math.abs(fruit.vy) * CONFIG.PHYSICS.WALL_BOUNCE;
                fruit.vx *= 0.9;
            }
        }
        
        // 构建空间网格
        this.grid.clear();
        for (const fruit of this.fruits) {
            this.grid.insert(fruit);
        }
        
        // 碰撞检测（使用网格优化）
        for (let iter = 0; iter < CONFIG.PERF.COLLISION_ITERATIONS; iter++) {
            for (const fruit of this.fruits) {
                const neighbors = this.grid.getNeighbors(fruit);
                for (const other of neighbors) {
                    if (fruit === other) continue;
                    if (this.checkCollision(fruit, other)) {
                        this.resolveCollision(fruit, other);
                    }
                }
            }
        }
        
        // 强制底部修正
        for (const fruit of this.fruits) {
            if (fruit.y + fruit.radius > this.height) {
                fruit.y = this.height - fruit.radius;
                fruit.vy = 0;
            }
        }
    }
    
    checkCollision(f1, f2) {
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const distSq = dx * dx + dy * dy;
        const r = f1.radius + f2.radius;
        return distSq < r * r;
    }
    
    resolveCollision(f1, f2) {
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) {
            const a = Math.random() * Math.PI * 2;
            const p = (f1.radius + f2.radius) * 0.5;
            f1.x -= Math.cos(a) * p;
            f1.y -= Math.sin(a) * p;
            f2.x += Math.cos(a) * p;
            f2.y += Math.sin(a) * p;
            return;
        }
        
        const overlap = f1.radius + f2.radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        
        const tm = f1.mass + f2.mass;
        const m1r = f2.mass / tm;
        const m2r = f1.mass / tm;
        
        f1.x -= nx * overlap * m1r;
        f1.y -= ny * overlap * m1r;
        f2.x += nx * overlap * m2r;
        f2.y += ny * overlap * m2r;
        
        const dvx = f2.vx - f1.vx;
        const dvy = f2.vy - f1.vy;
        const vel = dvx * nx + dvy * ny;
        
        if (vel > 0) return;
        
        const j = -(1 + CONFIG.PHYSICS.BOUNCE) * vel / (1 / f1.mass + 1 / f2.mass);
        const ix = j * nx;
        const iy = j * ny;
        
        f1.vx -= ix / f1.mass;
        f1.vy -= iy / f1.mass;
        f2.vx += ix / f2.mass;
        f2.vy += iy / f2.mass;
        
        // 只在高速碰撞时添加少量旋转
        const rs = Math.sqrt(dvx * dvx + dvy * dvy);
        if (rs > 3) {
            f1.rotationSpeed += (Math.random() - 0.5) * 0.03;
            f2.rotationSpeed += (Math.random() - 0.5) * 0.03;
        }
    }
    
    // ==================== 合并逻辑 ====================
    processMerges() {
        let merged = true;
        let iterations = 0;
        
        while (merged && iterations < 5) {
            merged = false;
            iterations++;
            
            // 处理队列
            if (this.mergeQueue.length > 0) {
                this.fruits = this.fruits.filter(f => !f.merged);
                for (const m of this.mergeQueue) {
                    this.fruits.push(m.newFruit);
                }
                this.mergeQueue = [];
                merged = true;
            }
            
            // 查找合并组
            const groups = this.findMergeGroups();
            if (groups.length > 0) {
                for (const g of groups) {
                    this.mergeGroup(g);
                }
                merged = true;
            }
        }
        
        // 最终处理
        if (this.mergeQueue.length > 0) {
            this.fruits = this.fruits.filter(f => !f.merged);
            for (const m of this.mergeQueue) {
                this.fruits.push(m.newFruit);
            }
            this.mergeQueue = [];
        }
    }
    
    findMergeGroups() {
        const n = this.fruits.length;
        const parent = Array(n).fill(0).map((_, i) => i);
        
        const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
        const union = (x, y) => { parent[find(x)] = find(y); };
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const f1 = this.fruits[i];
                const f2 = this.fruits[j];
                
                if (f1.type !== f2.type) continue;
                if (f1.merged || f2.merged) continue;
                if (f1.mergeCooldown > 0 || f2.mergeCooldown > 0) continue;
                
                const dx = f2.x - f1.x;
                const dy = f2.y - f1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= f1.radius + f2.radius + 2) {
                    union(i, j);
                }
            }
        }
        
        const groups = new Map();
        for (let i = 0; i < n; i++) {
            const f = this.fruits[i];
            if (f.merged || f.mergeCooldown > 0) continue;
            const root = find(i);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(i);
        }
        
        return Array.from(groups.values()).filter(g => g.length >= 2);
    }
    
    mergeGroup(indices) {
        if (indices.length < 2) return false;
        
        const first = this.fruits[indices[0]];
        const type = first.type;
        
        if (type >= CONFIG.FRUITS.length - 1) return false;
        
        let tx = 0, ty = 0, tvx = 0, tvy = 0;
        
        for (const idx of indices) {
            const f = this.fruits[idx];
            f.merged = true;
            tx += f.x;
            ty += f.y;
            tvx += f.vx;
            tvy += f.vy;
        }
        
        const c = indices.length;
        const nx = tx / c;
        const ny = ty / c;
        const levelUp = Math.min(c - 1, CONFIG.FRUITS.length - 1 - type);
        const newType = type + levelUp;
        
        const nf = this.fruitPool.acquire(newType, nx, ny);
        nf.vx = (tvx / c) * 0.5;
        nf.vy = (tvy / c) * 0.5;
        nf.mergeCooldown = CONFIG.PHYSICS.MERGE_COOLDOWN;
        
        this.mergeQueue.push({ newFruit: nf, x: nx, y: ny, type: newType });
        
        // 粒子效果
        this.createParticles(nx, ny, CONFIG.FRUITS[newType].color, c);
        
        // 分数
        const bs = CONFIG.FRUITS[newType].score;
        const mult = 1 + (c - 1) * 0.5;
        this.score += Math.floor(bs * mult);
        this.updateScore();
        
        // 连击文字
        this.showComboText(nx, ny, c, Math.floor(bs * mult) - bs);
        
        // 胜利判定
        if (newType === CONFIG.FRUITS.length - 1) {
            this.triggerVictory();
        }
        
        return true;
    }
    
    // ==================== 粒子系统 ====================
    createParticles(x, y, color, count) {
        const pc = Math.min(8 + count * 6, CONFIG.PERF.MAX_PARTICLES);
        
        for (let i = 0; i < pc; i++) {
            this.particles.push(this.particlePool.acquire(x, y, color, 'sparkle'));
        }
        
        const sc = Math.min(count >= 3 ? 8 : 4, CONFIG.PERF.MAX_PARTICLES - pc);
        for (let i = 0; i < sc; i++) {
            this.particles.push(this.particlePool.acquire(x, y, '#ffd700', 'star'));
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            if (p.life <= 0) {
                this.particlePool.release(p);
                this.particles.splice(i, 1);
            }
        }
    }
    
    // ==================== 渲染 ====================
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 预览水果
        if (this.previewFruit && !this.gameOver) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.previewFruit.x = this.mouseX;
            this.previewFruit.draw(this.ctx);
            this.ctx.restore();
            
            // 引导线
            this.ctx.beginPath();
            this.ctx.moveTo(this.previewFruit.x, this.previewFruit.y + this.previewFruit.radius);
            this.ctx.lineTo(this.previewFruit.x, this.height);
            this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // 水果
        for (const fruit of this.fruits) {
            fruit.draw(this.ctx);
        }
        
        // 粒子
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
    }
    
    // ==================== 游戏逻辑 ====================
    checkGameOver() {
        if (this.shakeProtectionTime && Date.now() < this.shakeProtectionTime) {
            return;
        }
        
        for (const fruit of this.fruits) {
            if (fruit.y + fruit.radius < 0 && !fruit.isPreview) {
                this.triggerGameOver();
                return;
            }
        }
        
        for (const fruit of this.fruits) {
            if (fruit.y - fruit.radius < this.dropLine && 
                Math.abs(fruit.vy) < 0.5 && 
                Math.abs(fruit.vx) < 0.5 &&
                !fruit.isPreview &&
                fruit.y > fruit.radius * 2) {
                this.triggerGameOver();
                return;
            }
        }
    }
    
    triggerGameOver() {
        this.gameOver = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('gameOverTitle').textContent = '游戏结束 🎮';
        document.getElementById('gameOver').classList.add('show');
    }
    
    triggerVictory() {
        this.gameOver = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('gameOverTitle').textContent = '🎉 游戏胜利！';
        document.getElementById('gameOver').classList.add('show');
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('watermelonHighScore', this.highScore);
        }
    }
    
    // ==================== 陀螺仪 ====================
    initShake() {
        this.shakeThreshold = 20;
        this.shakeCooldown = false;
        this.shakeCooldownTime = 5000;
        this.shakeInitialized = false;
        this.shakeListening = false;
        
        const hint = document.querySelector('.shake-hint');
        if (hint) {
            hint.style.cursor = 'pointer';
            hint.addEventListener('click', e => {
                e.stopPropagation();
                this.triggerShake();
            });
        }
        
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            const rp = () => {
                DeviceOrientationEvent.requestPermission()
                    .then(r => { if (r === 'granted') this.startShake(); })
                    .catch(console.error);
            };
            this.canvas.addEventListener('click', rp, { once: true });
        } else {
            this.startShake();
        }
    }
    
    startShake() {
        if (this.shakeListening) return;
        this.shakeListening = true;
        
        let lx = 0, ly = 0, lz = 0;
        
        window.addEventListener('devicemotion', e => {
            if (this.shakeCooldown || this.gameOver) return;
            
            const a = e.accelerationIncludingGravity;
            if (!a) return;
            
            const dx = Math.abs(a.x - lx);
            const dy = Math.abs(a.y - ly);
            const dz = Math.abs(a.z - lz);
            
            if (dx + dy + dz > this.shakeThreshold) {
                this.triggerShake();
                lx = a.x;
                ly = a.y;
                lz = a.z;
            } else {
                lx = a.x;
                ly = a.y;
                lz = a.z;
            }
        });
    }
    
    triggerShake() {
        if (this.shakeCooldown || this.gameOver) return;
        
        this.shakeCooldown = true;
        this.shakeProtectionTime = Date.now() + 3000;
        
        for (const fruit of this.fruits) {
            fruit.vx += (Math.random() - 0.5) * 20;
            fruit.vy -= Math.random() * 15 + 5;
            fruit.rotationSpeed += (Math.random() - 0.5) * 0.5;
        }
        
        this.showShakeText();
        this.startShakeCD();
    }
    
    startShakeCD() {
        const hint = document.querySelector('.shake-hint');
        if (!hint) return;
        
        let r = 5;
        hint.style.opacity = '0.5';
        hint.style.animation = 'none';
        hint.textContent = `⏳ 冷却中 (${r}s)`;
        
        this.shakeCDInterval = setInterval(() => {
            r--;
            if (r > 0) {
                hint.textContent = `⏳ 冷却中 (${r}s)`;
            } else {
                clearInterval(this.shakeCDInterval);
            }
        }, 1000);
        
        setTimeout(() => {
            this.shakeCooldown = false;
            clearInterval(this.shakeCDInterval);
            if (hint) {
                hint.style.opacity = '1';
                hint.style.animation = 'shakeHint 2s ease infinite';
                const isM = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                hint.textContent = isM ? '📱 晃动手机弹飞水果' : '🖱️ 点击弹飞水果';
            }
        }, this.shakeCooldownTime);
    }
    
    showShakeText() {
        const c = document.querySelector('.game-area');
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 36px;
            font-weight: 900;
            color: #ff6b6b;
            text-shadow: 0 0 20px #ff6b6b, 2px 2px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            animation: shakePop 0.8s ease-out forwards;
            z-index: 100;
        `;
        el.textContent = '💥 晃动冲击!';
        
        if (!document.getElementById('shakeAnim')) {
            const s = document.createElement('style');
            s.id = 'shakeAnim';
            s.textContent = `
                @keyframes shakePop {
                    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                    30% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(s);
        }
        
        c.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
    
    showComboText(x, y, count, bonus) {
        const c = document.querySelector('.game-area');
        const labels = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUADRA!', 'PENTA!', 'HEXA!'];
        const label = labels[count] || `${count} COMBO!`;
        const colors = ['', '', '#ff9800', '#f44336', '#9c27b0', '#3f51b5', '#00bcd4'];
        const color = colors[count] || '#ff5722';
        
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            font-size: ${18 + count * 4}px;
            font-weight: 900;
            color: ${color};
            text-shadow: 0 0 10px ${color}80, 0 0 20px ${color}60, 2px 2px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            animation: comboBoom 1.2s ease-out forwards;
            z-index: 100;
        `;
        el.textContent = label;
        
        if (!document.getElementById('comboAnim')) {
            const s = document.createElement('style');
            s.id = 'comboAnim';
            s.textContent = `
                @keyframes comboBoom {
                    0% { transform: translate(-50%, -50%) scale(0.5) rotate(-10deg); opacity: 0; }
                    15% { transform: translate(-50%, -50%) scale(1.3) rotate(5deg); opacity: 1; }
                    30% { transform: translate(-50%, -50%) scale(1.2) rotate(-3deg); }
                    50% { transform: translate(-50%, -50%) scale(1.3) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; }
                }
                @keyframes bonusFloat {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                    100% { transform: translate(-50%, -100%) scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(s);
        }
        
        c.appendChild(el);
        setTimeout(() => el.remove(), 1200);
        
        if (bonus > 0) {
            const bel = document.createElement('div');
            bel.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y + 30}px;
                transform: translate(-50%, -50%);
                font-size: 16px;
                font-weight: bold;
                color: #ffd700;
                text-shadow: 0 0 10px #ffd700, 1px 1px 2px rgba(0,0,0,0.5);
                pointer-events: none;
                animation: bonusFloat 1s ease-out forwards;
                z-index: 99;
            `;
            bel.textContent = `+${bonus} BONUS`;
            c.appendChild(bel);
            setTimeout(() => bel.remove(), 1000);
        }
        
        if (count >= 3) {
            this.shakeScreen(count);
        }
    }
    
    shakeScreen(intensity) {
        const c = document.querySelector('.game-container');
        const amt = Math.min(intensity * 2, 10);
        let s = 0;
        
        const doShake = () => {
            if (s >= 10) {
                c.style.transform = '';
                return;
            }
            c.style.transform = `translate(${(Math.random() - 0.5) * amt}px, ${(Math.random() - 0.5) * amt}px)`;
            s++;
            requestAnimationFrame(doShake);
        };
        doShake();
    }
    
    // ==================== 主循环 ====================
    update() {
        if (this.gameOver) return;
        
        if (this.previewFruit) {
            this.previewFruit.x = this.mouseX;
        }
        
        this.updatePhysics();
        this.processMerges();
        this.updateParticles();
        this.checkGameOver();
    }
    
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
    
    reset() {
        // 回收所有对象
        for (const f of this.fruits) {
            this.fruitPool.release(f);
        }
        for (const p of this.particles) {
            this.particlePool.release(p);
        }
        
        this.fruits = [];
        this.particles = [];
        this.score = 0;
        this.currentFruitType = 0;
        this.nextFruitType = Math.floor(Math.random() * 3);
        this.gameOver = false;
        this.mergeQueue = [];
        this.shakeCooldown = false;
        
        if (this.shakeCDInterval) {
            clearInterval(this.shakeCDInterval);
        }
        
        const hint = document.querySelector('.shake-hint');
        if (hint) {
            hint.style.opacity = '1';
            hint.style.animation = 'shakeHint 2s ease infinite';
            const isM = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            hint.textContent = isM ? '📱 晃动手机弹飞水果' : '🖱️ 点击弹飞水果';
        }
        
        this.updateScore();
        this.updatePreview();
        document.getElementById('gameOverTitle').textContent = '游戏结束 🎮';
        document.getElementById('gameOver').classList.remove('show');
    }
}

// 启动
window.onload = () => {
    window.game = new Game();
};
