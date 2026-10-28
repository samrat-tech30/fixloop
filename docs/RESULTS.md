# FixLoop results

Run on 28 Oct 2026 against the real LLM router (OpenAI `gpt-4.1-mini` first, Gemini `gemini-3.5-flash` fallback), through the backend API (`POST /analyze`, `POST /agent/run` with `auto_approve=true`, polling `GET /runs/{id}`). Seconds are wall-clock per request / per full agent run.

**Correct cause?** is for a human reviewer to fill in.

## Summary

| # | Case | Mode | Pattern | Provider | Final status | Attempts | Seconds | Correct cause? |
|---|---|---|---|---|---|---|---|---|
| 1 | `npm-missing-module` | explain | `missing-npm-module` | openai | diagnosed | – | 6.6 | ☐ yes ☐ no |
| 2 | `crashloop` | explain | `k8s-crashloop` | openai | diagnosed | – | 6.8 | ☐ yes ☐ no |
| 3 | `imagepull` | explain | `k8s-imagepull` | openai | diagnosed | – | 6.6 | ☐ yes ☐ no |
| 4 | `oomkilled` | explain | `oom-killed` | openai | diagnosed | – | 5.0 | ☐ yes ☐ no |
| 5 | `port-in-use` | explain | `port-in-use` | openai | diagnosed | – | 4.2 | ☐ yes ☐ no |
| 6 | `db-refused` | explain | `db-connection-refused` | openai | diagnosed | – | 4.5 | ☐ yes ☐ no |
| 7 | `docker-copy` | explain | `docker-copy-failed` | openai | diagnosed | – | 3.4 | ☐ yes ☐ no |
| 8 | `eresolve` | explain | `npm-eresolve` | openai | diagnosed | – | 4.9 | ☐ yes ☐ no |
| 9 | `missing-package` | fix | `missing-npm-module` | openai / fix: openai | **fixed** | 1 | 22.2 | ☐ yes ☐ no |
| 10 | `wrong-import` | fix | `wrong-import-path` | openai / fix: openai | **fixed** | 1 | 15.6 | ☐ yes ☐ no |
| 11 | `type-error` | fix | `typescript-type-error` | openai / fix: openai | **fixed** | 1 | 20.4 | ☐ yes ☐ no |
| 12 | `syntax-error` | fix | `syntax-error` | openai / fix: openai | **fixed** | 1 | 20.0 | ☐ yes ☐ no |
| 13 | `missing-env` | fix | `missing-env-var` | openai | **handed_off** | 0 | 8.6 | ☐ yes ☐ no |

- Explain: 8/8 samples matched the expected pattern and got an LLM diagnosis; average 5.2 s.
- Fix: 4/4 auto-fix scenarios reached `fixed` on the first attempt; `missing-env` was handed off (1/1).
- Offline (`?offline=true`, Ollama `gemma4:12b` on the dev laptop): the call timed out after 90 s and fell back to the pattern answer. Offline mode works as a fallback but this model is too slow on this machine for a live demo.

## Explain mode: each diagnosis

### `npm-missing-module` — Next.js build: module not found

Pattern `missing-npm-module` · openai `gpt-4.1-mini` · 6.6 s

- **Summary:** Build failed because the 'razorpay' package is missing and not found during compilation.
- **Root cause:** The code imports the 'razorpay' package in src/lib/payments.ts, but this package is not listed in package.json and therefore not installed during the build process. This causes the Next.js build to fail with a module not found error.
- **Category / severity / confidence:** dependency / critical / 0.90
- **Auto-fixable:** yes
- **Evidence:**

  ```text
  Module not found: Can't resolve 'razorpay'
  ./src/lib/payments.ts
  Failed to compile.
  Build failed because of webpack errors
  Error: Command "npm run build" exited with 1
  ```

- **Fix steps:**
  1. Run `npm install razorpay` to add the missing package
  2. Commit the updated `package.json` and `package-lock.json` files
  3. Push the changes to the repository branch triggering the deployment
  4. Redeploy the application to verify the build succeeds with `npm run build`

