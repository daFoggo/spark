# Known issues (`apps/web`)

Trạng thái các lỗi runtime/cảnh báo/hiệu năng trên `apps/web` (Next.js 16.4, `cacheComponents` + `partialPrefetching`).
Mỗi mục ghi nguyên nhân đã **kiểm chứng trong source Next/Better Auth**, cách sửa và số đo trước/sau.

| # | Vấn đề | Trạng thái |
|---|---|---|
| 1 | Dashboard chậm, DevTools báo cache `cold` | Đã sửa và đo trên production build |
| 2 | `/sign-in`: "Could not validate `instant`…" | Không còn tái hiện (cả luồng sign-out); code trang đúng pattern |
| 3 | Cảnh báo preload font `.woff2` | Đã sửa |
| 4 | Base UI `nativeButton` ở `DashboardNotFound` | Đã sửa |
| 5 | Check-in lỗi 500 với timezone `Asia/Saigon` (và mọi tên legacy trình duyệt trả về) | Đã sửa (backend `0008`) |
| 6 | "Settings not found" làm sập Today khi user của session không còn trong DB | Đã sửa (backend 401) |

---

## 1. Cache `cold`, chuyển trang chậm trong `/dashboard`

### Nguyên nhân (đã kiểm chứng)
- **`getToday()` gọi `await io()` ngoài cache scope.** `next/dist/server/request/io.js`: trong request store, dev resolve `io()` ở
  `RenderStage.Dynamic`; khi prerender runtime (prefetch App Shell) nó là hanging promise. Mọi read phụ thuộc `today` vì vậy
  không vào được App Shell → mỗi lần điều hướng phải chờ server. Trong scope `"use cache"`/`"use cache: private"`, `io()` resolve ngay.
- **`getSession()` dùng `React.cache`, không share giữa các `"use cache: private"`.** Mỗi cache scope có `React.cache` riêng,
  nên mỗi query private lại gọi `auth.api.getSession()` + `auth.api.getToken()` (đọc DB + ký JWT).
- **`/dashboard` và `/dashboard/tasks` đọc `searchParams`** (`?day`, `?tab`). Đây là URL data, không nằm trong App Shell dùng chung,
  nên dữ liệu chờ tới lúc click nếu link không bật per-link prefetching.
- Trong `next dev`, `"use cache: private"` bị ép `revalidate: 0` (`forceDynamicCacheLifeInDev`): hành vi dev, không phải bug.

### Cách sửa (theo `guides/authentication-with-cache-components.md`, `optimizing-prefetching.md`)
- `lib/dal.ts`: `getSession()` là `"use cache: private"` + `cacheLife({ stale: 300, revalidate: 300, expire: 3600 })`.
  Next gộp các lời gọi private cùng key trong một request (`pendingCacheInvocations`/`completedCacheInvocations` trong
  `use-cache-wrapper.js`). Kết quả private không lưu trên server giữa các request production.
- `lib/clock.ts`: `getToday()` là `"use cache: private"` (cùng `cacheLife`). Không dùng `"use cache"` thường: cache public dùng
  chung giữa user cùng timezone và có thể trả ngày hôm trước sau nửa đêm. Đánh đổi: client có thể giữ ngày cũ tối đa 5 phút.
- `config/navigation.ts` + `components/layout/nav-tree.tsx`: link Today và Tasks có `prefetch` (per-link prefetching).
- Link list → chi tiết (`/dashboard/goals/[goalId]`, `/dashboard/habits/[habitId]`) có `prefetch`: trang chi tiết đọc `params`.
- Better Auth `nextCookies()` nuốt lỗi `cookies().set()` trong RSC, nên đọc session trong scope private an toàn.
- Docs và skill đã cập nhật để không lặp lại lỗi: `docs/data-fetching.md`, `authentication.md`, `advanced-patterns.md`,
  `performance-optimization.md` (font subsets), `goals-habits/spec.md` + `roadmap.md`, `migration/auth-better-auth.md`,
  skill `next-mono-base` (luật "Never Do" trong `references/caching.md`). `.claude/skills/` là bản copy của `.agents/skills/`:
  sửa skill thì sửa cả hai.

### Số đo (production build, `next start`, user thật, FastAPI + Postgres)
| | Trước | Sau |
|---|---|---|
| `provider.getSession()` mỗi request (dashboard, habits, goals, tasks, review) | 9–12 | 1 |
| Chuyển trang tới khi hết skeleton: goals / habits / review | ~370 ms | ~60–90 ms |
| Chuyển trang tới khi hết skeleton: Today / tasks | ~365 ms | ~60–90 ms |
| Mở trang chi tiết goal / habit lần đầu | ~360 ms | ~70–80 ms |

