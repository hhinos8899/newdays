/**
 * 调试版 app.js（最终标准顺序版）
 * 标准8组：PBP, BBP, PPB, PBP, BBP, PPB, PBP, PBB
 * 套入：前4组（共12手）——顺序匹配可跳过
 * 门槛：虚拟13/14/15 = 第5组 BBP（必须连续走满3手再判定，三手至少中1手才进入预测）
 * 预测：虚拟16从第6组 PPB 开始接着走（所以22-24必然是PBB）
 */

const GROUPS = ["PBP","BBP","PPB","PBP"]; // 套入前4组=12手（顺序匹配可跳过）
const MASTER_GROUPS = ["PBP","BBP","PPB","PBP","BBP","PPB","PBP","PBB"]; // ✅ 你给的唯一标准顺序
const GATE_GROUP = "BBP"; // ✅ 虚拟13/14/15

let gameHistory = [];
let phase = 0; // 0套入 1门槛 2预测

// 套入指针（子序列匹配）
let fitGroupIdx = 0;
let fitPos = 0;

let completedAtRealHand = 0;

// 门槛指针（必须连续3手）
let gateStep = 0; // 0..2
let gateHits = 0;

// 预测指针（按 MASTER_GROUPS 循环）
let loopGroupIdx = 5; // ✅ 预测从第6组 PPB 开始（0:PBP 1:BBP 2:PPB 3:PBP 4:BBP 5:PPB 6:PBP 7:PBB）
let loopPos = 0;      // 0..2
let phase2StartRealHand = 0;

function byId(id){ return document.getElementById(id); }
function $(sel){ return document.querySelector(sel); }

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

function fmtUpcomingHand(){
  const upcomingReal = gameHistory.length + 1;

  if(phase === 0) return `第${upcomingReal}手`;
  if(phase === 1) return `第${upcomingReal}手(${13 + gateStep}手)`;
  if(phase === 2){
    const v = phase2StartRealHand ? (16 + (upcomingReal - phase2StartRealHand)) : null;
    return v == null ? `第${upcomingReal}手` : `第${upcomingReal}手(${v}手)`;
  }
  return `第${upcomingReal}手`;
}

function advanceAfterInput(actual){
  // phase0：套入（顺序匹配可跳过）
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    if(actual === expect){
      fitPos++;
      if(fitPos >= 3){
        fitPos = 0;
        fitGroupIdx++;
        if(fitGroupIdx >= GROUPS.length){
          completedAtRealHand = gameHistory.length; // 这手=虚拟12
          phase = 1;
          gateStep = 0;
          gateHits = 0;

          // 预测初始化：从第6组PPB开始（第5组BBP被门槛13-15用掉了）
          loopGroupIdx = 5;
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

  // phase1：门槛（必须连续3手）
  if(phase === 1){
    const target = GATE_GROUP[gateStep]; // BBP
    if(actual === target) gateHits++;
    gateStep++;

    if(gateStep < 3) return;

    if(gateHits >= 1){
      phase = 2;
      phase2StartRealHand = gameHistory.length + 1; // 下一手=虚拟16
      loopGroupIdx = 5; // ✅ 虚拟16从第6组PPB开始
      loopPos = 0;
    } else {
      gateStep = 0;
      gateHits = 0;
    }
    return;
  }

  // phase2：预测推进（严格按MASTER_GROUPS）
  if(phase === 2){
    loopPos++;
    if(loopPos >= 3){
      loopPos = 0;
      loopGroupIdx = (loopGroupIdx + 1) % MASTER_GROUPS.length; // 0..7循环
    }
  }
}

function nextPred(){
  return MASTER_GROUPS[loopGroupIdx][loopPos];
}

function updateView(){
  const realCount = gameHistory.length;

  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    showTextOnly(
      `【调试】套入阶段（前12手 / 4组）\n`+
      `标准8组：${MASTER_GROUPS.join("，")}\n`+
      `当前套入目标：第${fitGroupIdx+1}/4组=${need}\n`+
      `等待字符：${expect}\n`+
      `下一手：${fmtUpcomingHand()}`
    );
    return;
  }

  if(phase === 1){
    showTextOnly(
      `【调试】已套完：第${completedAtRealHand}手(12手)\n`+
      `门槛：虚拟13/14/15 = ${GATE_GROUP}（连续3手判定）\n`+
      `门槛进度：${gateStep}/3｜命中：${gateHits}/3\n`+
      `下一手：${fmtUpcomingHand()}\n`+
      `通过后：虚拟16从第6组PPB开始`
    );
    return;
  }

  const p = nextPred();
  const g = MASTER_GROUPS[loopGroupIdx];
  setLabelSide(p);
  byId('predictionText').textContent =
    `【调试】已过门槛（13/14/15=BBP）\n`+
    `下一手：${fmtUpcomingHand()}\n`+
    `当前组：${g}（第${loopPos+1}/3）\n`+
    `预测：${p}\n`+
    `标准8组：${MASTER_GROUPS.join("，")}\n`+
    `关键验收：虚拟22-24必须是PBB`;
}

function recomputeFromHistory(arr){
  phase = 0;
  fitGroupIdx = 0;
  fitPos = 0;
  completedAtRealHand = 0;
  gateStep = 0;
  gateHits = 0;
  loopGroupIdx = 5;
  loopPos = 0;
  phase2StartRealHand = 0;

  gameHistory = [];
  arr.forEach(x=>{
    gameHistory.push(x);
    advanceAfterInput(x);
  });
}

window.recordResult = function(type){
  if(type !== 'B' && type !== 'P') return;
  gameHistory.push(type);
  renderHistory();
  advanceAfterInput(type);
  updateView();
};

window.undoLastMove = function(){
  const old = [...gameHistory];
  old.pop();
  recomputeFromHistory(old);
  renderHistory();
  updateView();
};

window.resetGame = function(){
  recomputeFromHistory([]);
  renderHistory();
  showTextOnly('已重置（调试版）。');
  updateView();
};

document.addEventListener('DOMContentLoaded', function(){
  renderHistory();
  showTextOnly('就绪（调试版）。');
  updateView();
});
