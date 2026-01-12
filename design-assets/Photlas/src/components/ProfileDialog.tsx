import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Edit, Link as LinkIcon } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwnProfile: boolean;
  username: string;
  profileImageUrl?: string;
  snsLinks?: { platform: string; url: string }[];
  photos?: { id: string; thumbnailUrl: string }[];
  onPhotoClick?: (photoId: string) => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  isOwnProfile,
  username,
  profileImageUrl,
  snsLinks = [],
  photos = [],
  onPhotoClick,
}: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isOwnProfile ? "マイページ" : "プロフィール"}</DialogTitle>
          <DialogDescription className="sr-only">
            ユーザープロフィールと投稿写真
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* プロフィール画像エリア */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profileImageUrl} />
              <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <Button variant="outline" size="sm">
                画像を選択
              </Button>
            )}
          </div>

          {/* ユーザー名エリア */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <span>{username}</span>
            {isOwnProfile && (
              <Button variant="ghost" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                変更
              </Button>
            )}
          </div>

          {/* SNSリンクエリア */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3>SNSリンク</h3>
              {isOwnProfile && (
                <Button variant="outline" size="sm">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  追加
                </Button>
              )}
            </div>
            {snsLinks.length > 0 ? (
              <div className="space-y-2">
                {snsLinks.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="text-sm text-gray-500">{link.platform}</p>
                      <p className="text-sm">{link.url}</p>
                    </div>
                    {isOwnProfile && (
                      <Button variant="ghost" size="sm">
                        解除
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">リンクが設定されていません</p>
            )}
          </div>

          {/* 投稿写真一覧エリア */}
          <div className="space-y-3">
            <h3>投稿写真</h3>
            {photos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onPhotoClick?.(photo.id)}
                  >
                    <ImageWithFallback
                      src={photo.thumbnailUrl}
                      alt="投稿写真"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                投稿がありません
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
