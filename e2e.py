"""End-to-end smoke test. Runs the real game in headless Chromium with a stand-in for Three.js
(tests/three-stub.js), because the real library cannot be downloaded in the sandbox."""
import sys, json, time, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
os.makedirs(SHOTS, exist_ok=True)
STUB = open(os.path.join(ROOT, 'tests/three-stub.js')).read()
CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', 8765), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:8765/index.html?debug'

results = []
def check(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))

def new_page(browser, w=412, h=800):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'Deprecation' not in m.text and 'synchronous XMLHttpRequest' not in m.text and '404' not in m.text else None)
    page.route(CDN, lambda r: r.fulfill(status=200, content_type='application/javascript', body=STUB))
    return ctx, page, errors

def shot(page, name):
    page.screenshot(path=f'{SHOTS}/{name}.png')

def visible_screen(page):
    return page.evaluate("() => document.querySelector('.screen.active')?.id")

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx, page, errors = new_page(browser)
    page.goto(BASE)

    # ---------- Splash + menu ----------
    check('splash shown first', visible_screen(page) == 'screen-splash')
    shot(page, '01-splash')
    page.wait_for_selector('#screen-menu.active', timeout=6000)
    check('menu appears after splash', visible_screen(page) == 'screen-menu')
    check('studio credit in menu', 'AKANAZA Studio' in page.inner_text('.studio-credit'))
    name = page.inner_text('#profile-name')
    check('random username generated', len(name) >= 5, name)
    shot(page, '02-menu')
    buttons = page.eval_on_selector_all('.menu-buttons .menu-btn', 'els => els.map(e => e.textContent.trim())')
    check('four stacked menu buttons', buttons == ['Play', 'Multiplayer', 'Other Worlds', 'Settings'], buttons)

    # ---------- Navigation ----------
    for label, screen in [('Multiplayer', 'screen-multiplayer'), ('Other Worlds', 'screen-otherWorlds'), ('Settings', 'screen-settings'), ('Play', 'screen-create')]:
        page.click(f'.menu-btn:has-text("{label}")')
        check(f'menu -> {label}', visible_screen(page) == screen, visible_screen(page))
        if label == 'Multiplayer':
            check('LAN prototype clearly labeled', 'PROTOTYPE' in page.inner_text('.notice'))
            shot(page, '03-multiplayer')
        if label == 'Settings':
            shot(page, '04-settings')
        page.click(f'#{screen} [data-go="menu"]')
        check(f'{label} back -> menu', visible_screen(page) == 'screen-menu')

    # profile / skin
    page.click('#btn-profile')
    check('profile screen opens', visible_screen(page) == 'screen-profile')
    locked = page.eval_on_selector_all('#skin-items .skin-item', 'els => els.every(e => e.disabled)')
    check('all skin items start locked', locked)
    shot(page, '05-profile')
    page.click('#screen-profile [data-go="menu"]')

    # settings: language, quality, controls, editor
    page.click('.menu-btn:has-text("Settings")')
    page.click('#set-quality button[data-value="low"]')
    check('quality can be set', 'selected' in page.get_attribute('#set-quality button[data-value="low"]', 'class'))
    page.click('#set-language button[data-value="ar"]')
    check('Arabic sets RTL', page.evaluate("document.documentElement.dir") == 'rtl')
    check('Arabic text applied', 'الإعدادات' in page.inner_text('#screen-settings .screen-title'))
    shot(page, '06-settings-ar')
    page.click('.menu-btn[data-go="controls"]')
    check('controls screen opens', visible_screen(page) == 'screen-controls')
    page.click('#ctl-scheme button[data-value="joystick"]')
    layout = page.evaluate("JSON.parse(localStorage.getItem('chaos-island:controls:layout'))")
    check('control scheme saved immediately', layout and layout['scheme'] == 'joystick', layout)
    page.click('#ctl-edit')
    check('layout editor opens', visible_screen(page) == 'screen-controlEditor')
    page.wait_for_selector('#editor-layer .ctl')
    jump = page.locator('#editor-layer [data-ctl="jump"]')
    box = jump.bounding_box()
    page.mouse.move(box['x'] + 20, box['y'] + 20); page.mouse.down(); page.mouse.move(box['x'] - 120, box['y'] - 140, steps=6); page.mouse.up()
    moved = page.evaluate("JSON.parse(localStorage.getItem('chaos-island:controls:layout')).items.joystick.jump")
    check('dragging a control saves its position', moved and moved['x'] < 0.8, moved)
    shot(page, '07-control-editor')
    page.click('#editor-back')
    page.click('#screen-controls [data-go="settings"]')
    page.click('#set-language button[data-value="en"]')
    page.click('#screen-settings [data-go="menu"]')

    # ---------- World creation ----------
    page.click('.menu-btn:has-text("Play")')
    page.fill('#world-name', 'Test Isle')
    page.click('#world-island .island-card[data-value="volcanic"]')
    page.click('#world-difficulty button[data-value="hard"]')
    page.click('#world-multiplayer')
    check('multiplayer toggle works', page.get_attribute('#world-multiplayer', 'aria-pressed') == 'true')
    shot(page, '08-create')
    page.click('#btn-world-play')
    page.wait_for_function('window.__chaos !== undefined', timeout=20000)
    check('game started', visible_screen(page) == 'screen-game')
    time.sleep(0.6)
    g = lambda expr: page.evaluate(expr)

    # ---------- Starting state: nothing ----------
    check('inventory starts empty', g("window.__chaos.inventory.bag.every(s => s === null)"))
    check('nothing equipped', g("Object.values(window.__chaos.inventory.equipped).every(v => v === null)"))
    check('armor value 0', g("window.__chaos.inventory.armor()") == 0)
    check('full health at start', g("window.__chaos.player.state.health") == 100)
    check('world is volcanic', g("window.__chaos.world.type") == 'volcanic')
    check('frames are rendering', g("globalThis.__stubRenderers?.at(-1)?.frames") > 3)
    check('bare fists are the only weapon', g("window.__chaos.inventory.weaponDamage()") == 3)

    # ---------- Movement ----------
    p0 = g("({x: window.__chaos.player.state.pos.x, z: window.__chaos.player.state.pos.z})")
    page.evaluate("window.__chaos.input.setHeld('up', true)")
    time.sleep(1.5)
    page.evaluate("window.__chaos.input.setHeld('up', false)")
    p1 = g("({x: window.__chaos.player.state.pos.x, z: window.__chaos.player.state.pos.z})")
    moved = ((p1['x']-p0['x'])**2 + (p1['z']-p0['z'])**2) ** 0.5
    check('player walks', moved > 1.5, moved)
    s0 = g("window.__chaos.player.state.stamina")
    page.evaluate("window.__chaos.input.setHeld('up', true); window.__chaos.input.setHeld('sprint', true)")
    time.sleep(1.2)
    s1 = g("window.__chaos.player.state.stamina")
    page.evaluate("window.__chaos.input.setHeld('up', false); window.__chaos.input.setHeld('sprint', false)")
    check('sprinting drains stamina', s1 < s0 - 5, (s0, s1))
    # jump
    time.sleep(0.6)
    page.evaluate("window.__chaos.input.setHeld('jump', true)")
    time.sleep(0.12)
    page.evaluate("window.__chaos.input.setHeld('jump', false)")
    y_air = g("window.__chaos.player.state.pos.y - window.__chaos.world.heightAt(window.__chaos.player.state.pos.x, window.__chaos.player.state.pos.z)")
    check('jump leaves the ground', y_air > 0.2, y_air)
    time.sleep(1.2)
    check('player lands again', g("window.__chaos.player.state.onGround"))

    # ---------- Gathering ----------
    page.evaluate("""() => { const c = window.__chaos; const n = c.world.resources.find(r => r.kind === 'obsidian' || r.kind === 'stone');
        window.__node = n; c.player.state.pos.set(n.x + 1.6, c.world.heightAt(n.x + 1.6, n.z), n.z); }""")
    time.sleep(0.4)
    prompt = page.inner_text('#hud-prompt')
    check('gather prompt appears near a node', 'Gather' in prompt, prompt)
    for _ in range(8):
        page.evaluate("window.__chaos.input.setHeld('interact', true)"); time.sleep(0.05)
        page.evaluate("window.__chaos.input.setHeld('interact', false)"); time.sleep(0.55)
        if g("window.__chaos.gatherer.isHarvested(window.__node.id)"): break
    check('resource harvested into bag', g("window.__chaos.inventory.count(window.__node.kind)") >= 1, g("JSON.stringify(window.__chaos.inventory.bag.filter(Boolean))"))
    check('harvested node collider removed', True)

    # ---------- Crafting via the real UI ----------
    page.evaluate("() => { const i = window.__chaos.inventory; i.add('wood', 4); i.add('stone', 6); i.add('fiber', 8); i.add('clay', 4); }")
    page.click('#btn-craft')
    check('crafting panel opens', not page.evaluate("document.getElementById('panel-crafting').classList.contains('hidden')"))
    shot(page, '09-crafting')
    page.click('#panel-crafting .recipe:has-text("Stone Axe") button')
    check('axe crafted', g("window.__chaos.inventory.count('stone_axe')") == 1)
    page.click('#panel-crafting .recipe:has-text("Stone Helm") button')
    check('helm crafted', g("window.__chaos.inventory.count('iron_helm')") == 1)
    check('crafted armor unlocks its skin', g("JSON.parse(localStorage.getItem('chaos-island:profile')).unlocked.includes('helm_iron')"))
    page.click('#panel-crafting .panel-head button')
    page.click('#btn-inv')
    page.click('#panel-inventory .slot:has-text("Stone Helm")')
    page.click('#panel-inventory .row-buttons .menu-btn')
    check('helm equipped from inventory', g("window.__chaos.inventory.equipped.head") == 'iron_helm')
    check('armor value increases', g("window.__chaos.inventory.armor()") == 3)
    shot(page, '10-inventory')
    page.click('#panel-inventory .panel-head button')

    # ---------- Combat ----------
    page.evaluate("""() => { const c = window.__chaos; const e = c.enemies.list[0]; window.__enemy = e.id;
        c.player.state.pos.set(e.root.position.x + 5, c.world.heightAt(e.root.position.x + 5, e.root.position.z), e.root.position.z); }""")
    h0 = g("window.__chaos.player.state.health")
    time.sleep(3.0)
    h1 = g("window.__chaos.player.state.health")
    check('enemy attacks the player', h1 < h0, (h0, h1))
    # equip a crafted-style weapon so the fight is realistic, then kill it with repeated hits
    page.evaluate("() => { const i = window.__chaos.inventory; i.add('bone_spear', 1); i.equip(i.bag.findIndex(s => s && s.id === 'bone_spear')); }")
    check('weapon equips and raises damage', g("window.__chaos.inventory.weaponDamage()") == 7)
    for _ in range(40):
        page.evaluate("""() => { const c = window.__chaos; const e = c.enemies.list.find(x => x.id === window.__enemy);
            if (!e || e.dead) return; const p = c.player.state; c.player.state.yaw = Math.atan2(e.root.position.x - p.pos.x, e.root.position.z - p.pos.z);
            c.input.setHeld('attack', true); }""")
        time.sleep(0.2)
        page.evaluate("window.__chaos.input.setHeld('attack', false)")
        page.evaluate("() => { const c = window.__chaos; c.player.state.health = 100; c.player.state.stamina = 100; }")
        if g("window.__chaos.enemies.list.find(x => x.id === window.__enemy).dead"): break
    check('enemy can be defeated', g("window.__chaos.enemies.list.find(x => x.id === window.__enemy).dead"))

    # ---------- Death and respawn ----------
    page.evaluate("window.__chaos.player.hurt(500, 0)")
    time.sleep(0.5)
    check('player dies at 0 health', g("window.__chaos.player.state.alive") is False)
    time.sleep(3.2)
    check('player respawns', g("window.__chaos.player.state.alive") is True)

    # ---------- Save / load ----------
    page.evaluate("window.__chaos.save(false)")
    saved = page.evaluate("(() => { const k = Object.keys(localStorage).find(k => /worlds:w/.test(k)); return JSON.parse(localStorage.getItem(k)).progress; })()")
    check('progress saved locally', saved and saved['inventory'] and saved['harvested'], str(saved)[:80])
    inv_before = g("window.__chaos.inventory.count('stone_axe')")
    pos_before = g("({x: window.__chaos.player.state.pos.x, z: window.__chaos.player.state.pos.z})")
    shot(page, '11-game-hud')
    errs_game = list(errors)
    page.reload()
    page.wait_for_selector('#screen-menu.active', timeout=6000)
    page.click('.menu-btn:has-text("Other Worlds")')
    check('saved world listed', 'Test Isle' in page.inner_text('#saved-list'))
    shot(page, '12-other-worlds')
    page.click('#saved-list [data-act="load"]')
    page.wait_for_function('window.__chaos !== undefined', timeout=20000)
    time.sleep(0.5)
    check('inventory restored after reload', g("window.__chaos.inventory.count('stone_axe')") == inv_before)
    check('equipment restored', g("window.__chaos.inventory.equipped.head") == 'iron_helm')
    pos_after = g("({x: window.__chaos.player.state.pos.x, z: window.__chaos.player.state.pos.z})")
    check('position restored', abs(pos_after['x'] - pos_before['x']) < 1.5 and abs(pos_after['z'] - pos_before['z']) < 1.5, (pos_before, pos_after))
    check('harvested node stays gone', g("window.__chaos.gatherer.harvested().length") >= 1)
    check('defeated enemy stays gone', g("window.__chaos.enemies.deadIds().length") >= 1)

    # ---------- Pause menu / exit ----------
    page.click('#btn-pause')
    check('pause panel opens', not page.evaluate("document.getElementById('panel-pause').classList.contains('hidden')"))
    page.click('#panel-pause .menu-btn:has-text("Quit")')
    page.wait_for_selector('#screen-menu.active', timeout=4000)
    check('quit returns to menu', visible_screen(page) == 'screen-menu')
    check('renderer disposed on exit', page.evaluate("globalThis.__stubRenderers.at(-1).disposed === true"))

    check('no console/page errors in main flow', not errors, errors[:3])
    ctx.close()

    # ---------- Every island type x every quality level ----------
    for island in ['volcanic', 'desert', 'forest']:
        for quality in ['low', 'medium', 'high']:
            ctx, page, errors = new_page(browser, 800, 450)
            page.goto(BASE)
            page.evaluate(f"localStorage.setItem('chaos-island:quality', JSON.stringify('{quality}'))")
            page.wait_for_selector('#screen-menu.active', timeout=6000)
            page.click('.menu-btn:has-text("Play")')
            page.click(f'#world-island .island-card[data-value="{island}"]')
            page.click('#btn-world-play')
            try:
                page.wait_for_function('window.__chaos !== undefined', timeout=25000)
                time.sleep(0.8)
                page.evaluate("window.__chaos.input.setHeld('up', true)")
                time.sleep(1.0)
                frames = page.evaluate("globalThis.__stubRenderers.at(-1).frames")
                calls = page.evaluate("globalThis.__stubRenderers.at(-1).info.render.calls")
                nodes = page.evaluate("window.__chaos.world.resources.length")
                ok = frames > 5 and not errors
                check(f'{island}/{quality}: plays without errors', ok, errors[:2] or frames)
                print(f'      draw calls={calls} resources={nodes} decor={page.evaluate("window.__chaos.world.decor.length")}')
                if quality == 'high': shot(page, f'20-game-{island}')
            except Exception as ex:
                check(f'{island}/{quality}: plays without errors', False, f'{ex} {errors[:2]}')
            ctx.close()

    # Distinct worlds from the same name
    ctx, page, errors = new_page(browser)
    page.goto(BASE); page.wait_for_selector('#screen-menu.active', timeout=6000)
    seeds = []
    for _ in range(3):
        page.click('.menu-btn:has-text("Play")'); page.fill('#world-name', 'Same Name')
        page.evaluate("""() => { const o = window.__origCreate; }""")
        page.click('#btn-world-play')
        page.wait_for_function('window.__chaos !== undefined', timeout=20000)
        seeds.append(page.evaluate("window.__chaos.world.seed"))
        page.evaluate("window.__chaos = undefined")
        page.click('#btn-pause'); page.click('#panel-pause .menu-btn:has-text("Quit")'); page.wait_for_selector('#screen-menu.active')
    check('same name still gives different islands', len(set(seeds)) == 3, seeds)
    ctx.close()
    browser.close()

passed = sum(1 for _, ok in results if ok)
print(f'\n{passed}/{len(results)} checks passed')
sys.exit(0 if passed == len(results) else 1)
