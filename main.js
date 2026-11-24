
import * as THREE from
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ===================================
// HTML要素
// ===================================

const container = document.getElementById('game-container');
const statusText = document.getElementById('status');
const restartButton = document.getElementById('restart');
const errorBox = document.getElementById('error');

// エラーを画面に表示
function showError(message) {
  errorBox.style.display = 'block';
  errorBox.textContent = message;
}

// ===================================
// ゲーム設定
// ===================================

const BOX_WIDTH = 8;
const BOX_DEPTH = 6;
const BOX_HEIGHT = 2;

const BALL_RADIUS = 0.38;
const PAIR_COUNT = 6;

const COLORS = [
  0xff4444, // 赤
  0x44aaff, // 青
  0x44dd77, // 緑
  0xffdd44, // 黄
  0xbb66ff, // 紫
  0xff8833  // オレンジ
];

// ===================================
// Three.js初期設定
// ===================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202631);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, 8.5, 10);
camera.lookAt(0, 0.7, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

// ===================================
// ライト
// ===================================

scene.add(
  new THREE.AmbientLight(0xffffff, 2)
);

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(4, 10, 5);
scene.add(light);

// ===================================
// 箱の作成
// ===================================

function createBox() {
  // 底板
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_WIDTH, 0.3, BOX_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x8b7355
    })
  );

  floor.position.y = -0.15;
  scene.add(floor);

  // 壁
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0b8c8,
    transparent: true,
    opacity: 0.25
  });

  // 左右
  for (const x of [-BOX_WIDTH / 2, BOX_WIDTH / 2]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, BOX_HEIGHT, BOX_DEPTH),
      wallMaterial
    );

    wall.position.set(x, BOX_HEIGHT / 2, 0);
    scene.add(wall);
  }

  // 前後
  for (const z of [-BOX_DEPTH / 2, BOX_DEPTH / 2]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(BOX_WIDTH, BOX_HEIGHT, 0.25),
      wallMaterial
    );

    wall.position.set(0, BOX_HEIGHT / 2, z);
    scene.add(wall);
  }
}

// ===================================
// 球の管理
// ===================================

let balls = [];
let firstSelected = null;
let matchedPairs = 0;

// ===================================
// 球の生成
// ===================================

function createBall(pairId, color) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35
    })
  );

  ball.userData.pairId = pairId;
  ball.userData.isMatched = false;

  return ball;
}

// ===================================
// 配置
// ===================================

function randomPosition() {
  const margin = BALL_RADIUS + 0.15;

  return {
    x: THREE.MathUtils.randFloat(
      -BOX_WIDTH / 2 + margin,
      BOX_WIDTH / 2 - margin
    ),
    z: THREE.MathUtils.randFloat(
      -BOX_DEPTH / 2 + margin,
      BOX_DEPTH / 2 - margin
    )
  };
}

function isPositionAvailable(position, placedBalls) {
  const minDistance = BALL_RADIUS * 2 + 0.12;

  return placedBalls.every(ball => {
    const dx = position.x - ball.position.x;
    const dz = position.z - ball.position.z;

    return Math.sqrt(dx * dx + dz * dz) >= minDistance;
  });
}

function placeBall(ball, placedBalls) {
  let position;
  let attempts = 0;

  do {
    position = randomPosition();
    attempts++;
  } while (
    !isPositionAvailable(position, placedBalls) &&
    attempts < 1000
  );

  ball.position.set(
    position.x,
    BALL_RADIUS + 0.05,
    position.z
  );

  ball.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  scene.add(ball);
  placedBalls.push(ball);
}

// ===================================
// シャッフル
// ===================================

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ===================================
// ゲーム開始・リセット
// ===================================

function startGame() {
  // 前の球を片付ける
  for (const ball of balls) {
    scene.remove(ball);
    ball.geometry.dispose();
    ball.material.dispose();
  }

  balls = [];
  firstSelected = null;
  matchedPairs = 0;

  statusText.textContent =
    '同じ色の球を2つ選んでください';

  // 6色×2個
  const newBalls = [];

  COLORS.forEach((color, pairId) => {
    newBalls.push(createBall(pairId, color));
    newBalls.push(createBall(pairId, color));
  });

  shuffle(newBalls);

  for (const ball of newBalls) {
    placeBall(ball, balls);
  }
}

// ===================================
// 選択処理
// ===================================

function selectBall(ball) {
  if (ball.userData.isMatched) return;

  // 1個目
  if (firstSelected === null) {
    firstSelected = ball;
    ball.scale.setScalar(1.25);

    statusText.textContent = 'もう1つ選んでください';
    return;
  }

  // 同じ球を連続選択しない
  if (firstSelected === ball) return;

  // 2個目
  const secondSelected = ball;
  secondSelected.scale.setScalar(1.25);

  checkPair(firstSelected, secondSelected);
}

// ===================================
// 正誤判定
// ===================================

function checkPair(first, second) {
  if (first.userData.pairId === second.userData.pairId) {
    // 正解
    statusText.textContent = '正解！';

    removeBall(first);
    removeBall(second);

    matchedPairs++;
    firstSelected = null;

    if (matchedPairs === PAIR_COUNT) {
      statusText.textContent = 'クリア！全ペア発見！';
    }

  } else {
    // 不正解
    first.scale.setScalar(1);
    second.scale.setScalar(1);

    firstSelected = null;

    statusText.textContent = '違います。もう一度！';
  }
}

// ===================================
// 正解した球を削除
// ===================================

function removeBall(ball) {
  ball.userData.isMatched = true;

  scene.remove(ball);

  // 選択対象リストからも除外
  balls = balls.filter(b => b !== ball);

  ball.geometry.dispose();
  ball.material.dispose();
}

// ===================================
// タップ・クリック判定
// ===================================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', event => {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(balls);

  if (intersects.length > 0) {
    selectBall(intersects[0].object);
  }
});

// ===================================
// リスタート
// ===================================

restartButton.addEventListener('click', startGame);

// ===================================
// 画面サイズ変更
// ===================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
});

// ===================================
// 描画
// ===================================

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// ===================================
// 起動
// ===================================

try {
  createBox();
  startGame();
  animate();
} catch (error) {
  console.error(error);
  showError('ゲームの起動に失敗しました。\n' + error.message);
}