Correct cause? ☐ yes ☐ no

### `crashloop` — Kubernetes CrashLoopBackOff

Pattern `k8s-crashloop` · openai `gpt-4.1-mini` · 6.8 s

- **Summary:** orders-api pod fails to start because the file /app/dist/server.js is missing in the container image.
- **Root cause:** The container tries to run the command 'node dist/server.js' but the file /app/dist/server.js does not exist inside the container filesystem. This causes Node.js to throw a MODULE_NOT_FOUND error and exit with code 1, leading Kubernetes to restart the pod repeatedly.
- **Category / severity / confidence:** runtime / critical / 0.95
- **Auto-fixable:** no
- **Evidence:**

  ```text
  Error: Cannot find module '/app/dist/server.js'
  Exit Code:    1
  orders-api-7d9f8b6c5d-x2kqp   0/1     CrashLoopBackOff   6 (41s ago)   7m12s
  Command:        node dist/server.js
  ```

- **Fix steps:**
  1. Verify that the build process generates the /app/dist/server.js file inside the container image.
  2. Rebuild the orders-api image ensuring the dist/server.js file is included, e.g. run `npm run build` before building the Docker image.
  3. Push the updated image to the registry with the correct tag, e.g. `docker build -t registry.acme.io/orders-api:2.3.2 .` and `docker push registry.acme.io/orders-api:2.3.2`.
  4. Update the deployment to use the new image tag `2.3.2` in the Kubernetes manifest or run `kubectl set image deployment/orders-api orders-api=registry.acme.io/orders-api:2.3.2 -n orders`.
  5. Restart the deployment with `kubectl rollout restart deployment/orders-api -n orders` and verify the pod starts successfully with `kubectl get pods -n orders`.

Correct cause? ☐ yes ☐ no

### `imagepull` — Kubernetes ImagePullBackOff

Pattern `k8s-imagepull` · openai `gpt-4.1-mini` · 6.6 s

- **Summary:** The web deployment pods fail to start due to image pull errors caused by missing or unauthorized access to the container image ghcr.io/acme/shop-web:v1.8.0.
- **Root cause:** The Kubernetes nodes cannot pull the container image from the GitHub Container Registry because the repository either does not exist or the cluster lacks the necessary authorization credentials. This results in 'ImagePullBackOff' and 'ErrImagePull' errors, indicating that the image is inaccessible due to permission issues or incorrect image name/tag.
- **Category / severity / confidence:** infra / critical / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
  web-5c8d7f9b44-9hj2l   0/1     ImagePullBackOff   0          4m3s
  Failed to pull image "ghcr.io/acme/shop-web:v1.8.0": rpc error: code = Unknown desc = failed to pull and unpack image "ghcr.io/acme/shop-web:v1.8.0": failed to resolve reference "ghcr.io/acme/shop-web:v1.8.0": pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed
  Error: ErrImagePull
  Error: ImagePullBackOff
  error: deployment "web" exceeded its progress deadline
  ```

- **Fix steps:**
  1. Verify the image name and tag exist by running `docker pull ghcr.io/acme/shop-web:v1.8.0` locally.
  2. If the image is private, create a Kubernetes imagePullSecret with `kubectl create secret docker-registry ghcr-secret --docker-server=ghcr.io --docker-username=<username> --docker-password=<token> --docker-email=<email> -n shop`.
  3. Update the deployment to reference the imagePullSecret by adding `imagePullSecrets: - name: ghcr-secret` under the pod spec in the deployment YAML.
  4. Apply the updated deployment with `kubectl apply -f deployment.yaml -n shop`.
  5. Monitor the rollout status with `kubectl rollout status deployment/web -n shop` until pods are running.

Correct cause? ☐ yes ☐ no

### `oomkilled` — Kubernetes OOMKilled (exit 137)

Pattern `oom-killed` · openai `gpt-4.1-mini` · 5.0 s

- **Summary:** report-worker pod is OOMKilled because it exceeds its 256Mi memory limit during processing large data.
- **Root cause:** The report-worker container is configured with a memory limit of 256Mi, which is insufficient for the workload that loads over 1.2 million order rows into memory and builds pivot tables. This causes the Node.js process to run out of heap memory and be killed by the system with exit code 137.
- **Category / severity / confidence:** infra / critical / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
  report-worker-6b7c9d8f5-m4kzt     0/1     OOMKilled   3 (52s ago)   5m40s
  Last State:     Terminated
  Reason:       OOMKilled
  Limits:
  memory:  256Mi
  [worker] loading 1,240,551 order rows into memory
  FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
  ```

