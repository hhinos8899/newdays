/**
 * DEBUG版 app.js
 *
 * 规则（按你最新要求）：
 * A) 套入12手（4组三连顺序匹配，允许跳过，不要求连续）
 *    组顺序：PBP, BBP, PPB, PBP   （完成=虚拟12）
 *
 * B) 套完12手后：
 *    虚拟13/14/15 = BBP（接着前面组往下走，不从头开始）
 *    必须连续走满3手后再判定：三手里至少命中1手 -> 进入预测；否则继续下一轮(仍当作13/14/15)
 *
 * C) 过门槛后才开始逐手预测：
 *    因为13-15已经走完BBP，所以虚拟16从 PPB 开始
 *    循环组：BBP -> PPB -> PBP -> BBP -> PPB -> PBP -> PBB -> PBP -> ...
 *
 * D) DEBUG显示：真实第几手（虚拟第几手）、当前组/进度、门槛命中、下一手预测
 */

const GROUPS = ["PBP", "BBP", "PPB", "PBP"]; // 套入12
const GATE_GROUP = "BBP";                    // 13-15
const LOOP_GROUPS = ["BBP","PPB","PBP","BBP","PPB","PBP","PBB","PBP"]; // 循环结构

let gameHistory = [];
let waiting = false;

// 0=套入；1=门槛；2=逐手预测
let phase = 0;

// phase0：顺序套入（子序列匹配）
let fitGroupIdx = 0;
let fitPos = 0;

// 套完12发生在真实第几手（那一手=虚拟12）
let completedAtRealHand = 0;

// phase1：门槛（13/14/15 = BBP）
let gateStep = 0;  // 0..2
let gateHits = 0;
let lastGateLine = "";

// phase2：逐手预测
let loopGroupIdx = 0;
let loopPos = 0;
let phase2StartRealHand = 0;

// ============== DOM ==============
function byId(id){ return document.getElementById(id); }
function $(sel){ return document.querySelector(sel); }

function setButtonsDisabled(disabled){
  const p = $('.player-btn');
  const b = $('.banker-btn');
  const back = $('.back-btn');
  const reset = $('.reset-btn');
  if(p) p.disabled = disabled;
  if(b) b.disabled = disabled;
  if(back) back.disabled = disabled;
  if(reset) reset.disabled = disabled;
}

function renderHistory(){
  const box = byId('recordDisplay');
  if(!box) return;
  box.innerHTML = '';
  gameHistory.forEach(x=>{
    const d = document.createElement('div');
    d.className = 'record-item ' + x.toLowerCase();
    d.textContent = x;
    box.appendChild(d);
  });
}

function setLabelAI(){
  const label = byId('resultLabel');
  const pctEl = byId('resultPct');
  if(label){
    label.textContent = 'AI';
    label.classList.remove('player','banker');
  }
  if(pctEl) pctEl.textContent = '';
}

function setLabelSide(side){
  const label = byId('resultLabel');
  const pctEl = byId('resultPct');
  if(label){
    label.textContent = side;
    label.classList.remove('player','banker');
    label.classList.add(side === 'B' ? 'banker' : 'player');
  }
  if(pctEl) pctEl.textContent = '';
}

function showTextOnly(msg){
  setLabelAI();
  const text = byId('predictionText');
  if(text) text.textContent = msg;
}

// ============== 虚拟手计算（DEBUG用） ==============
function virtualHandForReal(realHand){
  // realHand: 1..N (已发生的真实手)
  if(!completedAtRealHand) return null;

  // 1..completedAtRealHand 映射为 虚拟?（套入阶段：虚拟手=未知直到套完，但我们只在套完后显示）
  // 套完后：已完成那一手 = 虚拟12
  if(realHand <= completedAtRealHand) return null;

  // 门槛阶段：下一轮始终当作13/14/15
  if(phase === 1){
    // 当前这手是门槛的第 gateStep(已推进前) 位置：实时显示用 update里单算
    return null;
  }

  // 预测阶段：虚拟16对应 phase2StartRealHand
  if(phase === 2 && phase2StartRealHand){
    return 16 + (realHand - phase2StartRealHand);
  }

  return null;
}

function fmtUpcomingHand(){
  const upcomingReal = gameHistory.length + 1;
  let v = null;

  if(phase === 0){
    // 套入阶段不标虚拟手（你要也可以，但没意义）
    return `第${upcomingReal}手`;
  }

  if(phase === 1){
    // 门槛永远显示 13/14/15
    v = 13 + gateStep;
    return `第${upcomingReal}手(${v}手)`;
  }

  if(phase === 2){
    v = phase2StartRealHand ? (16 + (upcomingReal - phase2StartRealHand)) : null;
    return (v == null) ? `第${upcomingReal}手` : `第${upcomingReal}手(${v}手)`;
  }

  return `第${upcomingReal}手`;
}

