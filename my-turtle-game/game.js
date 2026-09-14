const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// キャンバスサイズ自動調整
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ゲーム状態
let gameActive = false;
let score = 0;
let level = 1;
let exp = 0;
let nextLevelExp = 10;
let frameCount = 0;

// 入力管理
const keys = {};
let inputVector = { x: 0, y: 0 };

window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

// プレイヤー（カメ）
const player = {
    x: 0, y: 0,
    radius: 20,
    speed: 3.5,
    hp: 100,
    maxHp: 100,
    attackCooldown: 0,
    attackSpeed: 30, // 30フレーム毎に自動攻撃
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 甲羅（緑の円）
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#2e7d32";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#1b5e20";
        ctx.stroke();

        // 頭（小さな円）
        ctx.beginPath();
        ctx.arc(0, -this.radius + 2, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#81c784";
        ctx.fill();

        // 目
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-3, -this.radius, 2, 0, Math.PI * 2);
        ctx.arc(3, -this.radius, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
};

let enemies = [];
let bullets = [];
let expGems = [];

// 敵クラス（サメやカニを想定した赤玉）
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.speed = 1.5 + Math.random() * 0.5;
        this.hp = 2 + Math.floor(level * 0.5);
    }
    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#e53935";
        ctx.fill();
    }
}

// 弾（水てっぽう）
class Bullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 6;
        this.life = 100;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#29b6f6"; // 水色
        ctx.fill();
    }
}

// 経験値ジェム
class ExpGem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd54f"; // 黄色
        ctx.fill();
    }
}

// ゲーム初期化
function init() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.hp = 100;
    score = 0;
    level = 1;
    exp = 0;
    nextLevelExp = 10;
    enemies = [];
    bullets = [];
    expGems = [];
    gameActive = true;
    document.getElementById("game-over-screen").classList.add("hidden");
    updateUI();
}

// 敵のスポーン
function spawnEnemy() {
    if (enemies.length > 100) return;
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -20 : canvas.width + 20;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? -20 : canvas.height + 20;
    }
    enemies.push(new Enemy(x, y));
}

// 最寄りの敵を自動攻撃
function autoAttack() {
    if (enemies.length === 0) return;
    
    // 一番近い敵を探す
    let nearest = enemies[0];
    let minDist = Math.hypot(enemies[0].x - player.x, enemies[0].y - player.y);
    for (let i = 1; i < enemies.length; i++) {
        let d = Math.hypot(enemies[i].x - player.x, enemies[i].y - player.y);
        if (d < minDist) {
            minDist = d;
            nearest = enemies[i];
        }
    }

    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    const speed = 8;
    bullets.push(new Bullet(
        player.x, player.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
    ));
}

// メインループ
function gameLoop() {
    if (!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // キーボード移動判定
    inputVector.x = 0;
    inputVector.y = 0;
    if (keys["ArrowUp"] || keys["w"]) inputVector.y -= 1;
    if (keys["ArrowDown"] || keys["s"]) inputVector.y += 1;
    if (keys["ArrowLeft"] || keys["a"]) inputVector.x -= 1;
    if (keys["ArrowRight"] || keys["d"]) inputVector.x += 1;

    // 移動補正＆適用
    const len = Math.hypot(inputVector.x, inputVector.y);
    if (len > 0) {
        player.x += (inputVector.x / len) * player.speed;
        player.y += (inputVector.y / len) * player.speed;
    }

    // 画面外防止
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // プレイヤー描画
    player.draw();

    // 自動攻撃
    player.attackCooldown++;
    if (player.attackCooldown >= player.attackSpeed) {
        autoAttack();
        player.attackCooldown = 0;
    }

    // 敵出現
    if (frameCount % Math.max(10, 60 - level * 2) === 0) {
        spawnEnemy();
    }

    // 弾の更新＆描画
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        b.draw();
        if (b.life <= 0) {
            bullets.splice(i, 1);
            continue;
        }

        // 敵と弾の当たり判定
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
                e.hp--;
                bullets.splice(i, 1);
                if (e.hp <= 0) {
                    expGems.push(new ExpGem(e.x, e.y));
                    enemies.splice(j, 1);
                    score += 10;
                }
                break;
            }
        }
    }

    // 敵の更新＆判定
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update();
        e.draw();

        // 自機との接触判定
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius) {
            player.hp -= 0.5;
            updateUI();
            if (player.hp <= 0) {
                gameOver();
            }
        }
    }

    // 経験値ジェム回収判定
    for (let i = expGems.length - 1; i >= 0; i--) {
        const gem = expGems[i];
        gem.draw();
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist < player.radius + 30) { // 引き寄せ範囲
            gem.x += (player.x - gem.x) * 0.1;
            gem.y += (player.y - gem.y) * 0.1;
        }
        if (dist < player.radius + gem.radius) {
            expGems.splice(i, 1);
            exp++;
            if (exp >= nextLevelExp) {
                levelUp();
            }
            updateUI();
        }
    }

    requestAnimationFrame(gameLoop);
}

function levelUp() {
    level++;
    exp = 0;
    nextLevelExp = Math.floor(nextLevelExp * 1.5);
    player.maxHp += 10;
    player.hp = player.maxHp; // HP回復
    if (player.attackSpeed > 10) player.attackSpeed -= 2; // 攻撃速度アップ
}

function updateUI() {
    document.getElementById("hp-bar").style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    document.getElementById("score").innerText = `SCORE: ${score}`;
    document.getElementById("level").innerText = `LV: ${level}`;
}

function gameOver() {
    gameActive = false;
    document.getElementById("screen-title").innerText = "GAME OVER";
    document.getElementById("final-score").innerText = `SCORE: ${score} (LV.${level})`;
    document.getElementById("game-over-screen").classList.remove("hidden");
}

// タッチジョイスティック設定（スマホ用）
const joystickZone = document.getElementById("joystick-zone");
const joystickStick = document.getElementById("joystick-stick");
let touchId = null;

joystickZone.addEventListener("touchstart", (e) => {
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    updateJoystick(touch);
});

joystickZone.addEventListener("touchmove", (e) => {
    for (let touch of e.changedTouches) {
        if (touch.identifier === touchId) {
            updateJoystick(touch);
        }
    }
});

const resetJoystick = () => {
    touchId = null;
    joystickStick.style.top = "35px";
    joystickStick.style.left = "35px";
    inputVector = { x: 0, y: 0 };
};

joystickZone.addEventListener("touchend", resetJoystick);
joystickZone.addEventListener("touchcancel", resetJoystick);

function updateJoystick(touch) {
    const rect = joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxDist = 40;

    const angle = Math.atan2(dy, dx);
    const moveDist = Math.min(dist, maxDist);

    joystickStick.style.left = `${35 + Math.cos(angle) * moveDist}px`;
    joystickStick.style.top = `${35 + Math.sin(angle) * moveDist}px`;

    inputVector.x = Math.cos(angle);
    inputVector.y = Math.sin(angle);
}

document.getElementById("start-btn").addEventListener("click", () => {
    init();
    requestAnimationFrame(gameLoop);
});