- **Fix steps:**
  1. Increase the memory limit for the report-worker container by setting `resources.limits.memory` to at least `1Gi` in the deployment manifest.
  2. Set the environment variable `NODE_OPTIONS=--max-old-space-size=1024` in the container spec to allow Node.js to use more heap memory.
  3. Apply the updated deployment with `kubectl apply -f deployment.yaml -n analytics`.
  4. Monitor the pod status with `kubectl get pods -n analytics` to confirm the pod no longer restarts with OOMKilled.
  5. If OOMKilled persists, further increase memory limits or investigate memory usage patterns in the application.

Correct cause? ☐ yes ☐ no

### `port-in-use` — Node server: port already in use

Pattern `port-in-use` · openai `gpt-4.1-mini` · 4.2 s

- **Summary:** billing-api can't start: port 8080 is already in use by another process.
- **Root cause:** The billing-api service tries to listen on port 8080, but that port is already occupied by another process on the server. This causes the Node.js server to throw an EADDRINUSE error and crash. The app likely uses a hard-coded port instead of the environment-assigned port.
- **Category / severity / confidence:** runtime / critical / 0.95
- **Auto-fixable:** no
- **Evidence:**

  ```text
  Error: listen EADDRINUSE: address already in use :::8080
  at Server.setupListenHandle [as _listen2] (node:net:1904:16)
  at Object.<anonymous> (/srv/billing-api/server.js:41:5)
  ERROR billing-api errored (exit code 1), restarts: 15
  ERROR Deployment health check failed after 30s
  ```

- **Fix steps:**
  1. Find and stop the process using port 8080 with `lsof -i :8080` or `netstat -ano | findstr 8080`
  2. Modify `/srv/billing-api/server.js` to make the app listen on `process.env.PORT` instead of hard-coded 8080
  3. Restart the billing-api service with `pm2 restart billing-api`
  4. Verify the service is running without port conflicts using `pm2 status billing-api`

Correct cause? ☐ yes ☐ no

### `db-refused` — API start-up: database connection refused (contains secrets)

Pattern `db-connection-refused` · openai `gpt-4.1-mini` · 4.5 s

- **Summary:** inventory-api can't connect to the database because the connection to 127.0.0.1:5432 is refused.
- **Root cause:** The application is trying to connect to a PostgreSQL database on localhost (127.0.0.1) at port 5432, but the connection is refused. This usually means the database server is not running on the local machine, the port is blocked, or the database is hosted elsewhere and the DATABASE_URL environment variable is incorrectly set to localhost.
- **Category / severity / confidence:** network / critical / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
  [boot] DATABASE_URL=postgres://inventory_app:[REDACTED]@localhost:5432/inventory
  [db] attempt 1/5 failed
  Error: connect ECONNREFUSED 127.0.0.1:5432
  [boot] Fatal: could not connect to database, shutting down
  ```

- **Fix steps:**
  1. Verify if the PostgreSQL database is running locally with `pg_isready -h localhost -p 5432` or `systemctl status postgresql`
  2. If the database is remote, update the `DATABASE_URL` environment variable to point to the correct host instead of localhost
  3. Ensure the database server allows connections from the application host IP and that no firewall blocks port 5432
  4. Restart the inventory-api service after updating the environment variable with `render deploy inventory-api` or equivalent
  5. Confirm the service connects successfully by checking logs with `render logs inventory-api`

Correct cause? ☐ yes ☐ no

### `docker-copy` — Docker build: COPY failed

Pattern `docker-copy-failed` · openai `gpt-4.1-mini` · 3.4 s

- **Summary:** Docker build failed because the file config/production.json is missing from the build context.
- **Root cause:** The Dockerfile attempts to copy config/production.json into the image, but this file does not exist relative to the directory where the docker build command is run. This could be due to the file being absent, the build context being incorrect, or the file being excluded by .dockerignore.
- **Category / severity / confidence:** build / critical / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
   => ERROR [5/7] COPY config/production.json ./config/:
  Dockerfile:9
     9 | >>> COPY config/production.json ./config/
  ERROR: failed to solve: failed to compute cache key: failed to calculate checksum of ref 6b1f0e2a-77c4-4b0e-9d1a-2c0f5f3e8a10::q1x9: "/config/production.json": not found
  ```

