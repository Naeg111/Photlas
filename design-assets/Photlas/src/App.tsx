import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { SplashScreen } from "./components/SplashScreen";
import { MapView } from "./components/MapView";
import { TopMenuPanel } from "./components/TopMenuPanel";
import { FilterPanel } from "./components/FilterPanel";
import { ProfileDialog } from "./components/ProfileDialog";
import { AccountSettingsDialog } from "./components/AccountSettingsDialog";
import { PhotoDetailDialog } from "./components/PhotoDetailDialog";
import { PhotoLightbox } from "./components/PhotoLightbox";
import { PhotoContributionDialog } from "./components/PhotoContributionDialog";
import { SignUpDialog } from "./components/SignUpDialog";
import { LoginDialog } from "./components/LoginDialog";
import { PasswordResetDialog } from "./components/PasswordResetDialog";
import { LoginRequiredDialog } from "./components/LoginRequiredDialog";
import { TermsOfServicePage } from "./components/TermsOfServicePage";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import { CategoryIcon } from "./components/CategoryIcon";
import { Button } from "./components/ui/button";
import { Menu, SlidersHorizontal, Plus } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";

const CATEGORIES = ["風景", "街並み", "植物", "動物", "自動車", "バイク", "鉄道", "飛行機", "食べ物", "ポートレート", "星空", "その他"];

const SAMPLE_PHOTOS = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1617634667039-8e4cb277ab46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYW5kc2NhcGUlMjBuYXR1cmV8ZW58MXx8fHwxNzYxODEwNjk0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    username: "yamada_taro",
    userAvatarUrl: "",
    date: "2025年10月15日",
    weather: "晴れ",
    category: "風景",
    timeOfDay: "朝",
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1617381519460-d87050ddeb92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXR5JTIwYXJjaGl0ZWN0dXJlfGVufDF8fHx8MTc2MTgwOTk1Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    username: "sato_hanako",
    userAvatarUrl: "",
    date: "2025年10月20日",
    weather: "曇り",
    category: "街並み",
    timeOfDay: "昼",
  },
  {
    id: "3",
    imageUrl: "https://images.unsplash.com/photo-1519414442781-fbd745c5b497?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMHN1bnNldHxlbnwxfHx8fDE3NjE4MjI4MDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    username: "suzuki_kenji",
    userAvatarUrl: "",
    date: "2025年10月25日",
    weather: "晴れ",
    category: "風景",
    timeOfDay: "夕方",
  },
];

