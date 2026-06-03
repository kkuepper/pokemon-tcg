<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const NATURAL_W = 380

const host = ref<HTMLElement | null>(null)
const scale = ref(1)

let ro: ResizeObserver | null = null

onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    scale.value = entry.contentRect.width / NATURAL_W
  })
  if (host.value) ro.observe(host.value)
})

onUnmounted(() => ro?.disconnect())
</script>

<template>
  <div ref="host" class="card-host" role="img" aria-label="Pokémon card loading">
    <div class="card-scaler" :style="{ transform: `scale(${scale})` }">
      <div class="card-placeholder">
        <div class="inner">
          <div class="topbar">
            <div class="stage"><span class="lbl">BASIC</span></div>
            <div class="name blur">Pokémon</div>
            <div class="hp">
              <span class="lbl">HP</span>
              <span class="val blur">100</span>
            </div>
            <div class="coin"><span class="star">&#9733;</span></div>
          </div>

          <div class="art-frame">
            <div class="art" />
            <div class="caption"><span class="blur">NO. 000 &nbsp; Pokémon &nbsp; HT: 0&#39;00&#34; &nbsp; WT: 0 lbs.</span></div>
          </div>

          <div class="attack">
            <div class="attack-row">
              <div class="cost">
                <span class="energy"><span class="star">&#9733;</span></span>
                <span class="energy"><span class="star">&#9733;</span></span>
              </div>
              <div class="atk-name blur">Attack Name</div>
              <div class="atk-dmg blur">60</div>
            </div>
            <div class="atk-desc">
              <span class="blur">Flip a coin until you get tails. This attack does 20</span>
              <span class="blur">damage for each heads, then discard one Energy.</span>
            </div>
          </div>

          <div class="divider" />

          <div class="wr">
            <div class="cell">
              <span class="cap">weakness</span>
              <span class="pip" />
              <span class="plus">+20</span>
            </div>
            <div class="spacer" />
            <div class="cell">
              <span class="cap">retreat</span>
              <span class="pip" />
            </div>
          </div>

          <div class="footer">
            <div class="illus">
              <span class="blur">Illus. Artist Name</span>
              <div class="marks"><span class="m" /><span class="m" /></div>
            </div>
            <div class="flavor">
              <span class="blur">It drifts on warm currents at dusk, and the faint</span>
              <span class="blur">glow of its crest is said to calm restless travelers.</span>
            </div>
          </div>
        </div>

        <div class="shine" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Host fills whatever space the parent gives it, maintaining card aspect ratio */
.card-host {
  width: 100%;
  aspect-ratio: 367 / 512;
  overflow: hidden;
  position: relative;
}

/* Scaler positions the natural-size card at top-left and scales it down */
.card-scaler {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  width: 380px; /* NATURAL_W — must match the JS constant */
}

/* ---- Card at natural 380px size ---- */
.card-placeholder {
  --blur: 5px;
  --art-dark: 0.92;
  --silver-1: #fbfbfa;
  --silver-2: #d9d8d2;
  --silver-3: #b9b8b1;
  --silver-4: #efeee9;
  --body-top: #f3f1ea;
  --body-bot: #eceae1;
  --ink: #2c2b27;
  --ink-soft: #6f6e67;
  --hairline: #cfcdc3;
  --shimmer-speed: 2.4s;

  width: 380px;
  aspect-ratio: 367 / 512;
  border-radius: 18px;
  padding: 11px;
  position: relative;
  font-family: "Gill Sans", "Gill Sans MT", "Futura", "Avenir Next", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
  background:
    linear-gradient(135deg, var(--silver-1) 0%, var(--silver-3) 22%, var(--silver-4) 40%,
      var(--silver-2) 58%, var(--silver-1) 74%, var(--silver-3) 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.7) inset,
    0 0 0 1px rgba(120,118,110,0.55),
    0 22px 50px -18px rgba(0,0,0,0.7),
    0 6px 14px -8px rgba(0,0,0,0.5);
}

.inner {
  height: 100%;
  border-radius: 9px;
  padding: 11px 12px 10px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  background:
    radial-gradient(140% 90% at 50% 12%, var(--body-top) 0%, var(--body-bot) 70%),
    var(--body-bot);
  box-shadow: 0 0 0 1px rgba(150,148,140,0.55) inset;
}

.inner::after {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 18% 70%, rgba(255,255,255,0.5) 0 2px, transparent 3px),
    radial-gradient(circle at 72% 82%, rgba(255,255,255,0.4) 0 2px, transparent 3px),
    radial-gradient(circle at 40% 92%, rgba(200,196,184,0.4) 0 2px, transparent 3px),
    radial-gradient(circle at 86% 64%, rgba(255,255,255,0.4) 0 2px, transparent 3px);
  opacity: .6;
}

.blur {
  filter: blur(var(--blur));
  color: var(--ink);
  user-select: none;
  -webkit-user-select: none;
  white-space: nowrap;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 7px;
}

