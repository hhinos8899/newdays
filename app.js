// ===== DEBUG app.debug.js (with stats) =====
const APP_VER = "DEBUG-SEQ8-STATS-20260129-01";

const GROUPS = ["PBP","BBP","PPB","PBP"];
const MASTER_GROUPS = ["PBP","BBP","PPB","PBP","BBP","PPB","PBP","PBB"];
const GATE_GROUP = "BBP";

let gameHistory = [];
let phase = 0; // 0套入 1门槛 2预测

let fitGroupIdx = 0, fitPos = 0;
let gateStep = 0, gateHits = 0;

let loopGroupIdx = 5, loopPos = 0; // ✅ 过门槛后从第6组PPB开始
let completedAtRealHand = 0;
let phase2StartRealHand = 0;

// ===== 统计（只统计预测阶段）=====
let statPredTotal = 0;
let statPredHit = 0;
let statMissStreak = 0;
let statMaxMissStreak = 0;
let lastPrediction = null;

function byId(id){ return document.getElementById(id); }

function renderHistory(){
  const box = byId('recordDisplay');
  if(!box) return;
  box.innerHTML = '';
  gameHistory.forEach(x=>{
    const d=document.createElement('div');
    d.className='record-item '+x.toLowerCase();
    d.textContent=x;
    box.appendChild(d);
  });
}

function setLabelAI(){
  const label = byId('resultLabel');
  if(label){
    label.textContent='AI';
    label.classList.remove('player','banker');
  }
}

function setLabelSide(side){
  const label = byId('resultLabel');
  if(label){
    label.textContent=side;
    label.className='result-label '+(side==='B'?'banker':'player');
  }
}

function fmtRate(){
  const rate = statPredTotal ? (statPredHit / statPredTotal * 100) : 0;
  return `${statPredHit}/${statPredTotal} (${rate.toFixed(1)}%)`;
}

function fmtUpcomingHand(){
  const upcomingReal = gameHistory.length + 1;

  if(phase===0) return `第${upcomingReal}手`;
  if(phase===1) return `第${upcomingReal}手(${13 + gateStep}手)`;
  if(phase===2){
    const v = phase2StartRealHand ? (16 + (upcomingReal - phase2StartRealHand)) : null;
    return v==null ? `第${upcomingReal}手` : `第${upcomingReal}手(${v}手)`;
  }
  return `第${upcomingReal}手`;
}

function advance(actual){
  // phase0：套入（顺序匹配可跳过）
  if(phase===0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    if(actual===expect){
      fitPos++;
      if(fitPos>=3){
        fitPos=0; fitGroupIdx++;
        if(fitGroupIdx>=GROUPS.length){
          completedAtRealHand = gameHistory.length; // 这手=虚拟12
          phase=1;
          gateStep=0; gateHits=0;
          loopGroupIdx=5; loopPos=0;
          phase2StartRealHand=0;
          fitGroupIdx=0; fitPos=0;
          lastPrediction = null;
        }
      }
    }
    return;
  }

  // phase1：门槛（连续3手判定）
  if(phase===1){
    const target = GATE_GROUP[gateStep];
    if(actual===target) gateHits++;
    gateStep++;

    if(gateStep<3) return;

    if(gateHits>=1){
      phase=2;
      phase2StartRealHand = gameHistory.length + 1; // 下一手=虚拟16
      loopGroupIdx=5;
      loopPos=0;
    }else{
      gateStep=0; gateHits=0;
    }
    return;
  }

  // phase2：预测推进
  if(phase===2){
    loopPos++;
    if(loopPos>=3){
      loopPos=0;
      loopGroupIdx=(loopGroupIdx+1)%MASTER_GROUPS.length;
    }
  }
}

function nextPred(){
  return MASTER_GROUPS[loopGroupIdx][loopPos];
}

function updateView(){
  const text = byId('predictionText');
  if(!text) return;

  if(phase===0){
    setLabelAI();
    lastPrediction = null;
    text.textContent =
      `[DEBUG] 套入中 版本=${APP_VER}\n`+
      `标准8组：${MASTER_GROUPS.join("，")}\n`+
      `当前套入：第${fitGroupIdx+1}/4组=${GROUPS[fitGroupIdx]}（进度${fitPos}/3）\n`+
      `下一手：${fmtUpcomingHand()}`;
    return;
  }

  if(phase===1){
    setLabelAI();
    lastPrediction = null;
    text.textContent =
      `[DEBUG] 已套完：第${completedAtRealHand}手(12手)\n`+
      `门槛阶段：13/14/15 = ${GATE_GROUP}\n`+
      `门槛进度：${gateStep}/3 命中：${gateHits}/3\n`+
      `下一手：${fmtUpcomingHand()}`;
    return;
  }

  // phase2
  const p = nextPred();
  lastPrediction = p;

  const g = MASTER_GROUPS[loopGroupIdx];
  setLabelSide(p);

  text.textContent =
    `[DEBUG] 预测阶段 版本=${APP_VER}\n`+
    `下一手：${fmtUpcomingHand()}\n`+
    `当前循环组：${g}（第${loopPos+1}/3）\n`+
    `本手预测：${p}\n`+
    `命中率：${fmtRate()}\n`+
    `当前连错：${statMissStreak}\n`+
    `最大连错：${statMaxMissStreak}\n`+
    `循环：${MASTER_GROUPS.join(" → ")}\n`+
    `验收：虚拟22/23/24 必须是 PBB`;
}

function recompute(arr){
  gameHistory=[];
  phase=0;
  fitGroupIdx=0; fitPos=0;
  gateStep=0; gateHits=0;
  loopGroupIdx=5; loopPos=0;
  completedAtRealHand=0;
  phase2StartRealHand=0;

  // 统计也要跟着重算
  statPredTotal=0; statPredHit=0;
  statMissStreak=0; statMaxMissStreak=0;
  lastPrediction=null;

  arr.forEach(x=>{
    // 重算时：如果当下已在预测阶段，并且 lastPrediction 已生成，就统计
    if(phase===2 && lastPrediction){
      statPredTotal++;
      if(x===lastPrediction){ statPredHit++; statMissStreak=0; }
      else { statMissStreak++; if(statMissStreak>statMaxMissStreak) statMaxMissStreak=statMissStreak; }
    }

    gameHistory.push(x);
    advance(x);
    updateView(); // 让 lastPrediction 始终保持为“下一手预测”
  });
}

window.recordResult = function(type){
  if(type!=='B' && type!=='P') return;

  // ✅ 先统计“这手”的命中（用上一手预测 lastPrediction）
  if(phase===2 && lastPrediction){
    statPredTotal++;
    if(type===lastPrediction){
      statPredHit++;
      statMissStreak=0;
    }else{
      statMissStreak++;
      if(statMissStreak>statMaxMissStreak) statMaxMissStreak=statMissStreak;
    }
  }

  gameHistory.push(type);
  renderHistory();
  advance(type);
  updateView();
};

window.undoLastMove = function(){
  const old=[...gameHistory]; old.pop();
  recompute(old);
  renderHistory();
  updateView();
};

window.resetGame = function(){
  recompute([]);
  renderHistory();
  updateView();
};

document.addEventListener('DOMContentLoaded', ()=>{
  renderHistory();
  updateView();
});
