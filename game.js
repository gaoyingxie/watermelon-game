/**
 * 合成大西瓜 - 纯JavaScript物理引擎
 * 可爱画风 + 可靠碰撞
 */

// 水果配置（从小到大）- 高辨识度配色
const FRUITS = [
    { name: '蓝莓', emoji: '🫐', radius: 15, color: '#5c6bc0', score: 2 },      // 深蓝紫
    { name: '柠檬', emoji: '🍋', radius: 20, color: '#ffeb3b', score: 4 },      // 明黄
    { name: '猕猴桃', emoji: '🥝', radius: 25, color: '#8bc34a', score: 8 },    // 草绿
    { name: '番茄', emoji: '🍅', radius: 30, color: '#e53935', score: 16 },     // 鲜红
    { name: '橙子', emoji: '🍊', radius: 36, color: '#fb8c00', score: 32 },     // 橙黄
    { name: '苹果', emoji: '🍎', radius: 42, color: '#c62828', score: 64 },     // 深红
    { name: '梨', emoji: '🍐', radius: 50, color: '#cddc39', score: 128 },      // 青柠
    { name: '桃子', emoji: '🍑', radius: 58, color: '#f48fb1', score: 256 },    // 粉红
    { name: '菠萝', emoji: '🍍', radius: 68, color: '#ffc107', score: 512 },    // 金黄
    { name: '椰子', emoji: '🥥', radius: 80, color: '#795548', score: 1024 },   // 棕色
    { name: '西瓜', emoji: '🍉', radius: 95, color: '#2e7d32', score: 2048 }    // 墨绿条纹
];

// 物理常量
const GRAVITY = 0.4;
const FRICTION = 0.98;
const BOUNCE = 0.3;
const WALL_BOUNCE = 0.4;
const MAX_SPEED = 15;
const MERGE_COOLDOWN = 10; // 合并后冷却帧数

