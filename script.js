// --- 获取 HTML 元素 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 游戏常量 ---
// 使用新的画布尺寸
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// 玩家属性 (半圆)
const PLAYER_RADIUS = 20; // 半径决定大小
const PLAYER_SPEED = 5;
const PLAYER_COLOR = '#87CEFA'; // Light Sky Blue

// 子弹属性 (小圆)
const BULLET_RADIUS = 4;
const BULLET_SPEED = 7;
const BULLET_COLOR = '#FFFFFF'; // White

// 敌人属性 (圆)
const ENEMY_RADIUS_MIN = 15;
const ENEMY_RADIUS_MAX = 25;
const ENEMY_SPEED_MIN = 0.5;
const ENEMY_SPEED_MAX = 1.5;
const ENEMY_SPAWN_RATE = 180; // 敌人生成频率变慢 (数值越大越慢)
const ENEMY_COLORS = ['#FF69B4', '#FFFF00', '#DA70D6', '#FFA07A', '#ADD8E6']; // Pink, Yellow, Orchid, LightSalmon, LightBlue

// 其他
const STAR_COUNT = 100;
const STAR_COLOR = '#FFFFFF';
const TEXT_COLOR = '#FFFFFF'; // White text
const BACKGROUND_COLOR = '#000020'; // Very dark blue/black background

// --- 游戏变量 ---
let score = 0;
let gameRunning = false;
let gameOver = false;
let frameCount = 0;
let stars = [];

// --- 游戏对象 ---
let player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_RADIUS * 1.5, // Adjust starting Y based on radius
    radius: PLAYER_RADIUS,
    speed: 0, // 当前水平速度 (键盘控制)
    shootCooldown: 0,
    shootDelay: 20 // Slightly slower shooting
};

let bullets = [];
let enemies = [];

// --- 音效 (保持简单 Beep) ---
function playBeep(frequency = 440, duration = 50, volume = 0.05, type = 'sine') {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = volume;
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
        console.log("无法播放声音:", e);
    }
}
const shootSound = () => playBeep(880, 50, 0.03, 'triangle'); // Higher pitch, triangle wave
const hitSound = () => playBeep(220, 80, 0.05, 'sawtooth');   // Lower pitch, sawtooth wave
const gameOverSound = () => playBeep(110, 200, 0.08, 'square'); // Low long beep

// --- 输入处理 (基本不变) ---
let keysPressed = {};
let mouseX = CANVAS_WIDTH / 2;
let mouseClicked = false;

document.addEventListener('keydown', (event) => { keysPressed[event.code] = true; });
document.addEventListener('keyup', (event) => { keysPressed[event.code] = false; });

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
});

canvas.addEventListener('mousedown', (event) => {
    if (!gameRunning && !gameOver) {
         startGame();
    } else if (gameRunning && !gameOver) {
        mouseClicked = true; // Set flag for shooting in update()
    } else if (gameOver) {
        restartGame();
    }
});
// Prevent mouseup from being missed if mouse moves off canvas quickly
canvas.addEventListener('mouseup', () => {
    // mouseClicked = false; // Click is momentary, handled in update
});


// --- 游戏函数 ---

// 生成星星背景
function createStars() {
    stars = []; // Clear existing stars
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            radius: Math.random() * 1.5 // Small stars
        });
    }
}

// 创建敌人
function createEnemy() {
    const radius = Math.random() * (ENEMY_RADIUS_MAX - ENEMY_RADIUS_MIN) + ENEMY_RADIUS_MIN;
    const color = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
    enemies.push({
        x: Math.random() * (CANVAS_WIDTH - radius * 2) + radius, // Ensure enemy spawns fully within bounds
        y: -radius, // Start above the screen
        radius: radius,
        color: color,
        speedY: Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN,
        speedX: (Math.random() - 0.5) * 1 // Slower horizontal drift
    });
}

// 发射子弹
function shootBullet(x, y) {
    bullets.push({
        x: x, // Start from player's center X
        y: y - player.radius, // Start just above the player's arc
        radius: BULLET_RADIUS,
        speed: BULLET_SPEED,
        color: BULLET_COLOR
    });
    shootSound();
}

// 圆形碰撞检测
function checkCircleCollision(circle1, circle2) {
    const dx = circle2.x - circle1.x;
    const dy = circle2.y - circle1.y;
    const distanceSquared = dx * dx + dy * dy; // Use squared distance to avoid sqrt
    const radiusSumSquared = (circle1.radius + circle2.radius) * (circle1.radius + circle2.radius);
    return distanceSquared <= radiusSumSquared;
}

