# CRA → Vite Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace react-scripts + craco with Vite, eliminating all 31 npm audit vulnerabilities (all rooted in react-scripts) and cutting build times ~5×.

**Architecture:** Drop-in swap — same React 19 + Tailwind + shadcn stack, same `@` path alias, same port 3000. `process.env.REACT_APP_*` → `import.meta.env.VITE_*`. `public/index.html` moves to project root as Vite requires. Output dir changes from `build/` to `dist/` (update Coolify start command).

**Tech Stack:** Vite 6, @vitejs/plugin-react, React 19, Tailwind v3, TypeScript-free JSX

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/vite.config.js` | Create | Vite config: React plugin, `@` alias, port 3000, env prefix |
| `frontend/index.html` | Create | Root entry HTML for Vite (replaces `public/index.html` as template) |
| `frontend/package.json` | Modify | Scripts, remove react-scripts/craco, add vite deps |
| `frontend/.env` | Modify | Rename `REACT_APP_*` → `VITE_*` |
| `frontend/src/**` (40 files) | Modify | `process.env.REACT_APP_*` → `import.meta.env.VITE_*` |
| `frontend/craco.config.js` | Delete | No longer needed |
| `frontend/public/index.html` | Keep | Static assets still served from `public/`; HTML template moves to root |

---

## Task 1: Install Vite, remove CRA + craco

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Vite and React plugin**

```bash
cd frontend
npm install --save-dev vite @vitejs/plugin-react
```

Expected: `vite` and `@vitejs/plugin-react` added to `devDependencies`.

- [ ] **Step 2: Remove react-scripts, craco, cra-template**

```bash
npm uninstall react-scripts @craco/craco cra-template @babel/plugin-proposal-private-property-in-object
```

Expected: packages removed from `node_modules` and `package.json`.

- [ ] **Step 3: Verify package.json no longer references react-scripts**

```bash
grep "react-scripts\|craco\|cra-template" package.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(build): swap react-scripts+craco for vite"
```

---

## Task 2: Create vite.config.js

**Files:**
- Create: `frontend/vite.config.js`

- [ ] **Step 1: Create the config**

Create `frontend/vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3000,
  },
  envPrefix: 'VITE_',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.js
git commit -m "chore(build): add vite.config.js with @ alias and port 3000"
```

---

## Task 3: Create root index.html

Vite requires `index.html` at the project root (not inside `public/`). Static assets stay in `public/` and are served as-is.

**Files:**
- Create: `frontend/index.html`

- [ ] **Step 1: Create root index.html**

Create `frontend/index.html` (adapted from `public/index.html` — strip `%PUBLIC_URL%`, add Vite module script):

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1B2A4A" />
        <meta name="description" content="VENLAX Sports — Victory. Energy. eXperience. A global multi-sport league platform for Tennis, Cricket &amp; Pickleball. Compete. Connect. Rise." />
        <meta property="og:title" content="VENLAX Sports — Victory. Energy. eXperience." />
        <meta property="og:description" content="A global multi-sport platform for players who want to compete, connect, and rise. Tennis · Cricket · Pickleball." />
        <meta property="og:url" content="https://venlaxsports.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="VENLAX Sports — Victory. Energy. eXperience." />
        <meta name="twitter:description" content="Multi-sport leagues for Tennis, Cricket &amp; Pickleball — USA + India." />
        <meta property="og:image" content="https://venlaxsports.com/logo.png" />
        <meta name="twitter:image" content="https://venlaxsports.com/logo.png" />
        <link rel="canonical" href="https://venlaxsports.com" />
        <link rel="icon" type="image/png" href="/logo-icon.png" />
        <link rel="apple-touch-icon" href="/logo-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
        <title>VENLAX Sports — Victory. Energy. eXperience.</title>
        <script>window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);</script>
        <script>(function(){var t=localStorage.getItem("venlax-theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark")document.documentElement.classList.add("dark");})();</script>
    </head>
    <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="root"></div>
        <script>
            !(function (t, e) {
                var o, n, p, r;
                e.__SV ||
                    ((window.posthog = e),
                    (e._i = []),
                    (e.init = function (i, s, a) {
                        function g(t, e) {
                            var o = e.split(".");
                            2 == o.length && ((t = t[o[0]]), (e = o[1])),
                                (t[e] = function () {
                                    t.push(
                                        [e].concat(
                                            Array.prototype.slice.call(
                                                arguments,
                                                0,
                                            ),
                                        ),
                                    );
                                });
                        }
                        ((p = t.createElement("script")).type =
                            "text/javascript"),
                            (p.crossOrigin = "anonymous"),
                            (p.async = !0),
                            (p.src =
                                s.api_host.replace(
                                    ".i.posthog.com",
                                    "-assets.i.posthog.com",
                                ) + "/static/array.js"),
                            (r =
                                t.getElementsByTagName(
                                    "script",
                                )[0]).parentNode.insertBefore(p, r);
                        var u = e;
                        for (
                            void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
                                u.people = u.people || [],
                                u.toString = function (t) {
                                    var e = "posthog";
                                    return (
                                        "posthog" !== a && (e += "." + a),
                                        t || (e += " (stub)"),
                                        e
                                    );
                                },
                                u.people.toString = function () {
                                    return u.toString(1) + ".people (stub)";
                                },
                                o =
                                    "init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug xs getPageViewId captureTraceFeedback captureTraceMetric".split(
                                        " ",
                                    ),
                                n = 0;
                            n < o.length;
                            n++
                        )
                            g(u, o[n]);
                        e._i.push([i, s, a]);
                    }),
                    (e.__SV = 1));
            })(document, window.posthog || []);
            posthog.init("phc_xAvL2Iq4tFmANRE7kzbKwaSqp1HJjN7x48s3vr0CMjs", {
                api_host: "https://us.i.posthog.com",
                person_profiles: "identified_only",
                disable_session_recording: true,
            });
            if (localStorage.getItem("venlax_analytics_consent") === "accepted") {
                posthog.startSessionRecording();
            }
        </script>
        <script type="module" src="/src/index.js"></script>
    </body>
</html>
```

Key changes from `public/index.html`:
- `%PUBLIC_URL%/logo-icon.png` → `/logo-icon.png`
- Added `<script type="module" src="/src/index.js"></script>` at end of body
- Removed CRA HTML comments

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "chore(build): add root index.html for vite (strips %PUBLIC_URL%)"
```

---

## Task 4: Update package.json scripts

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update the scripts block**

Open `frontend/package.json` and replace the `scripts` block:

```json
"scripts": {
  "start": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "echo \"No tests configured\""
},
```

- [ ] **Step 2: Verify scripts**

```bash
npm run build -- --help 2>&1 | head -3
```

Expected: Vite build help output (not react-scripts).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(build): update scripts to use vite"
```

---

## Task 5: Rename env vars — .env file + all source files

**Files:**
- Modify: `frontend/.env`
- Modify: all `src/**/*.{js,jsx}` files with `process.env.REACT_APP_*`

CRA used `REACT_APP_` prefix with `process.env`. Vite uses `VITE_` prefix with `import.meta.env`.

- [ ] **Step 1: Update .env**

```bash
cd frontend
sed -i 's/^REACT_APP_/VITE_/g' .env
```

Verify:
```bash
cat .env
```

Expected output:
```
VITE_BACKEND_URL=http://localhost:8001
VITE_PHASE=1
VITE_VAPID_PUBLIC_KEY=BIdEa-APfpm34b3SjpGn-4g1qEboGUxF-oc4cHU8h6Rd87KJw_IRQvFt9cJ9U_siIrgdDZoQrsMk-CNe5MXtC1A
```

- [ ] **Step 2: Bulk-replace process.env.REACT_APP_ → import.meta.env.VITE_ in all source files**

```bash
cd frontend
find src/ -name "*.js" -o -name "*.jsx" | xargs sed -i 's/process\.env\.REACT_APP_/import.meta.env.VITE_/g'
```

- [ ] **Step 3: Verify no REACT_APP_ references remain in src/**

```bash
grep -r "REACT_APP_\|process\.env\." src/ --include="*.js" --include="*.jsx"
```

Expected: no output.

- [ ] **Step 4: Spot-check a key file**

```bash
grep "import.meta.env" src/config/platformConfig.js
```

Expected:
```
export const PHASE = parseInt(import.meta.env.VITE_PHASE || "1");
const CRICKET_ENABLED = import.meta.env.VITE_CRICKET_ENABLED === "true";
```

- [ ] **Step 5: Commit**

```bash
git add .env src/
git commit -m "chore(build): rename REACT_APP_* to VITE_* and process.env to import.meta.env"
```

---

## Task 6: Delete craco.config.js

**Files:**
- Delete: `frontend/craco.config.js`

- [ ] **Step 1: Remove craco config**

```bash
cd frontend
rm craco.config.js
```

- [ ] **Step 2: Verify no craco references remain**

```bash
grep -r "craco" . --include="*.json" --include="*.js" --exclude-dir=node_modules
```

Expected: no output (or only inside `node_modules` which is excluded).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(build): remove craco.config.js"
```

