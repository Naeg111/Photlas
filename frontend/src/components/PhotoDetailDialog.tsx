import { useState } from "react";
import { Dialog, DialogContent, DialogDescription } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Star, Flag, Calendar, Cloud, Tag } from "lucide-react";
import { Badge } from "./ui/badge";
import { ReportDialog } from "./ReportDialog";
import { toast } from "sonner";

interface PhotoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: {
    id: string;
    imageUrl: string;
    username: string;
    userAvatarUrl?: string;
    date: string;
    weather: string;
    category: string;
    timeOfDay?: string;
  };
  onUserClick: () => void;
  onPhotoClick: () => void;
}

export function PhotoDetailDialog({
  open,
  onOpenChange,
  photo,
  onUserClick,
  onPhotoClick,
}: PhotoDetailDialogProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const handleFavoriteClick = () => {
    setIsFavorited(!isFavorited);
  };

  const handleReportClick = () => {
    setIsReportDialogOpen(true);
  };

  const handleReportSubmit = async (data: {
    reason: string;
    details: string;
  }) => {
    setIsReportLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("ログインが必要です");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/photos/${photo.id}/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        toast.success("報告を受け付けました");
        setIsReportDialogOpen(false);
      } else if (response.status === 409) {
        toast.error("この写真はすでに報告済みです");
        setIsReportDialogOpen(false);
      } else {
        toast.error("報告の送信に失敗しました");
      }
    } catch (error) {
      console.error("Report error:", error);
      toast.error("報告の送信に失敗しました");
    } finally {
      setIsReportLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogDescription className="sr-only">
          写真の詳細情報と撮影コンテクスト
        </DialogDescription>
        <div className="space-y-4">
          {/* 投稿者情報ブロッ�� */}
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
            onClick={onUserClick}
          >
            <Avatar>
              <AvatarImage src={photo.userAvatarUrl} />
              <AvatarFallback>{photo.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{photo.username}</span>
          </div>

          {/* 写真表示エリア - Issue#15: 新しいタブでフルサイズ表示を開く */}
          <a
            href={`/photo-viewer/${photo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer block"
            onClick={() => {
              // onPhotoClick コールバックも実行（既存の互換性維持）
              if (onPhotoClick) {
                onPhotoClick()
              }
            }}
          >
            <ImageWithFallback
              src={photo.imageUrl}
              alt="投稿写真"
              className="w-full h-full object-cover"
            />
          </a>

          {/* 撮影コンテクスト情報ブロック */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{photo.date}</span>
            </div>
            {photo.timeOfDay && (
              <div className="flex items-center gap-2 text-sm">
                <span>🌅</span>
                <span>{photo.timeOfDay}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Cloud className="w-4 h-4" />
              <span>{photo.weather}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Tag className="w-4 h-4" />
              <Badge variant="secondary">{photo.category}</Badge>
            </div>
          </div>

          {/* 操作ボタンブロック */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className={`flex-1 ${
                isFavorited ? "bg-yellow-100 border-yellow-400" : ""
              }`}
              onClick={handleFavoriteClick}
            >
              <Star
                className={`w-5 h-5 mr-2 ${
                  isFavorited ? "fill-yellow-400 text-yellow-400" : ""
                }`}
              />
              お気に入り
            </Button>
            <Button variant="outline" onClick={handleReportClick}>
              <Flag className="w-5 h-5 mr-2" />
              報告
            </Button>
          </div>
        </div>
      </DialogContent>

      <ReportDialog
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
        onSubmit={handleReportSubmit}
        isLoading={isReportLoading}
      />
    </Dialog>
  );
}