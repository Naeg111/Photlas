import { useState } from "react";
import { Dialog, DialogContent, DialogDescription } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Star, Flag, Calendar, Cloud, Tag } from "lucide-react";
import { Badge } from "./ui/badge";

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

  const handleFavoriteClick = () => {
    setIsFavorited(!isFavorited);
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
            onClick={(e) => {
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
            <Button variant="outline">
              <Flag className="w-5 h-5 mr-2" />
              報告
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}