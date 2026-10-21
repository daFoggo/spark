# Known issues (`apps/web`)

Trạng thái các lỗi runtime/cảnh báo/hiệu năng trên `apps/web` (Next.js 16.4, `cacheComponents` + `partialPrefetching`).
Mỗi mục ghi nguyên nhân đã **kiểm chứng trong source Next/Better Auth**, cách sửa và số đo trước/sau.

| # | Vấn đề | Trạng thái |
|---|---|---|
| 1 | Dashboard chậm, DevTools báo cache `cold` | Đã sửa và đo trên production build |
| 2 | `/sign-in`: "Could not validate `instant`…" | Không còn tái hiện (cả luồng sign-out); code trang đúng pattern |
| 3 | Cảnh báo preload font `.woff2` | Đã sửa |
| 4 | Base UI `nativeButton` ở `DashboardNotFound` | Đã sửa |

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
- Better Auth `nextCookies()` nuốt lỗi `cookies().set()` trong RSC, nên đọc session trong scope private an toàn.
- Docs và skill (`docs/data-fetching.md` §1/§4.3/§5.2/checklist, `next-mono-base`) đã cập nhật để không lặp lại lỗi.

### Số đo (production build, `next start`, user thật, FastAPI + Postgres)
| | Trước | Sau |
|---|---|---|
| `provider.getSession()` mỗi request (dashboard, habits, goals, tasks, review) | 9–12 | 1 |
| Chuyển trang tới khi hết skeleton: goals / habits / review | ~370 ms | ~60–90 ms |
| Chuyển trang tới khi hết skeleton: Today / tasks | ~365 ms | ~60–90 ms |

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

## Ghi chú môi trường
- Browser pane của Claude desktop không chạy `requestAnimationFrame`: boundary `<Suspense>` stream về nhưng không reveal/hydrate,
  link bên trong thành hard navigation. Dùng Playwright hoặc trình duyệt thật để đo.
- `next start` trên `http://localhost` báo `ERR_SSL_PROTOCOL_ERROR` vì CSP `upgrade-insecure-requests` (chỉ bật ở production);
  hai test đầu của `e2e/smoke.spec.ts` fail vì vậy. Chạy smoke trên `next dev`, hoặc prod sau HTTPS.
- `e2e/smoke.spec.ts` cần `admin@gmail.com` có role `admin` (link Members).
- `spark-backend/compose.yaml` dùng port `5432`, trùng container `payment_db` của project khác.
