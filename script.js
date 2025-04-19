// --- 获取 HTML 元素 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); // 获取 2D 绘图上下文
const scoreElement = document.getElementById('scoreValue');
const gameStateText = document.getElementById('gameStateText');

// --- 游戏常量 ---
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 8;
const BULLET_WIDTH = 5;
const BULLET_HEIGHT = 15;
const BULLET_SPEED = 10;
const ENEMY_WIDTH = 40;
const ENEMY_HEIGHT = 30;
const ENEMY_SPEED_MIN = 1;
const ENEMY_SPEED_MAX = 3;
const ENEMY_SPAWN_RATE = 100; // 每 100 帧尝试生成一个敌人 (数值越小越快)
const PLAYER_COLOR = 'lime'; // 玩家颜色 (亮绿色)
const BULLET_COLOR = 'cyan'; // 子弹颜色 (青色)
const ENEMY_COLOR = 'red';   // 敌人颜色 (红色)
const TEXT_COLOR = 'white'; // 文字颜色

// --- 游戏变量 ---
let score = 0;
let gameRunning = false;
let gameOver = false;
let frameCount = 0; // 帧计数器，用于控制生成敌人

// --- 游戏对象 ---
let player = {
    x: canvas.width / 2 - PLAYER_WIDTH / 2,
    y: canvas.height - PLAYER_HEIGHT - 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: 0, // 当前水平速度 (键盘控制)
    shootCooldown: 0, // 射击冷却计时
    shootDelay: 15 // 射击间隔 (帧数)
};

let bullets = []; // 存储所有子弹的数组
let enemies = []; // 存储所有敌人的数组

// --- 音效 (简单HTML5 Audio) ---
// 注意：浏览器可能限制声音自动播放，通常需要用户交互（如点击）后才能播放
let shootSound = new Audio(); // 创建一个 Audio 对象
let hitSound = new Audio();
// 尝试加载声音文件 (如果想用自己的文件)
// shootSound.src = 'sounds/shoot.wav';
// hitSound.src = 'sounds/hit.wav';
// 简单的备用声音 (需要浏览器支持 Web Audio API 的简单 beep)
function playBeep(frequency = 440, duration = 50, volume = 0.1) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.value = volume;
        oscillator.frequency.value = frequency; // value in hertz
        oscillator.type = 'sine'; // sine, square, sawtooth, triangle

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000); // duration in seconds
    } catch (e) {
        console.log("浏览器不支持 Web Audio API 或播放出错", e);
    }
}

// --- 输入处理 ---
let keysPressed = {}; // 记录按下的键
let mouseX = canvas.width / 2; // 鼠标/触摸板 X 坐标
let mouseClicked = false; // 鼠标/触摸板是否点击

// 键盘事件监听
document.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

// 鼠标/触摸板事件监听
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect(); // 获取画布在页面上的位置
    mouseX = event.clientX - rect.left; // 计算鼠标在画布内的 X 坐标
});

canvas.addEventListener('mousedown', (event) => {
     // 只有在游戏运行时才响应点击发射
    if (gameRunning && !gameOver) {
       mouseClicked = true;
    } else if (!gameRunning) {
         startGame(); // 点击画布开始游戏
    } else if (gameOver) {
        restartGame(); // 游戏结束后点击重新开始
    }
});

// --- 游戏函数 ---

// 创建敌人
function createEnemy() {
    enemies.push({
        x: Math.random() * (canvas.width - ENEMY_WIDTH), // 随机 X 位置
        y: -ENEMY_HEIGHT, // 从画布顶端外部开始
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        speedY: Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN, // 随机 Y 速度
        speedX: (Math.random() - 0.5) * 2 // 随机 X 漂移速度 (-1 到 1)
    });
}

// 发射子弹
function shootBullet(x, y) {
    bullets.push({
        x: x - BULLET_WIDTH / 2, // 从玩家中心发射
        y: y,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        speed: BULLET_SPEED
    });
    // 尝试播放声音
    // shootSound.currentTime = 0; // 从头播放
    // shootSound.play().catch(e => console.log("播放射击声音失败:", e)); // 播放并捕获错误
    playBeep(880, 50, 0.05); // 播放一个高音短促的 beep
}