---

## Task 7: Verify local build passes

- [ ] **Step 1: Run dev server and confirm it starts**

```bash
cd frontend
npm run start
```

Expected: Vite dev server starts on port 3000, no errors in terminal. Open browser, check home page loads, check console for errors.

Kill with Ctrl+C after confirming.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: build succeeds, `dist/` directory created. No errors (warnings OK).

- [ ] **Step 3: Verify dist output**

```bash
ls dist/
```

Expected: `index.html`, `assets/` directory.

- [ ] **Step 4: Check bundle size is reasonable**

```bash
du -sh dist/
```

Expected: under 5MB total (Vite builds are typically much smaller than webpack/CRA).

- [ ] **Step 5: Smoke test the prod build locally**

```bash
npm run preview
```

Open browser at http://localhost:3000. Check:
- Home page loads
- Navbar renders (VENLAX logo visible)
- No console errors related to `process.env` or missing env vars

Kill with Ctrl+C.

- [ ] **Step 6: Run npm audit to verify vulnerabilities resolved**

```bash
npm audit
```

Expected: 0 vulnerabilities (or only low-severity non-CRA ones).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(build): verify vite build passes — dist/ output confirmed"
```

---

## Task 8: Update Coolify deploy config

The Coolify start command serves the build output. CRA output was `build/`, Vite output is `dist/`.

**Current Coolify start command:**
```
npx serve -s build -l 3000
```

**New start command:**
```
npx serve -s dist -l 3000
```

- [ ] **Step 1: Update Coolify application start command**

Use the Coolify MCP tool `mcp__coolify__application` to update the start command for UUID `forj0vu6jpr3on72033qs8x7`:

```json
{
  "uuid": "forj0vu6jpr3on72033qs8x7",
  "start_command": "npx serve -s dist -l 3000"
}
```

- [ ] **Step 2: Verify the update was saved**

Confirm the application's `start_command` field now reads `npx serve -s dist -l 3000`.

---

## Task 9: Push and deploy

- [ ] **Step 1: Push all commits**

```bash
cd frontend
git log --oneline -6
git push origin main
```

- [ ] **Step 2: Trigger Coolify deploy**

```bash
# Via Coolify MCP: deploy forj0vu6jpr3on72033qs8x7
```

- [ ] **Step 3: Watch build logs for any Vite-specific errors**

Poll deployment until status = `finished`. Check last log lines confirm:
```
Rolling update started.
New container started.
Rolling update completed.
```

- [ ] **Step 4: Smoke test prod**

Open https://www.venlaxsports.com:
- Home page loads with correct theme
- Dark mode toggle works
- No console errors
- Check Network tab: no 404s for assets

---

## Rollback plan

If the Vite build deploys but the app breaks, rollback in Coolify:

```bash
# Revert last commit locally
git revert HEAD~5..HEAD
git push origin main
# Trigger Coolify redeploy
```

Or use Coolify's rollback feature to the previous deployment UUID.

---

## Post-migration verification checklist

- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] `npm run build` completes without errors
- [ ] `dist/` directory created (not `build/`)
- [ ] Home page loads in prod
- [ ] API calls succeed (env var `VITE_BACKEND_URL` resolves)
- [ ] Dark mode toggle persists on reload
- [ ] Service worker at `/sw.js` still registers (it's in `public/`, unaffected)
- [ ] Push notifications still work (`VITE_VAPID_PUBLIC_KEY` set)
- [ ] Coolify start command uses `dist` not `build`