- **Fix steps:**
  1. Check that the file `config/production.json` exists relative to the directory where you run `docker build`
  2. Verify that `.dockerignore` does not exclude `config/production.json`
  3. Adjust the Dockerfile COPY path or the build context to include `config/production.json`
  4. Run `docker build .` again to verify the fix

Correct cause? ☐ yes ☐ no

### `eresolve` — npm install: dependency conflict (ERESOLVE)

Pattern `npm-eresolve` · openai `gpt-4.1-mini` · 4.9 s

- **Summary:** npm install fails due to a dependency conflict between react@19.0.0 and react-beautiful-dnd@13.1.1 which requires react versions 16, 17, or 18.
- **Root cause:** The project specifies react version 19.0.0, but react-beautiful-dnd@13.1.1 has a peer dependency requiring react versions ^16.8.0, ^17.0.0, or ^18.0.0. This version mismatch causes npm to refuse to resolve the dependency tree, resulting in installation failure.
- **Category / severity / confidence:** dependency / warning / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
  npm ERR! code ERESOLVE
  npm ERR! ERESOLVE unable to resolve dependency tree
  npm ERR! Found: react@19.0.0
  npm ERR! peer react@"^16.8.0 || ^17.0.0 || ^18.0.0" from react-beautiful-dnd@13.1.1
  npm ERR! Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps
  ```

- **Fix steps:**
  1. Check if react-beautiful-dnd has a newer version compatible with react 19 by running `npm info react-beautiful-dnd versions`
  2. If a compatible version exists, update react-beautiful-dnd in package.json to that version and run `npm install`
  3. Otherwise, downgrade react in package.json to a version compatible with react-beautiful-dnd (e.g., ^18.0.0) and run `npm install`
  4. As a temporary workaround, run `npm install --legacy-peer-deps` to bypass the peer dependency conflict and commit the updated package-lock.json
  5. Verify the fix by running `npm run build` or `npm start` to ensure the application works with the resolved dependencies

Correct cause? ☐ yes ☐ no

## Fix mode: each run

### `missing-package` → fixed (1 attempt(s), 22.2 s)

- **Summary:** Build failed because the 'axios' package is missing and not found during TypeScript compilation.
- **Root cause:** The source code imports the 'axios' package, but it is not listed in package.json dependencies, so it is not installed on the build server. This causes the TypeScript compiler to fail with a module not found error.
- **Category / severity / confidence:** dependency / critical / 0.90
- **Auto-fixable:** yes
- **Evidence:**

  ```text
  src/index.ts(1,19): error TS2307: Cannot find module 'axios' or its corresponding type declarations.
  npm notice run demo-app@1.0.0 build
  npm notice run tsc -p .
  ```

- **Fix steps:**
  1. Run `npm install axios` to add the missing package locally.
  2. Commit the updated `package.json` and `package-lock.json` files to version control.
  3. Redeploy the application to trigger a fresh build with the installed dependency.
  4. Verify the build succeeds by running `npm run build` or checking the deployment logs.

Agent steps:

1. `run_build` ✗ — npm run build: exit 2 in 2174 ms
2. `diagnose` ✓ — Build failed because the 'axios' package is missing and not found during TypeScript compilation.
3. `install_package` ✓ — Proposed via openai: npm install axios (patch #5)
4. `apply_patch` ✓ — npm install axios (exit 0)
5. `run_build` ✓ — npm run build: exit 0 in 657 ms
6. `finish` ✓ — Build passes after 1 fix(es)

Patch #5 (install, applied):

```diff
--- package.json
+++ package.json
@@ dependencies @@
+    "axios": "<latest>"