class Fruit {
    constructor(type, x, y, isPreview = false) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = FRUITS[type].radius;
        this.mass = this.radius * this.radius; // 质量与面积成正比
        this.emoji = FRUITS[type].emoji;
        this.color = FRUITS[type].color;
        this.name = FRUITS[type].name;
        this.score = FRUITS[type].score;
        this.isPreview = isPreview;
        this.merged = false;
        this.mergeCooldown = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
    }

    update() {
        if (this.isPreview) return;
        if (this.mergeCooldown > 0) this.mergeCooldown--;

        // 重力
        this.vy += GRAVITY;
        
        // 速度限制
        this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));
        this.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vy));
        
        // 应用速度
        this.x += this.vx;
        this.y += this.vy;
        
        // 摩擦力
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        
        // 旋转（增强阻尼，防止无限旋转）
        this.rotation += this.rotationSpeed;
        this.rotationSpeed *= 0.85; // 更快的衰减
        
        // 速度很慢时停止旋转
        if (Math.abs(this.rotationSpeed) < 0.01) {
            this.rotationSpeed = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // 阴影
        if (!this.isPreview) {
            ctx.beginPath();
            ctx.arc(3, 3, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();
        }
        
        // 水果本体（渐变圆形背景）
        const gradient = ctx.createRadialGradient(
            -this.radius * 0.3, -this.radius * 0.3, 0,
            0, 0, this.radius
        );
        gradient.addColorStop(0, this.lightenColor(this.color, 30));
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 20));
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = this.darkenColor(this.color, 30);
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 高光
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.3, -this.radius * 0.3, 
                    this.radius * 0.25, this.radius * 0.15, 
                    -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        
        // Emoji
        ctx.font = `${this.radius * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, this.radius * 0.1);
        
        ctx.restore();
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 6 + 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life -= 0.02;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fruits = [];
        this.particles = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('watermelonHighScore')) || 0;
        this.currentFruitType = 0;
        this.nextFruitType = Math.floor(Math.random() * 3);
        this.gameOver = false;
        this.dropLine = 100; // 警戒线位置
        this.mouseX = 0;
        this.previewFruit = null;
        this.mergeQueue = [];
        this.canDrop = true; // 防止连发
        this.lastDropTime = 0;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // 触摸/鼠标控制 - 防止按住连发
        this.isPointerDown = false;
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e);
        });
        
        // 鼠标按下
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 只响应左键
            this.isPointerDown = true;
            this.handleMove(e);
        });
        
        // 鼠标抬起 - 只有抬起时才发射
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            if (this.isPointerDown) {
                this.isPointerDown = false;
                this.dropFruit();
            }
        });
        
        // 鼠标离开canvas时重置
        this.canvas.addEventListener('mouseleave', () => {
            this.isPointerDown = false;
        });
        
        // 触摸开始
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isPointerDown = true;
            this.handleMove(e);
        });
        
        // 触摸结束 - 只有结束时才发射
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.isPointerDown) {
                this.isPointerDown = false;
                this.dropFruit();
            }
        });
        
        this.updatePreview();
        this.loop();
    }

    resize() {
        // 获取游戏区域(game-area)的实际尺寸
        const gameArea = document.querySelector('.game-area');
        const rect = gameArea.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // 调试：在画布底部画一条红线标记边界
        this.debugBoundary = true;
    }

    handleMove(e) {
        if (this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        this.mouseX = Math.max(FRUITS[this.currentFruitType].radius, 
                               Math.min(this.width - FRUITS[this.currentFruitType].radius, 
                                       clientX - rect.left));
    }

    dropFruit() {
        if (this.gameOver) return;
        
        // 冷却检查 - 500ms内只能发射一次
        const now = Date.now();
        if (now - this.lastDropTime < 500) return;
        this.lastDropTime = now;
        
        // 在鼠标位置创建水果（从顶部掉落）
        const fruit = new Fruit(this.currentFruitType, this.mouseX, FRUITS[this.currentFruitType].radius + 10);
        fruit.vy = 2; // 初始下落速度
        this.fruits.push(fruit);
        
        // 切换到下一个水果
        this.currentFruitType = this.nextFruitType;
        this.nextFruitType = Math.floor(Math.random() * Math.min(3, Math.floor(this.score / 100) + 3));
        this.updatePreview();
    }

    updatePreview() {
        document.getElementById('preview').textContent = FRUITS[this.nextFruitType].emoji;
        document.getElementById('preview').style.background = FRUITS[this.nextFruitType].color + '40';
        
        // 更新预览水果
        this.previewFruit = new Fruit(
            this.currentFruitType, 
            this.mouseX, 
            FRUITS[this.currentFruitType].radius + 20, 
            true
        );
    }

    checkCircleCollision(f1, f2) {
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < f1.radius + f2.radius;
    }

    resolveCollision(f1, f2) {
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return; // 防止除以零
        
        // 位置修正（防止重叠）
        const overlap = (f1.radius + f2.radius - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        
        f1.x -= nx * overlap;
        f1.y -= ny * overlap;
        f2.x += nx * overlap;
        f2.y += ny * overlap;
        
        // 弹性碰撞响应
        const dvx = f2.vx - f1.vx;
        const dvy = f2.vy - f1.vy;
        const velAlongNormal = dvx * nx + dvy * ny;
        
        if (velAlongNormal > 0) return; // 已经在分离
        
        // 计算碰撞冲量
        const restitution = BOUNCE;
        let j = -(1 + restitution) * velAlongNormal;
        j /= (1 / f1.mass + 1 / f2.mass);
        
        const impulseX = j * nx;
        const impulseY = j * ny;
        
        f1.vx -= impulseX / f1.mass;
        f1.vy -= impulseY / f1.mass;
        f2.vx += impulseX / f2.mass;
        f2.vy += impulseY / f2.mass;
        
        // 添加一点随机旋转
        f1.rotationSpeed += (Math.random() - 0.5) * 0.1;
        f2.rotationSpeed += (Math.random() - 0.5) * 0.1;
    }

    // 查找所有相连的相同水果（使用并查集/连通分量）
    findMergeGroups() {
        const n = this.fruits.length;
        const parent = Array(n).fill(0).map((_, i) => i);
        
        const find = (x) => {
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        };
        
        const union = (x, y) => {
            parent[find(x)] = find(y);
        };
        
        // 找到所有接触的相同水果对
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
                
                // 接触判定（放宽容差，确保并排的也能检测到）
                if (dist <= f1.radius + f2.radius + 2) {
                    union(i, j);
                }
            }
        }
        
        // 按根节点分组
        const groups = new Map();
        for (let i = 0; i < n; i++) {
            if (this.fruits[i].merged || this.fruits[i].mergeCooldown > 0) continue;
            const root = find(i);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(i);
        }
        
        // 只返回大小>=2的组
        return Array.from(groups.values()).filter(g => g.length >= 2);
    }

    // 合并一组水果
    mergeGroup(indices) {
        if (indices.length < 2) return false;
        
        const firstFruit = this.fruits[indices[0]];
        const type = firstFruit.type;
        
        if (type >= FRUITS.length - 1) return false; // 已经是最大水果
        
        // 标记所有水果为已合并
        let totalX = 0, totalY = 0;
        let totalVx = 0, totalVy = 0;
        
        for (const idx of indices) {
            const f = this.fruits[idx];
            f.merged = true;
            totalX += f.x;
            totalY += f.y;
            totalVx += f.vx;
            totalVy += f.vy;
        }
        
        const count = indices.length;
        const newX = totalX / count;
        const newY = totalY / count;
        
        // 计算升级等级：2个升1级，3个升2级，4个升3级...
        const levelUp = Math.min(count - 1, FRUITS.length - 1 - type);
        const newType = type + levelUp;
        
        // 创建新水果
        const newFruit = new Fruit(newType, newX, newY);
        newFruit.vx = (totalVx / count) * 0.5;
        newFruit.vy = (totalVy / count) * 0.5;
        newFruit.mergeCooldown = MERGE_COOLDOWN;
        
        // 添加到合并队列
        this.mergeQueue.push({
            newFruit,
            x: newX,
            y: newY,
            type: newType
        });
        
        // 粒子效果（根据合并数量调整）
        const particleCount = 8 + count * 4;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(newX, newY, FRUITS[newType].color));
        }
        
        // 加分：基础分 + 连击奖励（2个就有奖励）
        const baseScore = FRUITS[newType].score;
        // 连击奖励：2个+50%，3个+100%，4个+150%，以此类推
        const comboMultiplier = 1 + (count - 1) * 0.5;
        const totalScore = Math.floor(baseScore * comboMultiplier);
        this.score += totalScore;
        this.updateScore();
        
        // 显示连击文字效果（2个及以上都显示）
        this.showComboText(newX, newY, count, totalScore - baseScore);
        
        return true;
    }

    // 显示连击文字 - 更炫的特效
    showComboText(x, y, count, bonus) {
        const container = document.querySelector('.game-area');
        
        // 连击标签
        const comboLabels = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUADRA!', 'PENTA!', 'HEXA!'];
        const label = comboLabels[count] || `${count} COMBO!`;
        
        // 主连击文字
        const el = document.createElement('div');
        const colors = ['', '', '#ff9800', '#f44336', '#9c27b0', '#3f51b5', '#00bcd4'];
        const color = colors[count] || '#ff5722';
        
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            font-size: ${18 + count * 4}px;
            font-weight: 900;
            color: ${color};
            text-shadow: 
                0 0 10px ${color}80,
                0 0 20px ${color}60,
                2px 2px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            animation: comboBoom 1.2s ease-out forwards;
            z-index: 100;
            font-family: 'Arial Black', sans-serif;
            letter-spacing: 2px;
        `;
        el.textContent = label;
        
        // 额外奖励文字
        if (bonus > 0) {
            const bonusEl = document.createElement('div');
            bonusEl.style.cssText = `
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
            bonusEl.textContent = `+${bonus} BONUS`;
            container.appendChild(bonusEl);
            setTimeout(() => bonusEl.remove(), 1000);
        }
        
        // 添加动画样式
        if (!document.getElementById('comboAnim')) {
            const style = document.createElement('style');
            style.id = 'comboAnim';
            style.textContent = `
                @keyframes comboBoom {
                    0% { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; }
                    15% { transform: translate(-50%, -50%) scale(1.5) rotate(5deg); opacity: 1; }
                    30% { transform: translate(-50%, -50%) scale(1.2) rotate(-3deg); }
                    50% { transform: translate(-50%, -50%) scale(1.3) rotate(0deg); }
                    100% { transform: translate(-50%, -150%) scale(1) rotate(0deg); opacity: 0; }
                }
                @keyframes bonusFloat {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                    100% { transform: translate(-50%, -100%) scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        container.appendChild(el);
        setTimeout(() => el.remove(), 1200);
        
        // 屏幕震动效果（3连击以上）
        if (count >= 3) {
            this.shakeScreen(count);
        }
    }
    
    // 屏幕震动
    shakeScreen(intensity) {
        const container = document.querySelector('.game-container');
        const shakeAmount = Math.min(intensity * 2, 10);
        let shakes = 0;
        const maxShakes = 10;
        
        const doShake = () => {
            if (shakes >= maxShakes) {
                container.style.transform = '';
                return;
            }
            const dx = (Math.random() - 0.5) * shakeAmount;
            const dy = (Math.random() - 0.5) * shakeAmount;
            container.style.transform = `translate(${dx}px, ${dy}px)`;
            shakes++;
            requestAnimationFrame(doShake);
        };
        doShake();
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 12; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('watermelonHighScore', this.highScore);
        }
    }

    checkGameOver() {
        // 检查是否超出顶部
        for (const fruit of this.fruits) {
            if (fruit.y + fruit.radius < 0 && !fruit.isPreview) {
                this.triggerGameOver();
                return;
            }
        }
        
        // 检查警戒线（水果静止时超过警戒线）
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
        document.getElementById('gameOver').classList.add('show');
    }

    update() {
        if (this.gameOver) return;
        
        // 更新预览水果位置
        if (this.previewFruit) {
            this.previewFruit.x = this.mouseX;
        }
        
        // 更新所有水果
        for (const fruit of this.fruits) {
            fruit.update();
            
            // 边界碰撞
            if (fruit.x - fruit.radius < 0) {
                fruit.x = fruit.radius;
                fruit.vx = Math.abs(fruit.vx) * WALL_BOUNCE;
            } else if (fruit.x + fruit.radius > this.width) {
                fruit.x = this.width - fruit.radius;
                fruit.vx = -Math.abs(fruit.vx) * WALL_BOUNCE;
            }
            
            // 底部碰撞 - canvas高度就是游戏区域高度（不含controls）
            if (fruit.y + fruit.radius > this.height) {
                fruit.y = this.height - fruit.radius;
                fruit.vy = -Math.abs(fruit.vy) * WALL_BOUNCE;
                // 底部摩擦力
                fruit.vx *= 0.9;
            }
        }
        
        // 多轮碰撞处理（让堆叠更稳定）
        for (let iteration = 0; iteration < 3; iteration++) {
            for (let i = 0; i < this.fruits.length; i++) {
                for (let j = i + 1; j < this.fruits.length; j++) {
                    if (this.checkCircleCollision(this.fruits[i], this.fruits[j])) {
                        this.resolveCollision(this.fruits[i], this.fruits[j]);
                    }
                }
            }
        }
        
        // 强制底部边界检查 - 防止被挤出去
        for (const fruit of this.fruits) {
            if (fruit.y + fruit.radius > this.height) {
                fruit.y = this.height - fruit.radius;
                fruit.vy = 0;
            }
        }
        
        // 合并检测：循环处理直到没有新的合并（处理连锁反应）
        let hasMerged = true;
        let mergeIterations = 0;
        const MAX_MERGE_ITERATIONS = 5; // 防止无限循环
        
        while (hasMerged && mergeIterations < MAX_MERGE_ITERATIONS) {
            hasMerged = false;
            mergeIterations++;
            
            // 先处理当前队列中的合并
            if (this.mergeQueue.length > 0) {
                this.fruits = this.fruits.filter(f => !f.merged);
                for (const merge of this.mergeQueue) {
                    this.fruits.push(merge.newFruit);
                }
                this.mergeQueue = [];
                hasMerged = true;
            }
            
            // 查找新的合并组
            const mergeGroups = this.findMergeGroups();
            if (mergeGroups.length > 0) {
                for (const group of mergeGroups) {
                    this.mergeGroup(group);
                }
                hasMerged = true;
            }
        }
        
        // 最终处理剩余的合并队列
        if (this.mergeQueue.length > 0) {
            this.fruits = this.fruits.filter(f => !f.merged);
            for (const merge of this.mergeQueue) {
                this.fruits.push(merge.newFruit);
            }
            this.mergeQueue = [];
        }
        
        // 更新粒子
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        // 检查游戏结束
        this.checkGameOver();
    }

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 绘制预览水果
        if (this.previewFruit && !this.gameOver) {
            // 半透明效果
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
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
        
        // 绘制所有水果
        for (const fruit of this.fruits) {
            fruit.draw(this.ctx);
        }
        
        // 绘制粒子
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
        
        // 调试：画底部边界红线
        if (this.debugBoundary) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.height);
            this.ctx.lineTo(this.width, this.height);
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    reset() {
        this.fruits = [];
        this.particles = [];
        this.score = 0;
        this.currentFruitType = 0;
        this.nextFruitType = Math.floor(Math.random() * 3);
        this.gameOver = false;
        this.mergeQueue = [];
        this.lastDropTime = 0;
        this.isPointerDown = false;
        this.updateScore();
        this.updatePreview();
        document.getElementById('gameOver').classList.remove('show');
    }
}

// 启动游戏
let game;
window.onload = () => {
    game = new Game();
};
