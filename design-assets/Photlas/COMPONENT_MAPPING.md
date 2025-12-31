# Photlas コンポーネント・ボタン操作対応表

このドキュメントは、Photlasアプリケーションのバックエンド実装時に、どのコンポーネント名を使用すればどのボタンを操作できるかを示します。

## 主要コンポーネント一覧

### 1. メインアプリケーション
- **コンポーネント名**: `App`
- **ファイルパス**: `/App.tsx`
- **役割**: アプリケーション全体の状態管理と画面制御

### 2. スプラッシュスクリーン
- **コンポーネント名**: `SplashScreen`
- **ファイルパス**: `/components/SplashScreen.tsx`
- **表示条件**: アプリ起動時（3秒間）

### 3. 地図表示
- **コンポーネント名**: `MapView`
- **ファイルパス**: `/components/MapView.tsx`
- **役割**: Leaflet地図の表示と写真マーカーの配置

---

## フィルター機能

### フィルターパネル
- **コンポーネント名**: `FilterPanel`
- **ファイルパス**: `/components/FilterPanel.tsx`
- **開閉状態**: `open` prop (boolean)
- **開閉制御**: `onOpenChange` callback

#### 被写体種別ボタン（12種類）
配列定数: `CATEGORIES`
```typescript
const CATEGORIES = [
  "風景", "街並み", "植物", "動物", "自動車", 
  "バイク", "鉄道", "飛行機", "食べ物", "ポートレート", 
  "星空", "その他"
];
```

**状態管理**:
- State変数: `selectedCategories: string[]`
- 更新関数: `setSelectedCategories`
- 選択判定: `selectedCategories.includes(category)`

**ボタン操作**:
- クリックイベント: `toggleSelection(category, selectedCategories, setSelectedCategories)`
- ボタンvariant: 選択時 `"default"` / 非選択時 `"outline"`

**対応アイコン**:
- **コンポーネント**: `CategoryIcon`
- **ファイルパス**: `/components/CategoryIcon.tsx`
- **使用例**: `<CategoryIcon category="風景" className="w-5 h-5" />`

---

#### 時期（月別）ボタン（12種類）
配列定数: `MONTHS`
```typescript
const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月"
];
```

**状態管理**:
- State変数: `selectedMonths: string[]`
- 更新関数: `setSelectedMonths`
- 選択判定: `selectedMonths.includes(month)`

**ボタン操作**:
- クリックイベント: `toggleSelection(month, selectedMonths, setSelectedMonths)`
- ボタンvariant: 選択時 `"default"` / 非選択時 `"outline"`

**対応アイコン**:
- **エクスポート**: `MonthIcons`
- **ファイルパス**: `/components/FilterIcons.tsx`
- **使用例**: 
```typescript
const Icon = MonthIcons["1月"];
<Icon className="w-5 h-5" />
```

**月別アイコン詳細**:
| 月 | アイコン内容 |
|---|---|
| 1月 | 門松 |
| 2月 | バケツを被った雪だるま |
| 3月 | 学士帽 |
| 4月 | 桜の花 |
| 5月 | 鯉のぼり |
| 6月 | 傘 |
| 7月 | 花火 |
| 8月 | スイカ（黒地に白シマ） |
| 9月 | うさぎ |
| 10月 | ジャック・オー・ランタン |
| 11月 | カエデの葉 |
| 12月 | クリスマスツリー |

---

#### 時間帯ボタン（4種類）
配列定数: `TIME_OF_DAY`
```typescript
const TIME_OF_DAY = ["朝", "昼", "夕方", "夜"];
```

**状態管理**:
- State変数: `selectedTimes: string[]`
- 更新関数: `setSelectedTimes`
- 選択判定: `selectedTimes.includes(time)`

**ボタン操作**:
- クリックイベント: `toggleSelection(time, selectedTimes, setSelectedTimes)`
- ボタンvariant: 選択時 `"default"` / 非選択時 `"outline"`

**対応アイコン**:
- **エクスポート**: `TimeIcons`
- **ファイルパス**: `/components/FilterIcons.tsx`
- **使用例**: 
```typescript
const Icon = TimeIcons["朝"];
<Icon className="w-6 h-6" />
```

