// Warung Kilat's renderer: the whole kitchen in plain canvas 2D. Every
// frame is drawn from the world state plus `state.time`, so a staged shot
// looks the same on every machine. No images, no network.
import {
  BOARD_H, BOARD_Y, DECOR_COUNTER, DISH_ITEMS, FIELD, FLOOR_Y, FONT, HUD_H,
  INGREDIENTS, PALETTE, RECIPES, STATIONS,
} from './config.js';
import { stationApproach } from './cook.js';
import { dishIdOf } from './world.js';

const STATION_COLORS = {
  ayam: '#f2a541',
  sayur: '#7cb342',
  telur: '#f5d76e',
  stove: '#4a4a55',
  rice: '#eceff1',
  serve: '#ffd54f',
  board: '#a9743f',
  plate: '#8d5a2b',
  trash: '#9e9e9e',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function star(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

/** Deterministic wobble in [0, 1) from two integers and a time. */
function hash01(a, b, t) {
  const s = Math.sin(a * 127.1 + b * 311.7 + t * 0.9) * 43758.5453;
  return s - Math.floor(s);
}

function drawItem(ctx, x, y, item, size) {
  const s = size / 2;
  if (item.kind === 'ayam') {
    ctx.fillStyle = item.stage === 'cooked' ? '#a3521d' : item.stage === 'chopped' ? '#e87a7a' : '#f2a0a0';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y + s * 0.4);
    ctx.lineTo(x + s * 1.1, y + s * 1.0);
    ctx.stroke();
  } else if (item.kind === 'sayur') {
    ctx.fillStyle = item.stage === 'cooked' ? '#3f7d2e' : item.stage === 'chopped' ? '#8bc34a' : '#5da244';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x - s * 0.5 + i * s * 0.5, y + (i % 2 === 0 ? -s * 0.2 : s * 0.3), s * 0.45, s * 0.6, (i - 1) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (item.kind === 'telur') {
    if (item.stage === 'cooked') {
      ctx.fillStyle = '#e8b93b';
      rr(ctx, x - s, y - s * 0.6, s * 2, s * 1.2, s * 0.5);
      ctx.fill();
      ctx.fillStyle = '#b97f16';
      ctx.beginPath();
      ctx.arc(x - s * 0.4, y, s * 0.2, 0, Math.PI * 2);
      ctx.arc(x + s * 0.35, y + s * 0.15, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fffdf5';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.8, s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d8c9a3';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (item.kind === 'nasi') {
    ctx.fillStyle = '#4a7fb5';
    ctx.beginPath();
    ctx.arc(x, y + s * 0.3, s * 0.9, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#f5f0e1';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.1, s * 0.75, Math.PI, 0);
    ctx.fill();
  }
}

function drawDishDot(ctx, x, y, dishId, r) {
  ctx.fillStyle = DISH_ITEMS[dishId].color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPlate(ctx, x, y, items, ready, t) {
  if (ready) {
    const glow = 0.5 + 0.3 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(232, 185, 59, ${glow})`;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.ellipse(x, y, 30, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8c9a3';
  ctx.lineWidth = 2;
  ctx.stroke();
  items.forEach((dish, i) => {
    drawDishDot(ctx, x - 12 + i * 24, y - 2, dish, 8);
  });
}

function drawFloor(ctx) {
  const tile = 80;
  for (let ty = 0; ty < Math.ceil((FIELD.height - FLOOR_Y) / tile); ty++) {
    for (let tx = 0; tx < Math.ceil(FIELD.width / tile); tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(tx * tile, FLOOR_Y + ty * tile, tile, tile);
    }
  }
  ctx.strokeStyle = PALETTE.grout;
  ctx.lineWidth = 2;
  for (let x = 0; x <= FIELD.width; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x, FIELD.height);
    ctx.stroke();
  }
  for (let y = FLOOR_Y; y <= FIELD.height; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
    ctx.stroke();
  }
}

function drawDecorCounter(ctx) {
  const c = DECOR_COUNTER;
  ctx.fillStyle = PALETTE.wood;
  rr(ctx, c.x, c.y, c.w, c.h, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(c.x, c.y + c.h - 10, c.w, 10);
  // Bowls of ingredients on the counter.
  const bowls = [
    { x: c.x + 50, color: '#d84a35' },
    { x: c.x + 130, color: '#5da244' },
    { x: c.x + 210, color: '#e8b93b' },
    { x: c.x + 290, color: '#f2a0a0' },
  ];
  for (const b of bowls) {
    ctx.fillStyle = '#4a7fb5';
    ctx.beginPath();
    ctx.arc(b.x, c.y + 34, 20, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, c.y + 30, 15, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('BAHAN SEGAR', c.x + c.w / 2, c.y + 14);
}

function drawStation(ctx, state, station) {
  const { x, y, w, h } = station;
  ctx.fillStyle = STATION_COLORS[station.id];
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const dark = station.id === 'stove' || station.id === 'board' || station.id === 'plate';
  ctx.fillStyle = dark ? '#fff' : PALETTE.text;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(station.label, x + w / 2, y + 24);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.85)' : PALETTE.muted;
  ctx.fillText(station.sub, x + w / 2, y + 42);

  if (station.id === 'stove') {
    // Two burners; flame when a slot is cooking.
    state.stove.slots.forEach((slot, i) => {
      const bx = x + 44 + i * 80;
      const by = y + 82;
      ctx.fillStyle = '#22222a';
      ctx.beginPath();
      ctx.arc(bx, by, 26, 0, Math.PI * 2);
      ctx.fill();
      if (slot !== null) {
        const cooking = slot.stage !== 'cooked';
        ctx.fillStyle = cooking ? '#e8862e' : '#8bc34a';
        ctx.beginPath();
        ctx.arc(bx, by, 18, 0, Math.PI * 2);
        ctx.fill();
        drawItem(ctx, bx, by - 6, slot, 20);
        if (cooking) {
          ctx.fillStyle = '#2e2118';
          ctx.fillRect(bx - 20, by + 22, 40, 5);
          ctx.fillStyle = '#e8862e';
          ctx.fillRect(bx - 20, by + 22, 40 * state.stove.progress[i], 5);
        }
      }
    });
  }
  if (station.id === 'board') {
    // The chopping board with whatever is on it.
    ctx.fillStyle = '#e8d5a8';
    rr(ctx, x + 30, y + 52, w - 60, 28, 6);
    ctx.fill();
    if (state.board.item !== null) {
      drawItem(ctx, x + w / 2 - 30, y + 66, state.board.item, 22);
      if (state.board.item.stage === 'raw') {
        ctx.fillStyle = '#2e2118';
        ctx.fillRect(x + w / 2 + 10, y + 60, 90, 6);
        ctx.fillStyle = '#e8862e';
        ctx.fillRect(x + w / 2 + 10, y + 60, 90 * state.board.progress, 6);
        // The knife, mid-chop.
        ctx.fillStyle = '#cfd8dc';
        ctx.save();
        ctx.translate(x + w / 2 + 60, y + 58);
        ctx.rotate(-0.4 + 0.3 * Math.sin(state.time * 10));
        ctx.fillRect(-4, -14, 8, 26);
        ctx.restore();
      }
    }
  }
  if (station.id === 'plate') {
    // Two plate slots on the counter.
    state.plates.forEach((slot, i) => {
      const px = x + 85 + i * 170;
      const py = y + 64;
      drawPlate(ctx, px, py, slot.items, slot.ready, state.time);
    });
  }
  if (station.id === 'trash') {
    // A bin with a lid.
    ctx.fillStyle = '#757575';
    rr(ctx, x + w / 2 - 30, y + 50, 60, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#616161';
    ctx.fillRect(x + w / 2 - 34, y + 44, 68, 8);
  }
  if (station.id === 'serve') {
    // Awning stripes over the window.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d84a35' : '#fff';
      ctx.fillRect(x + 8 + i * 26, y + 52, 26, 16);
    }
    ctx.fillStyle = '#2e2118';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText('ANTAR DI SINI', x + w / 2, y + 92);
  }
  if (station.kind === 'supply') {
    const item = { kind: station.item, stage: station.item === 'nasi' ? 'ready' : 'raw' };
    drawItem(ctx, x + w / 2, y + 70, item, 30);
  }
  if (station.id === 'rice') {
    ctx.fillStyle = '#b0bec5';
    rr(ctx, x + w / 2 - 34, y + 52, 68, 34, 8);
    ctx.fill();
  }
}

function drawOrders(ctx, state) {
  ctx.fillStyle = PALETTE.board;
  ctx.fillRect(0, BOARD_Y, FIELD.width, BOARD_H);
  ctx.fillStyle = '#e0cba6';
  ctx.fillRect(0, BOARD_Y + BOARD_H - 4, FIELD.width, 4);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('PESANAN', 16, BOARD_Y + 24);
  if (state.orders.length === 0) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText('Belum ada pesanan — siap-siap!', 110, BOARD_Y + 44);
    return;
  }
  state.orders.forEach((order, i) => {
    const tx = 110 + i * 320;
    const ty = BOARD_Y + 8;
    const tw = 300;
    const th = BOARD_H - 16;
    const urgent = order.timeLeft < 10;
    const alpha = urgent ? 0.75 + 0.25 * Math.sin(state.time * 6) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, tx, ty, tw, th, 10);
    ctx.fill();
    ctx.strokeStyle = '#e0cba6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(order.recipe.name, tx + 12, ty + 22);
    order.recipe.items.forEach((dish, j) => {
      drawDishDot(ctx, tx + 20 + j * 92, ty + 40, dish, 7);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `12px ${FONT}`;
      ctx.fillText(DISH_ITEMS[dish].name, tx + 32 + j * 92, ty + 44);
    });
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`+${order.recipe.price}`, tx + tw - 12, ty + 22);
    ctx.textAlign = 'left';
    // Timer bar.
    const frac = Math.max(0, order.timeLeft / order.total);
    ctx.fillStyle = '#e8dcc3';
    ctx.fillRect(tx + 12, ty + th - 12, tw - 24, 6);
    ctx.fillStyle = frac > 0.5 ? PALETTE.green : frac > 0.25 ? PALETTE.amber : PALETTE.red;
    ctx.fillRect(tx + 12, ty + th - 12, (tw - 24) * frac, 6);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    // Right-aligned: the ingredient dots sit at tx+20..tx+200 on this line,
    // so a left-aligned timer collided with the first dish dot (the number
    // was hidden behind it in every screenshot). Right end is clear:
    // the longest second label ends by tx+202, the timer starts past tx+238.
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(order.timeLeft)} dtk`, tx + tw - 12, ty + th - 18);
    ctx.textAlign = 'left';
  });
}

function drawCook(ctx, state) {
  const cook = state.cook;
  const carrying = cook.carrying;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cook.x, cook.y + 18, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: white chef coat.
  ctx.fillStyle = PALETTE.cook;
  ctx.beginPath();
  ctx.arc(cook.x, cook.y + 4, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8c9a3';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Head.
  ctx.fillStyle = PALETTE.skin;
  ctx.beginPath();
  ctx.arc(cook.x, cook.y - 14, 12, 0, Math.PI * 2);
  ctx.fill();
  // Chef hat.
  ctx.fillStyle = '#fff';
  rr(ctx, cook.x - 12, cook.y - 34, 24, 12, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cook.x, cook.y - 24, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = PALETTE.hatBand;
  ctx.fillRect(cook.x - 12, cook.y - 24, 24, 4);
  // Eyes.
  ctx.fillStyle = '#2e2118';
  ctx.beginPath();
  ctx.arc(cook.x - 4, cook.y - 14, 1.8, 0, Math.PI * 2);
  ctx.arc(cook.x + 4, cook.y - 14, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // What the cook carries, held up above the hat.
  if (carrying !== null) {
    if (carrying.plate === true) {
      drawPlate(ctx, cook.x, cook.y - 48, carrying.items, carrying.ready, state.time);
    } else {
      drawItem(ctx, cook.x, cook.y - 46, carrying, 26);
    }
  }
}

function drawSteam(ctx, state) {
  const t = state.time;
  state.stove.slots.forEach((slot, i) => {
    if (slot === null || slot.stage === 'cooked') return;
    const st = STATIONS.find((s) => s.id === 'stove');
    const bx = st.x + 44 + i * 80;
    const by = st.y + 62;
    for (let p = 0; p < 3; p++) {
      const rise = hash01(i, p, Math.floor(t * 2));
      const x = bx - 10 + hash01(p, i, 7) * 20;
      const y = by - rise * 34;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - rise)})`;
      ctx.beginPath();
      ctx.arc(x, y, 5 + rise * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawHud(ctx, state) {
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, FIELD.width, HUD_H);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('WARUNG KILAT', 16, 35);
  // Shift timer.
  const remain = Math.max(0, 150 - state.time);
  const mm = Math.floor(remain / 60);
  const ss = String(Math.floor(remain % 60)).padStart(2, '0');
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(`${mm}:${ss}`, 300, 35);
  ctx.fillStyle = '#5a4636';
  ctx.fillRect(360, 22, 200, 10);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(360, 22, 200 * (remain / 150), 10);
  // Coins, served, stars.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(700, 28, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5c00';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Rp', 700, 32);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${state.coins}`, 718, 35);
  ctx.fillText(`Saji ${state.served}`, 800, 35);
  for (let i = 0; i < 3; i++) {
    const sx = 950 + i * 30;
    ctx.fillStyle = i < state.stars ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    star(ctx, sx, 28, 11, true);
  }
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(`Level ${state.level}`, 1060, 35);
}

function drawPopups(ctx, state) {
  ctx.textAlign = 'center';
  for (const p of state.popups) {
    const rise = (1.4 - p.ttl) * 24;
    ctx.globalAlpha = Math.min(1, p.ttl);
    ctx.fillStyle = p.color;
    ctx.font = `bold 22px ${FONT}`;
    // Dark outline: gold popups on the terracotta floor were low-contrast.
    ctx.strokeStyle = 'rgba(46, 33, 24, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(p.text, p.x, p.y - rise);
    ctx.fillText(p.text, p.x, p.y - rise);
    ctx.globalAlpha = 1;
  }
}

function drawPanel(ctx, title, lines) {
  ctx.fillStyle = 'rgba(46, 33, 24, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.panel;
  rr(ctx, 340, 180, 600, 360, 16);
  ctx.fill();
  ctx.strokeStyle = '#e0cba6';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(title, 640, 260);
  ctx.font = `17px ${FONT}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, 640, 310 + i * 30);
  });
}

export function draw(ctx, state, screen, opts) {
  const { best } = opts;
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawFloor(ctx);
  drawDecorCounter(ctx);
  for (const station of STATIONS) drawStation(ctx, state, station);
  drawSteam(ctx, state);
  drawOrders(ctx, state);
  drawCook(ctx, state);
  drawPopups(ctx, state);
  drawHud(ctx, state);

  if (screen === 'title') {
    drawPanel(ctx, 'WARUNG KILAT', [
      'Masak cepat, antar tepat waktu!',
      'WASD / panah: gerak   •   E / Spasi: ambil, potong, goreng, sajikan',
      'Selesaikan pesanan sebelum waktunya habis.',
      '',
      'Tekan Spasi / klik untuk mulai',
      best > 0 ? `Skor terbaik: ${best} koin` : '',
    ]);
  } else if (screen === 'gameover') {
    const title = state.overReason === 'stars' ? 'Bintang Habis!' : 'Shift Selesai!';
    drawPanel(ctx, title, [
      `Koin: ${state.coins}   •   Pesanan disajikan: ${state.served}`,
      best > 0 ? `Skor terbaik: ${best} koin` : '',
      '',
      'Tekan Spasi / klik untuk main lagi',
    ]);
  } else if (screen === 'paused') {
    drawPanel(ctx, 'Jeda', ['Tekan P untuk lanjut masak.']);
  }
}