// 碰撞检测 (Axis-Aligned Bounding Box)
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// --- 更新游戏状态 ---
function update() {
    if (!gameRunning || gameOver) return; // 如果游戏未运行或已结束，则不更新

    // --- 玩家移动 ---
    player.speed = 0; // 重置键盘速度
    // 键盘控制
    if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
        player.speed = -PLAYER_SPEED;
    }
    if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
        player.speed = PLAYER_SPEED;
    }
    // 鼠标/触摸板控制 (覆盖键盘)
    player.x = mouseX - player.width / 2;

    // 键盘速度应用 (如果鼠标没控制，键盘依然有效——可取消注释下面两行)
    // if (player.speed !== 0) {
    //      player.x += player.speed;
    // }

    // 限制玩家在画布内
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // --- 玩家射击 ---
    // 冷却计时
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    // 空格键射击
    if (keysPressed['Space'] && player.shootCooldown <= 0) {
        shootBullet(player.x + player.width / 2, player.y);
        player.shootCooldown = player.shootDelay; // 重置冷却
    }
    // 鼠标/触摸板点击射击
    if (mouseClicked && player.shootCooldown <= 0) {
         shootBullet(player.x + player.width / 2, player.y);
         player.shootCooldown = player.shootDelay;
         mouseClicked = false; // 重置点击状态
    }


    // --- 更新子弹 ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        // 移除飞出屏幕的子弹
        if (bullets[i].y + bullets[i].height < 0) {
            bullets.splice(i, 1); // 从数组中移除
        }
    }

    // --- 更新敌人 ---
    frameCount++;
    // 按频率生成敌人
    if (frameCount % ENEMY_SPAWN_RATE === 0) {
        createEnemy();
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speedY;
        enemies[i].x += enemies[i].speedX;

        // 敌人碰到左右边界反弹 (简单处理)
        if (enemies[i].x <= 0 || enemies[i].x + enemies[i].width >= canvas.width) {
             enemies[i].speedX *= -1;
        }

        // 移除掉落出屏幕的敌人，并结束游戏
        if (enemies[i].y > canvas.height) {
            enemies.splice(i, 1);
            setGameOver("敌人到达底部！");
            return; // 游戏结束，停止当前帧更新
        }
    }

    // --- 碰撞检测 ---
    // 子弹与敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], enemies[j])) {
                // 碰撞发生
                score += 10; // 加分
                scoreElement.textContent = score; // 更新页面分数显示
                // 尝试播放声音
                // hitSound.currentTime = 0;
                // hitSound.play().catch(e => console.log("播放击中声音失败:", e));
                playBeep(220, 80, 0.1); // 播放一个低音长一点的 beep

                bullets.splice(i, 1); // 移除子弹
                enemies.splice(j, 1); // 移除敌人
                createEnemy();        // 再生成一个敌人
                break; // 子弹已消失，停止内层循环
            }
        }
    }

    // 敌人与玩家
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (checkCollision(player, enemies[i])) {
            setGameOver("飞船被撞毁！");
            return; // 游戏结束
        }
    }
}

// --- 绘制 ---
function draw() {
    // 清除画布
    ctx.fillStyle = '#333'; // 深灰色背景
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameRunning && !gameOver) {
        // 显示开始提示
        drawText("点击画布开始游戏", canvas.width / 2, canvas.height / 2 - 30, 24, TEXT_COLOR, 'center');
        drawText("键盘: ← → / AD 移动, 空格发射", canvas.width / 2, canvas.height / 2 + 10, 16, TEXT_COLOR, 'center');
        drawText("鼠标/触摸板: 移动控制, 点击发射", canvas.width / 2, canvas.height / 2 + 40, 16, TEXT_COLOR, 'center');
        return; // 不绘制游戏元素
    }


    // 绘制玩家 (简单矩形)
    // 如果想用图片： ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 绘制子弹
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    // 绘制敌人
    ctx.fillStyle = ENEMY_COLOR;
    for (const enemy of enemies) {
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }

    // 绘制分数 (在画布顶部)
    drawText(`分数: ${score}`, 10, 20, 18, TEXT_COLOR, 'left');


    // 如果游戏结束，显示结束信息
    if (gameOver) {
        drawText("游戏结束!", canvas.width / 2, canvas.height / 2 - 40, 48, 'orange', 'center');
        drawText(`最终得分: ${score}`, canvas.width / 2, canvas.height / 2 + 10, 24, TEXT_COLOR, 'center');
        drawText("点击画布重新开始", canvas.width / 2, canvas.height / 2 + 50, 18, TEXT_COLOR, 'center');
    }
}

// 绘制文字的辅助函数
function drawText(text, x, y, size = 20, color = TEXT_COLOR, align = 'center') {
    ctx.fillStyle = color;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}


// --- 游戏主循环 ---
function gameLoop() {
    update(); // 更新状态
    draw();   // 重新绘制

    // 持续请求下一帧动画
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// --- 游戏控制 ---
function startGame() {
    if (gameRunning) return; // 防止重复开始
    console.log("游戏开始！");
    gameRunning = true;
    gameOver = false;
    score = 0;
    scoreElement.textContent = score;
    gameStateText.textContent = "游戏进行中...";
    // 重置游戏对象
    player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
    player.y = canvas.height - PLAYER_HEIGHT - 20;
    bullets = [];
    enemies = [];
    frameCount = 0;
    keysPressed = {}; // 清空按键状态
    mouseClicked = false; // 清空点击状态
    // 生成初始敌人
    for(let i = 0; i < 5; i++) { // 初始少一点敌人
        setTimeout(createEnemy, Math.random() * 1000); // 稍微错开生成
    }

    // 启动游戏循环
    requestAnimationFrame(gameLoop);
}

function setGameOver(reason) {
    if (!gameRunning || gameOver) return; // 防止重复结束
    console.log("游戏结束:", reason);
    gameRunning = false; // 停止动画循环请求
    gameOver = true;
    gameStateText.textContent = `游戏结束! ${reason} 点击画布重新开始。`;
}

function restartGame() {
    if (!gameOver) return;
    console.log("重新开始游戏...");
    startGame(); // 调用开始游戏的逻辑即可
}

// --- 初始提示 ---
// 页面加载后先绘制一次提示信息
window.onload = () => {
    draw(); // 初始绘制，会显示开始提示
    gameStateText.textContent = "点击画布开始游戏";
};