**時間帯アイコン詳細**:
| 時間帯 | アイコン内容 |
|---|---|
| 朝 | 上半分だけ見える太陽（三角形の光） |
| 昼 | 完全な太陽（三角形の光） |
| 夕方 | 地平線に沈む大きな太陽 |
| 夜 | 三日月 |

---

#### 天候ボタン（4種類）
配列定数: `WEATHER`
```typescript
const WEATHER = ["晴れ", "曇り", "雨", "雪"];
```

**状態管理**:
- State変数: `selectedWeather: string[]`
- 更新関数: `setSelectedWeather`
- 選択判定: `selectedWeather.includes(weather)`

**ボタン操作**:
- クリックイベント: `toggleSelection(weather, selectedWeather, setSelectedWeather)`
- ボタンvariant: 選択時 `"default"` / 非選択時 `"outline"`

**対応アイコン**:
- **エクスポート**: `WeatherIcons`
- **ファイルパス**: `/components/FilterIcons.tsx`
- **使用例**: 
```typescript
const Icon = WeatherIcons["晴れ"];
<Icon className="w-6 h-6" />
```

**天候アイコン詳細**:
| 天候 | アイコン内容 |
|---|---|
| 晴れ | 太陽（三角形の光、「昼」と同じ） |
| 曇り | 雲 |
| 雨 | 雲と雨粒 |
| 雪 | 雲と雪の結晶 |

---

#### フィルター操作ボタン
1. **クリアボタン**
   - ラベル: "クリア"
   - variant: `"outline"`
   - 処理: すべての選択状態をリセット
   ```typescript
   setSelectedCategories([]);
   setSelectedMonths([]);
   setSelectedTimes([]);
   setSelectedWeather([]);
   ```

2. **適用ボタン**
   - ラベル: "適用"
   - variant: `"default"`
   - 処理: フィルターパネルを閉じる
   ```typescript
   onOpenChange(false);
   ```

---

## トップメニュー

### トップメニューパネル
- **コンポーネント名**: `TopMenuPanel`
- **ファイルパス**: `/components/TopMenuPanel.tsx`
- **開閉状態**: `open` prop (boolean)
- **開閉制御**: `onOpenChange` callback

**メニュー項目**:
1. マイページ表示
2. アカウント設定表示
3. ログアウト

---

## ダイアログ・モーダル

### 1. ログイン画面
- **コンポーネント名**: `LoginDialog`
- **ファイルパス**: `/components/LoginDialog.tsx`
- **Props**:
  - `open: boolean` - 開閉状態
  - `onOpenChange: (open: boolean) => void` - 開閉制御
  - `onSwitchToSignUp: () => void` - サインアップ画面へ切り替え
  - `onForgotPassword: () => void` - パスワードリセット画面へ切り替え

**ボタン**:
- ログインボタン
- アカウント作成リンク
- パスワード忘れリンク

### 2. アカウント作成画面
- **コンポーネント名**: `SignUpDialog`
- **ファイルパス**: `/components/SignUpDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onSwitchToLogin: () => void` - ログイン画面へ切り替え

**ボタン**:
- アカウント作成ボタン
- ログインリンク
- 利用規約リンク
- プライバシーポリシーリンク

### 3. パスワードリセット画面
- **コンポーネント名**: `PasswordResetDialog`
- **ファイルパス**: `/components/PasswordResetDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onBackToLogin: () => void` - ログイン画面へ戻る

**ボタン**:
- リセットリンク送信ボタン
- ログインに戻るリンク

### 4. マイページ
- **コンポーネント名**: `ProfileDialog`
- **ファイルパス**: `/components/ProfileDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

**表示内容**:
- ユーザー名
- プロフィール画像
- 投稿写真一覧

### 5. アカウント設定
- **コンポーネント名**: `AccountSettingsDialog`
- **ファイルパス**: `/components/AccountSettingsDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

**設定項目**:
- ユーザー名変更
- メールアドレス変更
- パスワード変更
- プロフィール画像変更

### 6. 写真詳細表示
- **コンポーネント名**: `PhotoDetailDialog`
- **ファイルパス**: `/components/PhotoDetailDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onOpenLightbox: () => void` - フルサイズ表示へ切り替え

**表示内容**:
- 写真サムネイル
- 投稿者情報
- 撮影日時
- 位置情報
- カテゴリー
- いいね・コメント