const USER_PROFILE = {
  username: "yamada_taro",
  profileImageUrl: "",
  snsLinks: [
    { platform: "Twitter", url: "https://twitter.com/yamada_taro" },
    { platform: "Instagram", url: "https://instagram.com/yamada_taro" },
  ],
  photos: SAMPLE_PHOTOS.slice(0, 2),
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [photoDetailOpen, setPhotoDetailOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [loginRequiredOpen, setLoginRequiredOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<typeof SAMPLE_PHOTOS[0] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handlePhotoClick = (photo: any) => {
    const fullPhoto = SAMPLE_PHOTOS.find((p) => p.id === photo.id);
    if (fullPhoto) {
      setSelectedPhoto(fullPhoto);
      setPhotoDetailOpen(true);
    }
  };

  const handleUserClick = () => {
    setPhotoDetailOpen(false);
    setProfileOpen(true);
  };

  const handlePhotoImageClick = () => {
    setLightboxOpen(true);
  };

  const handleLogout = () => {
    console.log("Logging out...");
    setIsLoggedIn(false);
    setMenuOpen(false);
    toast("ログアウトしました");
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setLoginOpen(false);
    toast("ログインしました");
  };

  const handleSignUpSuccess = () => {
    setIsLoggedIn(true);
    setSignUpOpen(false);
    toast("アカウント登録が完了しました");
  };

  return (
    <>
      <AnimatePresence>
        {isLoading && <SplashScreen />}
      </AnimatePresence>

      {!isLoading && (
        <div className="relative w-full h-screen overflow-hidden">
          {/* Map View */}
          <MapView onPhotoClick={handlePhotoClick} />

          {/* Floating UI Elements */}
          <div className="absolute top-4 left-6 right-6 z-10 flex items-start justify-between gap-3">
            {/* Filter Button */}
            <Button
              variant="secondary"
              size="icon"
              className="shadow-lg w-18 h-10"
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </Button>

            {/* Menu Button */}
            <Button
              variant="secondary"
              size="icon"
              className="shadow-lg w-18 h-10"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          {/* Post Button */}
          <Button
            size="icon"
            className="absolute bottom-6 right-6 z-10 w-14 h-14 rounded-full shadow-lg"
            onClick={() => {
              if (!isLoggedIn) {
                setLoginRequiredOpen(true);
              } else {
                setContributionOpen(true);
              }
            }}
          >
            <Plus className="w-6 h-6" />
          </Button>

          {/* Top Menu Panel */}
          <TopMenuPanel
            open={menuOpen}
            onOpenChange={setMenuOpen}
            isLoggedIn={isLoggedIn}
            onMyPageClick={() => setProfileOpen(true)}
            onAccountSettingsClick={() => setAccountSettingsOpen(true)}
            onTermsClick={() => setTermsOpen(true)}
            onPrivacyClick={() => setPrivacyOpen(true)}
            onLoginClick={() => setLoginOpen(true)}
            onSignUpClick={() => setSignUpOpen(true)}
            onLogout={handleLogout}
          />

          {/* Filter Panel */}
          <FilterPanel open={filterOpen} onOpenChange={setFilterOpen} />

          {/* Profile Dialog */}
          <ProfileDialog
            open={profileOpen}
            onOpenChange={setProfileOpen}
            isOwnProfile={true}
            username={USER_PROFILE.username}
            profileImageUrl={USER_PROFILE.profileImageUrl}
            snsLinks={USER_PROFILE.snsLinks}
            photos={USER_PROFILE.photos}
            onPhotoClick={(photoId) => {
              const photo = SAMPLE_PHOTOS.find((p) => p.id === photoId);
              if (photo) {
                setSelectedPhoto(photo);
                setProfileOpen(false);
                setPhotoDetailOpen(true);
              }
            }}
          />

          {/* Account Settings Dialog */}
          <AccountSettingsDialog
            open={accountSettingsOpen}
            onOpenChange={setAccountSettingsOpen}
          />

          {/* Photo Detail Dialog */}
          {selectedPhoto && (
            <PhotoDetailDialog
              open={photoDetailOpen}
              onOpenChange={setPhotoDetailOpen}
              photo={selectedPhoto}
              onUserClick={handleUserClick}
              onPhotoClick={handlePhotoImageClick}
            />
          )}

          {/* Photo Lightbox */}
          {selectedPhoto && (
            <PhotoLightbox
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
              imageUrl={selectedPhoto.imageUrl}
            />
          )}

          {/* Photo Contribution Dialog */}
          <PhotoContributionDialog
            open={contributionOpen}
            onOpenChange={setContributionOpen}
          />

          {/* Auth Dialogs */}
          <LoginRequiredDialog
            open={loginRequiredOpen}
            onOpenChange={setLoginRequiredOpen}
            onShowLogin={() => setLoginOpen(true)}
            onShowSignUp={() => setSignUpOpen(true)}
          />
          <SignUpDialog
            open={signUpOpen}
            onOpenChange={setSignUpOpen}
            onShowTerms={() => setTermsOpen(true)}
            onSuccess={handleSignUpSuccess}
          />
          <LoginDialog
            open={loginOpen}
            onOpenChange={setLoginOpen}
            onShowSignUp={() => {
              setLoginOpen(false);
              setSignUpOpen(true);
            }}
            onShowPasswordReset={() => setPasswordResetOpen(true)}
            onSuccess={handleLoginSuccess}
          />
          <PasswordResetDialog
            open={passwordResetOpen}
            onOpenChange={setPasswordResetOpen}
          />

          {/* Terms and Privacy */}
          <TermsOfServicePage
            open={termsOpen}
            onOpenChange={setTermsOpen}
          />
          <PrivacyPolicyPage
            open={privacyOpen}
            onOpenChange={setPrivacyOpen}
          />
        </div>
      )}

      <Toaster />
    </>
  );
}