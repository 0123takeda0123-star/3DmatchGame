import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ============================
// 基本設定
// ============================

const container = document.getElementById('game-container');
const statusText = document.getElementById('status');
const restartButton = document.getElementById('restart');

const BOX_WIDTH = 8;
const BOX_DEPTH = 6;
const BOX_HEIGHT = 2;

const BALL_RADIUS = 0.38;
const BALL_COUNT = 12;
const PAIR_COUNT = 6;

// 6色（各色2個）
const COLORS = [
  0xff4444, // 赤
  0x44aaff, // 青
  0x44dd77, // 緑
  0xffdd44, // 黄
  0xbb66ff, // 紫
  0xff8833  // オレンジ
];

// ============================
// Three.js 基本構築
// ============================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202631);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, 8.5, 10);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ============================
// ライト
// ============================

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(4, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight;

// ============================
// 箱の作成
// ============================

function createBox() {
  // 底
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_WIDTH, 0.3, BOX_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x8b7355
    })
  );

  floor.position.y = -0.15;
  floor.receiveShadow = true;
  scene.add(floor);

  // 壁の共通材質
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0b8c8,
    transparent: true,
    opacity: 0.65
  });

  // 左右の壁
  const sideWallGeometry = new THREE.BoxGeometry(
    0.25,
    BOX_HEIGHT,
    BOX_DEPTH
  );

  const leftWall = new THREE.Mesh(
    sideWallGeometry,
    wallMaterial
  );

  leftWall.position.set(
    -BOX_WIDTH / 2,
    BOX_HEIGHT / 2,
    0
  );

  scene.add(leftWall);

  const rightWall = new THREE.Mesh(
    sideWallGeometry,
    wallMaterial
  );

  rightWall.position.set(
    BOX_WIDTH / 2,
    BOX_HEIGHT / 2,
    0
  );

  scene.add(rightWall);

  // 前後の壁
  const endWallGeometry = new THREE.BoxGeometry(
    BOX_WIDTH,
    BOX_HEIGHT,
    0.25
  );

  const backWall = new THREE.Mesh(
    endWallGeometry,
    wallMaterial
  );

  backWall.position.set(
    0,
    BOX_HEIGHT / 2,
    -BOX_DEPTH / 2
  );

  scene.add(backWall);

  const frontWall = new THREE.Mesh(
    endWallGeometry,
    wallMaterial
  );

  frontWall.position.set(
    0,
    BOX_HEIGHT / 2,
    BOX_DEPTH / 2
  );

  scene.add(frontWall);
}

// ============================
// 球体の管理
// ============================

let balls = [];
let firstSelected = null;
let matchedPairs = 0;

// ============================
// 球体を作成
// ============================

function createBall(pairId, color) {
  const geometry = new THREE.SphereGeometry(
    BALL_RADIUS,
    32,
    32
  );

  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.35,
    metalness: 0.05
  });

  const ball = new THREE.Mesh(geometry, material);

  ball.castShadow = true;
  ball.receiveShadow = true;

  // ペア判定用の情報
  ball.userData.pairId = pairId;
  ball.userData.originalScale = 1;
  ball.userData.isMatched = false;

  return ball;
}

// ============================
// ランダム配置
// ============================

function randomPosition() {
  const margin = BALL_RADIUS + 0.1;

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

  for (const ball of placedBalls) {
    const dx = position.x - ball.position.x;
    const dz = position.z - ball.position.z;

    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < minDistance) {
      return false;
    }
  }

  return true;
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

  // 球の向きをランダムにする
  ball.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  scene.add(ball);
  placedBalls.push(ball);
}

// ============================
// ゲーム初期化
// ============================

function startGame() {
  // 前回の球を削除
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

  // 各色2個ずつ作成
  const newBalls = [];

  COLORS.forEach((color, pairId) => {
    newBalls.push(createBall(pairId, color));
    newBalls.push(createBall(pairId, color));
  });

  // 配置順をシャッフル
  shuffle(newBalls);

  // 箱の中に配置
  for (const ball of newBalls) {
    placeBall(ball, balls);
  }
}

// ============================
// シャッフル
// ============================

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ============================
// 球の選択
// ============================

function selectBall(ball) {
  // すでに消えた球は選択不可
  if (ball.userData.isMatched) return;

  // 1個目の選択
  if (firstSelected === null) {
    firstSelected = ball;

    // 選択した球を少し大きくする
    ball.scale.setScalar(1.2);

    statusText.textContent = 'もう1つ選んでください';
    return;
  }

  // 同じ球を2回タップした場合は何もしない
  if (firstSelected === ball) {
    return;
  }

  // 2個目の選択
  const secondSelected = ball;

  secondSelected.scale.setScalar(1.2);

  // ペア判定
  checkPair(firstSelected, secondSelected);
}

// ============================
// ペア判定
// ============================

function checkPair(first, second) {
  if (
    first.userData.pairId ===
    second.userData.pairId
  ) {
    // 正解
    statusText.textContent = '正解！';

    removeBall(first);
    removeBall(second);

    matchedPairs++;

    firstSelected = null;

    // 全ペアを見つけたか
    if (matchedPairs === PAIR_COUNT) {
      statusText.textContent = 'クリア！全ペア発見！';
    }

  } else {
    // 不正解
    first.scale.setScalar(1);
    second.scale.setScalar(1);

    firstSelected = null;

    statusText.textContent = '違うペアです。もう一度！';
  }
}

// ============================
// 球を消す
// ============================

function removeBall(ball) {
  ball.userData.isMatched = true;

  scene.remove(ball);

  ball.geometry.dispose();
  ball.material.dispose();
}

// ============================
// タップ判定
// ============================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
  // タップ位置を正規化
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  // 球体だけを判定
  const intersects = raycaster.intersectObjects(balls);

  if (intersects.length > 0) {
    const ball = intersects[0].object;

    selectBall(ball);
  }
});

// ============================
// リスタートボタン
// ============================

restartButton.addEventListener('click', () => {
  startGame();
});

// ============================
// 画面サイズ変更
// ============================

window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
});

// ============================
// 描画ループ
// ============================

function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
}

// ============================
// 起動
// ============================

createBox();
startGame();
animate();