### 7. 写真フルサイズ表示（ライトボックス）
- **コンポーネント名**: `PhotoLightbox`
- **ファイルパス**: `/components/PhotoLightbox.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `imageUrl: string` - 表示する画像URL

**操作**:
- 閉じるボタン（X）
- 背景クリックで閉じる

### 8. 写真投稿画面
- **コンポーネント名**: `PhotoContributionDialog`
- **ファイルパス**: `/components/PhotoContributionDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

**フォーム項目**:
- 写真選択
- 位置情報設定
- カテゴリー選択（被写体種別）
- 撮影日時
- 時間帯選択
- 天候選択

**ボタン**:
- 投稿ボタン
- キャンセルボタン

### 9. ログイン要求ダイアログ
- **コンポーネント名**: `LoginRequiredDialog`
- **ファイルパス**: `/components/LoginRequiredDialog.tsx`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onLogin: () => void` - ログイン画面を開く

---

## 静的ページ

### 1. 利用規約
- **コンポーネント名**: `TermsOfServicePage`
- **ファイルパス**: `/components/TermsOfServicePage.tsx`
- **Props**:
  - `onBack: () => void` - 戻るボタンの処理

### 2. プライバシーポリシー
- **コンポーネント名**: `PrivacyPolicyPage`
- **ファイルパス**: `/components/PrivacyPolicyPage.tsx`
- **Props**:
  - `onBack: () => void` - 戻るボタンの処理

---

## フローティングボタン（地図上）

### 1. フィルターボタン
- **アイコン**: `SlidersHorizontal` (lucide-react)
- **位置**: 右上
- **処理**: `setFilterOpen(true)` - フィルターパネルを開く

### 2. メニューボタン
- **アイコン**: `Menu` (lucide-react)
- **位置**: 左上
- **処理**: `setMenuOpen(true)` - トップメニューを開く

### 3. 投稿ボタン
- **アイコン**: `Plus` (lucide-react)
- **位置**: 右下
- **形状**: 大きな円形ボタン
- **処理**: 
  - ログイン済み: `setContributionOpen(true)` - 投稿画面を開く
  - 未ログイン: `setLoginRequiredOpen(true)` - ログイン要求ダイアログを表示

### 4. 現在地ボタン
- **アイコン**: `Locate` (lucide-react)
- **位置**: 右下（投稿ボタンの上）
- **処理**: 地図を現在地に移動

---

## バックエンドAPI連携時の注意点

### フィルター選択状態の送信
フィルターの選択状態をバックエンドに送信する場合、以下の形式を使用:

```typescript
interface FilterState {
  categories: string[];  // 被写体種別
  months: string[];      // 月（"1月", "2月", ...）
  times: string[];       // 時間帯（"朝", "昼", "夕方", "夜"）
  weather: string[];     // 天候（"晴れ", "曇り", "雨", "雪"）
}
```

### 写真データ構造
写真投稿・取得時のデータ構造例:

```typescript
interface Photo {
  id: string;
  imageUrl: string;
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  category: string;      // 被写体種別（CATEGORIES配列の値）
  capturedAt: string;    // ISO 8601形式
  month?: string;        // "1月" ~ "12��"
  timeOfDay?: string;    // "朝", "昼", "夕方", "夜"
  weather?: string;      // "晴れ", "曇り", "雨", "雪"
  likes: number;
  comments: Comment[];
}
```

---

## 状態管理の参照

主要な状態変数（App.tsxで管理）:

```typescript
// ダイアログの開閉状態
const [filterOpen, setFilterOpen] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [loginOpen, setLoginOpen] = useState(false);
const [signUpOpen, setSignUpOpen] = useState(false);
const [passwordResetOpen, setPasswordResetOpen] = useState(false);
const [profileOpen, setProfileOpen] = useState(false);
const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
const [photoDetailOpen, setPhotoDetailOpen] = useState(false);
const [lightboxOpen, setLightboxOpen] = useState(false);
const [contributionOpen, setContributionOpen] = useState(false);
const [loginRequiredOpen, setLoginRequiredOpen] = useState(false);

// 認証状態
const [isLoggedIn, setIsLoggedIn] = useState(false);

// 表示モード
const [showTerms, setShowTerms] = useState(false);
const [showPrivacy, setShowPrivacy] = useState(false);
const [showSplash, setShowSplash] = useState(true);
```

このマッピングを参考に、バックエンド実装時にフロントエンドの状態やボタン操作と連携してください。