Đo bằng Playwright (Chromium), click link sidebar, chờ `main [data-slot="skeleton"]` = 0; mọi lần đều là soft navigation.

---

## 2. `/sign-in`: "Could not validate `instant` because a Client Component in a parent segment prevented the page from rendering"

### Kết luận
- `SignInPage` đọc `searchParams` trong `<Suspense>`: đúng pattern của `guides/adopting-partial-prefetching.md`.
  **Không** xóa `OAuthError`: `signInWithGoogleAction` vẫn redirect tới `/sign-in?error=oauth` khi provider lỗi.
- Trên dev server cũ, lỗi vẫn hiện khi `/sign-in` chỉ còn một `<h1>` tĩnh ("Dropped segment: `(auth)/layout.tsx`"), trong khi
  trang y hệt ở path khác không lỗi → không đến từ code trang.
- Sau khi restart: debug log validation (`NEXT_PRIVATE_DEBUG_VALIDATION=1`) "✅ All depths passed" cho load trực tiếp,
  `?error=oauth`, redirect qua proxy, client navigation, HMR. Playwright: đăng nhập → sign-out qua user menu → `/sign-in`,
  chờ 10 s: 0 lỗi console.
- Nếu lỗi quay lại: restart `next dev`; nếu vẫn còn, chạy với `NEXT_PRIVATE_DEBUG_VALIDATION=1` và báo Next.js kèm log.

---

## 3. Cảnh báo preload font không được dùng

`next/font/google` preload file của mọi subset trong `subsets`; `vietnamese` không dùng cho UI tiếng Anh. Sửa: `subsets: ["latin"]`
cho Geist và Geist Mono. Trong loader (`@next/font/dist/google/loader.js`) `subsets` chỉ quyết định file nào được **preload**;
`@font-face` của mọi subset vẫn được sinh, nên tiếng Việt trong nội dung vẫn đúng font. Playwright: 0 cảnh báo console.

---

## 4. Base UI `nativeButton` ở `DashboardNotFound`

`Button render={<Link />}` render ra `<a>` nên cần `nativeButton={false}` (như `app/not-found.tsx`). Các chỗ khác dùng
`render={<Link />}` là `Item`/`DropdownMenuItem`/`BreadcrumbLink`, không phải button.

---

## 5. Check-in lỗi 500 với `Asia/Saigon`

Chromium báo timezone Việt Nam là `Asia/Saigon` (tương tự `Asia/Calcutta`, `Europe/Kiev`, `Asia/Katmandu`). Python
`zoneinfo` chấp nhận (TM-2), nhưng tz data của Postgres trong `postgres:17` không có các tên legacy này. Trigger
`check_activity_window` gọi `today_for()` (`NOW() AT TIME ZONE <tz>`) nên mọi insert vào `activities` báo
`time zone "Asia/Saigon" not recognized`. Sửa: migration `0008_drop_activity_window` bỏ trigger và `today_for`; "today"
chỉ tính trong Python (D11), AC-5 đã kiểm ở mọi đường ghi (`create_log`, `toggle_check_in`, `set_check_in_note`;
`log_task` ghi ngày today). Luật: không dùng tên timezone của user trong SQL.

## 6. "Settings not found" làm sập Today

Better Auth `cookieCache` (5 phút) đọc session từ cookie, không hỏi DB. Khi user không còn trong DB (xóa tài khoản,
reset DB), web vẫn ký JWT, API trả 404 cho `/v1/settings` và trang rơi vào `error.tsx`. Sửa: dependency
`get_existing_user` (FastAPI) trả 401 khi `sub` không có trong `auth."user"`; `apiFetch` gặp 401 → `/auth/expired` →
xóa cookie → `/sign-in`. Session bị thu hồi (user còn) vẫn dùng được tới hết cửa sổ cookie cache: thiết kế có chủ đích.

---

## Ghi chú môi trường
- Browser pane của Claude desktop không chạy `requestAnimationFrame`: boundary `<Suspense>` stream về nhưng không reveal/hydrate,
  link bên trong thành hard navigation. Dùng Playwright hoặc trình duyệt thật để đo.
- `next start` trên `http://localhost` báo `ERR_SSL_PROTOCOL_ERROR` vì CSP `upgrade-insecure-requests` (chỉ bật ở production);
  hai test đầu của `e2e/smoke.spec.ts` fail vì vậy. Chạy smoke trên `next dev`, hoặc prod sau HTTPS.
- `e2e/smoke.spec.ts` cần `admin@gmail.com` có role `admin` (link Members).
- Postgres của `spark-backend` map ra host port `2211` (không phải 5432) để chạy song song DB của project khác; `DATABASE_URL` trong `.env` dùng `localhost:2211`.