$ npm install axios
```

Correct cause? ☐ yes ☐ no

### `wrong-import` → fixed (1 attempt(s), 15.6 s)

- **Summary:** Build failed due to a wrong import path './componets/header' in src/index.ts, which does not exist.
- **Root cause:** The TypeScript compiler cannot find the module './componets/header' because the import path is misspelled or has incorrect letter casing. This is common on case-sensitive Linux build servers where the actual folder or file name differs from the import statement.
- **Category / severity / confidence:** build / critical / 0.90
- **Auto-fixable:** yes
- **Evidence:**

  ```text
  src/index.ts(1,30): error TS2307: Cannot find module './componets/header' or its corresponding type declarations.
  ```

- **Fix steps:**
  1. Open the file src/index.ts and locate the import statement for './componets/header'.
  2. Correct the import path to the actual folder and file name, e.g. change './componets/header' to './components/header' if that is the correct path.
  3. Check the letter case of the folder and file names to ensure they match exactly.
  4. Run `npm run build` locally to verify the fix.
  5. Redeploy the application after a successful local build.

Agent steps:

1. `run_build` ✗ — npm run build: exit 2 in 1502 ms
2. `diagnose` ✓ — Build failed due to a wrong import path './componets/header' in src/index.ts, which does not exist.
3. `propose_edit` ✓ — Proposed via openai: Edit src/index.ts (patch #6)
4. `apply_patch` ✓ — Wrote src/index.ts
5. `run_build` ✓ — npm run build: exit 0 in 1300 ms
6. `finish` ✓ — Build passes after 1 fix(es)

Patch #6 (edit, applied):

```diff
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,4 +1,4 @@
-import { renderHeader } from "./componets/header";
+import { renderHeader } from "./components/header";
 import { retries } from "./config";
 import { formatPrice } from "./utils";