.stage {
  --chamf: 5px;
  flex: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: -4px 2px 0 -7px;
  padding: 3px 11px 4px;
  background: linear-gradient(180deg, #f7f6f2 0%, #e6e4dc 46%, #cdcbc1 100%);
  clip-path: polygon(
    var(--chamf) 0, calc(100% - var(--chamf)) 0, 100% var(--chamf),
    100% calc(100% - var(--chamf)), calc(100% - var(--chamf)) 100%, var(--chamf) 100%,
    0 calc(100% - var(--chamf)), 0 var(--chamf));
}

.stage::before {
  content: "";
  position: absolute;
  inset: -1.4px;
  z-index: -1;
  background: linear-gradient(180deg, #b6b4aa, #86847b);
  clip-path: polygon(
    var(--chamf) 0, calc(100% - var(--chamf)) 0, 100% var(--chamf),
    100% calc(100% - var(--chamf)), calc(100% - var(--chamf)) 100%, var(--chamf) 100%,
    0 calc(100% - var(--chamf)), 0 var(--chamf));
}

.stage .lbl { font-size: 9.5px; letter-spacing: .5px; color: #36352f; font-weight: 700; text-shadow: 0 1px 0 rgba(255,255,255,.55); }

.name { flex: 1 1 auto; min-width: 0; font-size: 27px; font-weight: 700; letter-spacing: .3px; text-shadow: 0 1px 0 rgba(255,255,255,0.5); }

.hp { flex: none; display: flex; align-items: baseline; gap: 4px; }
.hp .lbl { font-size: 11px; font-weight: 700; color: var(--ink-soft); transform: translateY(-2px); }
.hp .val { font-size: 26px; font-weight: 800; }

.coin {
  flex: none;
  width: 26px; height: 26px;
  border-radius: 50%;
  display: grid; place-items: center;
  margin-left: 4px;
  align-self: center;
  background: radial-gradient(circle at 36% 30%, #fff 0%, #e9e7df 45%, #c3c1b7 100%);
  box-shadow: 0 0 0 1.5px #b6b4aa, 0 1px 2px rgba(0,0,0,.25), 0 1px 0 rgba(255,255,255,.7) inset;
}
.coin .star { font-size: 16px; line-height: 1; color: #6c6a62; transform: translateY(-1px); }

.art-frame {
  border-radius: 4px;
  padding: 4px;
  background: linear-gradient(160deg, #f6f5f1, #c9c7be 50%, #ecebe5);
  box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 0 0 1px rgba(150,148,140,.5);
}

.art {
  aspect-ratio: 16 / 10.4;
  border-radius: 2px;
  background:
    radial-gradient(120% 130% at 32% 18%, rgba(70,74,84,calc(0.5 * var(--art-dark))) 0%, transparent 55%),
    linear-gradient(155deg,
      rgba(36,38,44, var(--art-dark)) 0%,
      rgba(20,21,25, var(--art-dark)) 48%,
      rgba(11,12,15, var(--art-dark)) 100%);
  box-shadow: 0 0 0 1px rgba(0,0,0,.35) inset;
}

.caption {
  background: linear-gradient(180deg, #36373b, #25262a);
  border-radius: 0 0 2px 2px;
  padding: 3px 8px;
  display: flex;
  justify-content: center;
}
.caption .blur { font-size: 8.5px; color: #d9d8d3; letter-spacing: .3px; }

.attack {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4px;
}

.attack-row { display: flex; align-items: center; gap: 10px; }
.cost { display: flex; gap: 3px; flex: none; }

.energy {
  width: 21px; height: 21px; border-radius: 50%;
  display: grid; place-items: center;
  background: radial-gradient(circle at 36% 30%, #fff 0%, #e9e7df 45%, #c3c1b7 100%);
  box-shadow: 0 0 0 1.3px #b0aea4, 0 1px 1px rgba(0,0,0,.2);
}
.energy .star { font-size: 13px; color: #6c6a62; line-height: 1; transform: translateY(-1px); }

.atk-name { flex: 1 1 auto; font-size: 21px; font-weight: 700; }
.atk-dmg  { flex: none; font-size: 25px; font-weight: 800; }

.atk-desc { margin-top: 7px; }
.atk-desc .blur { display: block; font-size: 11px; line-height: 1.55; }
.atk-desc .blur + .blur { margin-top: 2px; }

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--hairline) 12%, var(--hairline) 88%, transparent);
  margin: 6px 2px;
}

.wr { display: flex; align-items: center; gap: 10px; padding: 0 2px; }
.wr .cell { display: flex; align-items: center; gap: 6px; }
.wr .cap { font-size: 8px; font-weight: 700; letter-spacing: .4px; color: var(--ink-soft); text-transform: lowercase; }
.wr .pip {
  width: 15px; height: 15px; border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, #fff, #ddd 55%, #b9b7ad);
  box-shadow: 0 0 0 1px #b0aea4 inset;
}
.wr .plus { font-size: 12px; font-weight: 700; color: var(--ink-soft); }
.wr .spacer { flex: 1 1 auto; }

.footer { display: flex; align-items: flex-end; gap: 10px; margin-top: 6px; }
.illus { flex: none; display: flex; flex-direction: column; gap: 4px; }
.illus .blur { font-size: 8px; color: var(--ink-soft); }
.marks { display: flex; gap: 3px; }
.marks .m {
  width: 9px; height: 9px;
  border: 1.4px solid var(--ink-soft);
  transform: rotate(45deg);
  opacity: .8;
}
.flavor { flex: 1 1 auto; text-align: right; }
.flavor .blur { display: block; font-size: 9.5px; font-style: italic; line-height: 1.45; color: var(--ink-soft); }

.shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 9px;
  overflow: hidden;
}
.shine::before {
  content: "";
  position: absolute;
  top: -30%; bottom: -30%;
  left: -40%;
  width: 35%;
  background: linear-gradient(105deg,
    transparent 0%,
    rgba(255,255,255,0.06) 35%,
    rgba(255,255,255,0.55) 50%,
    rgba(255,255,255,0.06) 65%,
    transparent 100%);
  transform: skewX(-12deg);
  animation: sweep var(--shimmer-speed) cubic-bezier(.5,0,.5,1) infinite;
}
@keyframes sweep {
  0%   { left: -45%; }
  60%  { left: 115%; }
  100% { left: 115%; }
}
@media (prefers-reduced-motion: reduce) {
  .shine::before { animation: none; }
}
</style>