// ============== 核心推进 ==============
function advanceAfterInput(actual){

  // phase0：套入12手（允许跳过、不要求连续）
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];

    if(actual === expect){
      fitPos++;
      if(fitPos >= 3){
        fitPos = 0;
        fitGroupIdx++;

        if(fitGroupIdx >= GROUPS.length){
          // ✅ 套完12：真实第N手 = 虚拟12
          completedAtRealHand = gameHistory.length;
          phase = 1;

          gateStep = 0;
          gateHits = 0;

          // 预置预测：过门槛后从PPB开始（因为13-15用掉了BBP）
          loopGroupIdx = 1; // PPB
          loopPos = 0;
          phase2StartRealHand = 0;

          // 重置套入指针（可选）
          fitGroupIdx = 0;
          fitPos = 0;
        }
      }
    }
    return;
  }

  // phase1：门槛（13/14/15 = BBP，必须连续走满3手再判定）
  if(phase === 1){
    const target = GATE_GROUP[gateStep];
    const hit = (actual === target);
    if(hit) gateHits++;

    gateStep++;

    if(gateStep < 3) return;

    // 满3手统一判定
    if(gateHits >= 1){
      phase = 2;
      phase2StartRealHand = gameHistory.length + 1; // 下一手=虚拟16
      loopGroupIdx = 1; // ✅ 从PPB开始接上
      loopPos = 0;
    } else {
      // 三手全不中：继续下一轮门槛（仍当作13/14/15）
      gateStep = 0;
      gateHits = 0;
    }
    return;
  }

  // phase2：逐手预测推进（严格顺序）
  if(phase === 2){
    loopPos++;
    if(loopPos >= 3){
      loopPos = 0;
      loopGroupIdx = (loopGroupIdx + 1) % LOOP_GROUPS.length;
    }
  }
}

function nextPredLetterPhase2(){
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];
  return g[loopPos];
}

// ============== UI刷新（DEBUG信息很全） ==============
function updateView(){
  const realCount = gameHistory.length;

  // phase0
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    showTextOnly(
      `【DEBUG】套入阶段（前12手）\n` +
      `已输入：${realCount}手\n` +
      `当前目标组：第${fitGroupIdx + 1}/${GROUPS.length}组 = ${need}\n` +
      `等待字符：${expect}\n` +
      `下一手：${fmtUpcomingHand()}\n` +
      `说明：顺序匹配，可跳过夹杂，不要求连续`
    );
    return;
  }

  // phase1
  if(phase === 1){
    const upcoming = fmtUpcomingHand();          // 第x手(13/14/15)
    const target = GATE_GROUP[gateStep];         // 本轮门槛下一手目标
    const lastReal = gameHistory.length;          // 刚输入的真实手号
    const lastActual = gameHistory[lastReal - 1]; // 刚输入结果

    lastGateLine =
      `【DEBUG】已套完：第${completedAtRealHand}手(12手)\n` +
      `门槛阶段：13/14/15 = ${GATE_GROUP}\n` +
      `刚输入：第${lastReal}手 结果=${lastActual}\n` +
      `本轮门槛命中：${gateHits}/3\n` +
      `下一手：${upcoming}\n` +
      `下一手门槛目标：${target}\n` +
      `规则：必须连续走满3手才判定，三手至少中1手才进入预测`;

    showTextOnly(lastGateLine);
    return;
  }

  // phase2
  const p = nextPredLetterPhase2();
  const upcoming = fmtUpcomingHand();
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];

  setLabelSide(p);
  const text = byId('predictionText');
  if(text){
    const phase2VirtualUpcoming = upcoming.includes("(") ? upcoming : upcoming;
    text.textContent =
      `【DEBUG】已过门槛（13/14/15=${GATE_GROUP}，三手至少中1手）\n` +
      `已输入：${realCount}手\n` +
      `下一手：${phase2VirtualUpcoming}\n` +
      `当前循环组：${g}（第${loopPos + 1}/3）\n` +
      `本手预测：${p}\n` +
      `循环：${LOOP_GROUPS.join(" → ")}\n` +
      `说明：门槛已用掉BBP，所以虚拟16从PPB开始`;
  }
}

// ============== Back / Reset（整局重算） ==============
function recomputeFromHistory(arr){
  phase = 0;
  fitGroupIdx = 0;
  fitPos = 0;
  completedAtRealHand = 0;

  gateStep = 0;
  gateHits = 0;
  lastGateLine = "";

  loopGroupIdx = 1; // 默认预测接PPB（真正进入phase2时会再设置一次）
  loopPos = 0;
  phase2StartRealHand = 0;

  gameHistory = [];
  arr.forEach(x=>{
    gameHistory.push(x);
    advanceAfterInput(x);
  });
}

// ============== 按钮 ==============
window.recordResult = function(type){
  if(waiting) return;
  if(type !== 'B' && type !== 'P') return;

  waiting = true;
  setButtonsDisabled(true);

  gameHistory.push(type);
  renderHistory();
  advanceAfterInput(type);
  updateView();

  waiting = false;
  setButtonsDisabled(false);
};

window.undoLastMove = function(){
  if(waiting) return;
  const old = [...gameHistory];
  old.pop();
  recomputeFromHistory(old);
  renderHistory();
  updateView();
};

window.resetGame = function(){
  if(waiting) return;
  recomputeFromHistory([]);
  renderHistory();
  showTextOnly(
    `【DEBUG】已重置\n` +
    `1）套入12手：${GROUPS.join(" → ")}（顺序匹配，可跳过）\n` +
    `2）套完后：13/14/15 = ${GATE_GROUP}（连续走满3手判定）\n` +
    `3）过门槛后：虚拟16从 PPB 开始进入循环预测`
  );
};

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', function(){
  renderHistory();
  showTextOnly('【DEBUG】就绪：请输入真实结果(B/P)。');
  updateView();
});