```

Correct cause? ☐ yes ☐ no

### `type-error` → fixed (1 attempt(s), 20.4 s)

- **Summary:** TypeScript build failed due to a type mismatch in src/config.ts where a string is assigned to a number type.
- **Root cause:** The TypeScript compiler detected that a value declared as a number type is being assigned a string in src/config.ts at line 1, column 14. This type inconsistency causes the build to fail and prevents the production deployment.
- **Category / severity / confidence:** build / critical / 0.90
- **Auto-fixable:** yes
- **Evidence:**

  ```text
  src/config.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
  npm notice run demo-app@1.0.0 build
  npm notice run tsc -p .
  ```

- **Fix steps:**
  1. Open the file `src/config.ts` at line 1, column 14.
  2. Change the value or the declared type so that the assigned value matches the declared number type.
  3. Run `npx tsc --noEmit` locally to verify the type error is resolved.
  4. Once the build passes locally, redeploy the application.

Agent steps:

1. `run_build` ✗ — npm run build: exit 2 in 2199 ms
2. `diagnose` ✓ — TypeScript build failed due to a type mismatch in src/config.ts where a string is assigned to a number type.
3. `propose_edit` ✓ — Proposed via openai: Edit src/config.ts (patch #7)
4. `apply_patch` ✓ — Wrote src/config.ts
5. `run_build` ✓ — npm run build: exit 0 in 658 ms
6. `finish` ✓ — Build passes after 1 fix(es)

Patch #7 (edit, applied):

```diff
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1 @@
-export const retries: number = "5";
+export const retries: number = 5;
```

Correct cause? ☐ yes ☐ no

### `syntax-error` → fixed (1 attempt(s), 20.0 s)

- **Summary:** Build failed due to a syntax error in src/utils.ts at line 3: a closing '}' is missing.
- **Root cause:** The TypeScript compiler detected a syntax error indicating that a closing brace '}' is expected but missing in src/utils.ts at line 3. This usually means there is an unmatched or missing bracket, causing the code to be unparsable.
- **Category / severity / confidence:** build / critical / 0.90
- **Auto-fixable:** yes
- **Evidence:**

  ```text
  src/utils.ts(3,1): error TS1005: '}' expected.
  npm notice run demo-app@1.0.0 build
  npm notice run tsc -p .
  ```

- **Fix steps:**
  1. Open src/utils.ts and navigate to line 3 to inspect the code for a missing or extra '}'
  2. Use your editor's formatting or linting tools to highlight bracket mismatches in src/utils.ts
  3. Fix the syntax error by adding the missing '}' or correcting bracket placement
  4. Run `npm run build` locally to verify the syntax error is resolved
  5. Redeploy the application after a successful build

Agent steps:

1. `run_build` ✗ — npm run build: exit 2 in 1223 ms
2. `diagnose` ✓ — Build failed due to a syntax error in src/utils.ts at line 3: a closing '}' is missing.
3. `propose_edit` ✓ — Proposed via openai: Edit src/utils.ts (patch #8)
4. `apply_patch` ✓ — Wrote src/utils.ts
5. `run_build` ✓ — npm run build: exit 0 in 673 ms
6. `finish` ✓ — Build passes after 1 fix(es)

Patch #8 (edit, applied):

```diff
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,2 +1,3 @@
 export function formatPrice(amount: number): string {
   return `Rs. ${amount.toFixed(2)}`;
+}
```

Correct cause? ☐ yes ☐ no

### `missing-env` → handed_off (0 attempt(s), 8.6 s)

- **Summary:** The deployment failed because the environment variable API_KEY is missing, causing the app to error out during startup.
- **Root cause:** The application requires the API_KEY environment variable to function properly, but it is not set in the deployment environment. This variable is likely present locally in a .env file, which is why the app works locally but fails when deployed. Without this key, the app cannot proceed and throws an error.
- **Category / severity / confidence:** config / critical / 0.90
- **Auto-fixable:** no
- **Evidence:**

  ```text
  Error: API_KEY is not defined. Set it in your hosting provider's environment variables.
  ```

- **Fix steps:**
  1. Add `API_KEY` in your hosting dashboard (e.g. Vercel/Render → Settings → Environment Variables) for the right environment
  2. Ensure the value of `API_KEY` is not committed to git or exposed publicly
  3. Redeploy the application so the new environment variable is picked up
  4. Verify the deployment succeeds by running `kubectl rollout status deployment/demo-app` or equivalent

Agent steps:

1. `run_build` ✗ — npm run build: exit 1 in 2560 ms
2. `diagnose` ✓ — The deployment failed because the environment variable API_KEY is missing, causing the app to error out during startup.
3. `hand_off` ✓ — This needs a human: The application requires the API_KEY environment variable to function properly, but it is not set in the deployment environment. This variable is likely present locally in a .env file, which is why the app works locally but fails when deployed. Without this key, the app cannot proceed and throws an 
4. `finish` ✓ — Handed off to a human

Hand-off steps for a human:
1. Add `API_KEY` in your hosting dashboard (e.g. Vercel/Render → Settings → Environment Variables) for the right environment
2. Ensure the value of `API_KEY` is not committed to git or exposed publicly
3. Redeploy the application so the new environment variable is picked up
4. Verify the deployment succeeds by running `kubectl rollout status deployment/demo-app` or equivalent

Correct cause? ☐ yes ☐ no