// --- 更新游戏状态 ---
function update() {
    if (!gameRunning || gameOver) return;

    // --- 玩家移动 ---
    player.speed = 0;
    if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
        player.speed = -PLAYER_SPEED;
    }
    if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
        player.speed = PLAYER_SPEED;
    }

    // 鼠标/触摸板控制 (优先)
    player.x = mouseX;

    // 键盘速度应用 (如果鼠标没动，键盘仍可微调——可选)
    // if (player.speed !== 0) {
    //     player.x += player.speed;
    // }

    // 限制玩家在画布内 (考虑半径)
    if (player.x - player.radius < 0) player.x = player.radius;
    if (player.x + player.radius > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.radius;

    // --- 玩家射击 ---
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    if ((keysPressed['Space'] || mouseClicked) && player.shootCooldown <= 0) {
        shootBullet(player.x, player.y); // Pass player's center x,y
        player.shootCooldown = player.shootDelay;
        mouseClicked = false; // Reset mouse click flag after shooting
    }

    // --- 更新子弹 ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        if (bullets[i].y + bullets[i].radius < 0) {
            bullets.splice(i, 1);
        }
    }

    // --- 更新敌人 ---
    frameCount++;
    if (frameCount % ENEMY_SPAWN_RATE === 0) {
        createEnemy();
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speedY;
        enemies[i].x += enemies[i].speedX;

        // 简单边界反弹
        if (enemies[i].x - enemies[i].radius <= 0 || enemies[i].x + enemies[i].radius >= CANVAS_WIDTH) {
             enemies[i].speedX *= -1;
        }

        // 敌人掉落到底部 -> Game Over
        if (enemies[i].y - enemies[i].radius > CANVAS_HEIGHT) {
            enemies.splice(i, 1); // Remove fallen enemy
            setGameOver("目标溜走了！");
            return;
        }
    }

    // --- 碰撞检测 ---
    // 子弹 vs 敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            // Check if bullet exists before collision check (might be removed in same frame)
             if (!bullets[i]) break;

            if (checkCircleCollision(bullets[i], enemies[j])) {
                hitSound();
                score += Math.ceil(enemies[j].radius); // Score based on size
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                // Don't immediately respawn, let the field clear a bit
                break; // Bullet hit, no need to check this bullet against other enemies
            }
        }
    }

    // 敌人 vs 玩家 (Player treated as a circle for collision)
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (checkCircleCollision(player, enemies[i])) {
            setGameOver("飞船被撞！");
            return;
        }
    }
}

// --- 绘制 ---
function drawStars() {
    ctx.fillStyle = STAR_COLOR;
    for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function draw() {
    // 绘制背景
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 绘制星星
    drawStars();

    // --- 绘制游戏元素 (只有在游戏运行或结束后才绘制) ---
    if (gameRunning || gameOver) {
         // 绘制玩家 (半圆)
        ctx.fillStyle = PLAYER_COLOR;
        ctx.beginPath();
        // arc(x, y, radius, startAngle, endAngle, anticlockwise)
        // 0 is right, PI is left. Draw top half circle.
        ctx.arc(player.x, player.y, player.radius, Math.PI, 0, false);
        ctx.closePath(); // Close path to fill correctly
        ctx.fill();


        // 绘制子弹 (圆)
        ctx.fillStyle = BULLET_COLOR;
        for (const bullet of bullets) {
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制敌人 (圆)
        for (const enemy of enemies) {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制分数 (左上角)
        drawText(`分数: ${score}`, 15, 30, 18, TEXT_COLOR, 'left');
    }


    // --- 绘制游戏状态文字 ---
    if (!gameRunning && !gameOver) {
        // 开始画面
        drawText("点击开始", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30, 32, TEXT_COLOR, 'center');
        drawText("键盘: ← → / AD 移动, 空格发射", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, 14, TEXT_COLOR, 'center');
        drawText("鼠标/触摸板: 移动控制, 点击发射", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35, 14, TEXT_COLOR, 'center');
    } else if (gameOver) {
        // 结束画面
        drawText("游戏结束!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, 48, 'orange', 'center');
        drawText(`最终得分: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, 24, TEXT_COLOR, 'center');
        drawText("点击画布重新开始", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50, 18, TEXT_COLOR, 'center');
    }
}

// 绘制文字的辅助函数 (保持不变)
function drawText(text, x, y, size = 20, color = TEXT_COLOR, align = 'center') {
    ctx.fillStyle = color;
    ctx.font = `${size}px sans-serif`; // Use a generic sans-serif font
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}


// --- 游戏主循环 ---
function gameLoop() {
    update();
    draw();

    // Only continue the loop if the game should be running
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// --- 游戏控制 ---
function startGame() {
    if (gameRunning) return;
    console.log("游戏开始！");
    gameRunning = true;
    gameOver = false;
    score = 0;
    frameCount = 0; // Reset frame count for spawning
    player.x = CANVAS_WIDTH / 2; // Reset player position
    player.y = CANVAS_HEIGHT - PLAYER_RADIUS * 1.5;
    bullets = [];
    enemies = [];
    keysPressed = {};
    mouseClicked = false;

    // 减少初始敌人数量，并且延时出现
    // createEnemy(); // Start with maybe one enemy after a short delay
    setTimeout(createEnemy, 500); // Spawn first enemy after 0.5 sec

    createStars(); // Create stars at the beginning
    requestAnimationFrame(gameLoop);
}

function setGameOver(reason) {
    if (!gameRunning || gameOver) return;
    console.log("游戏结束:", reason);
    gameRunning = false;
    gameOver = true;
    gameOverSound(); // Play game over sound
    // Draw is called one last time via the final animation frame request
    // We redraw here immediately to show the game over text faster
     draw();
}

function restartGame() {
    if (!gameOver) return;
    console.log("重新开始游戏...");
    // Resetting gameOver flag is handled inside startGame now
    startGame();
}

// --- Initial Setup ---
window.onload = () => {
    createStars(); // Create stars initially
    draw(); // Draw the initial "Click to Start" screen
};
